import { gameTime } from '../simulation/engine';
import type { LogEntry, StoryHighlight, WorldState } from '../simulation/types';
import { recentActivity } from './community-insights';

const priority = { friendship: 3, conflict: 2, conversation: 1 };
type InteractionKind = keyof typeof priority;
export interface NarrativeMoment { id: number; minute: number; kind: InteractionKind | 'turning-point'; text: string; }
/** Turning points lead the reading, and are remembered for a full simulated day. */
const HIGHLIGHT_WINDOW = 1440;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
function turningPoint(entry: LogEntry, names: string, highlight: StoryHighlight) {
  const topic = entry.conversation?.repair?.topic;
  const about = topic ? ` about ${lower(topic)}` : '';
  return highlight === 'settled' ? `${names} settled their disagreement${about}.`
    : highlight === 'first-offer' ? `${names} agreed to try a new way through their disagreement${about}.`
    : highlight === 'turnaround' ? `${names} moved from a refused approach to a warmer conversation.`
    : `${names} are becoming real friends.`;
}

/** A local, deterministic reading of structured facts, never generated dialogue or motives. */
export function houseNarrative(world: WorldState) {
  const home = world.characters.filter(c => !c.away);
  const togetherness = world.cohesion > 65 ? 'strong' : world.cohesion > 40 ? 'moderate' : 'low';
  const tension = world.tension > 60 ? 'high' : world.tension > 30 ? 'moderate' : 'low';
  const atmosphere = home.length === 0 ? 'Nobody is at home right now; the house still holds its recorded stories.'
    : home.length === 1 ? 'One resident is at home right now; the journal can still hold encounters with neighbors who are away.'
    : `In the house right now, togetherness is ${togetherness} and tension is ${tension}.`;
  const activity = recentActivity(world);
  const residents = new Map(world.characters.map(c => [c.id, c.name]));
  // Select milestones and disagreements before ordinary conversations, then newest first.
  // One mention per pair avoids retelling an encounter through its milestone or later turns.
  const pair = (entry: LogEntry) => new Set(entry.characters).size === 2 && entry.characters.every(id => residents.has(id));
  const highlights = activity.entries.filter(entry => entry.highlight && entry.minute > world.minute - HIGHLIGHT_WINDOW && pair(entry))
    .sort((a, b) => b.minute - a.minute || b.id - a.id);
  const ordinary = activity.entries.filter((entry): entry is LogEntry & { kind: InteractionKind } =>
    !entry.highlight && Object.hasOwn(priority, entry.kind) && entry.minute > world.minute - 360 && pair(entry))
    .sort((a, b) => priority[b.kind] - priority[a.kind] || b.minute - a.minute || b.id - a.id);
  const candidates = [...highlights, ...ordinary];
  const pairs = new Set<string>();
  const moments: NarrativeMoment[] = [];
  for (const entry of candidates) {
    const ids = [...new Set(entry.characters)].sort();
    const key = JSON.stringify(ids);
    if (pairs.has(key)) continue;
    pairs.add(key);
    const names = ids.map(id => residents.get(id)!).join(' and ');
    if (entry.highlight) { moments.push({ id: entry.id, minute: entry.minute, kind: 'turning-point', text: turningPoint(entry, names, entry.highlight) }); if (moments.length === 2) break; continue; }
    const kind = entry.kind as InteractionKind;
    const text = kind === 'friendship' ? `A friendship milestone is recorded for ${names}.`
      : kind === 'conflict' ? `${names} appear in a recorded disagreement.`
      : `A conversation between ${names} is on record.`;
    moments.push({ id: entry.id, minute: entry.minute, kind, text });
    if (moments.length === 2) break;
  }
  const coverage = activity.earliest === null ? 'No journal entries are available yet.'
    : `Retained journal begins at ${gameTime(activity.earliest)}. ${activity.truncated ? 'Older entries are outside this snapshot. ' : ''}Missing records or skipped catch-up time may hide activity.`;
  return { atmosphere, moments, coverage,
    empty: 'No recent interactions can be described from the available records; this does not mean none occurred.' };
}
