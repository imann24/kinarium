import { useId, useLayoutEffect, useRef, useState } from 'react';
import { DoorOpen, X } from 'lucide-react';
import type { Character } from '../simulation/types';
import './away-confirmation.css';

interface Props {
  targetId: string | null;
  resident: Character | undefined;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (id: string) => Promise<boolean>;
}

export default function AwayConfirmation({ targetId, resident, busy, error, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const valid = targetId !== null && resident?.id === targetId && !resident.away;
  // A changed selection, removed resident, or live departure invalidates this consent.
  useLayoutEffect(() => {
    if (targetId && !valid) onClose();
  }, [targetId, valid, onClose]);
  useLayoutEffect(() => {
    if (!valid) return;
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [valid, targetId]);

  async function confirm() {
    if (!valid || busy || submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      if (await onConfirm(targetId!)) onClose();
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  if (!valid) return null;
  return <dialog ref={dialogRef} className="modal away-confirmation" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => { if (event.target === dialogRef.current) onClose(); }}>
    <div className="modal-content">
      <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button>
      <p className="eyebrow">TIME AWAY</p>
      <h2 id={titleId}>Let {resident.name} take some time away?</h2>
      <div id={descriptionId} className="away-consequences">
        <p>{resident.name} will leave the house and stop taking part in its daily life, freeing one resident space for everyone in this world.</p>
        <p>Their story, memories, and relationships stay here. You can welcome them back when there is room under the population cap.</p>
      </div>
      {error && <p className="error-box" role="alert">{error}</p>}
      {sending && <p role="status">Sending the departure request… Closing this dialog will not undo it.</p>}
      <div className="away-actions">
        <button ref={cancelRef} type="button" className="outline" onClick={onClose}>Cancel</button>
        <button type="button" className="primary" disabled={busy || sending} onClick={() => void confirm()}><DoorOpen size={15}/>{sending ? 'Sending…' : 'Confirm time away'}</button>
      </div>
    </div>
  </dialog>;
}
