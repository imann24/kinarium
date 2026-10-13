import { useState } from 'react';
import type { Character } from '../simulation/types';
import { characterMentions } from './character-mentions';

export default function CharacterText({ text, characters, participants, onSelect }: {
  text: string; characters: Character[]; participants?: string[]; onSelect: (id: string) => void;
}) {
  return <>{characterMentions(text, characters, participants).map((part, index) => part.characterIds
    ? <Mention key={index} name={part.text} candidates={characters.filter(c => part.characterIds!.includes(c.id))} onSelect={onSelect}/>
    : part.text)}</>;
}
function Mention({ name, candidates, onSelect }: { name: string; candidates: Character[]; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <span className="character-mention" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }} onKeyDown={event => { if (event.key === 'Escape') setExpanded(false); }}>
    <button type="button" className="character-name" aria-label={`View ${name}'s profile`} aria-expanded={candidates.length > 1 ? expanded : undefined}
      onClick={() => candidates.length === 1 ? onSelect(candidates[0].id) : setExpanded(value => !value)}>{name}</button>
    {expanded && <span className="character-name-choices" role="group" aria-label={`Choose which ${name}`}>
      <span>Which {name}?</span>
      {candidates.map(c => <button type="button" key={c.id} onClick={() => { setExpanded(false); onSelect(c.id); }}>
        <strong>{c.name} · {c.trait}{c.away ? ' · away' : ''} · #{c.id.replace(/^c/, '')}</strong><span>{c.backstory}</span>
      </button>)}
    </span>}
  </span>;
}
