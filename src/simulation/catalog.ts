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
  // Hub and spokes: nearly every trip passes through one wide courtyard, while the
  // upper floors are small pockets at opposite ends of the house.
  'courtyard-house': {
    id: 'courtyard-house', starterResidents: RESIDENT_ROSTERS['courtyard-house'], name: 'The courtyard house', description: 'Everyone crosses the open courtyard. Above it, snug balcony nooks and a rooftop orchard at the far end. Many chance meetings, and nowhere to avoid them.',
    floors: [
      { name: 'The open courtyard', purpose: 'cross paths in the courtyard', activity: 'sweeping the flagstones', color: '#e6d2ae', draw: 2.4 },
      { name: 'The balcony nooks', purpose: 'share a quiet corner', activity: 'watching the courtyard', color: '#e2d6c4', span: [8, 40], draw: .6 },
      { name: 'The rooftop orchard', purpose: 'pick fruit together', activity: 'pruning the pear trees', color: '#cfdcb9', span: [44, 84], draw: .9 },
    ],
    initialNames: ['Lior', 'Dalia', 'Wynn', 'Odette', 'Kasim', 'Bree', 'Tove', 'Emil'],
    initialMetrics: { cohesion: 58, tension: 22, resources: 68 },
  },
  // A slender tower: every floor is narrow, and at night everyone climbs to the
  // lantern room, so the late hours are spent close together.
  'lantern-tower': {
    id: 'lantern-tower', starterResidents: RESIDENT_ROSTERS['lantern-tower'], name: 'The lantern tower', description: 'A slender tower with narrow rooms. Each night everyone climbs to the lantern room to keep the light. Close quarters bring warmth and friction.',
    floors: [
      { name: 'The lamplit pantry', purpose: 'share a late supper', activity: 'filling the oil cans', color: '#e8d2b4', span: [28, 66], draw: 1.2 },
      { name: 'The spiral library', purpose: 'read on the stairs', activity: 'shelving logbooks', color: '#dcd6c9', span: [28, 66], draw: .7 },
      { name: 'The lantern room', purpose: 'keep the light burning', activity: 'polishing the lens', color: '#e9dfb0', span: [36, 60], draw: 1.1 },
    ],
    nightFloor: 2,
    initialNames: ['Hesper', 'Corin', 'Maeve', 'Teodor', 'Lark', 'Ines', 'Rook', 'Elsa'],
    initialMetrics: { cohesion: 66, tension: 24, resources: 60 },
  },
};
/**
 * How an event touches each pair, kept separate from its material and house-wide effects:
 * `gathering` brings people together, `relief` is material help only, `strain` wears pairs thin,
 * `rest` gives everyone time apart, `pairing` matches residents who barely know each other, and
 * `airing` names open disagreements so the people involved reach out.
 *
 * The rest each single out who is touched (see event-consequences.ts): `crowding` packs everyone
 * into one room, `suspicion` falls on one resident, `quarrel` sets the most strained pair arguing,
 * `scarcity` hits whoever is already worn down, `sleepless` leaves the most tired snapping,
 * `betrayal` breaks the closest pair's trust, `exclusion` leaves someone out, `letdown` puts off
 * planned peace offerings, `faction` splits the house in two, `hardship` is a worry shared by all,
 * `care` gathers people around someone unwell, and `honor` celebrates whoever feels least at home.
 */
export type EventRelational = 'gathering' | 'relief' | 'neutral' | 'strain' | 'rest' | 'pairing' | 'airing'
  | 'crowding' | 'suspicion' | 'quarrel' | 'scarcity' | 'sleepless' | 'betrayal' | 'exclusion' | 'letdown' | 'faction' | 'hardship' | 'care' | 'honor';
export type EventTone = 'kind' | 'mixed' | 'disruptive';
export interface EventDefinition {
  id: string; name: string; description: string; icon: string; tone: EventTone; relational: EventRelational;
  cohesion: number; tension: number; resources: number; mood: number; text: string;
  /** Change to each present resident's energy; most events leave it alone. */
  energy?: number;
  /** Where residents head afterwards; kind events otherwise draw everyone to the ground floor. */
  floor?: number;
  /** For events that open a disagreement: what the pair will remember it being about. */
  conflictTopic?: string;
}
export const EVENTS: EventDefinition[] = [
  { id: 'shared-meal', name: 'A shared meal', description: 'Make room at the table. Small connections have to start somewhere.', icon: 'soup', tone: 'kind', relational: 'gathering', cohesion: 7, tension: -7, resources: -8, mood: 8, text: 'A long table is set for a shared meal. Someone brings bread; someone finally stays to talk.' },
  { id: 'care-package', name: 'An unexpected gift', description: 'A box of useful things arrives at the door.', icon: 'gift', tone: 'kind', relational: 'relief', cohesion: 3, tension: -3, resources: 22, mood: 5, text: 'An unmarked care package arrives. For a moment, everyone feels a little more looked after.' },
  { id: 'story-night', name: 'Stories after dark', description: 'Give old memories a place to become new traditions.', icon: 'moon', tone: 'kind', relational: 'gathering', cohesion: 10, tension: -5, resources: -3, mood: 6, text: 'The lamps are dimmed for story night. The house listens to stories it has never heard before.' },
  { id: 'community-gathering', name: 'A community gathering', description: 'Bring neighbors together to talk, ease tension and strengthen connection.', icon: 'message', tone: 'kind', relational: 'gathering', cohesion: 6, tension: -6, resources: -4, mood: 5, text: 'Chairs are drawn together for a community gathering. Neighbors exchange ideas, questions and a little laughter.' },
  { id: 'vulnerable-share', name: 'A vulnerable share out', description: 'Make room for honest stories and attentive listening. Sharing is optional.', icon: 'message', tone: 'kind', relational: 'gathering', cohesion: 8, tension: 0, resources: 0, mood: 4, text: 'A circle opens for a vulnerable share out. People can speak honestly or simply listen, with no demand to disclose.' },
  { id: 'group-meditation', name: 'A group meditation', description: 'Offer a shared pause to breathe and let some tension settle.', icon: 'moon', tone: 'kind', relational: 'gathering', cohesion: 0, tension: -6, resources: 0, mood: 3, text: 'The house makes time for a group meditation. A few quiet breaths offer a pause from the day’s friction.' },
  { id: 'quiet-day', name: 'A quiet day', description: 'Ask nothing of anyone for a while. Rest is easier when nobody has to earn it.', icon: 'armchair', tone: 'kind', relational: 'rest', cohesion: 0, tension: -4, resources: 0, mood: 2, energy: 15, floor: 1, text: 'The house declares a quiet day. No plans, no meetings; doors stay half open and the kettle stays warm.' },
  { id: 'birthday-surprise', name: 'A birthday surprise', description: 'Celebrate the resident who feels least at home. Everyone gets a little closer to them.', icon: 'cake', tone: 'kind', relational: 'honor', cohesion: 6, tension: -3, resources: -6, mood: 5, text: 'Someone remembers a birthday nobody else knew about. By evening there is a lopsided cake and a card signed by everyone.' },
  { id: 'new-project', name: 'A common project', description: 'Something to build together. Not everyone will agree on how.', icon: 'sprout', tone: 'mixed', relational: 'neutral', cohesion: 5, tension: 4, resources: -10, mood: 3, text: 'A plan for a shared garden takes shape. So do a few very different opinions about it.' },
  { id: 'chore-partners', name: 'Chore partners', description: 'Pair up residents who barely know each other to get the house in order.', icon: 'handshake', tone: 'mixed', relational: 'pairing', cohesion: 3, tension: 0, resources: 8, mood: 0, energy: -5, text: 'A chore list goes up with unlikely names paired beside each job. Some partners chat; some just pass the dishcloth.' },
  { id: 'clearing-air', name: 'Clearing the air', description: 'Name what is unresolved, out loud. Harder in the moment, easier afterwards.', icon: 'wind', tone: 'mixed', relational: 'airing', cohesion: 2, tension: 5, resources: 0, mood: -2, floor: 0, text: 'The house sits down to clear the air. Old disagreements are named plainly, and nobody is asked to settle them on the spot.' },
  { id: 'house-vote', name: 'A house vote', description: 'Put a real decision to a vote. Each side grows closer, and further from the other.', icon: 'vote', tone: 'mixed', relational: 'faction', cohesion: -2, tension: 7, resources: 0, mood: 0, text: 'The house votes on whether to turn the spare room into a workshop. Hands go up, and the count is close.' },
  { id: 'unexpected-bill', name: 'An unexpected bill', description: 'A repair bill nobody planned for. Shared worry drains supplies but draws people together.', icon: 'receipt', tone: 'mixed', relational: 'hardship', cohesion: 4, tension: 6, resources: -18, mood: -3, text: 'A repair bill arrives that nobody planned for. The house gathers round the kitchen table to work out how to pay it.' },
  { id: 'someone-ill', name: 'Someone falls ill', description: 'The most worn-out resident comes down with something. Who looks after them says a lot.', icon: 'thermometer', tone: 'mixed', relational: 'care', cohesion: 3, tension: 0, resources: -5, mood: -2, text: 'Someone comes down with a fever. The house goes quiet, and a tray of tea finds its way upstairs.' },
  { id: 'power-outage', name: 'The lights go out', description: 'An interruption can bring people together—or wear them thin.', icon: 'zap', tone: 'disruptive', relational: 'strain', cohesion: -4, tension: 12, resources: -8, mood: -9, text: 'The house goes dark. Candles appear, patience thins, and neighbors learn who they can rely on.' },
  { id: 'rumor', name: 'A little rumor', description: 'A half-heard conversation takes on a life of its own.', icon: 'message', tone: 'disruptive', relational: 'strain', cohesion: -9, tension: 16, resources: 0, mood: -6, text: 'A rumor travels from floor to floor. No one is quite sure where it began.' },
  { id: 'burst-pipe', name: 'A burst pipe', description: 'Water upstairs sends everyone into one crowded room. Old frictions have nowhere to go.', icon: 'droplets', tone: 'disruptive', relational: 'crowding', cohesion: -3, tension: 9, resources: -14, mood: -5, energy: -6, floor: 0, text: 'A pipe bursts upstairs. Buckets come out, the floors are closed off, and the whole house squeezes into one room downstairs.' },
  { id: 'missing-thing', name: 'Something goes missing', description: 'A treasured thing disappears, and suspicion settles on whoever feels least at home.', icon: 'package-search', tone: 'disruptive', relational: 'suspicion', cohesion: -7, tension: 11, resources: -4, mood: -4, text: 'Something treasured goes missing from the shared shelf. Nobody accuses anyone, but glances linger.' },
  { id: 'shouting-match', name: 'A shouting match', description: 'The two residents most at odds finally have it out. It opens a disagreement they will have to mend.', icon: 'megaphone', tone: 'disruptive', relational: 'quarrel', cohesion: -5, tension: 14, resources: 0, mood: -5, conflictTopic: 'Who raised their voice first', text: 'Voices rise in the hallway until the whole house can hear. Doors close softly on every floor.' },
  { id: 'lean-week', name: 'A lean week', description: 'The cupboards run low. Those already worn down feel it most.', icon: 'basket', tone: 'disruptive', relational: 'scarcity', cohesion: -2, tension: 7, resources: -20, mood: -4, energy: -8, text: 'Deliveries fall through and the cupboards run low. Portions shrink, and everyone notices who takes what.' },
  { id: 'sleepless-night', name: 'A sleepless night', description: 'A storm keeps the house awake. By morning, the most tired snap at each other.', icon: 'bed', tone: 'disruptive', relational: 'sleepless', cohesion: -1, tension: 6, resources: 0, mood: -3, energy: -22, text: 'A storm rattles the windows all night. Nobody sleeps much, and breakfast is very quiet.' },
  { id: 'broken-confidence', name: 'A broken confidence', description: 'Something told in private gets passed along. The closest pair in the house takes the hit.', icon: 'heart-crack', tone: 'disruptive', relational: 'betrayal', cohesion: -8, tension: 10, resources: 0, mood: -5, conflictTopic: 'A broken confidence', text: 'Something shared in confidence turns up in someone else’s mouth. The house gets careful about what it says.' },
  { id: 'left-out', name: 'Someone left out', description: 'Plans are made without the resident who feels least at home. Kind hearts may notice.', icon: 'user-minus', tone: 'disruptive', relational: 'exclusion', cohesion: -6, tension: 5, resources: 0, mood: -1, text: 'An outing is planned and the list goes round. Not everyone’s name is on it.' },
  { id: 'plans-fall-through', name: 'Plans fall through', description: 'Something everyone looked forward to is called off. Peace offerings get put off too.', icon: 'calendar-x', tone: 'disruptive', relational: 'letdown', cohesion: -3, tension: 3, resources: 0, mood: -8, text: 'The trip everyone was looking forward to is called off at the last minute. Coats go back on their hooks.' },
];
export const TRAITS = ['kind', 'curious', 'reserved', 'spirited', 'practical'] as const;
export const COLORS = ['#ba7357', '#758969', '#d7ad55', '#6d9297', '#aa819b', '#7981a8', '#ba8e71', '#819b78'];

/** The definition behind a recorded house event. Older saves lack the id, so fall back to the event's own text. */
export function eventDefinition(entry: { eventDefinitionId?: string; text: string } | undefined) {
  if (!entry) return undefined;
  return EVENTS.find(e => e.id === entry.eventDefinitionId) ?? EVENTS.find(e => e.text === entry.text);
}
