import { describe, expect, it } from 'vitest';
import { applyCommand, createCharacter, createWorld, step } from '../src/simulation/engine';
import { advanceSupplyWork, needsSupplyWork, supplyDemand, supplyThreshold, SUPPLY_DURATION } from '../src/simulation/supplies';
import { residentDrift } from '../src/simulation/resident-state';
import { tensionFlow } from '../src/simulation/community-dynamics';

function fixture() {
 const world=createWorld({slug:'supplies',name:'Supplies',populationCap:2},0,42);
 world.resources=4; const [c,other]=world.characters;
 Object.assign(c,{floor:2,destination:2,energy:60,trait:'curious'});
 Object.assign(other,{floor:0,destination:0,energy:60});
 return {world,c,other};
}
describe('supply upkeep',()=>{
 it('charges real energy, occupies time, and records only completed supply gains',()=>{
  const {world,c}=fixture();const initial=world.resources;
  expect(advanceSupplyWork(world,c)).toBe(true);
  expect(c.energy).toBe(50);expect(world.resources).toBe(initial);
  expect(c.stateChanges?.at(-1)).toMatchObject({cause:'Supply work',energy:-10,mood:0,belonging:0});
  expect(world.history.at(-1)?.id).toBe(c.stateChanges?.at(-1)?.eventId);
  world.minute+=SUPPLY_DURATION-2;advanceSupplyWork(world,c);expect(world.resources).toBe(initial);
  world.minute+=2;advanceSupplyWork(world,c);expect(world.resources).toBe(initial+8);
  expect(c.supplyTask).toBeUndefined();expect(c.destination).toBe(0);
  expect(world.history.at(-1)?.text).toContain('+8 supplies');
 });
 it('respects thresholds, cooldowns, night rest, away status and a single worker',()=>{
  const {world,c,other}=fixture();
  world.resources=35;expect(needsSupplyWork(world,c)).toBe(false);
  world.resources=4;c.energy=39.99;expect(needsSupplyWork(world,c)).toBe(false);
  c.energy=40;world.minute=100;expect(needsSupplyWork(world,c)).toBe(false);
  world.minute=480;c.away=true;expect(needsSupplyWork(world,c)).toBe(false);
  c.away=false;advanceSupplyWork(world,c);expect(needsSupplyWork(world,other)).toBe(false);
  world.minute+=16;advanceSupplyWork(world,c);expect(c.destination).toBe(1);
  expect(needsSupplyWork(world,c)).toBe(false);
  c.energy=60;world.minute=660;expect(needsSupplyWork(world,c)).toBe(true);
 });
 it('preserves practical skill and bounds gains without restoring energy for free',()=>{
  const {world,c}=fixture();c.trait='practical';advanceSupplyWork(world,c);
  world.minute+=16;world.resources=98;advanceSupplyWork(world,c);
  expect(world.resources).toBe(100);expect(c.energy).toBe(50);
  expect(world.history.at(-1)?.text).toContain('+2 supplies');
 });
 it('cancels away work without a reward and resumes saved in-progress work exactly once',()=>{
  const {world,c}=fixture();advanceSupplyWork(world,c);
  const restored=JSON.parse(JSON.stringify(world));
  applyCommand(world,{type:'set-away',characterId:c.id,away:true},0);
  expect(c.supplyTask).toBeUndefined();expect(c.energy).toBe(50);expect(world.resources).toBe(4);
  restored.minute+=16;advanceSupplyWork(restored,restored.characters[0]);advanceSupplyWork(restored,restored.characters[0]);
  expect(restored.resources).toBe(12);expect(restored.characters[0].energy).toBe(50);
 });
 it('keeps workers out of conversations and sends depleted residents to recover',()=>{
  const {world,c,other}=fixture();c.energy=40.4;other.floor=other.destination=2;
  step(world);expect(c.supplyTask).toBeDefined();
  for(let i=0;i<8;i++)step(world);
  expect(c.supplyTask).toBeUndefined();expect(c.destination).toBe(1);
  expect(world.history.filter(e=>e.conversation&&e.characters.includes(c.id))).toHaveLength(0);
  const energy=c.energy;c.floor=c.destination=1;step(world);expect(c.energy).toBeGreaterThan(energy);
 });
 it('applies a shared shortage condition before work completion regardless of resident order',()=>{
  const {world,c,other}=fixture();world.resources=13;
  for(const p of [c,other])Object.assign(p,{mood:20,belonging:35});
  c.supplyTask={startedAt:world.minute-14,completeAt:world.minute+2,amount:8};
  step(world);expect(c.mood).toBe(other.mood);expect(world.resources).toBeGreaterThan(20);
 });
 it('keeps scarcity harmful, displays its exact contribution and eases tension gradually',()=>{
  const {world,c}=fixture();Object.assign(c,{mood:0,belonging:0});world.tension=100;
  const scarce=residentDrift(c,world);expect(scarce.supplies).toBe(-.2);expect(scarce.next.mood).toBe(0);
  world.resources=20;const stocked=residentDrift(c,world);expect(stocked.supplies).toBe(.015);expect(stocked.next.mood).toBeGreaterThan(0);
  expect(tensionFlow(4,100)).toEqual({scarcity:.06,easing:.015});
  expect(tensionFlow(20,100)).toEqual({scarcity:0,easing:.015});
  expect(supplyDemand(world)).toBe(.016);
 });
 it('scales the nighttime reserve with population and preserves a small-house threshold',()=>{
  const {world}=fixture();expect(supplyThreshold(world)).toBe(35);
  world.characters=Array.from({length:40},(_,i)=>({...world.characters[0],id:`c${i}`}));
  expect(supplyThreshold(world)).toBe(95);
  world.characters.forEach(c=>{c.away=true;});expect(supplyDemand(world)).toBe(0);
 });
 it.each([1,40])('supports %i residents without repeated empty cupboards or exhausted workers',population=>{
  const world=createWorld({slug:'capacity',name:'Capacity',populationCap:population},0,42);
  while(world.characters.length<population)createCharacter(world);
  for(const c of world.characters)c.trait='reserved';
  let empty=0;
  for(let i=0;i<10*720;i++) {step(world);world.history=world.history.slice(-80);if(i>5*720&&world.resources===0)empty++;}
  expect(empty).toBeLessThan(5*720*.1);
  expect(world.characters.every(c=>c.energy>=0&&c.energy<=100)).toBe(true);
 },30000);
 it('recovers from distressed, low-trust saves without resetting scores or requiring a practical resident',()=>{
  for(const seed of [1,42,101]){
   const world=createWorld({slug:'distress',name:'Distress'},0,seed);
   Object.assign(world,{resources:0,tension:100,cohesion:0});
   for(const c of world.characters)Object.assign(c,{mood:0,belonging:0,energy:15,trait:'reserved'});
   for(const r of Object.values(world.relationships))Object.assign(r,{trust:5,affinity:-30,encounters:20});
   for(let i=0;i<10*720;i++){step(world);world.history=world.history.slice(-80);for(const c of world.characters)expect(c.energy).toBeGreaterThanOrEqual(0);}
   expect(world.resources).toBeGreaterThan(20);expect(world.tension).toBeLessThan(90);
   expect(world.characters.reduce((n,c)=>n+c.mood,0)/6).toBeGreaterThan(5);
   expect(world.relationships['c1:c2'].trust).toBeLessThan(100);
  }
 },30000);
});
