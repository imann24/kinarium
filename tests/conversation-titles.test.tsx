import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createWorld, applyCommand } from '../src/simulation/engine';
import { beginConversation, advanceConversations, interruptConversations, TURN_INTERVAL } from '../src/simulation/conversations';
import { conversationTitle } from '../src/simulation/conversation-titles';
import ConversationThread from '../src/client/ConversationThread';

function fixture() {
  const world = createWorld({ slug: 'titles', name: 'Titles' }, 0, 42);
  const [a, b] = world.characters;
  a.floor = b.floor = 0;
  const entry = beginConversation(world, a, b, true);
  return { world, a, b, entry };
}
describe('grounded conversation titles', () => {
  it('uses specific revealed details without changing the procedural topic', () => {
    const { world, entry } = fixture();
    const topic = entry.conversation!.topic;
    entry.conversation!.turns.push({ speakerId: 'c2', minute: 6, generated: true, text: 'I miss sketching boats by the harbor. That makes sense to me.' });
    interruptConversations(world, 'c1');
    expect(entry.conversation!.title).toBe('“I miss sketching boats by the harbor”');
    expect(entry.conversation!.topic).toBe(topic);
  });
  it('chooses another supported detail when a nearby title repeats', () => {
    const { world, entry, a, b } = fixture();
    entry.conversation!.title = '“I miss sketching boats by the harbor”';
    const next = beginConversation(world, a, b, true);
    next.conversation!.turns.push({ speakerId: b.id, minute: 6, generated: true, text: 'I miss sketching boats by the harbor. Drawing helps me find a little quiet.' });
    expect(conversationTitle(world, next)).toBe('“Drawing helps me find a little quiet”');
  });
  it('keeps active titles stable and excludes unrevealed plans on interruption', () => {
    const { world, entry } = fixture();
    const initial = entry.conversation!.title;
    entry.conversation!.planned = [{ speakerId: 'c2', text: 'I miss sketching boats by the harbor.' }, { speakerId: 'c1', text: 'I worry about the broken telescope.' }];
    world.minute += TURN_INTERVAL; advanceConversations(world);
    expect(entry.conversation!.title).toBe(initial);
    interruptConversations(world, 'c1');
    expect(entry.conversation!.title).toContain('boats');
    expect(entry.conversation!.title).not.toContain('telescope');
    const restored = JSON.parse(JSON.stringify(world));
    restored.minute += 100; advanceConversations(restored);
    expect(restored.history.find((e: {id:number}) => e.id === entry.id).conversation.title).toBe(entry.conversation!.title);
  });
  it('provides varied procedural titles without inference or invented details', () => {
    const { world, entry, a, b } = fixture();
    b.trait = 'practical';
    for (let i = 0; i < 6; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
    expect(entry.conversation!.title!.length).toBeGreaterThan(0);
    const next = beginConversation(world, a, b, true);
    for (let i = 0; i < 6; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
    expect(next.conversation!.title).not.toBe(entry.conversation!.title);
    expect(conversationTitle(world, next)).toBe(conversationTitle(world, next));
  });
  it('retains actual event context and safe fallback for empty/legacy threads', () => {
    const { world, a, b, entry } = fixture();
    applyCommand(world, { type: 'trigger-event', eventId: 'power-outage' }, 0);
    const event = beginConversation(world, a, b, true);
    expect(event.conversation!.title).toBe('The lights go out');
    entry.conversation!.turns = [];
    expect(conversationTitle(world, entry)).toBe(entry.conversation!.topic);
    delete entry.conversation!.title;
    expect(renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>)).toContain(entry.conversation!.topic);
  });
  it('renders saved titles safely beside participants', () => {
    const { world, entry, a, b } = fixture();
    entry.conversation!.title = '<script>boats</script>';
    const html = renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>);
    expect(html).toContain('&lt;script&gt;boats&lt;/script&gt;');
    expect(html).toContain(a.name); expect(html).toContain(b.name);
    expect(html).not.toContain('Company at the common table');
  });
});
