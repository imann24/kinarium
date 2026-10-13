import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import type { TimeMode } from '../simulation/types';

export default function TimeModeStatus({ mode }: { mode: TimeMode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const label = mode === 'persistent' ? 'Always on' : 'Catch-up';
  return <span className="time-mode-status" tabIndex={0} role="note" aria-label={`Time mode: ${label}`} aria-describedby={id}
    onMouseEnter={() => setOpen(true)} onMouseLeave={event => { if (!event.currentTarget.matches(':focus')) setOpen(false); }}
    onFocus={() => setOpen(true)} onBlur={event => { if (!event.currentTarget.matches(':hover')) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <span>Time mode: <strong>{label}</strong></span><CircleHelp size={13} aria-hidden="true"/>
    <span id={id} role="tooltip" className="time-mode-tooltip" hidden={!open}>
      {mode === 'persistent'
        ? 'This world keeps evolving even when everyone is away.'
        : 'When everyone is away, this world waits and catches up when someone returns. Time passes normally while anyone is here.'}
      <span>Change this in World settings.</span>
    </span>
  </span>;
}
