import CharacterText from './CharacterText';
import type { Character, LogEntry } from '../simulation/types';
import { gameTime } from '../simulation/engine';
import { MEMORY_LIMIT } from '../simulation/memories';
import { buildResidentSummary, type HistoryEpisode } from '../simulation/resident-summary';
import './personal-history.css';

export default function PersonalHistory({ character, characters, onSelect, minute, events }: { character: Character; characters: Character[]; onSelect: (id: string) => void; minute: number; events: LogEntry[] }) {
  const summary = buildResidentSummary(character, characters, events, minute);
  const renderText = (episode: HistoryEpisode) => <CharacterText text={episode.text} characters={characters} participants={episode.memories[0].participantIds} onSelect={onSelect}/>;
  function originals(episode: HistoryEpisode) {
    return <>{episode.memories.map((memory, index) => <div className="history-source" key={memory.eventId ?? `legacy-${index}`}>
        <p className="history-meta">{gameTime(memory.minute)} · {memory.eventId === undefined ? 'Earlier saved memory' : `Event #${memory.eventId}`}</p>
        <details><summary>Read original memory{memory.kind === 'conversation' || memory.kind === 'conflict' ? ' and revealed dialogue' : ''}</summary><p className="history-original"><CharacterText text={memory.text} characters={characters} participants={memory.participantIds} onSelect={onSelect}/></p></details>
      </div>)}
    </>;
  }
  function sources(episode: HistoryEpisode) {
    return <details className="history-sources"><summary>Sources · {episode.memories.length} {episode.memories.length === 1 ? 'memory' : 'memories'}</summary>{originals(episode)}</details>;
  }
  return <section className="personal-history" aria-label={`${character.name}’s personal history`}>
    <h4>Story so far</h4><p className="history-note">Highlights from retained memories.</p>
    {summary.story.length ? <><p className="history-story">{summary.story.map((episode, index) => <span key={episode.key}>{index > 0 ? ' ' : ''}{renderText(episode)}</span>)}</p><details className="history-sources"><summary>Story sources</summary>{summary.story.map(episode => <div key={episode.key}>{originals(episode)}</div>)}</details></>
      : <p className="history-note">{summary.timeline.length ? 'Their retained moments are preserved below in their original words.' : 'Their lived history will grow as they take part in the world.'}</p>}
    {!!summary.defining.length && <><h4>Defining moments</h4><ul className="history-highlights">{summary.defining.map(episode => <li key={episode.key}><p>{renderText(episode)}</p>{sources(episode)}</li>)}</ul></>}
    {summary.tension && <><h4>Recent tension</h4><p className="history-story">{renderText(summary.tension)}</p>{sources(summary.tension)}</>}
    <details className="history-retained"><summary>Read retained history · {summary.timeline.length} {summary.timeline.length === 1 ? 'episode' : 'episodes'}</summary>
      <p className="history-note">Newest first · Based on up to {MEMORY_LIMIT} retained memories, not a complete lifetime. Similar consecutive moments are grouped; original records are unchanged.</p>
      <ol className="history-list">{summary.timeline.map(episode => <li key={episode.key}><div className="history-meta">{episode.memories.length > 1 ? `${gameTime(episode.memories[0].minute)} – ${gameTime(episode.minute)}` : gameTime(episode.minute)}{episode.memories.length > 1 ? ` · ${episode.memories.length} memories` : ''}</div><p>{renderText(episode)}</p>{originals(episode)}</li>)}</ol>
    </details>
  </section>;
}
