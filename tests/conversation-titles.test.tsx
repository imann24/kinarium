import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createWorld, applyCommand } from '../src/simulation/engine';
import { advanceConversations, beginConversation, TURN_INTERVAL } from '../src/simulation/conversations';
import { conversationTitle, finalizeConversationTitle, CONVERSATION_TITLE_LIMIT } from '../src/simulation/conversation-titles';
import ConversationThread from '../src/client/ConversationThread';
import type { LogEntry } from '../src/simulation/types';

function fixture(lines: string[]) {
  const world = createWorld({slug:'titles',name:'Titles'},0,42);
  const entry = beginConversation(world,world.characters[0],world.characters[1],true);
  entry.conversation!.status = 'finished';
  entry.conversation!.turns = lines.map((text,index) => ({text,speakerId:entry.characters[index % 2],minute:world.minute+index}));
  return {world,entry};
}
const lines = ['I kept my mother’s blue teapot when I moved here.', 'Does sharing tea make the kitchen feel less unfamiliar?', 'The teapot reminds me of Sunday mornings by the sea.'];

describe('saved conversation titles', () => {
  it('uses a concrete revealed detail instead of the reusable topic', () => {
    const {world,entry} = fixture(lines);
    finalizeConversationTitle(world,entry);
    expect(conversationTitle(entry)).toMatch(/teapot|sharing tea/i);
    expect(conversationTitle(entry)).not.toBe(entry.conversation!.topic);
    expect(lines.some(line => line.includes(conversationTitle(entry).slice(1,-1)))).toBe(true);
  });
  it('selects different real details when nearby threads have the same broad topic', () => {
    const {world,entry} = fixture(lines);
    finalizeConversationTitle(world,entry);
    const next = structuredClone(entry); next.id++; delete next.conversation!.title; world.history.push(next);
    finalizeConversationTitle(world,next);
    expect(conversationTitle(next)).not.toBe(conversationTitle(entry));
    expect(lines.some(line => line.includes(conversationTitle(next).slice(1,-1)))).toBe(true);
  });
  it('does not invent numbered or randomized variants when identical content exhausts the choices', () => {
    const {world,entry} = fixture(['The blue teapot reminds me of home.']);
    finalizeConversationTitle(world,entry);
    const next = structuredClone(entry); next.id++; delete next.conversation!.title; world.history.push(next);
    finalizeConversationTitle(world,next);
    expect(next.conversation!.title).toBe(entry.conversation!.title);
  });
  it('does not reveal planned replies or reuse a quoted line from an earlier thread', () => {
    const {world,entry} = fixture(['Last time you said, “The missing diamond is in the attic.” Does that still feel true?', 'I would rather talk about the blue teapot.']);
    entry.conversation!.planned = [{speakerId:'c1',text:'The secret wedding is tomorrow.'}];
    finalizeConversationTitle(world,entry);
    expect(conversationTitle(entry)).toContain('blue teapot');
    expect(conversationTitle(entry)).not.toMatch(/wedding|diamond/);
  });
  it('persists titles across serialization, changed neighboring history, and repeated finalization', () => {
    const {world,entry} = fixture(lines);
    finalizeConversationTitle(world,entry);
    const restored = JSON.parse(JSON.stringify(world));
    const saved = restored.history.find((e:LogEntry) => e.id === entry.id)!;
    restored.history.reverse(); saved.conversation.turns.push({speakerId:'c1',minute:999,text:'An unrelated new topic.'});
    finalizeConversationTitle(restored,saved);
    expect(conversationTitle(saved)).toBe(conversationTitle(entry));
  });
  it('leaves active and legacy saves unchanged with a readable topic fallback', () => {
    const {world,entry} = fixture(lines);
    entry.conversation!.status = 'active';
    finalizeConversationTitle(world,entry);
    expect(entry.conversation!.title).toBeUndefined();
    expect(conversationTitle(entry)).toBe(entry.conversation!.topic);
    const legacy = structuredClone(entry); legacy.conversation!.status = 'finished';
    const before = JSON.stringify(legacy);
    expect(conversationTitle(legacy)).toBe(legacy.conversation!.topic);
    expect(JSON.stringify(legacy)).toBe(before);
  });
  it('handles empty or filler-only transcripts and bounds long excerpts at whole words', () => {
    for (const lines of [[],['Yes. I see.'],['The handwritten recipe notebook beside the old ceramic teapot always reminds me of breakfasts with my grandmother in her seaside kitchen.']]) {
      const {world,entry} = fixture(lines);
      finalizeConversationTitle(world,entry);
      expect(conversationTitle(entry).length).toBeLessThanOrEqual(CONVERSATION_TITLE_LIMIT);
      expect(conversationTitle(entry)).toBeTruthy();
    }
  });
  it('finalizes procedural exchanges and interruptions through the engine without changing topic continuity', () => {
    const world = createWorld({slug:'engine-titles',name:'Titles'},0,42);
    const [a,b] = world.characters; a.floor=b.floor=0;
    const entry = beginConversation(world,a,b,true); const topic=entry.conversation!.topic;
    for(let i=0;i<6;i++){world.minute+=TURN_INTERVAL;advanceConversations(world);}
    expect(entry.conversation!.title).toBeTruthy();
    expect(entry.conversation!.topic).toBe(topic);
    const next=beginConversation(world,a,b,true);
    applyCommand(world,{type:'set-away',characterId:a.id,away:true},0);
    expect(next.conversation!.status).toBe('interrupted');
    expect(next.conversation!.title).toBeTruthy();
  });
  it('renders the saved title in the thread summary and safely escapes fictional text', () => {
    const {world,entry} = fixture(lines);
    entry.conversation!.title='A <teapot> by the kitchen window';
    const html=renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>);
    expect(html).toContain('A &lt;teapot&gt; by the kitchen window');
    expect(html).not.toContain(`<span>${entry.conversation!.topic}</span>`);
    delete entry.conversation!.title;
    expect(renderToStaticMarkup(<ConversationThread entry={entry} characters={world.characters}/>)).toContain(entry.conversation!.topic);
  });
});
