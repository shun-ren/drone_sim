import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CityFlight, cityCoordinates, cityPosition, parseCoordinates, restoreCityFlight } from '../lib/city-flight.mjs';
import { PRESETS, FLOOR, settingsFor, Simulation, eulerFromQuaternion } from '../lib/sim.mjs';

test('restoring a pre-update session adds current methods and speeds without losing flight state', () => {
  const old = new CityFlight(PRESETS[0], parseCoordinates('60.1695,24.9355'));
  old.arm();
  for (let i = 0; i < 1000; i++) old.step({ forward: 1 });
  old.pause();
  delete old.flightSpeeds;
  Object.setPrototypeOf(old, Simulation.prototype); // Older live instance has no teleport API.
  assert.equal(typeof old.teleport, 'undefined');
  const before = structuredClone(old);
  const restored = restoreCityFlight(old, PRESETS[0]);
  assert.ok(restored instanceof CityFlight);
  assert.equal(restoreCityFlight(restored, PRESETS[0]), restored);
  for (const key of Object.keys(before)) assert.deepEqual(restored[key], before[key], key);
  assert.equal(restored.flightSpeeds.horizontal, 12);
  const point = cityCoordinates(restored.location, [100, 200]);
  assert.equal(restored.teleport(point), true);
  assert.equal(restored.undoTeleport(), true);
  assert.deepEqual(restored.p, before.p);
  restored.pause(); restored.step({ forward: 1 });
  assert.ok(restored.t > before.t);
  const changedAircraft = restoreCityFlight(restored, PRESETS[1], CITIES[1]);
  assert.equal(changedAircraft.status, 'ready');
  assert.equal(changedAircraft.location.id, CITIES[1].id);
});

test('teleport and undo preserve flight resources and settle at the requested position', () => {
  const city = new CityFlight(); city.arm();
  for (let i = 0; i < 1000; i++) city.step({ forward: 1, up: .2, yaw: .1 });
  city.pause();
  const before = { p: [...city.p], yaw: eulerFromQuaternion(city.q)[2], battery: city.battery, energy: city.energy, t: city.t, route: city.routeLength };
  const destination = cityCoordinates(city.location, [350, -400]);
  const roundTrip = cityPosition(city.location, destination);
  assert.ok(Math.abs(roundTrip[0] - 350) < 1e-7 && Math.abs(roundTrip[1] + 400) < 1e-7);
  assert.equal(city.teleport(destination), true);
  assert.deepEqual(city.v, [0, 0, 0]); assert.deepEqual(city.target, city.p);
  assert.equal(city.p[2], before.p[2]); assert.equal(city.paused, true);
  assert.ok(Math.abs(eulerFromQuaternion(city.q)[2] - before.yaw) < 1e-10);
  assert.equal(city.battery, before.battery); assert.equal(city.energy, before.energy);
  assert.equal(city.t, before.t); assert.equal(city.routeLength, before.route);
  const landedAt = [...city.p];
  for (const invalid of [[NaN, 0], [0, 90], cityCoordinates(city.location, [5100, 0])]) assert.equal(city.teleport(invalid), false);
  assert.deepEqual(city.p, landedAt);
  city.pause();
  for (let i = 0; i < 300; i++) city.step();
  assert.ok(Math.hypot(city.p[0] - landedAt[0], city.p[1] - landedAt[1]) < .01);
  assert.ok(Math.abs(city.p[2] - landedAt[2]) < .1);
  const batteryAfterFlight = city.battery;
  assert.equal(city.undoTeleport(), true); assert.deepEqual(city.p, before.p);
  assert.equal(city.battery, batteryAfterFlight); assert.equal(city.undoTeleport(), false);
  city.status = 'failed'; assert.equal(city.teleport(destination), false);
});

test('city cruise is faster, releases into hover, and leaves training speeds unchanged', () => {
  for (const config of PRESETS) {
    const fast = new CityFlight(config), normal = new CityFlight(config);
    normal.flightSpeeds = undefined;
    fast.arm(); normal.arm();
    for (let i = 0; i < 1200; i++) { fast.step({ forward: 1 }); normal.step({ forward: 1 }); }
    assert.equal(fast.status, 'active');
    assert.ok(fast.speed > normal.speed * 1.7, `${config.id}: ${fast.speed} vs ${normal.speed}`);
    assert.ok(Math.abs(fast.altitude - fast.location.altitude) < 1);
    for (let i = 0; i < 1500; i++) fast.step();
    assert.ok(fast.speed < .2, `${config.id} stops: ${fast.speed}`);
  }
  assert.equal(new Simulation().flightSpeeds, undefined);
});
test('city coordinates preserve ENU metre directions and reject invalid locations', () => {
  const origin={lng:0,lat:0};
  assert.deepEqual(cityCoordinates(origin,[0,0,80]),[0,0]);
  const [east,north]=cityCoordinates(origin,[111319.4908,111319.4908,0]);
  assert.ok(Math.abs(east-1)<1e-8 && Math.abs(north-1)<1e-8);
  for(const input of ['','1,','91,0','0,181','NaN,0','1,2,3']) assert.equal(parseCoordinates(input),null);
  assert.equal(parseCoordinates(' 1.2868, 103.8544 ').lng,103.8544);
});
test('city flight reuses aircraft physics while removing invisible training collisions', () => {
  const city=new CityFlight(PRESETS[0],CITIES[0]);
  assert.equal(city.arm(),true);
  const start=[...city.p];
  for(let i=0;i<500;i++)city.step({forward:1,up:1});
  assert.equal(city.status,'active');
  assert.ok(Math.hypot(city.p[0]-start[0],city.p[1]-start[1])>10);
  assert.ok(city.altitude>CITIES[0].altitude+8);
  assert.ok(city.battery<1 && city.energy>0 && city.power>0);
  assert.ok(Math.abs((1-city.battery)*city.aircraft.usableWh-city.energy)<1e-9);
  city.p=[10,40,10]; city.target=[...city.p];city.v=[0,0,0];city.step();
  assert.equal(city.status,'active'); // would collide with the Game inspection tower
  assert.equal(city.samples.length,0);
  city.pause();const before=JSON.stringify({p:city.p,t:city.t,battery:city.battery});
  city.step({forward:1});assert.equal(JSON.stringify({p:city.p,t:city.t,battery:city.battery}),before);
});
test('city and training worlds keep separate constraints and invalid aircraft protection', () => {
  const city=new CityFlight();city.arm();
  city.p=[6000,-6000,600];city.evaluate();assert.deepEqual(city.p,[5000,-5000,500+FLOOR]);
  city.status='active';city.land({vertical:.6,horizontal:0,tilt:0});assert.equal(city.status,'failed');
  const bad=new CityFlight({...PRESETS[0],battery:'4s'});assert.equal(bad.arm(),false);
  const game=new Simulation(PRESETS[0],settingsFor('hover'));game.arm();game.p=[0,0,70];game.status='active';
  for(let i=0;i<400;i++)game.step();assert.equal(game.status,'failed');
});
