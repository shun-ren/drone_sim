// DroneLab educational model. SI units, right handed Z-up, body X forward/Y left.
// No rendering imports: physics, evaluation and recording run identically in Node and browsers.
export const MODEL_VERSION = 'dronelab-1.0.0';
export const DT = 0.01;
export const G = 9.81;
export const FLOOR = 0.22;
export const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, v));
export const length = v => Math.hypot(...v);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const distance = (a,b) => length(sub(a,b));
const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0;
const rms = a => Math.sqrt(mean(a.map(v=>v*v)));
const median = a => { const b=[...a].sort((x,y)=>x-y); return b.length ? (b[Math.floor((b.length-1)/2)]+b[Math.floor(b.length/2)])/2 : 10; };
const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
export const FRAMES = [
 {id:'standard',name:'DL–450 Utility',mass:.75,arm:.26,maxPayload:1.5,maxProp:.32},
 {id:'light',name:'DL–420 Scout',mass:.55,arm:.24,maxPayload:.6,maxProp:.29},
 {id:'cargo',name:'DL–550 Cargo',mass:1.05,arm:.32,maxPayload:2.5,maxProp:.36},
];
export const PROPULSION = [
 {id:'utility',name:'Utility / 12-inch',mass:.48,maxThrust:12,power:270,prop:.3048,voltage:22.2,tau:.06,esc:20},
 {id:'scout',name:'Scout / 10-inch',mass:.36,maxThrust:9,power:215,prop:.254,voltage:22.2,tau:.045,esc:15},
 {id:'lift',name:'Lift / 13-inch',mass:.62,maxThrust:15,power:340,prop:.3302,voltage:22.2,tau:.075,esc:22},
];
export const BATTERIES = [
 {id:'standard',name:'6S / 4,000 mAh',mass:.42,voltage:22.2,ah:4,maxCurrent:60},
 {id:'endurance',name:'6S / 6,000 mAh',mass:.65,voltage:22.2,ah:6,maxCurrent:80},
 {id:'light',name:'6S / 3,000 mAh',mass:.32,voltage:22.2,ah:3,maxCurrent:55},
 {id:'4s',name:'4S / 4,000 mAh (incompatible)',mass:.3,voltage:14.8,ah:4,maxCurrent:50},
];
export const PRESETS = [
 {id:'baseline',version:1,name:'DL–450 Baseline',frame:'standard',propulsion:'utility',battery:'standard',controller:'balanced'},
 {id:'scout',version:1,name:'DL–420 Scout',frame:'light',propulsion:'scout',battery:'light',controller:'agile'},
 {id:'cargo',version:1,name:'DL–550 Carrier',frame:'cargo',propulsion:'lift',battery:'endurance',controller:'gentle'},
];
export const PROVENANCE = 'Synthetic educational curves, DroneLab v1.0: thrust = Tmax × command²; power per motor = Pmax × command³ + 2 × command. Not measured hardware. Fixed voltage; 80% usable nominal energy; 15% landing reserve. No battery sag, propwash or ground effect.';
export function estimate(config, payload=0){
 if(!Number.isFinite(payload)||payload<0)return {errors:['Payload must be a finite nonnegative mass.'],warnings:[],valid:false};
 const frame=FRAMES.find(x=>x.id===config.frame), prop=PROPULSION.find(x=>x.id===config.propulsion), battery=BATTERIES.find(x=>x.id===config.battery);
 if(!frame||!prop||!battery) return {errors:['Unknown catalogue component.'],warnings:[],valid:false};
 const emptyMass=frame.mass+prop.mass+battery.mass+.12, mass=emptyMass+payload, thrust=4*prop.maxThrust, hover=Math.sqrt(mass*G/thrust), power=8+4*(prop.power*hover**3+2*hover), usableWh=battery.voltage*battery.ah*.8;
 const errors=[],warnings=[],current=(8+4*(prop.power+2))/battery.voltage;
 if(battery.voltage!==prop.voltage) errors.push('Voltage mismatch: this propulsion package requires 6S / 22.2 V.');
 if(prop.prop>frame.maxProp||prop.prop>frame.arm*Math.SQRT2-.02) errors.push('Propeller clearance is insufficient on this frame.');
 if(payload>frame.maxPayload) errors.push('Payload exceeds the frame mounting limit.');
 if(current>battery.maxCurrent||((prop.power+2)/battery.voltage)>prop.esc) errors.push('Maximum current exceeds the battery or ESC limit.');
 if(hover>=1) errors.push('Available thrust cannot sustain hover.');
 if(thrust/(mass*G)<1.5) warnings.push('Small thrust reserve: reduced capacity for manoeuvres and gust recovery.');
 return {frame,prop,battery,emptyMass,mass,thrust,hover,power,usableWh,current,ratio:thrust/(mass*G),endurance:usableWh*.85/power*60,errors,warnings,valid:errors.length===0};
}
export const START=[-50,-35,FLOOR], DEST=[50,-35,FLOOR], FINISH=[82,0,FLOOR];
export const GATES=[[-35,0,5],[-20,8,6],[-5,12,8],[10,4,10],[25,-8,12],[40,-4,10],[55,8,8],[70,0,5]].map((p,i)=>({id:i+1,p,normal:[1,0,0],radius:2}));
export const OBSTACLES=[{id:'inspection tower',min:[5,35,0],max:[15,45,25]},{id:'warehouse',min:[-78,-57,0],max:[-60,-43,8]},{id:'service building',min:[43,37,0],max:[63,51,7]}];
export const TARGETS=[[5,38,6],[5,42,10],[5,38,14],[5,42,18],[5,40,20]].map((p,i)=>({id:'T'+(i+1),p}));
const scoreSpec=(labels,weights,good,poor,units)=>labels.map((label,i)=>({label,weight:weights[i],good:good[i],poor:poor[i],unit:units[i]}));
export const MISSIONS = [
 {id:'hover',name:'Hover test',subtitle:'Stability & precision',limit:120,wind:0,payload:0,steps:['Climb to 10 m','Hold for 10 seconds','Land on launch pad'],brief:'Hold within 1 m horizontally and 0.5 m vertically of the 10 m target for 10 consecutive seconds. Return to the launch pad and land gently.',scores:scoreSpec(['Horizontal RMS','Altitude RMS','Landing precision','Completion time'],[35,30,25,10],[.2,.1,.1,35],[1,.5,1,120],['m','m','m','s'])},
 {id:'obstacle',name:'Obstacle course',subtitle:'Agility & clearance',limit:180,wind:0,payload:0,steps:['Approach gate 1','Cross 8 gates in order','Land on finish pad'],brief:'Pass through eight 4 m gates in order, crossing from west to east. Keep every rotor clear of the frames, then land on the finish pad.',scores:scoreSpec(['Gate precision','Route RMS','Completion time','Landing precision'],[35,25,25,15],[.25,.5,60,.1],[1.5,3,180,1],['m','m','s','m'])},
 {id:'delivery',name:'Delivery',subtitle:'Payload & efficiency',limit:240,wind:2,payload:1,steps:['Carry 1 kg to the destination','Land and unload for 3 seconds','Return to the warehouse pad'],brief:'Carry 1 kg across 100 m in a 2 m/s crosswind. Land on the destination pad for 3 seconds to unload, then return with at least 15% battery.',scores:scoreSpec(['Energy fraction','Delivery accuracy','Completion time','Return accuracy'],[35,30,20,15],[.2,.1,90,.1],[.6,1,240,1],['fraction','m','s','m'])},
 {id:'inspection',name:'Inspection',subtitle:'Control & camera',limit:300,wind:2,payload:0,steps:['Approach the inspection tower','Capture 5 unique targets','Return and land'],brief:'Aim the sensor at each target from 3–5 m away. Hold below 0.5 m/s and within 15° for 2 seconds, then press F to capture. The sensor follows aircraft heading and your camera pitch.',scores:scoreSpec(['Camera alignment','Stand-off error','Capture stability','Completion time'],[35,30,20,15],[2,.1,.1,120],[15,1,.5,300],['°','m','m/s','s'])},
 {id:'wind',name:'Wind challenge',subtitle:'Disturbance & recovery',limit:180,wind:4,payload:0,steps:['Qualify with a 5 second hold','20 s calm + 60 s wind','Return and land'],brief:'Hold at 10 m through 20 seconds of calm and 60 seconds of seeded crosswind with three gusts. Recover from each gust, then land.',scores:scoreSpec(['Horizontal RMS','Altitude RMS','Gust recovery','Landing precision'],[40,25,25,10],[.5,.2,2,.1],[3,1,10,1],['m','m','s','m'])},
];
export function settingsFor(id, overrides={}){const m=MISSIONS.find(m=>m.id===id)||MISSIONS[0];return {mission:id,version:1,seed:42,initialBattery:1,payload:m.payload,wind:m.wind,limit:m.limit,hold:10,horizontal:1,vertical:.5,padRadius:1,passScore:70,scores:structuredClone(m.scores),...overrides};}
export function validateSettings(s){const errors=[];if(!MISSIONS.some(m=>m.id===s.mission))errors.push('Unknown mission.');for(const [key,lo,hi] of [['initialBattery',.01,1],['payload',0,10],['wind',0,12],['limit',1,1800],['hold',1,120],['horizontal',.1,10],['vertical',.1,5],['padRadius',.2,5],['passScore',0,100],['seed',0,4294967295]])if(!Number.isFinite(s[key])||s[key]<lo||s[key]>hi)errors.push(`${key} must be between ${lo} and ${hi}.`);if(s.mission==='delivery'&&s.payload!==1)errors.push('Delivery requires exactly 1 kg scenario payload.');if(!Array.isArray(s.scores)||s.scores.length!==4||s.scores.some(x=>!Number.isFinite(x.good)||!Number.isFinite(x.poor)||x.poor<=x.good||!Number.isFinite(x.weight)||x.weight<0)||Math.abs((s.scores||[]).reduce((n,x)=>n+x.weight,0)-100)>.001)errors.push('Four finite score thresholds are required; poor must exceed good and weights must sum to 100.');return errors;}
export function gustSchedule(seed){let n=seed>>>0;return [5,23,42].map((start,i)=>{n=(1664525*n+1013904223)>>>0;return {id:i+1,start,end:start+5,delta:(n/4294967296)*4-2};});}
export function quaternionFromEuler(r,p,y){const cr=Math.cos(r/2),sr=Math.sin(r/2),cp=Math.cos(p/2),sp=Math.sin(p/2),cy=Math.cos(y/2),sy=Math.sin(y/2);return [sr*cp*cy-cr*sp*sy,cr*sp*cy+sr*cp*sy,cr*cp*sy-sr*sp*cy,cr*cp*cy+sr*sp*sy];}
export function eulerFromQuaternion([x,y,z,w]){return [Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y)),Math.asin(clamp(2*(w*y-z*x),-1,1)),Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))];}
export function rotate([x,y,z,w],v){const t=[2*(y*v[2]-z*v[1]),2*(z*v[0]-x*v[2]),2*(x*v[1]-y*v[0])];return [v[0]+w*t[0]+y*t[2]-z*t[1],v[1]+w*t[1]+z*t[0]-x*t[2],v[2]+w*t[2]+x*t[1]-y*t[0]];}
function quaternionError(q,d){const [x,y,z,w]=q, [a,b,c,k]=d;const e=[w*a-x*k-y*c+z*b,w*b+x*c-y*k-z*a,w*c-x*b+y*a-z*k,w*k+x*a+y*b+z*c];return e.slice(0,3).map(v=>2*v*(e[3]<0?-1:1));}
export function pointBoxDistance(p,b){return Math.hypot(...p.map((v,i)=>Math.max(b.min[i]-v,0,v-b.max[i])));}
export function segmentBox(a,b,box,padding=0){let lo=0,hi=1;for(let i=0;i<3;i++){const d=b[i]-a[i],mn=box.min[i]-padding,mx=box.max[i]+padding;if(Math.abs(d)<1e-9){if(a[i]<mn||a[i]>mx)return false;}else{let l=(mn-a[i])/d,h=(mx-a[i])/d;if(l>h)[l,h]=[h,l];lo=Math.max(lo,l);hi=Math.min(hi,h);if(lo>hi)return false;}}return hi>=0&&lo<.999;}
function segmentDistance(p,a,b){const ab=sub(b,a),ap=sub(p,a),d=ab.reduce((s,v)=>s+v*v,0);const f=clamp(ap.reduce((s,v,i)=>s+v*ab[i],0)/(d||1));return distance(p,a.map((v,i)=>v+ab[i]*f));}
export function gateCrossing(a,b,gate,radius){const before=a[0]-gate.p[0],after=b[0]-gate.p[0];if(before*after>0||before===after)return null;const f=-before/(after-before),p=a.map((v,i)=>v+(b[i]-v)*f),radial=Math.hypot(p[1]-gate.p[1],p[2]-gate.p[2]);return {radial,forward:before<0&&after>=0,valid:radial+radius<=gate.radius,frame:radial+radius>=gate.radius&&radial-radius<=gate.radius+.15};}
export function gateFrameContact(a,b,gate,radius){if(Math.min(a[0],b[0])>gate.p[0]+radius+.1||Math.max(a[0],b[0])<gate.p[0]-radius-.1)return false;const steps=Math.max(1,Math.ceil(distance(a,b)/.08));for(let j=0;j<=steps;j++){const p=a.map((v,i)=>v+(b[i]-v)*j/steps),radial=Math.hypot(p[1]-gate.p[1],p[2]-gate.p[2]);if(Math.hypot(p[0]-gate.p[0],radial-(gate.radius+.08))<=radius+.08)return true;}return false;}
export class Simulation {
 constructor(config=PRESETS[0],settings=settingsFor('hover'),options={}){
  this.config=structuredClone(config);this.settings=structuredClone(settings);this.spec=MISSIONS.find(m=>m.id===settings.mission)||MISSIONS[0];this.options=options;this.createdAt=new Date().toISOString();this.routeInterval=null;
  this.payload=settings.payload;this.aircraft=estimate(config,this.payload);this.id=options.id||globalThis.crypto?.randomUUID?.()||'run-'+Date.now();
  this.t=0;this.tick=0;this.elapsed=0;this.liftoff=null;this.p=[...START];this.v=[0,0,0];this.q=[0,0,0,1];this.omega=[0,0,0];this.motors=[0,0,0,0];this.commands=[0,0,0,0];this.thrusts=[0,0,0,0];this.power=0;this.energy=0;this.battery=settings.initialBattery;this.armed=false;this.paused=false;this.grounded=true;
  this.status='ready';this.reason='Ready to arm';this.mode='game';this.camera='chase';this.control=options.control||'assisted';this.guided=!!options.guided;this.sensorPitch=0;this.yawTarget=0;
  this.target=[...START];this.input={forward:0,left:0,up:0,yaw:0,throttle:0};this.wind=[0,0,0];this.integral=[0,0,0];this.hold=0;this.phase='takeoff';this.phaseStart=0;this.holdStart=null;this.holdInterval=null;this.windInterval=null;this.calmInterval=null;
  this.gate=0;this.gateErrors=[];this.routeErrors=[];this.captureStates=TARGETS.map(()=>({dwell:0,speeds:[]}));this.captures=[];this.captureHint='Approach a target and aim the sensor';this.deliveryDwell=0;this.delivered=false;this.deliveryError=null;this.landingError=null;
  this.boundaryTime=0;this.nearTime=0;this.horizontalExcursion=0;this.verticalExcursion=0;this.gusts=gustSchedule(settings.seed).map(g=>({...g,started:false,ended:false,recovered:false,recovery:null,dwell:0}));
  this.events=[];this.samples=[];this.inputs=[];this.routeLength=0;this.lastSampleEnergy=0;this.saturated=false;this.warnedBattery=false;this.demoStage=0;this.demoWait=0;this.maxDrift=0;
  this.emit('ready','Aircraft validated',{valid:this.aircraft.valid});
 }
 emit(type,message,data={}){this.events.push({t:this.t,missionTime:this.elapsed,type,message,...data});}
 arm(){const errors=validateSettings(this.settings);if(this.status!=='ready'||!this.aircraft.valid||errors.length){this.reason=[...this.aircraft.errors,...errors].join(' ')||'Aircraft cannot arm in this state';return false;}this.armed=true;this.status='armed';this.reason='Armed — raise throttle to take off';this.emit('armed',this.reason);return true;}
 switchMode(mode){if(!['game','simulator'].includes(mode)||this.mode===mode)return;this.mode=mode;if(!['completed','failed','incomplete'].includes(this.status))this.emit('presentation','Presentation changed to '+mode,{mode});}
 setCamera(camera){if(['chase','fpv','ground'].includes(camera))this.camera=camera;}
 pause(){if(['armed','active'].includes(this.status)){this.paused=!this.paused;this.emit('pause',this.paused?'Paused':'Resumed');}}
 abort(){if(!['completed','failed','incomplete'].includes(this.status)){this.status='incomplete';this.reason='Flight ended by pilot';this.armed=false;this.emit('abort',this.reason);}}
 fail(reason){if(['completed','failed','incomplete'].includes(this.status))return;this.status='failed';this.reason=reason;this.armed=false;this.emit('failure',reason);}
 get mass(){return this.aircraft.emptyMass+this.payload;}
 get speed(){return length(this.v);}
 get altitude(){return this.p[2]-FLOOR;}
 get hoverTarget(){return [START[0],START[1],10+FLOOR];}
 get error(){return {h:Math.hypot(this.p[0]-START[0],this.p[1]-START[1]),z:Math.abs(this.p[2]-this.hoverTarget[2])};}
 get progress(){if(this.spec.id==='hover')return this.phase==='land'?1:this.hold/this.settings.hold;if(this.spec.id==='obstacle')return this.gate/8;if(this.spec.id==='delivery')return this.delivered?.7:clamp(this.deliveryDwell/3)*.6;if(this.spec.id==='inspection')return this.captures.length/5;if(this.spec.id==='wind')return this.phase==='land'?1:this.phase==='wind'?.25+.75*clamp((this.t-this.phaseStart)/60):this.phase==='calm'?.25*clamp((this.t-this.phaseStart)/20):0;return 0;}
 get objective(){switch(this.spec.id){case 'hover':return this.phase==='land'?'Hold complete. Return and land gently.':`Climb to 10 m · hold ${this.hold.toFixed(1)} / ${this.settings.hold} s`;case 'obstacle':return this.gate<8?`Gate ${this.gate+1} of 8 · cross west to east`:'All gates clear. Land on the finish pad.';case 'delivery':return this.delivered?'Payload delivered. Return to the warehouse pad.':this.grounded&&this.deliveryDwell>0?`Unloading · ${this.deliveryDwell.toFixed(1)} / 3 s`:'Fly 100 m to the destination pad and land.';case 'inspection':return this.captures.length===5?'All captures saved. Return to the launch pad.':`${this.captures.length} / 5 targets captured · ${this.captureHint}`;case 'wind':return this.phase==='land'?'Wind test complete. Return and land.':this.phase==='calm'?`Calm phase · ${(this.t-this.phaseStart).toFixed(0)} / 20 s`:this.phase==='wind'?`Wind phase · ${(this.t-this.phaseStart).toFixed(0)} / 60 s`:`Qualify at 10 m · ${this.hold.toFixed(1)} / 5 s`;default:return '';}}
 waypoint(){const id=this.spec.id;if(id==='hover'||id==='wind')return this.phase==='land'?[...START]:this.hoverTarget;if(id==='obstacle')return this.gate<8?GATES[this.gate].p:FINISH;if(id==='delivery')return this.delivered?START:DEST;if(id==='inspection'){const next=TARGETS.find(t=>!this.captures.some(c=>c.id===t.id));return next?[next.p[0]-4,next.p[1],next.p[2]]:START;}return START;}
 updateDemo(){
  const id=this.spec.id,close=(p,d=.25)=>distance(this.p,p)<d&&this.speed<.35;
  const move=p=>{this.target=[...p];};
  this.yawTarget=0;
  if(id==='hover'||id==='wind'){move(this.phase==='land'?[START[0],START[1],FLOOR-.3]:this.hoverTarget);return;}
  if(id==='delivery'){
   const base=this.delivered?DEST:START,dest=this.delivered?START:DEST;
   if(this.demoStage===0){move([base[0],base[1],10]);if(close(this.target))this.demoStage=1;}
   else if(this.demoStage===1){move([dest[0],dest[1],10]);if(close(this.target))this.demoStage=2;}
   else move([dest[0],dest[1],FLOOR-.3]);
   return;
  }
  if(id==='obstacle'){
   if(this.gate<8){const g=GATES[this.gate].p;
    if(this.demoStage===0){move([g[0]-5,g[1],g[2]]);if(close(this.target))this.demoStage=1;}
    else move([g[0]+3,g[1],g[2]]);
   }else if(this.demoStage===0){move([FINISH[0],FINISH[1],5]);if(close(this.target))this.demoStage=1;}else move([FINISH[0],FINISH[1],FLOOR-.3]);
   return;
  }
  if(id==='inspection'){
   const next=TARGETS.find(t=>!this.captures.some(c=>c.id===t.id));this.sensorPitch=0;
   if(next){if(this.demoStage===0){move([START[0],START[1],23]);if(close(this.target))this.demoStage=1;}else if(this.demoStage===1){move([1,38,23]);if(close(this.target))this.demoStage=2;}else {move([next.p[0]-4,next.p[1],next.p[2]]);const i=TARGETS.indexOf(next);if(this.captureStates[i].dwell>=2)this.capture();}}
   else if(this.demoStage===2){move([1,40,23]);if(close(this.target))this.demoStage=3;}else if(this.demoStage===3){move([START[0],START[1],23]);if(close(this.target))this.demoStage=4;}else move([START[0],START[1],FLOOR-.3]);
  }
 }
 updateWind(){
  let y=this.spec.id==='wind'?0:this.settings.wind;
  if(this.spec.id==='wind'&&this.phase==='wind'){
   y=this.settings.wind;const t=this.t-this.phaseStart;
   for(const g of this.gusts){if(t>=g.start&&!g.started){g.started=true;g.startT=this.t;this.emit('gust_start',`Gust ${g.id} started`,{gustId:g.id,delta:g.delta});}if(t>=g.end&&!g.ended){g.ended=true;g.endT=this.t;this.emit('gust_end',`Gust ${g.id} ended`,{gustId:g.id});}if(t>=g.start&&t<g.end)y+=g.delta;
    if(g.ended&&!g.recovered){if(this.error.h<1){g.validSince??=this.t;g.dwell=this.t-g.validSince;}else{g.validSince=null;g.dwell=0;}if(g.dwell>=2-1e-8){g.recovered=true;g.recovery=Math.min(10,this.t-g.endT);this.emit('gust_recovery',`Gust ${g.id} recovered`,{gustId:g.id,recovery:g.recovery,start:g.endT,end:this.t});}else if(this.t-g.endT>=10){g.recovered=true;g.recovery=10;g.unresolved=true;this.emit('gust_unresolved',`Gust ${g.id} did not recover in 10 s`,{gustId:g.id,start:g.endT,end:this.t});}}
   }
  }
  this.wind=[0,y,0];
 }
 step(input={}){
  if(this.paused||!this.armed||['completed','failed','incomplete'].includes(this.status))return;
  this.input={forward:0,left:0,up:0,yaw:0,throttle:0,...input};
  const inputState={...this.input,sensorPitch:this.sensorPitch};if(JSON.stringify(this.lastInput)!==JSON.stringify(inputState)){this.inputs.push({tick:this.tick+1,...inputState});this.lastInput=inputState;}
  if(this.guided)this.updateDemo();
  this.tick++;this.t=this.tick*DT;if(this.liftoff!==null)this.elapsed=this.t-this.liftoff;
  this.updateWind();
  const prev=[...this.p],wasGrounded=this.grounded, [roll,pitch,yaw]=eulerFromQuaternion(this.q),m=this.mass,ac=this.aircraft;
  const gain=this.config.controller==='agile'?1.6:this.config.controller==='gentle'?1:1.3;
  const speeds=this.flightSpeeds||{horizontal:5,vertical:2.5,climb:2.8,descent:1.6};
  if(!this.guided){
   const f=this.input.forward,l=this.input.left;this.yawTarget=wrap(this.yawTarget+this.input.yaw*DT*.9);
   const vx=(Math.cos(yaw)*f-Math.sin(yaw)*l)*speeds.horizontal,vy=(Math.sin(yaw)*f+Math.cos(yaw)*l)*speeds.horizontal;
   if(f||l){this.target[0]=this.p[0]+vx/gain;this.target[1]=this.p[1]+vy/gain;}else if(this.lastMoving){this.target[0]=this.p[0];this.target[1]=this.p[1];}
   this.lastMoving=!!(f||l);
   if(this.input.up){this.target[2]=this.p[2]+this.input.up*speeds.vertical/gain;this.target[2]=Math.max(FLOOR-.3,this.target[2]);}else if(this.lastVertical)this.target[2]=this.p[2];
   this.lastVertical=!!this.input.up;
  }
  const desiredVelocity=this.target.map((v,i)=>clamp((v-this.p[i])*gain,i===2?-speeds.descent:-speeds.horizontal,i===2?speeds.climb:speeds.horizontal));
  if(this.p[2]<1.5&&desiredVelocity[2]<0)desiredVelocity[2]=Math.max(desiredVelocity[2],-.28);
  const acceleration=desiredVelocity.map((v,i)=>{const error=v-this.v[i];if(this.motors.every(u=>u<.95)&&!this.grounded)this.integral[i]=clamp(this.integral[i]+error*DT*.18,-2,2);return clamp(2.4*error+this.integral[i],i===2?-4:-5,i===2?4:5);});
  let pitchTarget=clamp((Math.cos(yaw)*acceleration[0]+Math.sin(yaw)*acceleration[1])/G,-.45,.45),rollTarget=clamp((Math.sin(yaw)*acceleration[0]-Math.cos(yaw)*acceleration[1])/G,-.45,.45);
  let total=m*(G+acceleration[2])/Math.max(.5,Math.cos(roll)*Math.cos(pitch));
  if(this.control==='attitude'&&!this.guided){rollTarget=-this.input.left*.42;pitchTarget=this.input.forward*.42;total=4*ac.prop.maxThrust*clamp(ac.hover+this.input.up*.25+this.input.throttle,0,1)**2;}
  if(this.grounded&&!this.guided&&this.input.up<=0){total=0;this.integral=[0,0,0];}
  const qDesired=quaternionFromEuler(rollTarget,pitchTarget,this.yawTarget),err=quaternionError(this.q,qDesired),arm=ac.frame.arm/Math.SQRT2;
  const inertia=[.018+m*ac.frame.arm**2*.32+this.payload*.07**2,.018+m*ac.frame.arm**2*.32+this.payload*.07**2,.025+m*ac.frame.arm**2*.6];
  const torque=err.map((e,i)=>inertia[i]*(32*e-10*this.omega[i]));
  const xs=[1,1,-1,-1],ys=[1,-1,-1,1],spins=[1,-1,1,-1];
  const differential=xs.map((x,i)=>ys[i]*torque[0]/(4*arm)-x*torque[1]/(4*arm)+spins[i]*torque[2]/(.018*4));
  total=clamp(total,0,4*ac.prop.maxThrust);const base=total/4;
  let scale=1;for(const d of differential)if(d>0)scale=Math.min(scale,(ac.prop.maxThrust-base)/d);else if(d<0)scale=Math.min(scale,-base/d);
  this.commands=differential.map(d=>Math.sqrt(clamp((base+d*scale)/ac.prop.maxThrust)));
  const response=1-Math.exp(-DT/ac.prop.tau);this.motors=this.motors.map((u,i)=>u+(this.commands[i]-u)*response);
  this.thrusts=this.motors.map(u=>ac.prop.maxThrust*u*u);const thrust=this.thrusts.reduce((a,b)=>a+b,0),force=rotate(this.q,[0,0,thrust]);
  const relative=sub(this.v,this.wind),airspeed=length(relative),drag=.055*airspeed;
  for(let i=0;i<3;i++){this.v[i]+=(force[i]/m-(i===2?G:0)-drag*relative[i]/m)*DT;this.p[i]+=this.v[i]*DT;}
  const actualTorque=[this.thrusts.reduce((s,t,i)=>s+ys[i]*arm*t,0),this.thrusts.reduce((s,t,i)=>s-xs[i]*arm*t,0),this.thrusts.reduce((s,t,i)=>s+spins[i]*.018*t,0)];
  const w=this.omega,cross=[(inertia[2]-inertia[1])*w[1]*w[2],(inertia[0]-inertia[2])*w[2]*w[0],(inertia[1]-inertia[0])*w[0]*w[1]];
  this.omega=w.map((v,i)=>v+(actualTorque[i]-cross[i]-.015*v)/inertia[i]*DT);
  const [qx,qy,qz,qw]=this.q,[wx,wy,wz]=this.omega;
  const nq=[qx+.5*(qw*wx+qy*wz-qz*wy)*DT,qy+.5*(qw*wy+qz*wx-qx*wz)*DT,qz+.5*(qw*wz+qx*wy-qy*wx)*DT,qw-.5*(qx*wx+qy*wy+qz*wz)*DT],norm=length(nq);this.q=nq.map(v=>v/norm);
  this.power=8+this.motors.reduce((s,u)=>s+ac.prop.power*u**3+2*u,0);this.energy+=this.power*DT/3600;this.battery=Math.max(0,this.settings.initialBattery-this.energy/ac.usableWh);
  const saturated=this.commands.some(v=>v>=.995);if(saturated!==this.saturated){this.emit(saturated?'saturation_start':'saturation_end',saturated?'Motor command at upper limit':'Motor command left upper limit');this.saturated=saturated;}
  if(this.battery<.2&&!this.warnedBattery){this.warnedBattery=true;this.emit('battery_warning','Usable battery below 20%');}
  if(this.battery<=0)this.fail('Battery usable energy exhausted');
  if(this.liftoff!==null&&this.elapsed>this.settings.limit)this.fail('Mission time limit exceeded');
  if(this.p[2]>FLOOR+.05&&this.liftoff===null&&this.status==='armed'){this.liftoff=this.t;this.status='active';this.reason='Mission active';this.emit('takeoff','Takeoff — mission timer started');}
  this.grounded=this.p[2]<=FLOOR;
  if(this.status==='active')this.evaluate(prev);
  if(this.grounded){const contact={vertical:Math.abs(this.v[2]),horizontal:Math.hypot(this.v[0],this.v[1]),tilt:Math.acos(clamp(rotate(this.q,[0,0,1])[2],-1,1))*180/Math.PI};this.p[2]=FLOOR;
   if(!wasGrounded&&this.liftoff!==null&&this.status==='active')this.land(contact);
   this.v=[0,0,0];this.omega=[0,0,0];this.q=quaternionFromEuler(0,0,yaw);
  }
  this.routeLength+=distance(prev,this.p);
  if(this.tick%2===0||['completed','failed'].includes(this.status))this.record();
 }
 validPad(pad){return Math.hypot(this.p[0]-pad[0],this.p[1]-pad[1])<=this.settings.padRadius;}
 land(contact){
  if(this.status!=='active')return;
  const pads=[START,DEST,FINISH],pad=pads.find(p=>this.validPad(p));
  if(!pad||contact.vertical>=.5||contact.horizontal>=.5||contact.tilt>=10){this.fail(!pad?'Ground impact outside a landing pad':`Hard landing: vertical ${contact.vertical.toFixed(2)} m/s, horizontal ${contact.horizontal.toFixed(2)} m/s, tilt ${contact.tilt.toFixed(1)}°`);return;}
  this.landingError=Math.hypot(this.p[0]-pad[0],this.p[1]-pad[1]);this.emit('landing','Controlled landing',{pad:pad===START?'launch':pad===DEST?'destination':'finish',error:this.landingError,...contact});
  const id=this.spec.id;
  if(id==='delivery'&&pad===DEST&&!this.delivered){this.deliveryError=this.landingError;return;}
  if(id==='delivery'&&this.delivered&&pad===START){if(this.battery<.15)this.fail('Return reserve below 15%');else this.complete();return;}
  if((id==='hover'||id==='wind')&&this.phase==='land'&&pad===START)this.complete();
  if(id==='obstacle'&&this.gate===8&&pad===FINISH)this.complete();
  if(id==='inspection'&&this.captures.length===5&&pad===START)this.complete();
 }
 evaluate(prev){
  const p=this.p,id=this.spec.id;
  if(Math.abs(p[0])>100||Math.abs(p[1])>100||this.altitude>40){this.boundarySince??=this.t;this.boundaryTime=this.t-this.boundarySince;}else{this.boundarySince=null;this.boundaryTime=0;}
  if(this.boundaryTime>=3-1e-8){this.fail('Outside flight boundary for 3 continuous seconds');return;}
  if(this.elapsed>this.settings.limit){this.fail('Mission time limit exceeded');return;}
  const radius=this.aircraft.frame.arm+this.aircraft.prop.prop/2;
  for(const b of OBSTACLES)if(segmentBox(prev,p,b,radius)){this.fail('Structural impact: '+b.id);return;}
  for(const g of GATES)if(gateFrameContact(prev,p,g,radius)){this.fail('Gate frame impact at gate '+g.id);return;}
  if(id==='hover'||id==='wind'){
   const e=this.error;this.maxDrift=Math.max(this.maxDrift,e.h);
   if(this.phase==='takeoff'){
    if(e.h<=this.settings.horizontal&&e.z<=this.settings.vertical){this.holdStart??=this.t;this.hold=this.t-this.holdStart;}
    else {if(this.hold>0)this.emit('hold_reset',e.h>this.settings.horizontal?'Hold interrupted by horizontal drift':'Hold interrupted by altitude error',{start:this.holdStart,end:this.t});this.hold=0;this.holdStart=null;}
    const required=id==='hover'?this.settings.hold:5;
    if(this.hold>=required-1e-8){this.holdInterval=[this.holdStart,this.t];this.phase=id==='hover'?'land':'calm';this.phaseStart=this.t;this.emit('task',id==='hover'?'10 second hover hold complete':'Calm phase started',{start:this.holdStart,end:this.t});}
   }
   if(id==='wind'){
    if(this.phase==='calm'&&this.t-this.phaseStart>=20-1e-8){this.calmInterval=[this.phaseStart,this.t];this.phase='wind';this.phaseStart=this.t;this.emit('task','Wind phase started');}
    if(this.phase==='wind'){
     if(e.h>=5){this.horizontalSince??=this.t;this.horizontalExcursion=this.t-this.horizontalSince;}else{this.horizontalSince=null;this.horizontalExcursion=0;}if(e.z>=2){this.verticalSince??=this.t;this.verticalExcursion=this.t-this.verticalSince;}else{this.verticalSince=null;this.verticalExcursion=0;}
     if(this.horizontalExcursion>=3-1e-8||this.verticalExcursion>=3-1e-8){this.fail('Wind excursion limit sustained for 3 seconds');return;}
     if(this.t-this.phaseStart>=60-1e-8){this.windInterval=[this.phaseStart,this.t];this.phase='land';this.emit('task','Wind phase complete');}
    }
   }
  }
  if(id==='obstacle'&&this.gate<8){
   const route=GATES.flatMap(g=>[[g.p[0]-5,g.p[1],g.p[2]],g.p,[g.p[0]+3,g.p[1],g.p[2]]]);if(!this.routeInterval&&distance(p,GATES[0].p)<8)this.routeInterval=[this.t,this.t];if(this.routeInterval){this.routeInterval[1]=this.t;this.routeErrors.push(Math.min(...route.slice(1).map((b,i)=>segmentDistance(p,route[i],b))));}
   const cross=gateCrossing(prev,p,GATES[this.gate],radius);
   if(cross?.valid&&cross.forward){this.gateErrors.push(cross.radial);this.gate++;this.demoStage=0;this.emit('gate',`Gate ${this.gate} cleared`,{gate:this.gate,error:cross.radial});}
  }
  if(id==='delivery'&&!this.delivered){
   if(this.grounded&&this.validPad(DEST)&&this.deliveryError!==null){this.deliverySince??=this.t;this.deliveryDwell=this.t-this.deliverySince;}else{this.deliverySince=null;this.deliveryDwell=0;}
   if(this.deliveryDwell>=3-1e-8){const oldMass=this.mass;this.payload=0;this.aircraft=estimate(this.config,0);this.delivered=true;this.demoStage=0;this.integral=[0,0,0];this.emit('payload_release','1 kg payload delivered',{oldMass,newMass:this.mass,removedKg:this.settings.payload});}
  }
  if(id==='inspection'){
   if(pointBoxDistance(p,OBSTACLES[0])<2){this.nearSince??=this.t;this.nearTime=this.t-this.nearSince;}else{this.nearSince=null;this.nearTime=0;}
   if(this.nearTime>=2-1e-8){this.fail('Inside 2 m inspection clearance for 2 seconds');return;}
   let nearest={range:Infinity,reason:''};
   TARGETS.forEach((t,i)=>{const result=this.captureGeometry(t);const state=this.captureStates[i];if(result.valid&&!this.captures.some(c=>c.id===t.id)){state.since??=this.t;state.dwell=this.t-state.since;state.speeds.push(this.speed);}else{state.since=null;state.dwell=0;state.speeds=[];}if(result.range<nearest.range&&!this.captures.some(c=>c.id===t.id)){nearest={range:result.range,reason:result.valid?`${t.id}: hold ${state.dwell.toFixed(1)} / 2 s${state.dwell>=2?' · press F':''}`:t.id+': '+result.reason};}});
   this.captureHint=nearest.reason||'All targets captured';
  }
 }
 captureGeometry(target){
  const origin=this.p,dir=rotate(this.q,[Math.cos(this.sensorPitch),0,Math.sin(this.sensorPitch)]),delta=sub(target.p,origin),range=length(delta),angle=Math.acos(clamp(delta.reduce((s,v,i)=>s+v*dir[i],0)/(range||1),-1,1))*180/Math.PI;
  const occluded=OBSTACLES.some(b=>segmentBox(origin,target.p,b));
  const reason=occluded?'Line of sight obstructed':range<3||range>5?'Keep sensor 3–5 m from target':angle>15?'Aim within 15°':this.speed>=.5?'Slow below 0.5 m/s':'';
  return {range,angle,occluded,valid:!reason,reason};
 }
 capture(){
  if(this.spec.id!=='inspection'||this.status!=='active'||this.paused)return {ok:false,reason:'No active inspection'};
  for(let i=0;i<TARGETS.length;i++){const target=TARGETS[i],g=this.captureGeometry(target),state=this.captureStates[i];if(g.valid&&state.dwell>=2-1e-8&&!this.captures.some(c=>c.id===target.id)){const capture={id:target.id,t:this.t,p:[...this.p],q:[...this.q],pitch:this.sensorPitch,angle:g.angle,range:g.range,speed:mean(state.speeds),start:this.t-state.dwell,end:this.t};this.captures.push(capture);this.emit('capture','Accepted capture '+target.id,capture);return {ok:true,capture};}}
  this.emit('capture_rejected',this.captureHint||'Hold all capture conditions for 2 seconds');return {ok:false,reason:this.captureHint};
 }
 complete(){if(this.status!=='active')return;const score=this.score().total;if(!Number.isFinite(score)||score<this.settings.passScore){this.fail(`Objectives finished, but score ${score.toFixed(1)} is below ${this.settings.passScore}`);return;}this.status='completed';this.reason='All objectives completed with a controlled landing';this.armed=false;this.emit('complete',this.reason,{score});}
 record(){const [roll,pitch,yaw]=eulerFromQuaternion(this.q).map(v=>v*180/Math.PI),sample={t:this.t,mission_s:this.elapsed,x:this.p[0],y:this.p[1],z:this.p[2],altitude:this.altitude,qx:this.q[0],qy:this.q[1],qz:this.q[2],qw:this.q[3],roll_deg:roll,pitch_deg:pitch,yaw_deg:yaw,vx:this.v[0],vy:this.v[1],vz:this.v[2],wx:this.omega[0],wy:this.omega[1],wz:this.omega[2],speed:this.speed,motor1:this.commands[0],motor2:this.commands[1],motor3:this.commands[2],motor4:this.commands[3],motor_actual1:this.motors[0],motor_actual2:this.motors[1],motor_actual3:this.motors[2],motor_actual4:this.motors[3],thrust_N:this.thrusts.reduce((a,b)=>a+b,0),power_W:this.power,interval_energy_Wh:this.energy-this.lastSampleEnergy,energy_Wh:this.energy,battery:this.battery,voltage_V:this.aircraft.battery.voltage,current_A:this.power/this.aircraft.battery.voltage,wind_x:this.wind[0],wind_y:this.wind[1],wind_z:this.wind[2],payload_kg:this.payload,mass_kg:this.mass,forward:this.input.forward,left:this.input.left,up:this.input.up,yaw_input:this.input.yaw,throttle:this.input.throttle,target_x:this.target[0],target_y:this.target[1],target_z:this.target[2],horizontal_error:this.error.h,vertical_error:this.error.z,hold_s:this.hold,delivery_dwell_s:this.deliveryDwell,task:this.phase,gate:this.gate,captures:this.captures.length,control:this.control};const objective=this.waypoint();sample.objective_horizontal_error=Math.hypot(this.p[0]-objective[0],this.p[1]-objective[1]);sample.objective_vertical_error=Math.abs(this.p[2]-objective[2]);sample.mission_target_x=objective[0];sample.mission_target_y=objective[1];sample.mission_target_z=objective[2];sample.sensor_pitch_rad=this.sensorPitch;this.samples.push(sample);this.lastSampleEnergy=this.energy;}
 intervalSamples(interval){return interval?this.samples.filter(s=>s.t>=interval[0]-1e-8&&s.t<=interval[1]+1e-8):[];}
 score(){
  const id=this.spec.id,hold=this.intervalSamples(this.holdInterval),wind=this.intervalSamples(this.windInterval||(this.phase==='wind'?[this.phaseStart,this.t]:null));let raw=[];
  if(id==='hover')raw=[hold.length?rms(hold.map(s=>s.horizontal_error)):Infinity,hold.length?rms(hold.map(s=>s.vertical_error)):Infinity,this.landingError??Infinity,this.elapsed];
  if(id==='obstacle')raw=[this.gateErrors.length?mean(this.gateErrors):Infinity,this.routeErrors.length?rms(this.routeErrors):Infinity,this.elapsed,this.landingError??Infinity];
  if(id==='delivery')raw=[this.energy/(this.aircraft.usableWh*this.settings.initialBattery),this.deliveryError??Infinity,this.elapsed,this.landingError??Infinity];
  if(id==='inspection')raw=[this.captures.length?mean(this.captures.map(c=>c.angle)):Infinity,this.captures.length?mean(this.captures.map(c=>Math.abs(c.range-4))):Infinity,this.captures.length?mean(this.captures.map(c=>c.speed)):Infinity,this.elapsed];
  if(id==='wind')raw=[wind.length?rms(wind.map(s=>s.horizontal_error)):Infinity,wind.length?rms(wind.map(s=>s.vertical_error)):Infinity,median(this.gusts.map(g=>g.recovery??10)),this.landingError??Infinity];
  const metrics=this.settings.scores.map((s,i)=>({...s,value:Number.isFinite(raw[i])?raw[i]:null,quality:clamp((s.poor-raw[i])/(s.poor-s.good)),points:s.weight*clamp((s.poor-raw[i])/(s.poor-s.good))}));return {total:metrics.reduce((s,m)=>s+m.points,0),metrics};
 }
 report(){
  const stable=this.samples.filter(s=>s.altitude>2&&s.speed<.5),hoverCommand=stable.length?mean(stable.map(s=>(s.motor1+s.motor2+s.motor3+s.motor4)/4)):null,saturation=this.samples.length?this.samples.filter(s=>Math.max(s.motor1,s.motor2,s.motor3,s.motor4)>=.995).length/this.samples.length:0;
  const findings=[{title:'Mission energy',text:`Used ${this.energy.toFixed(2)} Wh over ${this.elapsed.toFixed(1)} s and ${this.routeLength.toFixed(1)} m of flight. Compare only matching routes, battery and assistance.`,chart:'power_W'},
   {title:'Hover demand',text:hoverCommand===null?'No stable hover samples; insufficient evidence to assess hover demand.':`Stable flight averaged ${(hoverCommand*100).toFixed(1)}% motor command. Repeat the same mission with a different payload to measure its effect.`,chart:'motor1'},
   {title:'Actuator headroom',text:`${(saturation*100).toFixed(2)}% of samples reached the motor command limit. ${saturation>.02?'Inspect these intervals before attributing drift to thrust reserve.':'There was little recorded saturation; hover command alone does not establish stability.'}`,chart:'motor1'}];
  if(this.spec.id==='wind')findings.push({title:'Gust recovery',text:`Median recovery ${median(this.gusts.map(g=>g.recovery??10)).toFixed(2)} s; ${this.gusts.filter(g=>g.unresolved||g.recovery===null).length} unresolved. Repeat the same seed with one controller change.`,chart:'horizontal_error'});
  return structuredClone({metadata:{id:this.id,createdAt:this.createdAt,modelVersion:MODEL_VERSION,missionId:this.spec.id,missionVersion:1,config:this.config,settings:this.settings,control:this.control,pilot:this.guided?'repeatable demonstration':'manual',samplingHz:50,physicsHz:100,frame:'right-handed X/Y horizontal, Z up; body X forward/Y left/Z up',quaternion:'xyzw, body to world',rotors:'1 front-left (+,+); 2 front-right (+,-); 3 rear-right (-,-); 4 rear-left (-,+). Reaction yaw +,-,+,-',provenance:PROVENANCE},outcome:{status:this.status,reason:this.reason,score:this.score(),elapsed:this.elapsed,energy:this.energy,battery:this.battery,routeLength:this.routeLength,hoverCommand,saturation,maxDrift:this.maxDrift,calmPower:mean(this.intervalSamples(this.calmInterval).map(s=>s.power_W)),windPower:mean(this.intervalSamples(this.windInterval).map(s=>s.power_W))},intervals:{hold:this.holdInterval,wind:this.windInterval,calm:this.calmInterval,route:this.routeInterval},gusts:this.gusts,findings,captures:this.captures,events:this.events,inputs:this.inputs,samples:this.samples});
 }
}
export function runDemo(mission, config=PRESETS[0],overrides={},options={}){const sim=new Simulation(config,settingsFor(mission,overrides),{guided:true,...options});if(!sim.arm())return sim;const maxTicks=Math.ceil((sim.settings.limit+20)/DT);for(let n=0;n<maxTicks&&!['completed','failed','incomplete'].includes(sim.status);n++){if(options.switchAt&&n===options.switchAt)sim.switchMode('simulator');sim.step();}return sim;}
export function telemetryCSV(samples){if(!samples.length)return '';const keys=Object.keys(samples[0]);const unit=k=>k==='t'?'time_s':k==='x'||k==='y'||k==='z'||k==='altitude'||k.endsWith('_error')||k.startsWith('target_')?k+'_m':/^v[xyz]$/.test(k)||k==='speed'||k.startsWith('wind_')?k+'_m_s':/^w[xyz]$/.test(k)?k+'_rad_s':k;return keys.map(unit).join(',')+'\n'+samples.map(s=>keys.map(k=>typeof s[k]==='number'?Number(s[k]).toFixed(7):String(s[k]).replaceAll(',',';')).join(',')).join('\n');}
export function comparison(a,b){const mismatches=[];for(const key of ['missionId','missionVersion','modelVersion','control','pilot'])if(a.metadata[key]!==b.metadata[key])mismatches.push(key);for(const key of ['seed','wind','limit','initialBattery','payload','scores','hold','horizontal','vertical','padRadius','passScore'])if(JSON.stringify(a.metadata.settings[key])!==JSON.stringify(b.metadata.settings[key]))mismatches.push(key);if(a.metadata.pilot==='manual'||b.metadata.pilot==='manual')mismatches.push('manual routes and inputs may differ');if(Math.abs(a.outcome.routeLength-b.outcome.routeLength)>Math.max(2,a.outcome.routeLength*.05))mismatches.push('flown route length differs');return {mismatches,differences:['frame','propulsion','battery','controller'].filter(k=>a.metadata.config[k]!==b.metadata.config[k]).map(k=>({field:k,from:a.metadata.config[k],to:b.metadata.config[k]}))};}
