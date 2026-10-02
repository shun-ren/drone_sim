import fs from 'node:fs';
import {Simulation, PRESETS, START, FLOOR, DT, estimate, runDemo, settingsFor, MODEL_VERSION} from '../lib/sim.mjs';
import {runBundle} from '../lib/storage.mjs';
fs.mkdirSync('examples',{recursive:true});const rows=[];
function save(s,kind){const report=s.report();fs.writeFileSync(`examples/${s.spec.id}-${kind}.zip`,runBundle(report));rows.push({mission:s.spec.id,kind,status:s.status,reason:s.reason,score:s.score().total,duration_s:s.elapsed,energy_Wh:s.energy,battery:s.battery,samples:s.samples.length,intervals:report.intervals});}
for(const id of ['hover','obstacle','delivery','inspection','wind'])save(runDemo(id),'success');
save(runDemo('hover',PRESETS[0],{limit:10}),'failure');
save(runDemo('delivery',PRESETS[0],{initialBattery:.17}),'failure');
for(const id of ['obstacle','inspection','wind']){
 const s=new Simulation(PRESETS[0],settingsFor(id),{guided:true});const normal=s.updateDemo.bind(s);let stage=0;
 s.updateDemo=()=>{if(id==='wind'){normal();if(s.phase==='wind')s.target=[START[0]+8,START[1],10+FLOOR];return;}if(id==='inspection'){if(stage===0){s.target=[START[0],START[1],30];if(Math.abs(s.p[2]-30)<.3&&s.speed<.5)stage=1;}else if(stage===1){s.target=[10,40,30];if(Math.hypot(s.p[0]-10,s.p[1]-40)<.3&&s.speed<.5)stage=2;}else s.target=[10,40,20];return;}if(stage===0){s.target=[-40,2,5];if(Math.hypot(s.p[0]+40,s.p[1]-2,s.p[2]-5)<.3&&s.speed<.5)stage=1;}else s.target=[-30,2,5];};
 s.arm();for(let n=0;n<(s.settings.limit+20)/DT&&!['failed','completed'].includes(s.status);n++)s.step();save(s,'failure');
}
const base=runDemo('hover'),loaded=runDemo('hover',PRESETS[0],{payload:1});save(loaded,'payload-1kg');const hardware={os:process.platform,node:process.version,architecture:process.arch};
const summary={model:MODEL_VERSION,generatedAt:new Date().toISOString(),hardware,runs:rows,payloadExperiment:{baseline:base.report().outcome,oneKg:loaded.report().outcome},estimates:{empty:estimate(PRESETS[0],0),loaded:estimate(PRESETS[0],1)}};
fs.writeFileSync('examples/validation-results.json',JSON.stringify(summary,null,2));console.table(rows.map(({mission,kind,status,score,duration_s,energy_Wh,reason})=>({mission,kind,status,score:score.toFixed(2),seconds:duration_s.toFixed(2),Wh:energy_Wh.toFixed(3),reason})));
if(rows.some(r=>r.kind==='success'&&r.status!=='completed'||r.kind==='failure'&&r.status!=='failed'))process.exitCode=1;
