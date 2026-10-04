import { Simulation, PRESETS, settingsFor, FLOOR, clamp, quaternionFromEuler, eulerFromQuaternion } from './sim.mjs';

export const CITIES = [
  { id: 'singapore', name: 'Singapore · Marina Bay', lng: 103.8544, lat: 1.2868, altitude: 70, heading: 25 },
  { id: 'san-francisco', name: 'San Francisco · Embarcadero', lng: -122.3940, lat: 37.7949, altitude: 80, heading: 240 },
  { id: 'new-york', name: 'New York · Lower Manhattan', lng: -74.0142, lat: 40.7046, altitude: 100, heading: 45 },
  { id: 'tokyo', name: 'Tokyo · Shinjuku', lng: 139.6917, lat: 35.6885, altitude: 80, heading: 90 },
];
const EARTH_RADIUS = 6378137;
export const CITY_RANGE = 5000;

// A local ENU position, in metres, anchored to a real geographic location.
// The flat city surface is an exploration view; it does not claim surveyed terrain or collisions.
export function cityCoordinates(origin, position) {
  return [origin.lng + position[0] / (EARTH_RADIUS * Math.cos(origin.lat * Math.PI / 180)) * 180 / Math.PI,
    origin.lat + position[1] / EARTH_RADIUS * 180 / Math.PI];
}
export function cityPosition(origin, coordinates) {
  const [lng, lat] = coordinates;
  // Pick the nearest copy of the world when browsing across the date line.
  const delta = ((lng - origin.lng + 180) % 360 + 360) % 360 - 180;
  return [delta * Math.PI / 180 * EARTH_RADIUS * Math.cos(origin.lat * Math.PI / 180),
    (lat - origin.lat) * Math.PI / 180 * EARTH_RADIUS];
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
    this.flightSpeeds = { horizontal: 12, vertical: 5, climb: 5, descent: 3.2 };
    this.p = [0, 0, location.altitude + FLOOR];
    this.target = [...this.p];
    this.yawTarget = (90 - location.heading) * Math.PI / 180;
    this.q = quaternionFromEuler(0, 0, this.yawTarget);
    this.motors.fill(this.aircraft.hover || 0);
    this.grounded = false;
    this.reason = 'Ready to explore';
  }
  canTeleport(coordinates) {
    if (!coordinates?.every(Number.isFinite) || coordinates.length !== 2 || Math.abs(coordinates[1]) > 80) return false;
    return !['failed', 'completed', 'incomplete'].includes(this.status)
      && cityPosition(this.location, coordinates).every(v => Math.abs(v) <= CITY_RANGE);
  }
  teleport(coordinates) {
    if (!this.canTeleport(coordinates)) return false;
    this.previousJump = [...this.p];
    this.setHoverPosition([...cityPosition(this.location, coordinates), this.p[2]]);
    return true;
  }
  undoTeleport() {
    if (!this.previousJump || ['failed', 'completed', 'incomplete'].includes(this.status)) return false;
    this.setHoverPosition(this.previousJump);
    this.previousJump = null;
    return true;
  }
  setHoverPosition(position) {
    const yaw = eulerFromQuaternion(this.q)[2];
    this.p = [...position]; this.target = [...position];
    this.v = [0, 0, 0]; this.omega = [0, 0, 0]; this.integral = [0, 0, 0];
    this.q = quaternionFromEuler(0, 0, yaw); this.yawTarget = yaw;
    this.lastMoving = false; this.lastVertical = false;
    this.input = { forward: 0, left: 0, up: 0, yaw: 0, throttle: 0 };
    this.grounded = this.p[2] <= FLOOR;
    this.motors.fill(this.grounded ? 0 : this.aircraft.hover || 0);
    this.commands = [...this.motors];
  }
  evaluate() {
    for (let i = 0; i < 3; i++) {
      const lo = i === 2 ? -Infinity : -CITY_RANGE, hi = i === 2 ? 500 + FLOOR : CITY_RANGE;
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

// React Fast Refresh retains the parent's session ref, including instances of
// the previous module's class. Rebuild that instance with current methods and
// defaults while preserving its flight state instead of resetting the flight.
export function restoreCityFlight(current, config = PRESETS[0], location = CITIES[0]) {
  if (!current || JSON.stringify(current.config) !== JSON.stringify(config)) return new CityFlight(config, location);
  if (current instanceof CityFlight) return current;
  const restored = new CityFlight(config, current.location || location);
  const flightSpeeds = restored.flightSpeeds;
  return Object.assign(restored, current, { flightSpeeds });
}
