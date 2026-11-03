import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import type { WorldSummary } from '../simulation/types';
import './admin.css';

type House = { slug: string; summary: WorldSummary | null; status: 'active' | 'pending' | 'deleted' };
type Listing = { houses: House[]; next: string | null };
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Refresh before retrying.';

export default function Admin() {
  const [signedIn, setSignedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [houses, setHouses] = useState<House[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [selected, setSelected] = useState<House | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function failed(e: unknown) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 503 && !e.data.status)) {
      setSignedIn(false); setHouses([]); setSelected(null); setConfirmation('');
    }
    setError(message(e));
  }
  async function load(after = '') {
    const result = await api<Listing>(`/admin/houses${after ? `?after=${encodeURIComponent(after)}` : ''}`);
    setHouses(previous => after ? [...previous, ...result.houses] : result.houses);
    setNext(result.next); setSignedIn(true);
  }
  useEffect(() => { load().catch(e => { if (!(e instanceof ApiError && e.status === 401)) failed(e); }).finally(() => setBusy(false)); }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const credential = password; setPassword('');
    try { await api('/admin/login', { password: credential }); await load(); }
    catch (e) { failed(e); } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await api('/admin/logout', {}); setSignedIn(false); setHouses([]); setSelected(null); setConfirmation(''); setNotice('Signed out.'); }
    catch (e) { failed(e); } finally { setBusy(false); }
  }
  async function remove(event: FormEvent) {
    event.preventDefault(); if (!selected || confirmation !== selected.slug) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/admin/houses/${encodeURIComponent(selected.slug)}/delete`, { confirmation });
      setNotice(`Deleted ${selected.slug}. Its address is permanently retired.`);
      setSelected(null); setConfirmation(''); await load();
    } catch (e) {
      failed(e);
      // A failed cleanup still retires the address, so show its new pending state.
      if (e instanceof ApiError && e.data.status === 'pending') { setSelected(null); setConfirmation(''); await load().catch(() => undefined); }
    } finally { setBusy(false); }
  }
  const active = houses.filter(house => house.status !== 'deleted');
  const deleted = houses.filter(house => house.status === 'deleted');
  const row = (house: House) => <li key={house.slug}>
    <div><h2>{house.summary?.name || house.slug}</h2><code>{house.slug}</code>
      {house.summary && <p>{house.summary.description}</p>}
      <p>{house.status === 'deleted' ? 'Deleted · address retired' : house.status === 'pending' ? 'Cleanup pending · retry required' : house.summary ? `${house.summary.protected ? 'Password protected' : 'Open house'} · ${house.summary.mode}` : 'Creation pending'}</p>
    </div>
    {house.status !== 'deleted' && <button disabled={busy} onClick={() => { setSelected(house); setConfirmation(''); setError(''); setNotice(''); document.querySelector('.admin-page')?.scrollIntoView({ behavior: 'smooth' }); }}>{house.status === 'pending' ? 'Retry cleanup' : 'Delete…'}</button>}
  </li>;
  return <main className="admin-page">
    <h1>Manage houses</h1>
    <p>Deletion permanently removes a house, its residents, history, visitor sessions, and connections. This cannot be undone. Deleted addresses cannot be reused.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!signedIn ? <form className="admin-login" onSubmit={login}>
      <label htmlFor="admin-password">Admin password</label>
      <input id="admin-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
      <p>The server owner configures this password. Sessions expire after 30 minutes.</p>
    </form> : <>
      <div className="admin-actions"><button disabled={busy} onClick={() => { setBusy(true); setError(''); load().catch(failed).finally(() => setBusy(false)); }}>Refresh houses</button><button disabled={busy} onClick={logout}>Sign out</button></div>
      {selected && <form className="admin-confirm" onSubmit={remove} aria-label="Confirm house deletion">
        <h2>Permanently delete {selected.summary?.name || selected.slug}?</h2>
        <p><strong>Destructive action:</strong> All saved house content will be erased and connected visitors disconnected. The slug <code>{selected.slug}</code> will remain retired forever.</p>
        {selected.status === 'pending' && <p>Cleanup is pending. Retry this same slug to finish; the house may still be running until cleanup succeeds.</p>}
        <label htmlFor="admin-confirmation">Type <strong>{selected.slug}</strong> exactly to confirm</label>
        <input id="admin-confirmation" autoComplete="off" spellCheck={false} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy}/>
        <div className="admin-actions"><button className="admin-delete" disabled={busy || confirmation !== selected.slug}>{busy ? 'Deleting…' : selected.status === 'pending' ? 'Retry permanent deletion' : 'Permanently delete house'}</button><button type="button" disabled={busy} onClick={() => { setSelected(null); setConfirmation(''); }}>Cancel</button></div>
      </form>}
      <ul className="admin-houses">{active.map(row)}</ul>
      {!active.length && <p>No active houses.</p>}
      {deleted.length > 0 && <section aria-labelledby="deleted-houses"><h2 id="deleted-houses">Deleted houses</h2><ul className="admin-houses admin-deleted">{deleted.map(row)}</ul></section>}
      {next && <button disabled={busy} onClick={() => { setBusy(true); load(next).catch(failed).finally(() => setBusy(false)); }}>Load more houses</button>}
    </>}
  </main>;
}
