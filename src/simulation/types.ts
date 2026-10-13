export type TimeMode = 'persistent' | 'fast-forward';
export type Trait = 'kind' | 'curious' | 'reserved' | 'spirited' | 'practical';
export type LogKind = 'arrival' | 'departure' | 'conversation' | 'conflict' | 'friendship' | 'event' | 'ritual' | 'world';
export interface Memory { text: string; minute: number; }
export interface Character {
  id: string; name: string; color: string; trait: Trait; backstory: string;
  floor: number; x: number; destination: number; inElevator?: boolean; activity: string; away: boolean;
  mood: number; energy: number; belonging: number; memories: Memory[];
  speech?: string; speechUntil?: number;
}
export interface Relationship { a: string; b: string; affinity: number; trust: number; encounters: number; lastMinute: number; }
export interface LogEntry { id: number; minute: number; kind: LogKind; text: string; characters: string[]; generated?: boolean; }
export interface WorldSettings { mode: TimeMode; populationCap: number; }
export interface WorldState {
  version: 1; slug: string; name: string; description: string; templateId: string; createdAt: number;
  settings: WorldSettings; minute: number; lastTickAt: number; seed: number; nextCharacter: number;
  characters: Character[]; relationships: Record<string, Relationship>; history: LogEntry[]; nextLog: number;
  cohesion: number; tension: number; resources: number; elevatorFloor: number; elevatorDirection: number;
  cooldowns: Record<string, number>; lastRitualDay: number;
}
export interface WorldSummary { slug: string; name: string; description: string; templateId: string; createdAt: number; population: number; populationCap: number; mode: TimeMode; protected: boolean; cohesion: number; }
export interface Presence { id: string; name: string; color: string; }
export interface Snapshot { world: WorldState; presence: Presence[]; protected: boolean; serverNow: number; playerEvents: import('./event-budget').PlayerEventBudget; }
export type Command =
  | { type: 'add-character'; name?: string; trait?: Trait; backstory?: string }
  | { type: 'set-away'; characterId: string; away: boolean }
  | { type: 'trigger-event'; eventId: string }
  | { type: 'settings'; mode: TimeMode; populationCap: number };
export interface WorldTemplate { id: string; name: string; description: string; floors: { name: string; purpose: string; color: string }[]; initialNames: string[]; }
