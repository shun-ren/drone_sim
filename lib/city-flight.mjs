import { Simulation, PRESETS, settingsFor, FLOOR, clamp, quaternionFromEuler } from './sim.mjs';

export const CITIES = [
  { id: 'singapore', name: 'Singapore · Marina Bay', lng: 103.8544, lat: 1.2868, altitude: 70, heading: 25 },
  { id: 'san-francisco', name: 'San Francisco · Embarcadero', lng: -122.3940, lat: 37.7949, altitude: 80, heading: 240 },
  { id: 'new-york', name: 'New York · Lower Manhattan', lng: -74.0142, lat: 40.7046, altitude: 100, heading: 45 },
  { id: 'tokyo', name: 'Tokyo · Shinjuku', lng: 139.6917, lat: 35.6885, altitude: 80, heading: 90 },
];
const EARTH_RADIUS = 6378137;

// A local ENU position, in metres, anchored to a real geographic location.
// The flat city surface is an exploration view; it does not claim surveyed terrain or collisions.
export function cityCoordinates(origin, position) {
  return [origin.lng + position[0] / (EARTH_RADIUS * Math.cos(origin.lat * Math.PI / 180)) * 180 / Math.PI,
    origin.lat + position[1] / EARTH_RADIUS * 180 / Math.PI];
}
export function parseCoordinates(text) {
  const parts = text.trim().split(/\s*,\s*/);
  if (parts.length !== 2 || parts.some(p => !p.trim())) return null;
  const [lat, lng] = parts.map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 80 && Math.abs(lng) <= 180
    ? { id: 'custom', name: 'Custom location', lat, lng, altitude: 80, heading: 0 } : null;
}

// Same 100 Hz aircraft, controller, motor and energy model as Game. Only the
// training evaluator/recording are replaced: a city has no authored gates or pads.
export class CityFlight extends Simulation {
  constructor(config = PRESETS[0], location = CITIES[0]) {
    super(config, settingsFor('hover', { limit: 1800 }));
    this.location = { ...location };
    this.p = [0, 0, location.altitude + FLOOR];
    this.target = [...this.p];
    this.yawTarget = (90 - location.heading) * Math.PI / 180;
    this.q = quaternionFromEuler(0, 0, this.yawTarget);
    this.motors.fill(this.aircraft.hover || 0);
    this.grounded = false;
    this.reason = 'Ready to explore';
  }
  evaluate() {
    for (let i = 0; i < 3; i++) {
      const lo = i === 2 ? -Infinity : -5000, hi = i === 2 ? 500 + FLOOR : 5000;
      if (this.p[i] < lo || this.p[i] > hi) {
        this.p[i] = clamp(this.p[i], lo, hi);
        this.target[i] = this.p[i];
        this.v[i] = 0;
      }
    }
  }
  land(contact) {
    if (contact.vertical >= .5 || contact.horizontal >= .5 || contact.tilt >= 10) {
      this.fail('Hard landing. Reset your city flight to explore again.');
    } else {
      this.target = [...this.p];
      this.emit('landing', 'Landed on the map surface');
    }
  }
  // City exploration has no mission score/history. Bound transient input/event memory.
  record() {
    if (this.inputs.length > 1000) this.inputs.splice(0, 500);
    if (this.events.length > 1000) this.events.splice(0, 500);
  }
}
