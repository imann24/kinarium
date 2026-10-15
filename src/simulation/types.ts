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
  id: string; name: string; color: string; trait: Trait; backstory: string;
  floor: number; x: number; destination: number; inElevator?: boolean; activity: string; away: boolean;
  mood: number; energy: number; belonging: number; memories: Memory[];
  /** Actual bounded deltas from recent discrete effects; absent in older saves. */
  stateChanges?: ResidentStateChange[];
  speech?: string; speechUntil?: number;
}
export interface Relationship { a: string; b: string; affinity: number; trust: number; encounters: number; lastMinute: number; lastRepairMinute?: number; repairedConflictId?: number; unresolvedConflict?: { id: number; minute: number; topic: string }; repairCommitment?: { conflictId: number; initiatorId: string }; }
export interface ConversationTurn { speakerId: string; text: string; minute: number; generated?: boolean; }
export interface Conversation {
  topic: string; title?: string; tone: 'warm' | 'tense'; status: 'active' | 'finished' | 'interrupted';
  turns: ConversationTurn[]; nextTurnAt: number; targetTurns: number;
  /** Saved procedural arc; absent in legacy threads. Never treated as revealed dialogue. */
  sceneId?: string; fallbackTurns?: string[];
  repair?: { conflictId: number; phase: 'offer' | 'follow-through'; accepted: boolean };
  planned?: { speakerId: string; text: string }[]; generationAttempted?: boolean;
}
export interface LogEntry { id: number; minute: number; kind: LogKind; text: string; characters: string[]; generated?: boolean; conversation?: Conversation; }
export interface WorldSettings { mode: TimeMode; populationCap: number; }
export interface WorldState {
  version: 1; slug: string; name: string; description: string; templateId: string; createdAt: number;
  /** Older snapshots begin at revision zero. Independent of simulation ticks/settings. */
  detailsRevision?: number;
  settings: WorldSettings; minute: number; lastTickAt: number; seed: number; nextCharacter: number;
  characters: Character[]; relationships: Record<string, Relationship>; history: LogEntry[]; nextLog: number;
  cohesion: number; tension: number; resources: number; elevatorFloor: number; elevatorDirection: number;
  /** Missing in older snapshots; treated as stopped on their next step. */
  elevatorPhase?: 'moving' | 'stopped';
  cooldowns: Record<string, number>; lastRitualDay: number;
}
export interface WorldSummary { slug: string; name: string; description: string; templateId: string; createdAt: number; population: number; populationCap: number; mode: TimeMode; protected: boolean; cohesion: number; }
export interface Presence { id: string; name: string; color: string; }
export interface Snapshot { world: WorldState; presence: Presence[]; protected: boolean; serverNow: number; playerEvents: import('./event-budget').PlayerEventBudget; }
export type Command =
  | { type: 'house-details'; name: string; description: string; expectedRevision: number }
  | { type: 'add-character'; name?: string; trait?: Trait; backstory?: string }
  | { type: 'set-away'; characterId: string; away: boolean }
  | { type: 'trigger-event'; eventId: string }
  | { type: 'settings'; mode: TimeMode; populationCap: number };
export interface WorldTemplate {
  id: string; name: string; description: string;
  // v1 houses share three floors: gathering, rest, and resource production.
  floors: { name: string; purpose: string; color: string; activity?: string }[];
  initialNames: string[];
  starterResidents: readonly Pick<Character, 'name' | 'trait' | 'backstory'>[];
  initialMetrics?: { cohesion: number; tension: number; resources: number };
}
