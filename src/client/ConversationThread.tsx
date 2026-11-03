import { ChevronDown } from 'lucide-react';
import CharacterText from './CharacterText';
import { gameTime } from '../simulation/engine';
import type { Character, LogEntry } from '../simulation/types';
import './conversation-thread.css';

export default function ConversationThread({ entry, characters, onSelect, expanded = false, journal = false }: { entry: LogEntry; characters: Character[]; onSelect?: (id: string) => void; expanded?: boolean; journal?: boolean }) {
  const thread = entry.conversation!;
  const name = (id: string) => characters.find(c => c.id === id)?.name ?? 'Former resident';
  const status = <small>{entry.characters.length > 2 ? `${entry.characters.length} residents · ` : ''}{thread.turns.length} turns · {thread.status === 'active' ? 'In conversation' : thread.status === 'interrupted' ? 'Interrupted' : 'At a pause'}</small>;
  return <details className={`conversation-thread${journal ? ' journal-conversation' : ''}`} open={expanded || thread.status === 'active' ? true : undefined}>
    {journal ? <summary>
      <span className="entry-meta"><span>{gameTime(entry.minute)}</span><span>{entry.kind}</span></span>
      <strong className="journal-conversation-title">{thread.title ?? thread.topic}</strong>
      <span className="journal-conversation-description">{entry.text}</span>
      {status}
      <span className="journal-disclosure"><span className="journal-read-label">Read conversation</span><span className="journal-hide-label">Hide dialogue</span><ChevronDown size={14} aria-hidden="true"/></span>
    </summary> : <summary><strong>{entry.characters.map(name).join(' & ')}</strong><span>{thread.title ?? thread.topic}</span>{status}</summary>}
    {journal && <div className="conversation-participants" role="group" aria-label="Conversation participants">{entry.characters.map(id => onSelect ? <button type="button" className="character-name" key={id} onClick={() => onSelect(id)} aria-label={`View ${name(id)}'s profile`}>{name(id)}</button> : <span key={id}>{name(id)}</span>)}</div>}
    <ol aria-label={`Conversation ${entry.characters.length > 2 ? 'among' : 'between'} ${entry.characters.map(name).join(' and ')}`}>
      {thread.turns.map((turn, index) => <li key={index}><div className="conversation-speaker"><b>{onSelect ? <button type="button" className="character-name" aria-label={`View ${name(turn.speakerId)}'s profile`} onClick={() => onSelect(turn.speakerId)}>{name(turn.speakerId)}</button> : name(turn.speakerId)}</b><time>{gameTime(turn.minute)}</time></div><p>{onSelect ? <CharacterText text={turn.text} characters={characters} participants={entry.characters} onSelect={onSelect}/> : turn.text}</p>{turn.generated && <small className="ai-label">AI dialogue</small>}</li>)}
    </ol>
    {thread.status === 'active' && <small className="conversation-progress">The conversation is unfolding…</small>}
  </details>;
}
