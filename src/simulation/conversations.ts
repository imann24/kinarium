import { finishRepair, repairScene } from './repair';
import { EVENTS } from './catalog';
import { rememberEvent } from './memories';
import { chooseConversationScene } from './conversation-scenes';
import { conversationTitle } from './conversation-titles';
import type { Character, LogEntry, WorldState } from './types';

export const TURN_INTERVAL = 6;
export function isConversing(world: WorldState, id: string) {
  return world.history.some(e => e.conversation?.status === 'active' && e.characters.includes(id));
}
function finish(world: WorldState, entry: LogEntry, interrupted = false) {
  const thread = entry.conversation!;
  if (entry.kind === 'conflict' && !thread.repair) {
    const r = world.relationships[[...entry.characters].sort().join(':')];
    if (r) { r.unresolvedConflict = { id: entry.id, minute: world.minute, topic: thread.topic }; r.repairCommitment = undefined; }
  }
  finishRepair(world, entry, interrupted);
  thread.title = conversationTitle(world, entry);
  thread.status = interrupted ? 'interrupted' : 'finished';
  thread.planned = undefined;
  thread.fallbackTurns = undefined;
  // Only revealed turns are final; discarded planned replies never become memories.
  const transcript = thread.turns.map(t => `${world.characters.find(c => c.id === t.speakerId)?.name ?? t.speakerId}: “${t.text}”`).join(' ');
  for (const id of entry.characters) {
    const c = world.characters.find(c => c.id === id);
    if (!c) continue;
    const others = entry.characters.filter(other => other !== id).map(other => world.characters.find(p => p.id === other)?.name ?? other).join(' and ');
    rememberEvent(c, entry, `I ${thread.tone === 'tense' ? 'disagreed' : 'talked'} with ${others} about ${thread.topic.toLowerCase()}.${interrupted ? ' Our conversation was interrupted.' : ''} ${transcript}`, { tone: thread.tone, salience: thread.tone === 'tense' ? 3 : 1 });
    c.activity = 'reflecting on a conversation';
    c.speech = undefined;
  }
}
export function interruptConversations(world: WorldState, id: string) {
  for (const entry of world.history) if (entry.conversation?.status === 'active' && entry.characters.includes(id)) finish(world, entry, true);
}
export function beginConversation(world: WorldState, a: Character, b: Character, positive: boolean, repair?: NonNullable<ReturnType<typeof repairScene>>) {
  const scene = repair ?? chooseConversationScene(world, a, b, positive);
  const { topic } = scene;
  const text = scene.lines[0];
  const entry: LogEntry = { id: world.nextLog++, minute: world.minute, kind: positive ? 'conversation' : 'conflict', text: `${a.name} ${positive ? 'talks with' : 'has a disagreement with'} ${b.name}.${scene.eventText ? ` ${scene.eventText}` : ''}`, characters: [a.id, b.id], conversation: { repair: repair?.repair, generationAttempted: repair ? true : undefined, topic, sceneId: scene.id, fallbackTurns: scene.lines.slice(1), tone: positive ? 'warm' : 'tense', status: 'active', turns: [{ speakerId: a.id, text, minute: world.minute }], nextTurnAt: world.minute + TURN_INTERVAL, targetTurns: scene.lines.length } };
  entry.conversation!.title = conversationTitle(world, entry);
  world.history.push(entry);
  a.speech = text; a.speechUntil = world.minute + TURN_INTERVAL;
  a.activity = `talking with ${b.name}`; b.activity = `listening to ${a.name}`;
  return entry;
}
function fallback(entry: LogEntry, speaker: Character) {
  const thread = entry.conversation!;
  const scripted = thread.fallbackTurns?.[thread.turns.length - 1];
  if (scripted) return scripted;
  const warm = thread.tone === 'warm';
  const space = thread.topic.replace('Who gets a say in ', '');
  if (!warm) return [
    'I still disagree, even if I want to understand your view.',
    'What part do you think we are seeing differently?',
    'I don’t think we have settled that. I would rather leave it open than pretend we agree.',
    'We can pause here. A quieter ending does not mean this is resolved.',
  ][Math.min(thread.turns.length - 1, 3)];
  if (/^(Last time you said|I’m still uneasy|Could we try again|Our disagreement|I remember our time)/.test(thread.turns[0].text)) {
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
