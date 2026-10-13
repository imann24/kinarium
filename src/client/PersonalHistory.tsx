import CharacterText from './CharacterText';
import React, { useState } from 'react';
import type { Character } from '../simulation/types';
import { gameTime } from '../simulation/engine';
import { MEMORY_LIMIT, recallMemories } from '../simulation/memories';
import './personal-history.css';

export default function PersonalHistory({ character, characters, onSelect, minute }: { character: Character; characters: Character[]; onSelect: (id: string) => void; minute: number }) {
  const [expanded, setExpanded] = useState(false);
  const salient = recallMemories(character, { minute, limit: 3 });
  const history = [...character.memories].sort((a, b) => b.minute - a.minute || (b.eventId ?? 0) - (a.eventId ?? 0));
  return <section className="personal-history" aria-label={`${character.name}’s personal history`}>
    <h4>Things that stay with them</h4>
    <div className="memories">{salient.map((memory, index) => <p key={memory.eventId ?? `legacy-${index}`}><CharacterText text={memory.text} characters={characters} participants={memory.participantIds} onSelect={onSelect}/><small>{gameTime(memory.minute)}</small></p>)}</div>
    <h4>Personal history</h4>
    <p className="history-note">Newest first · Up to {MEMORY_LIMIT} recent and defining memories stay with each resident. Earlier experiences may fade.</p>
    {!history.length && <p className="history-note">Their lived history will grow as they take part in the world.</p>}
    <ol className="history-list">{(expanded ? history : history.slice(0, 6)).map((memory, index) => <li key={memory.eventId ?? `legacy-${index}`}>
      <div className="history-meta"><span>{gameTime(memory.minute)}</span><span>{memory.kind ?? 'Earlier memory'}{(memory.salience ?? 0) >= 5 ? ' · defining moment' : ''}</span></div>
      <p><CharacterText text={memory.text} characters={characters} participants={memory.participantIds} onSelect={onSelect}/></p>
    </li>)}</ol>
    {history.length > 6 && <button className="quiet-link history-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer memories' : `Read all ${history.length} memories`}</button>}
  </section>;
}
