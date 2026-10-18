export type TimeMode = 'persistent' | 'fast-forward';
export type Trait = 'kind' | 'curious' | 'reserved' | 'spirited' | 'practical';
export type LogKind = 'arrival' | 'departure' | 'conversation' | 'conflict' | 'friendship' | 'event' | 'ritual' | 'world';
export interface Memory {
  text: string; minute: number;
  /** Optional so existing saved memories stay intact, without invented provenance. */
  eventId?: number; kind?: LogKind; participantIds?: string[];
  tone?: 'warm' | 'tense' | 'neutral'; salience?: number;
}
export interface ResidentStats { mood: number; energy: number; belonging: number; }
export interface ResidentStateChange extends ResidentStats { minute: number; cause: string; eventId: number; }
export interface Character {
  model?: string;
  id: string; name: string; color: string; trait: Trait; backstory: string;
  floor: number; x: number; destination: number; inElevator?: boolean; activity: string; away: boolean;
  mood: number; energy: number; belonging: number; memories: Memory[];
  /** Actual bounded deltas from recent discrete effects; absent in older saves. */
  stateChanges?: ResidentStateChange[];
  /** Limits restorative company across different partners as well as repeated pairs. */
  lastQuietMinute?: number;
  /** Display-only cached history; optional for legacy saves. */
  residentSummary?: import('./resident-summary').SavedResidentSummary;
  speech?: string; speechUntil?: number;
  /** Journal entry that produced this utterance; absent for legacy/unlinked speech. */
  speechConversationId?: number;
  /** Chosen look; absent until someone edits it, so the sprite falls back to its id-based look. */
  appearance?: ResidentAppearance;
}
/** Indexes into the sprite's fixed skin, hair style and hair color options. */
export interface ResidentAppearance { skinTone: number; hairStyle: number; hairColor: number; }
/** One subject that repeatedly moved a pair closer or further apart. `impact` is affinity moved, always positive. */
export interface RelationshipThread {
  topic: string; source: 'conversation' | 'event' | 'repair'; count: number; impact: number;
  firstMinute: number; lastMinute: number; lastEventId: number;
  /** Set when a later repair settled this disagreement; cleared if it flares up again. */
  mendedMinute?: number;
}
/** `group` marks words heard in a gathering; one-to-one words are more personal and take precedence. */
export interface RememberedWords { speakerId: string; text: string; minute: number; eventId: number; group?: true; }
/** What one resident has done toward, and heard from, the other. Keyed by the holder's id. */
export interface RelationshipPerspective {
  reachedOut: number; repairsOffered: number; spaceRequested: number; promisesKept: number;
  warmWords?: RememberedWords; hardWords?: RememberedWords;
}
/** The course of repair for one disagreement, so repeated attempts read as one story. */
export interface RepairArc {
  conflictId: number; topic: string;
  /** Bids, follow-throughs and peace offerings that reached their end. */
  attempts: number; accepted: number;
  /** Requests for space, each one honored. */
  spaceGiven: number;
  state: 'open' | 'eased' | 'settled';
  firstMinute: number; lastMinute: number; lastEventId: number;
}
/** Bounded, durable relationship history; absent in older saves and for pairs with no shared moments. */
export interface RelationshipStory {
  beginning?: { minute: number; eventId: number; topic: string; tone: 'warm' | 'tense' };
  friendsMinute?: number;
  connections: RelationshipThread[]; disagreements: RelationshipThread[];
  perspectives: Record<string, RelationshipPerspective>;
  /** Newest last; absent in older saves. */
  arcs?: RepairArc[];
}
export interface Relationship {
  a: string; b: string; affinity: number; trust: number; encounters: number; lastMinute: number;
  lastRepairMinute?: number; repairedConflictId?: number;
  /** Recovery cooldowns and continuously observed quiet time; optional for older saves. */
  lastConnectionMinute?: number; quietSince?: number; quietLastMinute?: number; lastQuietMinute?: number;
  unresolvedConflict?: { id: number; minute: number; topic: string };
  repairCommitment?: { conflictId: number; initiatorId: string };
  /** 0–10, earned by honoring each other's choices; absent (0) in older saves. */
  goodwill?: number;
  /** When goodwill first eased the current conflict; cleared by a new conflict. */
  easedMinute?: number;
  /** When a repair bid or offering was last declined; cleared once warmth follows. */
  lastRefusedMinute?: number;
  /** Latest quarrel, including flare-ups of an open disagreement; absent in older saves. */
  lastQuarrelMinute?: number;
  /** Refused repair attempts on one conflict, for backing off between bids. */
  repairRefusals?: { conflictId: number; count: number };
  story?: RelationshipStory;
}
export interface ConversationTurn { speakerId: string; text: string; minute: number; generated?: boolean; }
export interface Conversation {
  /** Absent in persisted legacy pairs. */
  proximity?: boolean; joinedAtTurn?: Record<string, number>;
  topic: string; title?: string; tone: 'warm' | 'tense'; status: 'active' | 'finished' | 'interrupted';
  turns: ConversationTurn[]; nextTurnAt: number; targetTurns: number;
  /** Saved procedural arc; absent in legacy threads. Never treated as revealed dialogue. */
  sceneId?: string; fallbackTurns?: string[];
  /** `topic` names the original disagreement; absent in older saves. */
  repair?: { conflictId: number; phase: 'offer' | 'follow-through' | 'gesture'; accepted: boolean; applied?: boolean; topic?: string };
  planned?: { speakerId: string; text: string }[]; generationAttempted?: boolean;
}
export type StoryHighlight = 'first-offer' | 'settled' | 'friendship' | 'turnaround';
export interface LogEntry { id: number; minute: number; kind: LogKind; text: string; characters: string[]; generated?: boolean; conversation?: Conversation;
  /** A turning point worth leading the story with; absent for ordinary moments and older saves. */
  highlight?: StoryHighlight;
  /** The house event definition behind an `event` entry; older saves are matched by text. */
  eventDefinitionId?: string; }
/** A resident's intention, prompted by a house event, to make a peace offering to someone they are at odds with. */
export interface PendingGesture { fromId: string; toId: string; conflictId: number; eventId: number; eventName: string; minute: number; }
export interface WorldSettings { mode: TimeMode; populationCap: number; }
export interface WorldState {
  version: 1; slug: string; name: string; description: string; templateId: string; createdAt: number;
  /** Older snapshots begin at revision zero. Independent of simulation ticks/settings. */
  detailsRevision?: number;
  settings: WorldSettings; minute: number; lastTickAt: number; seed: number; nextCharacter: number;
  characters: Character[]; relationships: Record<string, Relationship>; history: LogEntry[]; nextLog: number;
  communityChanges?: import('./community-state').CommunityChange[];
  cohesion: number; tension: number; resources: number; elevatorFloor: number; elevatorDirection: number;
  /** Missing in older snapshots; treated as stopped on their next step. */
  elevatorPhase?: 'moving' | 'stopped';
  cooldowns: Record<string, number>; lastRitualDay: number;
  /** After a material gift, supplies ease worries until this minute; absent in older saves. */
  reliefUntil?: number;
  /** Peace offerings residents decided on after a house event, given when the pair next meets. */
  pendingGestures?: PendingGesture[];
}
/** Just enough of a resident to draw them in a directory preview. */
export interface ResidentPreview { id: string; name: string; color: string; appearance?: ResidentAppearance; floor: number; x: number; inElevator?: true; }
export interface WorldSummary {
  slug: string; name: string; description: string; templateId: string; createdAt: number; population: number; populationCap: number; mode: TimeMode; protected: boolean; cohesion: number;
  /** Residents at home when the summary was taken; absent in summaries indexed before previews existed. */
  residents?: ResidentPreview[]; elevatorFloor?: number;
}
export interface Presence { id: string; name: string; color: string; }
export interface Snapshot { models?: { allowed: string[]; defaultModel: string | null }; world: WorldState; presence: Presence[]; protected: boolean; serverNow: number; playerEvents: import('./event-budget').PlayerEventBudget; }
export type Command =
  | { type: 'house-details'; name: string; description: string; expectedRevision: number }
  | { type: 'add-character'; name?: string; trait?: Trait; backstory?: string }
  | { type: 'rename-character'; characterId: string; name: string }
  | { type: 'set-model'; characterId: string; model?: string }
  | { type: 'set-away'; characterId: string; away: boolean }
  | { type: 'set-appearance'; characterId: string; color: string; appearance: ResidentAppearance }
  | { type: 'trigger-event'; eventId: string }
  | { type: 'settings'; mode: TimeMode; populationCap: number };
export interface WorldTemplate {
  id: string; name: string; description: string;
  // v1 houses share three floors: gathering, rest, and resource production.
  // Layout: `span` bounds where residents wander on a floor (map units, default 8–84),
  // `draw` weights how often residents choose it as a destination (default 1).
  floors: { name: string; purpose: string; color: string; activity?: string; span?: readonly [number, number]; draw?: number }[];
  // Where residents settle at night (default: the rest floor, 1).
  nightFloor?: number;
  initialNames: string[];
  starterResidents: readonly Pick<Character, 'name' | 'trait' | 'backstory'>[];
  initialMetrics?: { cohesion: number; tension: number; resources: number };
}
