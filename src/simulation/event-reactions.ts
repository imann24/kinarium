import type { EventDefinition, EventRelational } from './catalog';
import { communityStats, recordCommunityChange } from './community-state';
import { beginConversation, isConversing, nearby } from './conversations';
import { addGoodwill, goodwill } from './goodwill';
import { rememberEvent } from './memories';
import { repairReadiness } from './repair';
import { recordResidentChange, residentStats } from './resident-state';
import type { Character, Conversation, LogEntry, Relationship, Trait, WorldState } from './types';

/** How long a resident holds on to an intention to make a peace offering. */
export const GESTURE_WINDOW = 360;
/** Arriving with something in hand makes an offering easier to accept than words alone. */
export const GESTURE_WELCOME = .15;
/** Below this mood a resident keeps to themselves at an event. */
export const WITHDRAWN_MOOD = 20;

/** Events that ask residents to join in; someone struggling keeps to themselves instead. */
const JOINED: EventRelational[] = ['gathering', 'airing', 'faction', 'honor'];
/** Events that leave kind residents, and those with goodwill, ready to make a peace offering. */
const REACHING_OUT: EventRelational[] = ['gathering', 'relief', 'airing', 'hardship', 'honor'];

export interface Reaction {
  /** Completes "Fern …", for journal and cause text. */
  label: string; memory: string;
  mood?: number; energy?: number; belonging?: number;
  /** The resident's own contribution to the house, not the event's. */
  tension?: number; resources?: number;
  floor?: number;
}
type Reactions = Partial<Record<EventRelational, Reaction>>;

/** Temperament decides what each resident does with an event; residents' actions carry the house-wide follow-on. */
export const EVENT_REACTIONS: Record<Trait, Reactions> = {
  kind: {
    gathering: { label: 'made sure everyone had a seat', memory: 'I made sure everyone had a seat.', belonging: 2 },
    relief: { label: 'set some of the supplies aside for others', memory: 'I set some of the new supplies aside for others.', mood: 1 },
    strain: { label: 'checked on everyone', memory: 'I went around and checked on everyone.', belonging: 1, tension: -.5 },
    rest: { label: 'let someone else put the kettle on for once', memory: 'I let someone else put the kettle on for once.', mood: 1, energy: 3 },
    pairing: { label: 'took the harder half of the job', memory: 'I took the harder half of the job so my partner wouldn’t have to.', energy: -2, belonging: 1 },
    airing: { label: 'made sure every side was heard', memory: 'I made sure every side was heard, not just the loudest.', belonging: 1, tension: -1 },
    crowding: { label: 'made room for everyone downstairs', memory: 'I made room for everyone downstairs while the water was dealt with.', belonging: 1, energy: -2 },
    suspicion: { label: 'refused to point fingers', memory: 'I refused to point fingers at anyone, even in my head.', tension: -1 },
    quarrel: { label: 'stepped between them', memory: 'I stepped between them before it got any worse.', energy: -3, tension: -1 },
    scarcity: { label: 'gave away part of their share', memory: 'I gave part of my share to someone who needed it more.', energy: -3, belonging: 2 },
    sleepless: { label: 'made tea for anyone still awake', memory: 'I made tea for anyone still awake. There were a lot of us.', energy: -2, belonging: 1 },
    betrayal: { label: 'tried to comfort both of them', memory: 'I tried to comfort both of them. I don’t think either felt comforted.', energy: -2 },
    exclusion: { label: 'went looking for whoever was missing', memory: 'I noticed someone was missing from the list and went looking for them.', belonging: 1 },
    letdown: { label: 'promised everyone they would try again', memory: 'I promised everyone we would try again soon. I hope I’m right.', belonging: 1 },
    faction: { label: 'tried to keep both sides talking', memory: 'I tried to keep both sides talking to each other after the count.', energy: -2, tension: -1 },
    hardship: { label: 'reassured everyone they would manage', memory: 'I told everyone we would manage. Saying it helped me believe it.', belonging: 1, tension: -.5 },
    care: { label: 'sat up with the patient', memory: 'I sat up with them and kept the tea coming.', energy: -4, belonging: 2 },
    honor: { label: 'baked the cake in secret', memory: 'I baked the cake and kept it a secret all morning.', energy: -2, belonging: 1 },
  },
  practical: {
    gathering: { label: 'quietly took care of the dishes', memory: 'I took care of the dishes so others could keep talking.', mood: 1 },
    relief: { label: 'put the new supplies away', memory: 'I sorted and put away the new supplies.', resources: 2, floor: 2 },
    strain: { label: 'got to work fixing things', memory: 'I got to work fixing what I could.', mood: 1, tension: -1, floor: 2 },
    rest: { label: 'fixed one small thing, then stopped', memory: 'I fixed one small thing and then made myself stop.', mood: 1 },
    pairing: { label: 'showed their partner a faster way', memory: 'I showed my partner a faster way to do it.', mood: 1, resources: 1 },
    airing: { label: 'asked what could actually change', memory: 'I asked what could actually change, so it didn’t stay abstract.', tension: -.5 },
    crowding: { label: 'shut off the water and fetched buckets', memory: 'I shut off the water and fetched buckets before it spread.', resources: 3, energy: -4 },
    suspicion: { label: 'searched every shelf twice', memory: 'I searched every shelf twice. It wasn’t anywhere obvious.', energy: -3 },
    quarrel: { label: 'waited it out, then opened a window', memory: 'I waited for it to blow over, then opened a window.', tension: -.5 },
    scarcity: { label: 'stretched what was left with a careful plan', memory: 'I worked out how to stretch what was left until the next delivery.', resources: 3 },
    sleepless: { label: 'gave up on sleep and fixed the banging shutter', memory: 'I gave up on sleep and fixed the shutter that kept banging.', energy: -3, tension: -.5 },
    betrayal: { label: 'decided to keep their own news to themselves', memory: 'I decided to keep my own news to myself for a while.', belonging: -1 },
    exclusion: { label: 'suggested opening the plans up', memory: 'I suggested we open the plans up to everyone next time.', tension: -1 },
    letdown: { label: 'salvaged a smaller version of the plan', memory: 'I salvaged a smaller version of the plan, just around the house.', mood: 2 },
    faction: { label: 'counted the votes twice', memory: 'I counted the votes twice so nobody could argue with the tally.', tension: -.5 },
    hardship: { label: 'drew up a budget on the back of the bill', memory: 'I drew up a budget on the back of the bill itself.', resources: 3 },
    care: { label: 'made soup and drew up a rota', memory: 'I made soup and drew up a rota so nobody wore themselves out.', energy: -2, mood: 1 },
    honor: { label: 'hung the streamers', memory: 'I hung the streamers, straight, which took longer than it should have.', belonging: 1 },
  },
  reserved: {
    gathering: { label: 'stayed near the edge and tired early', memory: 'I stayed near the edge. It was nice, but tiring.', energy: -6, belonging: 1 },
    relief: { label: 'took a quiet moment with a cup of something new', memory: 'I took a quiet moment with something from the package.', mood: 1 },
    strain: { label: 'withdrew to the quiet floor', memory: 'I withdrew to the quiet floor until it passed.', mood: -1, floor: 1 },
    rest: { label: 'slept late and read in peace', memory: 'I slept late and read without interruption.', mood: 2, energy: 5 },
    pairing: { label: 'worked quietly beside their partner', memory: 'I worked quietly beside my partner. It was easier than talking.', belonging: 1 },
    airing: { label: 'said one hard thing, then went quiet', memory: 'I said one hard thing out loud. Then I needed to be quiet.', energy: -4, belonging: 1 },
    crowding: { label: 'felt crowded and short of air', memory: 'Everyone was crammed into one room. I couldn’t find a quiet corner.', mood: -3, energy: -3 },
    suspicion: { label: 'kept their door shut', memory: 'I kept my door shut. I didn’t want anyone wondering about me.', belonging: -2 },
    quarrel: { label: 'left the room as voices rose', memory: 'I left the room as soon as the voices rose.', mood: -2, floor: 1 },
    scarcity: { label: 'quietly ate less', memory: 'I quietly ate less and didn’t mention it to anyone.', energy: -4 },
    sleepless: { label: 'lay awake listening to the house', memory: 'I lay awake listening to the house creak and settle.', mood: -2 },
    betrayal: { label: 'resolved to say less from now on', memory: 'It made me resolve to say less from now on.', belonging: -2, mood: -1 },
    exclusion: { label: 'wondered if they would be next', memory: 'I wondered whether I’d be the one left off the list next time.', belonging: -2 },
    letdown: { label: 'was secretly a little relieved', memory: 'I was a little relieved, if I’m honest. A quiet evening suited me.', energy: 4 },
    faction: { label: 'voted quietly and slipped away', memory: 'I voted quietly and slipped away before the arguing started.', floor: 1 },
    hardship: { label: 'worried about it privately', memory: 'I worried about it privately, long after everyone went to bed.', mood: -2, energy: -2 },
    care: { label: 'left a book outside their door', memory: 'I left a book outside their door. I didn’t want to crowd them.', mood: 1 },
    honor: { label: 'wrote a long note in the card', memory: 'I wrote a long note in the card. It was easier than saying it.', belonging: 1 },
  },
  spirited: {
    gathering: { label: 'livened up the room', memory: 'I livened things up, and people laughed.', mood: 2, belonging: 2 },
    relief: { label: 'handed things out to everyone', memory: 'I handed things out to everyone.', mood: 1 },
    strain: { label: 'grew short-tempered', memory: 'I was short-tempered with everyone.', mood: -2, tension: .5 },
    rest: { label: 'grew restless by the afternoon', memory: 'I got restless by the afternoon. Resting is harder than it looks.', mood: -1 },
    pairing: { label: 'turned the chores into a race', memory: 'I turned the chores into a race, and we laughed.', mood: 2, energy: -2 },
    airing: { label: 'spoke up a little too sharply', memory: 'I spoke up a little too sharply.', mood: 1, tension: 1 },
    crowding: { label: 'made a game of bailing out', memory: 'I made a game of bailing out the floor. It helped, a little.', mood: 1, tension: -.5 },
    suspicion: { label: 'said aloud what others were thinking', memory: 'I said out loud what others were only thinking. It didn’t help.', mood: -1, tension: 1 },
    quarrel: { label: 'took a side, loudly', memory: 'I took a side, loudly. I regretted it a little afterwards.', tension: 1.5 },
    scarcity: { label: 'complained about the empty cupboards', memory: 'I complained about the empty cupboards to anyone who would listen.', mood: 1, tension: 1 },
    sleepless: { label: 'grew snappish by breakfast', memory: 'I was snappish by breakfast and knew it.', mood: -1, tension: 1 },
    betrayal: { label: 'said exactly what they thought of it', memory: 'I told everyone exactly what I thought of passing on secrets.', tension: 1 },
    exclusion: { label: 'went along with the plans anyway', memory: 'I went along with the plans anyway, and felt a little guilty.', mood: 1, tension: .5 },
    letdown: { label: 'took the disappointment hard', memory: 'I took it hard. I’d been looking forward to it all week.', mood: -4 },
    faction: { label: 'campaigned hard for their side', memory: 'I campaigned hard for my side. Maybe too hard.', mood: 1, tension: 1 },
    hardship: { label: 'rallied everyone to pitch in', memory: 'I rallied everyone to pitch in, and people did.', mood: 1, belonging: 1 },
    care: { label: 'kept the house noise down, mostly', memory: 'I tried to keep the noise down. Mostly I managed.', mood: -1 },
    honor: { label: 'led the singing', memory: 'I led the singing, badly and gladly.', mood: 2 },
  },
  curious: {
    gathering: { label: 'asked everyone questions', memory: 'I asked everyone questions and learned something new.', mood: 2 },
    relief: { label: 'opened the box first', memory: 'I opened the box first to see what was inside.', mood: 2 },
    strain: { label: 'tried to work out what had happened', memory: 'I tried to work out what had happened.', mood: -1 },
    rest: { label: 'wandered the house noticing things', memory: 'I wandered the house and noticed things I usually rush past.', mood: 2 },
    pairing: { label: 'asked their partner about themselves', memory: 'I asked my partner about themselves while we worked.', mood: 1, belonging: 1 },
    airing: { label: 'asked how the disagreements started', memory: 'I asked how the disagreements started. Some of it surprised me.', mood: 1 },
    crowding: { label: 'traced where the leak started', memory: 'I traced the leak back to where it started.', mood: 1 },
    suspicion: { label: 'pieced together who was where', memory: 'I pieced together who was where. It made me uneasy.', mood: -1 },
    quarrel: { label: 'tried to work out what set it off', memory: 'I tried to work out what really set it off.', mood: -1 },
    scarcity: { label: 'invented a meal from odds and ends', memory: 'I invented a meal from odds and ends. It was better than it sounds.', mood: 2, resources: 1 },
    sleepless: { label: 'watched the storm from the window', memory: 'I watched the storm from the window for hours.', mood: 1 },
    betrayal: { label: 'wondered what else had been passed along', memory: 'I wondered what else of mine had been passed along.', mood: -2 },
    exclusion: { label: 'asked who decided the list', memory: 'I asked who had decided the list. Nobody quite knew.', mood: -1 },
    letdown: { label: 'asked what went wrong', memory: 'I asked what went wrong. The answer was nobody’s fault.', mood: -1 },
    faction: { label: 'asked each side to explain itself', memory: 'I asked each side to explain itself before I voted.', mood: 1 },
    hardship: { label: 'read every line of the bill', memory: 'I read every line of the bill. One charge looked wrong.', resources: 1 },
    care: { label: 'looked up remedies', memory: 'I looked up remedies, some of them very odd.', mood: 1 },
    honor: { label: 'found out their favorite flavor', memory: 'I found out their favorite flavor without giving the game away.', mood: 1 },
  },
};

const bound = (n: number) => Math.max(0, Math.min(100, n));
const pairOf = (world: WorldState, a: string, b: string) => world.relationships[[a, b].sort().join(':')];

/**
 * Each present resident responds to an event in their own way, and some decide to make a
 * peace offering to someone they are at odds with. Returns who did what, for the journal.
 */
export function reactToEvent(world: WorldState, event: EventDefinition, occasion: LogEntry, people: Character[], focus = new Map<string, Reaction>()) {
  const beforeCommunity = communityStats(world);
  const reactions: { character: Character; label: string }[] = [];
  for (const c of people) {
    // Whoever the event singled out has their own experience of it, not a bystander's.
    const reaction = focus.get(c.id) ?? (c.mood < WITHDRAWN_MOOD && JOINED.includes(event.relational)
      ? { label: 'kept to themselves', memory: 'I didn’t have it in me to join in.' } as Reaction
      : EVENT_REACTIONS[c.trait][event.relational]);
    const tone = event.mood > 0 ? 'warm' : event.mood < 0 ? 'tense' : 'neutral';
    rememberEvent(c, occasion, `I was here for ${event.name.toLowerCase()}. ${event.text}${reaction ? ` ${reaction.memory}` : ''}`, { tone, salience: 3 });
    if (!reaction) continue;
    const before = residentStats(c);
    c.mood = bound(c.mood + (reaction.mood ?? 0));
    c.energy = bound(c.energy + (reaction.energy ?? 0));
    c.belonging = bound(c.belonging + (reaction.belonging ?? 0));
    world.tension = bound(world.tension + (reaction.tension ?? 0));
    world.resources = bound(world.resources + (reaction.resources ?? 0));
    if (reaction.floor !== undefined && !c.inElevator) c.destination = reaction.floor;
    c.activity = reaction.label;
    recordResidentChange(c, before, world.minute, `${event.name}: ${reaction.label}`, occasion.id);
    reactions.push({ character: c, label: reaction.label });
  }
  recordCommunityChange(world, beforeCommunity, `${event.name}: residents’ responses`, occasion.id);
  // Naming a disagreement in front of the house is itself a little good faith, and moves everyone involved to reach out.
  if (event.relational === 'airing') for (const [i, a] of people.entries()) for (const b of people.slice(i + 1)) {
    const r = pairOf(world, a.id, b.id);
    if (r?.unresolvedConflict) addGoodwill(r, 1, world.minute);
  }
  const gestures = REACHING_OUT.includes(event.relational)
    ? planGestures(world, event, occasion, people, event.relational === 'airing') : [];
  return { reactions, gestures };
}

/**
 * Pairs residents who know each other least, leaving open disagreements out of it: a chore is
 * no place to settle one. With an odd number, someone works alone.
 */
export function choosePartners(people: Character[], pair: (a: Character, b: Character) => Relationship) {
  const candidates = people.flatMap((a, i) => people.slice(i + 1).map(b => ({ a, b, r: pair(a, b) })))
    .filter(({ r }) => !r.unresolvedConflict)
    .sort((x, y) => x.r.affinity + x.r.trust - (y.r.affinity + y.r.trust) || x.r.encounters - y.r.encounters);
  const used = new Set<string>(), partners: [Character, Character][] = [];
  for (const { a, b } of candidates) {
    if (used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id); used.add(b.id); partners.push([a, b]);
  }
  return partners;
}

/**
 * Kind residents, and anyone who has already built some goodwill, use the moment to reach out.
 * After an airing, anyone at odds with someone here does.
 */
function planGestures(world: WorldState, event: EventDefinition, occasion: LogEntry, people: Character[], everyone = false) {
  const pending = world.pendingGestures ?? [];
  const planned: { from: Character; to: Character }[] = [];
  for (const from of people) {
    if (from.mood < WITHDRAWN_MOOD) continue;
    // The most recent open disagreement with someone who is here.
    const target = people.filter(to => to.id !== from.id)
      .map(to => ({ to, r: pairOf(world, from.id, to.id) }))
      .filter(({ r }) => r?.unresolvedConflict && (everyone || from.trait === 'kind' || goodwill(r) >= 2))
      .sort((x, y) => y.r.unresolvedConflict!.minute - x.r.unresolvedConflict!.minute)[0];
    if (!target || pending.some(g => [g.fromId, g.toId].sort().join(':') === [from.id, target.to.id].sort().join(':'))) continue;
    pending.push({ fromId: from.id, toId: target.to.id, conflictId: target.r.unresolvedConflict!.id, eventId: occasion.id, eventName: event.name, minute: world.minute });
    planned.push({ from, to: target.to });
    if (!from.inElevator) from.destination = target.to.floor;
    from.activity = `looking for ${target.to.name}`;
  }
  world.pendingGestures = pending.length ? pending : undefined;
  return planned;
}

export function gestureScene(world: WorldState, a: Character, b: Character, r: Relationship, eventName: string, roll: number) {
  const conflict = r.unresolvedConflict!;
  const accepted = roll < repairReadiness(world, a, b, r, 0, GESTURE_WELCOME);
  const topic = conflict.topic;
  const lines = [
    `After ${eventName.toLowerCase()}, I wanted to bring you something. I know ${topic.toLowerCase()} is still between us. This isn’t meant to settle it.`,
    accepted ? 'Thank you. That’s kind of you. It doesn’t fix everything, but it helps.' : 'Thanks, but I’m not ready to take anything from you yet.',
    accepted ? 'I’m glad. We can leave the rest for another day.' : 'That’s all right. I’ll leave it where you can find it, and you can decide.',
  ];
  return { eventText: undefined, id: 'repair:gesture', topic: 'A peace offering', lines, relevance: 100,
    repair: { conflictId: conflict.id, phase: 'gesture', accepted, topic } as NonNullable<Conversation['repair']> };
}

/**
 * Gives pending peace offerings when the pair is together and free. Offerings for a
 * disagreement that has since settled or changed, or that waited too long, are dropped.
 */
export function advanceGestures(world: WorldState, roll: () => number) {
  if (!world.pendingGestures?.length) return;
  const people = new Map(world.characters.map(c => [c.id, c]));
  const remaining = [];
  for (const g of world.pendingGestures) {
    const from = people.get(g.fromId), to = people.get(g.toId);
    const r = from && to && pairOf(world, from.id, to.id);
    if (!from || !to || !r || from.away || to.away || r.unresolvedConflict?.id !== g.conflictId || world.minute - g.minute > GESTURE_WINDOW) continue;
    if (!nearby(from, to) || isConversing(world, from.id) || isConversing(world, to.id) || from.energy < 15 || to.energy < 15) { remaining.push(g); continue; }
    beginConversation(world, from, to, true, gestureScene(world, from, to, r, g.eventName, roll()));
  }
  world.pendingGestures = remaining.length ? remaining : undefined;
}
