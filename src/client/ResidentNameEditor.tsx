import { useId, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import './resident-name.css';

export function ResidentNameEditor({ name, busy, onSave }: { name: string; busy: boolean; onSave: (name: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setEditing(false); setError(''); requestAnimationFrame(() => trigger.current?.focus()); };
  return <div className="resident-name-editor">
    <button ref={trigger} type="button" className="back-link" hidden={editing} disabled={busy} aria-label={`Edit ${name}’s name`} onClick={() => { setDraft(name); setError(''); setEditing(true); }}><Pencil size={13} aria-hidden="true"/> Edit name</button>
    {editing && <form onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!submitting.current) close(); } }} onSubmit={async e => {
      e.preventDefault();
      if (busy || submitting.current) return;
      const next = draft.trim();
      if (!next || next.length > 30) { setError('Enter a name between 1 and 30 characters.'); return; }
      if (next === name) { close(); return; }
      submitting.current = true; setSaving(true); setError('');
      try { await onSave(next); close(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not save the name. Please try again.'); }
      finally { submitting.current = false; setSaving(false); }
    }}>
      <label htmlFor={id}>Resident name</label>
      <input id={id} autoFocus required maxLength={30} value={draft} disabled={busy || saving} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} onChange={e => { setDraft(e.target.value); setError(''); }}/>
      <p id={`${id}-help`} className="muted">Changes show for everyone. Earlier stories keep their original words.</p>
      {error && <p id={`${id}-error`} className="error-box" role="alert">{error}</p>}
      <div className="resident-name-actions"><button className="primary" disabled={busy || saving}>{saving ? 'Saving…' : 'Save name'}</button><button type="button" className="outline" disabled={busy || saving} onClick={close}>Cancel</button></div>
    </form>}
  </div>;
}
