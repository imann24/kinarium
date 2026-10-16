import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { activeCharacters } from '../simulation/engine';
import type { WorldState } from '../simulation/types';

export default function IntroduceResidentButton({ world, pending = false, sidebar = false, onClick }: {
  world: WorldState;
  pending?: boolean;
  sidebar?: boolean;
  onClick: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const full = activeCharacters(world).length >= world.settings.populationCap;
  const label = sidebar ? 'Introduce someone new' : 'Introduce someone';
  // Disabled buttons cannot receive focus or reliably receive pointer events.
  return <div className="introduce-control" tabIndex={full ? 0 : undefined}
    role={full ? 'group' : undefined} aria-label={full ? label : undefined} aria-describedby={full ? id : undefined}
    onMouseEnter={() => setOpen(true)} onMouseLeave={event => { if (!event.currentTarget.matches(':focus')) setOpen(false); }}
    onFocus={() => setOpen(true)} onBlur={event => { if (!event.currentTarget.matches(':hover')) setOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <button className={`primary introduce-resident${sidebar ? ' add-resident' : ''}`} disabled={pending || full} onClick={onClick}>
      <Plus size={18} strokeWidth={2.5}/> {label}
    </button>
    {full && <span id={id} role="tooltip" className="population-tooltip" hidden={!open}>
      This house is full. The population limit is {world.settings.populationCap} residents.
    </span>}
  </div>;
}
