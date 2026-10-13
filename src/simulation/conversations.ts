import { EVENTS, TEMPLATES } from './catalog';
import type { Character, LogEntry, WorldState } from './types';

export const TURN_INTERVAL = 6;
export function isConversing(world: WorldState, id: string) {
  return world.history.some(e => e.conversation?.status === 'active' && e.characters.includes(id));
}
function finish(world: WorldState, entry: LogEntry, interrupted = false) {
  const thread = entry.conversation!;
  thread.status = interrupted ? 'interrupted' : 'finished';
  thread.planned = undefined;
  const memory = `${thread.topic}: ${thread.turns.map(t => `${world.characters.find(c => c.id === t.speakerId)?.name ?? t.speakerId}: “${t.text}”`).join(' ')}`;
  for (const id of entry.characters) {
    const c = world.characters.find(c => c.id === id);
    if (!c) continue;
    c.memories.unshift({ text: memory, minute: world.minute });
    c.memories = c.memories.slice(0, 16);
    c.activity = 'reflecting on a conversation';
    c.speech = undefined;
  }
}
export function interruptConversations(world: WorldState, id: string) {
  for (const entry of world.history) if (entry.conversation?.status === 'active' && entry.characters.includes(id)) finish(world, entry, true);
}
export function beginConversation(world: WorldState, a: Character, b: Character, positive: boolean) {
  const recentEvent = [...world.history].reverse().find(e => e.kind === 'event');
  const previous = [...world.history].reverse().find(e => e.conversation && e.characters.includes(a.id) && e.characters.includes(b.id));
  const event = recentEvent && world.minute - recentEvent.minute < 120 ? recentEvent : undefined;
  const space = TEMPLATES[world.templateId].floors[2].name.toLowerCase();
  const topic = event ? EVENTS.find(e => e.text === event.text)?.name ?? 'Today in the house' : previous?.conversation?.topic ?? (positive ? 'Company at the common table' : `Who gets a say in ${space}`);
  const previousReply = previous?.conversation?.turns.filter(t => t.speakerId === b.id).at(-1);
  const text = event ? `After today, I keep thinking about ${topic.toLowerCase()}. What stayed with you?` : previousReply ? (positive ? `Last time you said, “${previousReply.text}” Does that still feel true?` : `I’m still uneasy about ${topic.toLowerCase()}. Where did our last conversation leave you?`) : positive ? (a.trait === 'reserved' ? 'At the common table, I want company, but I’m not always ready to talk. Does that make sense?' : 'At the common table, would you rather be invited into the conversation or have room to listen?') : `If we change ${space}, I want everyone to get a say. Would you find that frustrating?`;
  const entry: LogEntry = { id: world.nextLog++, minute: world.minute, kind: positive ? 'conversation' : 'conflict', text: `${a.name} ${positive ? 'talks with' : 'works through a disagreement with'} ${b.name}.${event ? ` ${event.text}` : ''}`, characters: [a.id, b.id], conversation: { topic, tone: positive ? 'warm' : 'tense', status: 'active', turns: [{ speakerId: a.id, text, minute: world.minute }], nextTurnAt: world.minute + TURN_INTERVAL, targetTurns: 6 } };
  world.history.push(entry);
  a.speech = text; a.speechUntil = world.minute + TURN_INTERVAL;
  a.activity = `talking with ${b.name}`; b.activity = `listening to ${a.name}`;
  return entry;
}
function fallback(entry: LogEntry, speaker: Character) {
  const thread = entry.conversation!;
  const warm = !thread.topic.startsWith('Who gets a say');
  const space = thread.topic.replace('Who gets a say in ', '');
  if (/^(Last time you said|I’m still uneasy)/.test(thread.turns[0].text)) {
    return [
      'Some of it still feels true. Talking about it didn’t make the feeling disappear.',
      'What part is still weighing on you?',
      warm ? 'Wanting company but not knowing how to join in. I still worry that being quiet looks like being unfriendly.' : `${space.charAt(0).toUpperCase() + space.slice(1)} is shared, but that doesn’t mean everyone finds it equally easy to speak up about it.`,
      'That helps me understand. I don’t think one conversation can settle how it feels to belong here.',
      'No, but being able to say it out loud makes a difference to me.',
    ][Math.min(thread.turns.length - 1, 4)];
  }
  // A coherent exchange remains available without inference, with distinct responses by nature.
  if (EVENTS.some(e => e.name === thread.topic)) {
    return [
      speaker.trait === 'reserved' ? 'I’m still sorting through it. I notice how much I want company afterwards, even when I don’t have words.' : `With ${thread.topic.toLowerCase()}, I noticed how differently we all respond. Did it make you feel closer to anyone?`,
      'Closer in some ways, but also aware of how little I know about what everyone else is carrying.',
      'Is that distance upsetting you, or does getting to know people slowly feel all right?',
      'A little of both. I want to belong here without pretending that we all experience the same thing.',
      'I can understand that. Hearing your side makes today feel less simple to me, too.',
    ][Math.min(thread.turns.length - 1, 4)];
  }
  const replies = warm ? [
    speaker.trait === 'practical' ? 'I find it easier to talk over a meal. Having something ordinary to do takes the pressure off.' : speaker.trait === 'reserved' ? 'I’d rather listen at first. Being quiet at the table doesn’t mean I want to be left out.' : 'Being included in the little things. Even an invitation to sit together helps.',
    'So being included matters, even without saying much. I sometimes mistake silence for wanting to be alone.',
    'Thank you for asking instead of assuming. What about you—what have you been missing?',
    'Someone who notices when I go quiet. I don’t always know how to ask for company.',
    'That makes sense. Sharing a table quietly feels different from sitting there alone.',
  ] : [
    speaker.trait === 'spirited' ? `A little, yes. I worry we’ll spend all our time debating ${space} and never agree on anything.` : `I’d worry that asking everyone about ${space} would mean nothing ever got decided.`,
    'I understand that worry. But it’s a shared space; a quick decision can still leave someone feeling shut out.',
    'Could we check with each other first next time, even if we don’t end up agreeing?',
    'That would help. I’m still upset, but I don’t want this to become the only way we talk.',
    'Neither do I. I’m not sure we agree yet, but I understand why having a say matters to you.',
  ];
  return replies[Math.min(thread.turns.length - 1, replies.length - 1)];
}
export function advanceConversations(world: WorldState) {
  for (const entry of world.history) {
    const thread = entry.conversation;
    if (!thread || thread.status !== 'active') continue;
    const people = entry.characters.map(id => world.characters.find(c => c.id === id));
    if (people.some(c => !c || c.away || c.inElevator) || people[0]!.floor !== people[1]!.floor) { finish(world, entry, true); continue; }
    if (world.minute < thread.nextTurnAt) continue;
    if (thread.turns.length >= thread.targetTurns) { finish(world, entry); continue; }
    const speaker = people[thread.turns.length % 2]!;
    const planned = thread.planned?.shift();
    const text = planned?.text ?? fallback(entry, speaker);
    thread.turns.push({ speakerId: speaker.id, text, minute: world.minute, ...(planned ? { generated: true } : {}) });
    if (planned) entry.generated = true;
    thread.nextTurnAt = world.minute + TURN_INTERVAL;
    for (const c of people) { c!.speech = undefined; c!.activity = c === speaker ? `talking with ${people.find(p => p !== c)!.name}` : `listening to ${speaker.name}`; }
    speaker.speech = text; speaker.speechUntil = thread.nextTurnAt;
  }
}
