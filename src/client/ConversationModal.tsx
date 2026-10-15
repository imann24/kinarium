import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LogEntry, WorldState } from '../simulation/types';
import { api } from './api';
import ConversationThread from './ConversationThread';
import './conversation-modal.css';

/** The ID, never the dialogue text, identifies both live and archived threads. */
export default function ConversationModal({ world, conversationId, onClose, onJournal, onSelect }: {
  world: WorldState; conversationId: number; onClose: () => void;
  onJournal: (entry: LogEntry) => void; onSelect: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const live = world.history.find(e => e.id === conversationId && e.conversation);
  const lastReceived = useRef<LogEntry | undefined>(live);
  const [archived, setArchived] = useState<LogEntry>();
  const [status, setStatus] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { if (live) lastReceived.current = live; }, [live]);
  const entry = live ?? archived ?? lastReceived.current;
  const retained = Boolean(live);

  useEffect(() => {
    if (retained) { setStatus(''); return; }
    const controller = new AbortController();
    setStatus('Loading conversation…');
    // The existing archive cursor includes the requested ID; verify the exact ID
    // because a missing record can return unrelated earlier entries.
    void api<{ entries: LogEntry[] }>(`/worlds/${world.slug}/history?before=${conversationId + 1}`, undefined, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        const found = data.entries.find(e => e.id === conversationId && e.conversation);
        setArchived(found);
        setStatus(found ? '' : 'This conversation is no longer available in the journal.');
      }).catch(() => {
        if (!controller.signal.aborted) setStatus('The conversation could not be loaded. Please try again.');
      });
    return () => controller.abort();
  }, [world.slug, conversationId, retained, retry]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallback = dialog.closest('main')?.querySelector<HTMLElement>('.journal-panel-toggle');
    dialog.showModal();
    return () => {
      dialog.close();
      // A live speech bubble may disappear while its thread is being read.
      (opener?.isConnected ? opener : fallback)?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className="modal conversation-modal" aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
    <div className="modal-content">
      <button type="button" autoFocus className="icon-button modal-close" aria-label="Close conversation" onClick={onClose}><X size={19}/></button>
      <p className="eyebrow">CONVERSATION</p><h2 id={titleId}>{entry?.conversation?.title ?? entry?.conversation?.topic ?? 'Conversation'}</h2>
      {status && <p role="status">{status}{entry && ' Showing the last received conversation.'}</p>}
      {status.startsWith('The conversation could not') && <button type="button" className="outline" onClick={() => setRetry(n => n + 1)}>Try again</button>}
      {entry && <><ConversationThread entry={entry} characters={world.characters} expanded onSelect={onSelect}/>
        <button type="button" className="outline" onClick={() => onJournal(entry)}>View in journal</button></>}
    </div>
  </dialog>;
}
