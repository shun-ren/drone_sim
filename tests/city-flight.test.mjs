import test from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, CityFlight, cityCoordinates, parseCoordinates } from '../lib/city-flight.mjs';
import { PRESETS, FLOOR, settingsFor, Simulation } from '../lib/sim.mjs';
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
