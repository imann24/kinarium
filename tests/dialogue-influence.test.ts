import { describe, expect, it, vi } from 'vitest';
import { EVENTS, TRAITS } from '../src/simulation/catalog';
import { createWorld } from '../src/simulation/engine';
import { chooseConversationScene } from '../src/simulation/conversation-scenes';
import { dialogueMemory } from '../src/simulation/dialogue-context';
import { beginConversation, advanceConversations, TURN_INTERVAL } from '../src/simulation/conversations';
import { enrichConversation, enrichDialogue } from '../src/server/llm';
import type { Character, Memory, WorldState } from '../src/simulation/types';

function fixture() {
  const world = createWorld({ slug: 'influence', name: 'Influence' }, 0, 42);
  world.minute = 60;
  const [a,b] = world.characters;
  for (const c of [a,b]) Object.assign(c, { trait: 'kind', mood: 55, energy: 70, belonging: 60, floor: 0, inElevator: false, memories: [] });
  const bond = Object.values(world.relationships).find(r => [r.a,r.b].includes(a.id) && [r.a,r.b].includes(b.id))!;
  Object.assign(bond, { trust: 50, affinity: 10 });
  return { world,a,b,bond };
}
const copy = (world: WorldState) => JSON.parse(JSON.stringify(world)) as WorldState;
const scene = (world: WorldState) => chooseConversationScene(world, world.characters[0], world.characters[1], true);
function memoryFor(world: WorldState, owner: Character, text: string, extras: Partial<Memory> = {}) {
  const other = world.characters.find(c => c.id !== owner.id)!;
  const eventId = world.nextLog++;
  world.history.push({ id:eventId, minute:12, kind:'friendship', characters:[owner.id,other.id], text:'A recorded moment of friendship.' });
  owner.memories.push({ eventId, minute:12, kind:'friendship', participantIds:[other.id], text, tone:'warm', salience:5, ...extras });
}

describe('controlled dialogue influence (same seed and all other inputs fixed)', () => {
  it('lets the responder’s personality change an answer within the same topic', () => {
    const { world,b } = fixture(); b.trait='practical';
    const practical = scene(world); b.trait='reserved'; const reserved=scene(world);
    expect(practical.topic).toBe(reserved.topic);
    expect(practical.lines[1]).toContain('wrong problem');
    expect(reserved.lines[1]).toContain('Ask quietly');
    expect(practical.lines[0]).toBe(reserved.lines[0]);
  });
  it.each(EVENTS)('lets each personality answer the same $id question differently', event => {
    const {world,b}=fixture();world.history.push({id:world.nextLog++,minute:world.minute,kind:'event',characters:[],text:event.text});
    const answers=TRAITS.map(trait=>{b.trait=trait;const chosen=scene(world);expect(chosen.topic).toBe(event.name);return chosen.lines[1];});
    expect(new Set(answers).size).toBe(TRAITS.length);
    expect(answers.every(answer=>answer.length<=220)).toBe(true);
  });
  it('lets the initiator’s personality change their follow-up without changing the listener', () => {
    const { world,a } = fixture(); world.resources=10;
    a.trait='practical'; const practical=scene(world); a.trait='curious'; const curious=scene(world);
    expect(practical.id).toBe('resources'); expect(curious.id).toBe('resources');
    expect(practical.lines[1]).toBe(curious.lines[1]);
    expect(practical.lines[2]).toContain('compare two urgent needs');
    expect(curious.lines[2]).toContain('understand');
  });
  it.each([0,1])('lets resident %i energy change pace and end the same topic coherently', index => {
    const { world }=fixture(); const baseline=scene(world); const tired=copy(world); tired.characters[index].energy=15;
    // Force the same recorded event, so state cannot pass solely by selecting a new topic.
    const event={id:world.nextLog++,minute:60,kind:'event' as const,characters:[],text:'An unmarked care package arrives. For a moment, everyone feels a little more looked after.'};
    world.history.push(event); tired.history.push(event); tired.nextLog=world.nextLog;
    const restedScene=scene(world), tiredScene=scene(tired);
    expect(tiredScene.topic).toBe(restedScene.topic);
    expect(tiredScene.lines.slice(0,2)).toEqual(restedScene.lines.slice(0,2));
    expect(tiredScene.lines.join(' ')).toMatch(index===0 ? /running out of energy/ : /I’m tired/);
    expect(tiredScene.lines.at(-1)).toMatch(/worn out|quick answer/);
    expect(baseline.lines.join(' ')).not.toMatch(/running out of energy|I’m tired/);
  });
  it.each([0,1])('lets resident %i mood change disclosure and the partner’s response', index => {
    const { world }=fixture(); const normal=scene(world); world.characters[index].mood=10; const low=scene(world);
    expect(low.lines.join(' ')).toMatch(index===0 ? /hard time finding the words/ : /feeling low/);
    expect(low.lines.at(-1)).toMatch(/cheerful|upbeat/);
    expect(low.lines).not.toEqual(normal.lines);
  });
  it.each([0,1])('lets resident %i belonging affect topic and their own perspective', index => {
    const {world}=fixture();const settled=scene(world);world.characters[index].belonging=10;const uncertain=scene(world);
    expect(uncertain.id).toBe('belonging');expect(uncertain.topic).not.toBe(settled.topic);
    expect(uncertain.lines[index]).toMatch(index===0 ? /don’t quite feel part/ : /not sure where I fit/);
    expect(uncertain.lines.join(' ')).not.toContain('everyone rejects');
  });
  it('separates trust from affinity rather than assuming affection or agreement', () => {
    const {world,bond}=fixture();bond.trust=10;const guarded=scene(world);bond.trust=80;const candid=scene(world);
    expect(guarded.id).toBe('help');expect(candid.id).toBe('help');
    expect(guarded.lines[3]).toContain('Please ask');expect(candid.lines[3]).toContain('feel able to say no');
    bond.affinity=-40;expect(scene(world).lines[3]).toContain('rub each other the wrong way');
    bond.trust=50;expect(scene(world).lines[3]).toContain('don’t always find our exchanges easy');
  });
  it.each([0,1])('uses resident %i memory content only in that resident’s speech', index => {
    const {world}=fixture();const noMemory=scene(world);
    memoryFor(world,world.characters[index],'I felt welcome when we talked about the garden.');
    const recalled=scene(world);expect(recalled.topic).not.toBe(noMemory.topic);
    expect(recalled.id).toBe(`memory:${world.characters[index].id}`);
    expect(recalled.lines[index]).toContain('I felt welcome when we talked about the garden.');
    expect(recalled.lines[1-index]).not.toContain('I felt welcome');
    const changed=copy(world);changed.characters[index].memories[0].text='I valued having room to disagree about the garden.';
    expect(scene(changed).lines[index]).toContain('room to disagree');
    expect(scene(changed).lines[1-index]).toBe(recalled.lines[1-index]);
    const tense=copy(world);tense.characters[index].memories[0].tone='tense';
    expect(scene(tense).lines.join(' ')).toContain('still feels unsettled');
  });
  it('does not attribute future, legacy, unrelated, active or contradictory memories', () => {
    const {world,a,b}=fixture();
    memoryFor(world,a,'A future recollection.',{minute:100});
    a.memories.push({text:'A legacy personal memory.',minute:0});
    expect(dialogueMemory(world,a,b)).toBeUndefined();
    a.memories=[{text:'We disagreed.',minute:0,kind:'conflict',participantIds:[b.id]}];
    expect(scene(world).lines.join(' ')).not.toMatch(/our disagreement|remember it this way/);
    a.memories=[];memoryFor(world,a,'An unrelated recollection.',{participantIds:['c3']});
    expect(dialogueMemory(world,a,b)).toBeUndefined();
    a.memories=[];memoryFor(world,a,'A contradicted recollection.');world.history.at(-1)!.characters=['c3'];
    expect(dialogueMemory(world,a,b)).toBeUndefined();
    a.memories=[];const active=beginConversation(world,a,b,true);
    a.memories.push({text:'Unfinished exchange.',minute:active.minute,eventId:active.id,kind:active.kind,participantIds:[b.id]});
    expect(dialogueMemory(world,a,b)).toBeUndefined();
  });
  it('preserves archived provenance, active saves, and titles until the encounter ends', () => {
    const {world,a,b}=fixture();memoryFor(world,a,'I felt heard when we disagreed.');
    world.history=world.history.filter(e=>e.id!==a.memories[0].eventId);
    expect(scene(world).lines[0]).toContain('I felt heard');
    const entry=beginConversation(world,a,b,true);const title=entry.conversation!.title;const restored=copy(world);
    world.minute+=TURN_INTERVAL;restored.minute+=TURN_INTERVAL;advanceConversations(world);advanceConversations(restored);
    expect(restored).toEqual(world);expect(entry.conversation!.title).toBe(title);
  });
});

describe('AI causal instructions and enforced pacing', () => {
  const response={turns:[{speakerId:'c2',text:'I want to understand what kind of help would feel useful.'},{speakerId:'c1',text:'Perhaps asking first would give us room to choose.'},{speakerId:'c2',text:'That is a question I can sit with for now.'}]};
  async function prompt(world: WorldState, legacy=false) {
    const entry=beginConversation(world,world.characters[0],world.characters[1],true);
    const run=vi.fn().mockResolvedValue({response:legacy?'Could we leave that question open?':JSON.stringify(response)});
    await (legacy?enrichDialogue:enrichConversation)({AI:{run}},world,entry);
    return { system:run.mock.calls[0][1].messages[0].content, context:JSON.parse(run.mock.calls[0][1].messages[1].content) };
  }
  it.each([false,true])('makes independent state/trait/relationship changes actionable in the AI path (legacy=%s)', async legacy => {
    const {world}=fixture();const baseline=await prompt(copy(world),legacy);
    for(const [field,value,expected] of [['trait','reserved','selective disclosure'],['energy',15,'Low energy'],['mood',10,'Low mood'],['belonging',10,'Low belonging']] as const) {
      const changed=copy(world);Object.assign(changed.characters[0],{[field]:value});const result=await prompt(changed,legacy);
      expect(result.context.characters[0].delivery.join(' ')).toContain(expected);
      expect(result.context.characters[0].delivery).not.toEqual(baseline.context.characters[0].delivery);
      expect(result.context.characters[1]).toEqual(baseline.context.characters[1]);
    }
    const changed=copy(world);Object.values(changed.relationships)[0].trust=10;
    expect((await prompt(changed,legacy)).context.characters[0].delivery.join(' ')).toContain('Low trust');
    const friction=copy(world);Object.values(friction.relationships)[0].affinity=-40;
    expect((await prompt(friction,legacy)).context.characters[0].delivery.join(' ')).toContain('Friction');
    expect(baseline.system).toMatch(/owner|speaker/);
  });
  it('transmits a grounded memory only under its owner, excluding current/future records', async () => {
    const {world,b}=fixture();memoryFor(world,b,'I valued being asked rather than assumed to agree.');
    b.memories.push({text:'Future private recollection.',minute:999});
    const {context}=await prompt(world);
    expect(context.characters[0].memories).toEqual([]);
    expect(context.characters[1].memories.map((m:Memory)=>m.text)).toEqual(['I valued being asked rather than assumed to agree.']);
  });
  it('rejects an overlong exhausted plan in one call and keeps the procedural pause', async () => {
    const {world,a,b}=fixture();a.energy=10;const entry=beginConversation(world,a,b,true);
    const run=vi.fn().mockResolvedValue({response:JSON.stringify({turns:[...response.turns,{speakerId:'c1',text:'Let us start another long debate about all of this.'}]})});
    expect(await enrichConversation({AI:{run}},world,entry)).toBeNull();expect(run).toHaveBeenCalledTimes(1);
    for(let i=0;i<8;i++){world.minute+=TURN_INTERVAL;advanceConversations(world);}
    expect(entry.conversation!.turns).toHaveLength(4);
    expect(entry.conversation!.turns[2].text).toContain('running out of energy');
    expect(a.memories[0].text).not.toContain('another long debate');
  });
});
