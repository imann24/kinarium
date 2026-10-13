import type { WorldTemplate } from './types';

// Templates are data. A future generator can validate and register the same shape.
export const TEMPLATES: Record<string, WorldTemplate> = {
  'common-house': {
    id: 'common-house', name: 'The common house', description: 'Three floors, one elevator, a thousand small possibilities.',
    floors: [
      { name: 'The gathering room', purpose: 'share a meal', color: '#eccead' },
      { name: 'The quiet floor', purpose: 'find a little quiet', color: '#e6dcc8' },
      { name: 'The winter garden', purpose: 'tend the garden', color: '#cdd9be' },
    ],
    initialNames: ['Milo', 'Juniper', 'Cleo', 'Otis', 'Fern', 'Remy', 'Ada', 'Sol'],
  },
};
export interface EventDefinition { id: string; name: string; description: string; icon: string; tone: 'kind' | 'mixed' | 'disruptive'; cohesion: number; tension: number; resources: number; mood: number; text: string; }
export const EVENTS: EventDefinition[] = [
  { id: 'shared-meal', name: 'A shared meal', description: 'Make room at the table. Small connections have to start somewhere.', icon: 'soup', tone: 'kind', cohesion: 7, tension: -7, resources: -8, mood: 8, text: 'A long table is set for a shared meal. Someone brings bread; someone finally stays to talk.' },
  { id: 'care-package', name: 'An unexpected gift', description: 'A box of useful things arrives at the door.', icon: 'gift', tone: 'kind', cohesion: 3, tension: -3, resources: 22, mood: 5, text: 'An unmarked care package arrives. For a moment, everyone feels a little more looked after.' },
  { id: 'story-night', name: 'Stories after dark', description: 'Give old memories a place to become new traditions.', icon: 'moon', tone: 'kind', cohesion: 10, tension: -5, resources: -3, mood: 6, text: 'The lamps are dimmed for story night. The house listens to stories it has never heard before.' },
  { id: 'new-project', name: 'A common project', description: 'Something to build together. Not everyone will agree on how.', icon: 'sprout', tone: 'mixed', cohesion: 5, tension: 4, resources: -10, mood: 3, text: 'A plan for a shared garden takes shape. So do a few very different opinions about it.' },
  { id: 'power-outage', name: 'The lights go out', description: 'An interruption can bring people together—or wear them thin.', icon: 'zap', tone: 'disruptive', cohesion: -4, tension: 12, resources: -8, mood: -9, text: 'The house goes dark. Candles appear, patience thins, and neighbors learn who they can rely on.' },
  { id: 'rumor', name: 'A little rumor', description: 'A half-heard conversation takes on a life of its own.', icon: 'message', tone: 'disruptive', cohesion: -9, tension: 16, resources: 0, mood: -6, text: 'A rumor travels from floor to floor. No one is quite sure where it began.' },
];
export const TRAITS = ['kind', 'curious', 'reserved', 'spirited', 'practical'] as const;
export const COLORS = ['#ba7357', '#758969', '#d7ad55', '#6d9297', '#aa819b', '#7981a8', '#ba8e71', '#819b78'];
