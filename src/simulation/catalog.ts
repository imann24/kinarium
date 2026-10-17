import type { WorldTemplate } from './types';
import { RESIDENT_ROSTERS } from './residents';

// Templates are data. A future generator can validate and register the same shape.
export const TEMPLATES: Record<string, WorldTemplate> = {
  'common-house': {
    id: 'common-house', starterResidents: RESIDENT_ROSTERS['common-house'], name: 'The common house', description: 'Three floors, one elevator, a thousand small possibilities.',
    floors: [
      { name: 'The gathering room', purpose: 'share a meal', color: '#eccead' },
      { name: 'The quiet floor', purpose: 'find a little quiet', color: '#e6dcc8' },
      { name: 'The winter garden', purpose: 'tend the garden', color: '#cdd9be' },
    ],
    initialNames: ['Milo', 'Juniper', 'Cleo', 'Otis', 'Fern', 'Remy', 'Ada', 'Sol'],
  },
  'makers-house': {
    id: 'makers-house', starterResidents: RESIDENT_ROSTERS['makers-house'], name: 'The makers’ house', description: 'A busy workshop, a quiet retreat, and a studio full of unfinished ideas. Plenty of supplies; a few creative differences.',
    floors: [
      { name: 'The shared workshop', purpose: 'build something together', activity: 'sorting tools', color: '#e5c4a7' },
      { name: 'The reading nook', purpose: 'rest with a sketchbook', activity: 'sketching ideas', color: '#e8dbc7' },
      { name: 'The sunlit studio', purpose: 'make something useful', activity: 'mixing paints', color: '#dcd3df' },
    ],
    initialNames: ['Pip', 'Alma', 'Theo', 'Nia', 'Hugo', 'Esme', 'Jules', 'Ravi'],
    initialMetrics: { cohesion: 54, tension: 26, resources: 88 },
  },
  'harbor-house': {
    id: 'harbor-house', starterResidents: RESIDENT_ROSTERS['harbor-house'], name: 'The harbor house', description: 'A seaside kitchen, a sheltered lounge, and a net-mending loft. Close-knit neighbors make the most of modest supplies.',
    floors: [
      { name: 'The dockside kitchen', purpose: 'share a pot of chowder', activity: 'brewing seaside tea', color: '#e9d7bb' },
      { name: 'The sheltered lounge', purpose: 'rest out of the sea breeze', activity: 'reading tide charts', color: '#d6e1e1' },
      { name: 'The net-mending loft', purpose: 'repair nets and supplies', activity: 'mending fishing nets', color: '#c6d8de' },
    ],
    initialNames: ['Marin', 'Iona', 'Finn', 'Pearl', 'Casper', 'Rosa', 'Ari', 'Mae'],
    initialMetrics: { cohesion: 74, tension: 12, resources: 52 },
  },
};
/**
 * How an event touches each pair, kept separate from its material and house-wide effects:
 * `gathering` brings people together, `relief` is material help only, `strain` wears pairs thin.
 */
export type EventRelational = 'gathering' | 'relief' | 'neutral' | 'strain';
export interface EventDefinition { id: string; name: string; description: string; icon: string; tone: 'kind' | 'mixed' | 'disruptive'; relational: EventRelational; cohesion: number; tension: number; resources: number; mood: number; text: string; }
export const EVENTS: EventDefinition[] = [
  { id: 'shared-meal', name: 'A shared meal', description: 'Make room at the table. Small connections have to start somewhere.', icon: 'soup', tone: 'kind', relational: 'gathering', cohesion: 7, tension: -7, resources: -8, mood: 8, text: 'A long table is set for a shared meal. Someone brings bread; someone finally stays to talk.' },
  { id: 'care-package', name: 'An unexpected gift', description: 'A box of useful things arrives at the door.', icon: 'gift', tone: 'kind', relational: 'relief', cohesion: 3, tension: -3, resources: 22, mood: 5, text: 'An unmarked care package arrives. For a moment, everyone feels a little more looked after.' },
  { id: 'story-night', name: 'Stories after dark', description: 'Give old memories a place to become new traditions.', icon: 'moon', tone: 'kind', relational: 'gathering', cohesion: 10, tension: -5, resources: -3, mood: 6, text: 'The lamps are dimmed for story night. The house listens to stories it has never heard before.' },
  { id: 'community-gathering', name: 'A community gathering', description: 'Bring neighbors together to talk, ease tension and strengthen connection.', icon: 'message', tone: 'kind', relational: 'gathering', cohesion: 6, tension: -6, resources: -4, mood: 5, text: 'Chairs are drawn together for a community gathering. Neighbors exchange ideas, questions and a little laughter.' },
  { id: 'vulnerable-share', name: 'A vulnerable share out', description: 'Make room for honest stories and attentive listening. Sharing is optional.', icon: 'message', tone: 'kind', relational: 'gathering', cohesion: 8, tension: 0, resources: 0, mood: 4, text: 'A circle opens for a vulnerable share out. People can speak honestly or simply listen, with no demand to disclose.' },
  { id: 'group-meditation', name: 'A group meditation', description: 'Offer a shared pause to breathe and let some tension settle.', icon: 'moon', tone: 'kind', relational: 'gathering', cohesion: 0, tension: -6, resources: 0, mood: 3, text: 'The house makes time for a group meditation. A few quiet breaths offer a pause from the day’s friction.' },
  { id: 'new-project', name: 'A common project', description: 'Something to build together. Not everyone will agree on how.', icon: 'sprout', tone: 'mixed', relational: 'neutral', cohesion: 5, tension: 4, resources: -10, mood: 3, text: 'A plan for a shared garden takes shape. So do a few very different opinions about it.' },
  { id: 'power-outage', name: 'The lights go out', description: 'An interruption can bring people together—or wear them thin.', icon: 'zap', tone: 'disruptive', relational: 'strain', cohesion: -4, tension: 12, resources: -8, mood: -9, text: 'The house goes dark. Candles appear, patience thins, and neighbors learn who they can rely on.' },
  { id: 'rumor', name: 'A little rumor', description: 'A half-heard conversation takes on a life of its own.', icon: 'message', tone: 'disruptive', relational: 'strain', cohesion: -9, tension: 16, resources: 0, mood: -6, text: 'A rumor travels from floor to floor. No one is quite sure where it began.' },
];
export const TRAITS = ['kind', 'curious', 'reserved', 'spirited', 'practical'] as const;
export const COLORS = ['#ba7357', '#758969', '#d7ad55', '#6d9297', '#aa819b', '#7981a8', '#ba8e71', '#819b78'];
