import { gameTime } from '../simulation/engine';
import type { Character, Relationship, RelationshipPerspective, RelationshipThread, RememberedWords, Trait } from '../simulation/types';
import { bondKind, type BondKind } from './relationship-label';

export interface StoryPoint { key: string; title: string; detail: string; mended?: string; }
export interface ResidentView { from: Character; to: Character; feeling: string; details: string[]; words?: RememberedWords & { tone: 'warm' | 'tense' }; }
export interface RelationshipNarrative { story: string[]; connections: StoryPoint[]; disagreements: StoryPoint[]; views: [ResidentView, ResidentView]; recorded: boolean; }

const lower = (topic: string) => topic.charAt(0).toLowerCase() + topic.slice(1);
const times = (n: number) => n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
const points = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? 'point' : 'points'}`;
const empty: RelationshipPerspective = { reachedOut: 0, repairsOffered: 0, spaceRequested: 0, promisesKept: 0 };

// How one resident reads the other's temperament, colored by how things stand between them.
const impressions: Record<Trait, Record<'warm' | 'tense' | 'neutral', string>> = {
  kind: { warm: 'a steady, generous presence', tense: 'well-meaning, but quick to step in', neutral: 'gentle, if still hard to know' },
  curious: { warm: 'good company for wondering aloud', tense: 'full of questions that can feel like prying', neutral: 'always asking about something' },
  reserved: { warm: 'quiet company that never needs filling', tense: 'hard to read', neutral: 'quiet, and still something of a mystery' },
  spirited: { warm: 'a spark that livens up a room', tense: 'quick to push back', neutral: 'lively and hard to ignore' },
  practical: { warm: 'dependable whenever something needs doing', tense: 'brisk, sometimes more about the task than the person', neutral: 'usually busy with something useful' },
};

function connectionPoint(t: RelationshipThread): StoryPoint {
  const title = t.source === 'event' ? t.topic : t.source === 'repair' ? `Making amends after “${lower(t.topic)}”` : `Talking about ${lower(t.topic)}`;
  const what = t.source === 'event' ? `Shared ${times(t.count)}` : t.source === 'repair' ? `Worked on ${times(t.count)}` : `Came up ${times(t.count)}`;
  return { key: `${t.source}:${t.topic}`, title, detail: `${what}, drawing them ${points(t.impact)} closer · last on ${gameTime(t.lastMinute)}` };
}
function disagreementPoint(t: RelationshipThread): StoryPoint {
  const title = t.source === 'event' ? t.topic : `Clashing over ${lower(t.topic)}`;
  const what = t.source === 'event' ? `Strained them ${times(t.count)}` : `Flared up ${times(t.count)}`;
  return { key: `${t.source}:${t.topic}`, title, detail: `${what}, pushing them ${points(t.impact)} apart · last on ${gameTime(t.lastMinute)}`,
    mended: t.mendedMinute === undefined ? undefined : `Mended on ${gameTime(t.mendedMinute)}` };
}

function view(r: Relationship, from: Character, to: Character): ResidentView {
  const mine = r.story?.perspectives[from.id] ?? empty, theirs = r.story?.perspectives[to.id] ?? empty;
  const kind = bondKind(r);
  const feeling = kind === 'unmet' ? `${from.name} hasn’t really met ${to.name} yet.`
    : kind === 'close' ? r.trust > 60 ? `${from.name} counts ${to.name} among the people they trust most here.` : `${from.name} is fond of ${to.name}, and feels able to trust them.`
    : kind === 'strained' ? r.trust < 25 ? `${from.name} is wary of ${to.name} and keeps a careful distance.` : `${from.name} finds ${to.name} difficult, but hasn’t given up on them.`
    : kind === 'repairing' ? `${from.name} knows a promise to repair their disagreement is still awaiting follow-through.`
    : kind === 'easing' ? `${from.name} still remembers their disagreement with ${to.name}, but the goodwill between them is easing it.`
    : kind === 'warm' ? `${from.name} is fond of ${to.name}, though trust is still catching up.`
    : kind === 'familiar' ? `${from.name} knows ${to.name}, but they are not close at present.`
    : r.trust > 55 ? `${from.name} trusts ${to.name}, without feeling close to them.` : `${from.name} is still making up their mind about ${to.name}.`;
  const tone = kind === 'close' || kind === 'warm' ? 'warm' : kind === 'strained' || kind === 'repairing' ? 'tense' : 'neutral';
  const details = kind === 'unmet' ? [] : [`To ${from.name}, ${to.name} is ${impressions[to.trait][tone]}.`];
  if (mine.reachedOut >= 2 && mine.reachedOut >= theirs.reachedOut * 2) details.push(`${from.name} is usually the one to seek ${to.name} out.`);
  else if (theirs.reachedOut >= 2 && theirs.reachedOut >= mine.reachedOut * 2) details.push(`${from.name} has noticed ${to.name} tends to come to them first.`);
  if (theirs.promisesKept) details.push(`${from.name} saw ${to.name} keep their word after a disagreement.`);
  else if (theirs.repairsOffered) details.push(`${from.name} remembers ${to.name} reaching out to make things right.`);
  if (mine.spaceRequested && r.unresolvedConflict) details.push(`${from.name} has asked ${to.name} for space and isn’t ready to revisit it yet.`);
  else if (mine.spaceRequested) details.push(`${from.name} once asked ${to.name} for space, and it was respected.`);
  // Recall the words that fit where things stand now, falling back to whatever was heard.
  const preferHard = kind === 'strained' || (!!r.unresolvedConflict && kind !== 'close');
  const [first, second] = preferHard ? [mine.hardWords, mine.warmWords] : [mine.warmWords, mine.hardWords];
  const heard = first ?? second;
  const words = heard && { ...heard, tone: heard === mine.hardWords ? 'tense' as const : 'warm' as const };
  return { from, to, feeling, details, words };
}

/** A deterministic reading of recorded relationship facts; it never invents motives or events. */
export function relationshipNarrative(r: Relationship, a: Character, b: Character): RelationshipNarrative {
  const s = r.story;
  const story: string[] = [];
  const opening = s?.beginning
    ? `${a.name} and ${b.name} first met on ${gameTime(s.beginning.minute)}, ${s.beginning.tone === 'warm' ? 'talking about' : 'in a disagreement over'} ${lower(s.beginning.topic)}.`
    : r.encounters ? `${a.name} and ${b.name} have met ${times(r.encounters)}; how it began predates these records.`
    : `${a.name} and ${b.name} haven’t had a conversation of their own yet.`;
  story.push(s?.friendsMinute === undefined ? opening : `${opening} By ${gameTime(s.friendsMinute)}, they were becoming real friends.`);
  const closer = s?.connections.reduce((sum, t) => sum + t.impact, 0) ?? 0, apart = s?.disagreements.reduce((sum, t) => sum + t.impact, 0) ?? 0;
  const top = s?.connections[0], sore = s?.disagreements.find(t => t.mendedMinute === undefined) ?? s?.disagreements[0];
  if (top || sore) {
    const arc = closer >= apart * 2 ? 'Most of what has passed between them has drawn them closer'
      : apart >= closer * 2 ? 'Their time together has been marked more by friction than ease'
      : 'Warmth and friction have both left their mark';
    const reasons = [top && `${lower(connectionPoint(top).title)} brought them together`, sore && `${lower(disagreementPoint(sore).title)} ${sore.mendedMinute === undefined ? 'still pulls them apart' : 'once pulled them apart'}`].filter(Boolean);
    story.push(`${arc}: ${reasons.join(', while ')}.`);
  }
  const kind = bondKind(r);
  const currentStates: Record<BondKind, string> = {
    close: 'Today they are close', warm: 'Today they are fond of each other but cautious',
    trusted: 'Today they trust each other without being close', familiar: 'Today they are familiar but distant',
    repairing: 'Today a repair is promised but still awaits follow-through', easing: 'Today goodwill is easing an old disagreement', strained: 'Today the connection is strained',
    forming: 'Today they are still getting to know each other', unmet: 'For now they are yet to meet',
  };
  const now = currentStates[kind];
  const trust = r.trust > 60 ? 'trust runs deep' : r.trust < 25 ? 'trust is thin' : 'trust is steady but modest';
  let current = kind === 'unmet' ? `${now}.` : `${now}, and ${trust}.`;
  if (r.unresolvedConflict) current += ` Their disagreement about ${lower(r.unresolvedConflict.topic)} from ${gameTime(r.unresolvedConflict.minute)} is still unresolved.`;
  const promiser = r.repairCommitment && [a, b].find(c => c.id === r.repairCommitment!.initiatorId);
  if (promiser) current += ` ${promiser.name} has promised to ask first next time.`;
  story.push(current);
  return { story, recorded: !!s, connections: s?.connections.map(connectionPoint) ?? [], disagreements: s?.disagreements.map(disagreementPoint) ?? [],
    views: [view(r, a, b), view(r, b, a)] };
}
