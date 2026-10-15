import { expect, it } from 'vitest';
import { createWorld, step } from '../src/simulation/engine';
it('reports seeded long-run behavior without intervention', () => {
 const rows=[];
 for (const templateId of ['common-house','makers-house','harbor-house']) for (const seed of [1,42,101]) {
  const w=createWorld({slug:'diagnostic',name:'Diagnostic',templateId},0,seed);
  let moodZero=0,tensionMax=0,resourceZero=0,completedWork=0,energySpent=0,moodMax=0;
  for(let i=0;i<60*720;i++) {
   const nextLog=w.nextLog;step(w);
   for(const e of w.history.filter(e=>e.id>=nextLog&&e.kind==='upkeep')) { if(e.text.includes(' finishes replenishing'))completedWork++;if(e.text.includes(' starts replenishing'))energySpent+=10; }
   w.history=w.history.slice(-80);
   if(i>=50*720){moodMax+=w.characters.filter(c=>c.mood===100).length;moodZero+=w.characters.filter(c=>c.mood===0).length;tensionMax+=+(w.tension===100);resourceZero+=+(w.resources===0);}
  }
  expect(w.resources).toBeGreaterThan(20);expect(w.resources).toBeLessThan(80);
  expect(moodZero).toBeLessThan(10*720*6*.1);expect(moodMax).toBeLessThan(10*720*6*.1);expect(tensionMax).toBeLessThan(10*720*.1);
  expect(completedWork).toBeGreaterThan(0);
  rows.push({templateId,seed,practical:w.characters.filter(c=>c.trait==='practical').length,mood:Math.round(w.characters.reduce((n,c)=>n+c.mood,0)/6),belonging:Math.round(w.characters.reduce((n,c)=>n+c.belonging,0)/6),resources:Math.round(w.resources),tension:Math.round(w.tension),cohesion:Math.round(w.cohesion),moodZeroPct:Math.round(100*moodZero/(10*720*6)),tensionMaxPct:Math.round(100*tensionMax/(10*720)),resourceZeroPct:Math.round(100*resourceZero/(10*720)),completedWork,energySpent,moodMaxPct:Math.round(100*moodMax/(10*720*6))});
 }
 console.log(JSON.stringify(rows,null,2));
},120000);
