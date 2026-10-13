import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyCommand, createWorld, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation, isConversing, TURN_INTERVAL } from '../src/simulation/conversations';
import { enrichConversation } from '../src/server/llm';
import { applyConversationPlan, dailyConversationLimit } from '../src/server/conversation-policy';
import { MEMORY_LIMIT, rememberEvent } from '../src/simulation/memories';
import ConversationThread from '../src/client/ConversationThread';

function fixture(positive = true) {
  const world = createWorld({ slug: 'thread-test', name: 'Threads', populationCap: 2 }, 0, 42);
  const [a,b] = world.characters;
  for (const c of [a,b]) { c.floor = 0; c.destination = 0; }
  const entry = beginConversation(world, a, b, positive);
  return { world, a, b, entry };
}
const replies = [
  { speakerId: 'c2', text: 'I like listening first. Quiet isn’t the same as lonely.' },
  { speakerId: 'c1', text: 'Would an invitation feel like pressure, then?' },
  { speakerId: 'c2', text: 'Only if I had to accept it. Having the choice would help.' },
];

describe('conversation lifecycle', () => {
  it('alternates named speakers over time, holds residents together, and survives reload', () => {
    const { world, a } = fixture();
    const restored = JSON.parse(JSON.stringify(world));
    for (let i = 0; i < 12; i++) { step(world); step(restored); }
    expect(restored).toEqual(world);
    const entry = world.history.find(e => e.conversation)!;
    expect(entry.conversation!.turns.map(t => t.speakerId)).toEqual(['c1','c2','c1','c2','c1']);
    expect(a.floor).toBe(0); expect(a.destination).toBe(0);
    expect(isConversing(world, a.id)).toBe(true);
  });
  it('finishes bounded exchanges and remembers actual spoken dialogue for both residents', () => {
    const { world, a, b, entry } = fixture(false);
    for (let i = 0; i < 7; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
    expect(entry.conversation!.status).toBe('finished');
    expect(entry.conversation!.turns).toHaveLength(6);
    expect(a.memories[0]).toMatchObject({ eventId: entry.id, participantIds: [b.id], kind: 'conflict', tone: 'tense', minute: entry.minute });
    expect(b.memories[0]).toMatchObject({ eventId: entry.id, participantIds: [a.id] });
    expect(a.memories[0].text).not.toBe(b.memories[0].text);
    expect(a.memories[0].text).toContain(entry.conversation!.turns[1].text);
    expect(isConversing(world, a.id)).toBe(false);
    expect(entry.conversation!.topic).toContain('garden');
  });
  it('retains defining memories beyond 16 entries and records only revealed interrupted turns once', () => {
    const { world, a, b, entry } = fixture();
    const arrival = a.memories[0];
    for (let i = 0; i < 70; i++) rememberEvent(a, { id: 100 + i, minute: 400 + i, kind: 'event', characters: [a.id], text: 'Recorded event' }, `Moment ${i}`);
    applyConversationPlan(entry, 1, [...replies]);
    applyCommand(world, { type: 'set-away', characterId: b.id, away: true }, 0);
    const remembered = a.memories.find(m => m.eventId === entry.id)!;
    expect(a.memories).toHaveLength(MEMORY_LIMIT);
    expect(a.memories).toContainEqual(arrival);
    expect(remembered.text).toContain(entry.conversation!.turns[0].text);
    expect(remembered.text).not.toContain(replies[0].text);
    expect(remembered.text).toContain('interrupted');
    advanceConversations(world);
    expect(a.memories.filter(m => m.eventId === entry.id)).toHaveLength(1);
  });
  it('interrupts immediately on departure and never speaks for away residents', () => {
    const { world, a, entry } = fixture();
    applyCommand(world, { type:'set-away', characterId:a.id, away:true }, 0);
    world.minute += 100; advanceConversations(world);
    expect(entry.conversation!.status).toBe('interrupted');
    expect(entry.conversation!.turns).toHaveLength(1);
    expect(a.speech).toBeUndefined();
  });
  it('continues concrete topics and references prior dialogue on a later encounter', () => {
    const { world, a, b, entry } = fixture();
    for (let i = 0; i < 6; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
    const next = beginConversation(world, a, b, true);
    expect(next.conversation!.topic).toBe(entry.conversation!.topic);
    expect(next.conversation!.turns[0].text).toContain(entry.conversation!.turns.at(-1)!.text);
  });
  it.each(['makers-house', 'harbor-house'])('grounds topics in the actual %s setting', templateId => {
    const world = createWorld({slug:'setting',name:'Setting',templateId},0);
    const entry = beginConversation(world,world.characters[0],world.characters[1],false);
    expect(entry.conversation!.topic).not.toContain('garden');
    expect(entry.conversation!.turns[0].text).toContain(templateId === 'makers-house' ? 'studio' : 'loft');
  });
  it('grounds an event conversation in an event that actually occurred', () => {
    const { world, a, b } = fixture();
    applyCommand(world, { type:'trigger-event', eventId:'power-outage' }, 0);
    const next = beginConversation(world, a, b, false);
    expect(next.conversation!.topic).toBe('The lights go out');
    expect(next.text).toContain('The house goes dark');
  });
  it('reveals accepted AI replies individually and retains legacy histories', () => {
    const { world, entry } = fixture();
    expect(applyConversationPlan(entry, 1, [...replies])).toBe(true);
    world.minute += TURN_INTERVAL; advanceConversations(world);
    expect(entry.conversation!.turns[1]).toMatchObject({ ...replies[0], generated:true });
    expect(entry.conversation!.turns).toHaveLength(2);
    const legacy = createWorld({ slug:'legacy',name:'Legacy' },0);
    expect(() => advanceConversations(legacy)).not.toThrow();
  });
  it('rejects stale, interrupted, missing and failed plans without corrupting dialogue', () => {
    const { entry } = fixture();
    expect(applyConversationPlan(entry, 2, replies)).toBe(false);
    expect(applyConversationPlan(entry, 1, null)).toBe(false);
    expect(applyConversationPlan(undefined, 1, replies)).toBe(false);
    entry.conversation!.status = 'interrupted';
    expect(applyConversationPlan(entry, 1, replies)).toBe(false);
    expect(entry.conversation!.planned).toBeUndefined();
  });
  it('bounds configuration while allowing substantially more generation', () => {
    expect(dailyConversationLimit()).toBe(240);
    expect(dailyConversationLimit('broken')).toBe(240);
    expect(dailyConversationLimit('-1')).toBe(0);
    expect(dailyConversationLimit('0')).toBe(0);
    expect(dailyConversationLimit('999999')).toBe(10000);
  });
});

describe('thread generation', () => {
  it('sends transcript, personal history, relationship and event context to the provider', async () => {
    const { world, entry, a } = fixture();
    a.memories.unshift({text:'A specific old memory',minute:400}, {text:'Current encounter',minute:entry.minute,eventId:entry.id});
    const run = vi.fn().mockResolvedValue({response:JSON.stringify({turns:replies})});
    expect(await enrichConversation({AI:{run}},world,entry)).toEqual(replies);
    const input = run.mock.calls[0][1];
    const context = JSON.parse(input.messages[1].content);
    expect(context.transcript).toEqual(entry.conversation!.turns);
    expect(context.characters[0]).toMatchObject({backstory:a.backstory,trait:a.trait});
    expect(context.characters[0].memories.map((m: {text:string}) => m.text)).toContain('A specific old memory');
    expect(context.characters[0].memories.some((m: {eventId?:number}) => m.eventId === entry.id)).toBe(false);
    expect(context.relationship).toMatchObject({a:'c1',b:'c2'});
    expect(input.max_tokens).toBe(900);
  });
  it.each(['bad json', JSON.stringify({turns:[]}), JSON.stringify({turns:[...replies,{speakerId:'intruder',text:'Hi'}]}), JSON.stringify({turns:replies.map(t=>({...t,text:'a'.repeat(221)}))}), JSON.stringify({turns:replies.map(t=>({...t,speakerId:'c1'}))})])('rejects malformed exchanges: %s', async response => {
    const { world, entry } = fixture();
    expect(await enrichConversation({AI:{run:vi.fn().mockResolvedValue({response})}},world,entry)).toBeNull();
    expect(entry.conversation!.turns).toHaveLength(1);
  });
  it('keeps procedural replies on provider failure or disabled inference', async () => {
    const { world, entry } = fixture();
    const run = vi.fn().mockRejectedValue(new Error('Unavailable'));
    expect(await enrichConversation({AI:{run}},world,entry)).toBeNull();
    expect(await enrichConversation({AI:{run},LLM_PROVIDER:'disabled'},world,entry)).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('thread presentation', () => {
  it('shows an expanded active thread with named chronological turns and AI attribution', () => {
    const { world, entry } = fixture();
    applyConversationPlan(entry,1,[...replies]);
    world.minute += TURN_INTERVAL; advanceConversations(world);
    const html = renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>);
    expect(html).toContain('open=""');
    expect(html).toContain('2 turns'); expect(html).toContain('In conversation');
    expect(html).toContain('Milo'); expect(html).toContain('Juniper');
    expect(html).toContain('AI dialogue');
    expect(html.indexOf(entry.conversation!.turns[0].text)).toBeLessThan(html.indexOf(replies[0].text));
  });
  it('collapses ended threads, labels interruptions and escapes fictional text', () => {
    const { world, entry } = fixture();
    entry.conversation!.status = 'interrupted';
    entry.conversation!.turns[0].text = '<script>bad()</script>';
    const html = renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>);
    expect(html).not.toContain('open=""'); expect(html).toContain('Interrupted');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
  });
});
