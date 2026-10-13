import CharacterText from './CharacterText';
import { gameTime } from '../simulation/engine';
import type { Character, LogEntry } from '../simulation/types';
import './conversation-thread.css';

export default function ConversationThread({ entry, characters, onSelect }: { entry: LogEntry; characters: Character[]; onSelect?: (id: string) => void }) {
  const thread = entry.conversation!;
  const name = (id: string) => characters.find(c => c.id === id)?.name ?? 'Former resident';
  return <details className="conversation-thread" open={thread.status === 'active' ? true : undefined}>
    <summary><strong>{entry.characters.map(name).join(' & ')}</strong><span>{thread.topic}</span><small>{thread.turns.length} turns · {thread.status === 'active' ? 'In conversation' : thread.status === 'interrupted' ? 'Interrupted' : 'At a pause'}</small></summary>
    <ol aria-label={`Conversation between ${entry.characters.map(name).join(' and ')}`}>
      {thread.turns.map((turn, index) => <li key={index}><div className="conversation-speaker"><b>{onSelect ? <button type="button" className="character-name" aria-label={`View ${name(turn.speakerId)}'s profile`} onClick={() => onSelect(turn.speakerId)}>{name(turn.speakerId)}</button> : name(turn.speakerId)}</b><time>{gameTime(turn.minute)}</time></div><p>{onSelect ? <CharacterText text={turn.text} characters={characters} participants={entry.characters} onSelect={onSelect}/> : turn.text}</p>{turn.generated && <small className="ai-label">AI dialogue</small>}</li>)}
    </ol>
    {thread.status === 'active' && <small className="conversation-progress">The conversation is unfolding…</small>}
  </details>;
}
