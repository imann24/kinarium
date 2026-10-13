import { useRef, useState } from 'react';
import type { Snapshot, WorldState } from '../simulation/types';
import { api, ApiError } from './api';
import './house-details.css';

export default function HouseDetailsForm({ world, onSaved, onCancel, onBusy, disabled }: {
  world: WorldState; disabled: boolean; onSaved: (snapshot: Snapshot) => void; onCancel: () => void; onBusy: (busy: boolean) => void;
}) {
  const [baseline, setBaseline] = useState(world);
  const [name, setName] = useState(world.name);
  const [description, setDescription] = useState(world.description);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const stale = (world.detailsRevision ?? 0) !== (baseline.detailsRevision ?? 0);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || disabled) return;
    setSaved(false);
    if (!name.trim()) { setError('Enter a house name.'); return; }
    submitting.current = true; setBusy(true); onBusy(true); setError('');
    try {
      const snapshot = await api<Snapshot>(`/worlds/${world.slug}/commands`, { type: 'house-details', name, description, expectedRevision: baseline.detailsRevision ?? 0 });
      onSaved(snapshot); setBaseline(snapshot.world); setName(snapshot.world.name); setDescription(snapshot.world.description); setSaved(true); setConflict(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save house details. Try again.');
      setConflict(e instanceof ApiError && e.status === 409);
    } finally { submitting.current = false; setBusy(false); onBusy(false); }
  }
  async function loadLatest() {
    if (submitting.current || disabled) return;
    submitting.current = true; setBusy(true); onBusy(true); setError('');
    try {
      const snapshot = await api<Snapshot>(`/worlds/${world.slug}`);
      onSaved(snapshot); setBaseline(snapshot.world); setName(snapshot.world.name); setDescription(snapshot.world.description); setConflict(false); setSaved(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load house details.'); }
    finally { submitting.current = false; setBusy(false); onBusy(false); }
  }
  return <form className="house-details" onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy || disabled}>
      <legend>House details</legend>
      <label htmlFor="house-name">House name</label>
      <input id="house-name" required maxLength={60} value={name} aria-describedby="house-name-help" onChange={e => { setName(e.target.value); setSaved(false); setError(''); }}/>
      <small id="house-name-help">Required · up to 60 characters</small>
      <label htmlFor="house-description">Description</label>
      <textarea id="house-description" maxLength={240} value={description} aria-describedby="house-description-help" onChange={e => { setDescription(e.target.value); setSaved(false); setError(''); }}/>
      <small id="house-description-help">Optional · up to 240 characters. These details are public.</small>
      <p className="muted">The house address and its story stay the same.</p>
      {(stale || conflict) && <p role="status">House details changed in another session. Your draft is still here. <button className="text-button" type="button" onClick={() => void loadLatest()}>Load latest details</button> to replace it.</p>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="house-details-actions"><button className="primary" disabled={stale || conflict}>Save house details</button><button type="button" className="outline" onClick={onCancel}>Cancel</button></div>
    </fieldset>
    <p className="house-details-status" role="status">{busy ? 'Saving or loading house details…' : saved ? 'House details saved.' : ''}</p>
  </form>;
}
