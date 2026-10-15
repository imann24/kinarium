import { describe, expect, it } from 'vitest';
import { createWorld, relationship, applyCommand } from '../src/simulation/engine';
import { relationshipLabel, bondKind } from '../src/simulation/relationship-labels';
import { chooseConversationScene } from '../src/simulation/conversation-scenes';
import { beginConversation } from '../src/simulation/conversations';

describe('relationship and encounter consistency',()=>{
 it('uses actual familiarity, trust and unresolved history rather than affinity alone',()=>{
  const w=createWorld({slug:'labels',name:'Labels'});const r=relationship(w,'c1','c2');
  Object.assign(r,{affinity:90,trust:90});expect(relationshipLabel(r)).toBe('Yet to meet');
  r.encounters=301;r.affinity=14;r.trust=57;expect(relationshipLabel(r)).toBe('Familiar · mixed connection');
  r.affinity=90;expect(relationshipLabel(r)).toBe('Close');
  r.trust=5;expect(relationshipLabel(r)).toBe('Low trust');expect(bondKind(r)).toBe('strained');
  r.trust=90;r.unresolvedConflict={id:20,minute:400,topic:'Sharing'};
  expect(relationshipLabel(r)).toBe('Unresolved disagreement');expect(bondKind(r)).toBe('strained');
  r.repairCommitment={conflictId:20,initiatorId:'c1'};expect(relationshipLabel(r)).toBe('Repair in progress');
 });
 it('keeps disagreement explicit in belonging and owned-memory scenes with a conflict outcome',()=>{
  for(let seed=1;seed<=30;seed++)for(const energy of [15,75]){
   const w=createWorld({slug:'scenes',name:'Scenes'},0,seed);const [a,b]=w.characters;
   a.belonging=b.belonging=5;a.energy=b.energy=energy;
   a.memories=[{text:'I appreciated your kindness.',minute:0,eventId:999,kind:'friendship',participantIds:[b.id],tone:'warm',salience:10}];
   const scene=chooseConversationScene(w,a,b,false);
   expect(scene.lines[0]).toMatch(/disagree|see this differently/);
   expect(scene.lines.every(line=>line.length<=220)).toBe(true);
  }
 });
 it('requires event participation and identifies a discussion without re-enacting the event',()=>{
  const w=createWorld({slug:'events',name:'Events'});const [a,b]=w.characters;
  b.away=true;applyCommand(w,{type:'trigger-event',eventId:'power-outage'},0);b.away=false;
  expect(chooseConversationScene(w,a,b,false).id).not.toBe('event:power-outage');
  w.cooldowns={};applyCommand(w,{type:'trigger-event',eventId:'power-outage'},45000);
  const e=beginConversation(w,a,b,false);
  expect(e.text).toContain('has a disagreement');expect(e.text).toContain('They discuss an earlier event');
  expect(e.text).not.toContain('The house goes dark');expect(e.conversation?.turns[0].text).toContain('see this differently');
 });
});
