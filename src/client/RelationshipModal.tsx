import { useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Character, LogEntry, Relationship } from '../simulation/types';
import RelationshipStory from './RelationshipStory';
import './conversation-modal.css';

export default function RelationshipModal({ relationship, a, b, records, onClose, onSelectResident }: {
  relationship: Relationship; a: Character; b: Character; records: LogEntry[];
  onClose: () => void; onSelectResident: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef<number | undefined>(undefined);
  const backdropClick = useRef(false);
  function onBackdrop(target: EventTarget | null, x: number, y: number) {
    const dialog = dialogRef.current;
    if (!dialog || target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className="modal conversation-modal relationship-modal" aria-label={`${a.name} and ${b.name}`}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onPointerDown={e => {
      backdropClick.current = false;
      backdropPointer.current = e.button === 0 && onBackdrop(e.target, e.clientX, e.clientY) ? e.pointerId : undefined;
    }}
    onPointerUp={e => {
      backdropClick.current = e.pointerId === backdropPointer.current && onBackdrop(e.target, e.clientX, e.clientY);
      backdropPointer.current = undefined;
    }}
    onPointerCancel={() => { backdropPointer.current = undefined; backdropClick.current = false; }}
    onClick={e => {
      // Both ends of the gesture must be on the backdrop so text-selection drags never dismiss.
      const dismiss = backdropClick.current && onBackdrop(e.target, e.clientX, e.clientY);
      backdropClick.current = false;
      if (dismiss) onClose();
    }}
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}>
    <div className="modal-content">
      <button type="button" autoFocus className="icon-button modal-close" aria-label="Close relationship" onClick={onClose}><X size={19}/></button>
      <RelationshipStory relationship={relationship} a={a} b={b} records={records} onSelectResident={onSelectResident}/>
    </div>
  </dialog>;
}
