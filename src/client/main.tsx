import { ResidentNameEditor } from './ResidentNameEditor';
import Admin from './Admin';
import { relationshipLabel } from './relationship-label';
import CommunityMetrics from './CommunityMetrics';
import IntroduceResidentButton from './IntroduceResidentButton';
import Bonds from './Bonds';
import FieldGuide from './FieldGuide';
import { ModelSelection } from './ModelSelection';
import { AppearanceEditor } from './AppearanceEditor';
import { OBSERVER_KEY, observerPresence, parseObserver, type ObserverIdentity } from './observer';
import UpdateBanner from './UpdateBanner';
import { HEARTBEAT_MS } from './heartbeat';
import ResidentState from './ResidentState';
import HouseDetailsForm from './HouseDetailsForm';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Palette, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Asterisk, BookOpen, Check, ChevronDown, CircleHelp, Clock3, DoorOpen, Globe2, Heart, Infinity as InfinityIcon, Leaf, LockKeyhole, Maximize, Maximize2, MessageCircle, Minimize, Moon, Plus, Search, Settings2, Sparkles, Sprout, Users, X, Zap, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { EVENTS, TEMPLATES, TRAITS } from '../simulation/catalog';
import { EVENT_COOLDOWN_MS, activeCharacters, createWorld, gameTime } from '../simulation/engine';
import type { Character, Command, LogEntry, Snapshot, TimeMode, WorldState, WorldSummary } from '../simulation/types';
import Building, { Person } from './Building';
import ConversationThread from './ConversationThread';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';
import { previewWorld } from './world-preview';
import ConversationModal from './ConversationModal';
import EventAllowance from './EventAllowance';
import EventPicker from './EventPicker';
import { eventWait, serverEvents } from './event-effects';
import AwayConfirmation from './AwayConfirmation';
import PersonalHistory from './PersonalHistory';
import CommunityInsights from './CommunityInsights';
import TimeModeStatus from './TimeModeStatus';
import CharacterText from './CharacterText';
import { useWorldFullscreen } from './useWorldFullscreen';
import { eventBudget, type PlayerEventBudget } from '../simulation/event-budget';
import { api, ApiError } from './api';
import './design-tokens.css';
import './style.css';
import './theme.css';
import './landing.css';
import './introduce-resident.css';
import ThemeControl from './ThemeControl';
import { useJournalPanel } from './useJournalPanel';
import { foldJournal, highlightLabels, isStoryItem } from './journal-stories';
import './journal-panel.css';
import { useFullscreenCanvas } from './useFullscreenCanvas';
import { useWorldViewport } from './useWorldViewport';
import { useSceneZoom } from './useSceneZoom';
import './compact-world-header.css';
import './larger-house-scene.css';
import './phone-landscape.css';
import './resident-modal.css';
import './interface.css';
import { isAppropriate } from '../simulation/content-filter';

const templateExamples = Object.fromEntries(Object.keys(TEMPLATES).map(templateId => [templateId, createWorld({ slug: 'example', name: 'A little world', templateId }, 0, 125)]));
const example = templateExamples['common-house'];
function WorldPreview({ summary }: { summary: WorldSummary }) {
  const world = useMemo(() => previewWorld(templateExamples[summary.templateId] ?? example, summary), [summary]);
  return <Building world={world} miniature/>;
}
const getError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
function Logo() { return <a href="/" className="brand" aria-label="Kinarium home"><span className="brand-mark"><i/><i/><i/><i/></span>kinarium<span className="alpha">a living playground</span></a>; }
function App() {
  const [guide, setGuide] = useState(false);
  const match = location.pathname.match(/^\/w\/([a-z0-9-]+)(\/insights)?\/?$/);
  return <><UpdateBanner/><header className={`site-header ${match ? 'world-site-header' : location.pathname === '/' ? 'landing-header' : ''}`}><Logo/><nav><a href="/" className={!match ? 'active' : ''}>The worlds</a><button type="button" className="text-button" aria-haspopup="dialog" onClick={() => setGuide(true)}><BookOpen size={13} aria-hidden="true"/> Field guide</button><span className="header-note"><span className="status-dot"/> A little life, unfolding</span><ThemeControl/></nav></header>
    {/^\/admin\/?$/.test(location.pathname) ? <Admin/> : match ? <World slug={match[1]} insights={Boolean(match[2])}/> : location.pathname === '/' ? <Directory/> : <main className="empty-page"><h1>A path without a world.</h1><a href="/">Back to the directory</a></main>}
    {guide && <Modal title="Field guide" onClose={() => setGuide(false)}><FieldGuide/></Modal>}
  </>;
}
function Modal({ title, className = '', children, onClose }: { title: string; className?: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${className}`.trim()} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href]')].filter(el => el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="modal-content"><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button><h2 id={titleId}>{title}</h2>{children}</div></dialog>;
}
function Directory() {
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [create, setCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [featuredSlug, setFeaturedSlug] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setWorlds((await api<{ worlds: WorldSummary[] }>('/worlds')).worlds); }
    catch (e) { setError(getError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const featured = worlds.find(w => w.slug === featuredSlug) ?? worlds.find(w => !w.protected) ?? worlds[0];
  const filtered = worlds.filter(w => `${w.name} ${w.description}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'all' || (filter === 'open' ? !w.protected : w.mode === 'persistent')));
  return <main className="directory festival">
    <section className="festival-opening" aria-labelledby="landing-title">
      <div className="festival-title-row">
        <h1 id="landing-title">Little worlds.<br/><span>A life of their own.</span></h1>
        <div className="festival-invitation">
          <p>A few neighbors. A shared roof.<br/>An open-ended community simulation where the relationships are the story.</p>
          <a className="festival-browse" href="#worlds">Find your little corner <ArrowRight size={19} aria-hidden="true"/></a>
        </div>
      </div>
      <div className="house-stage">
        <div className="house-stage-note"><span>Nothing to win.<br/><strong>So much to discover.</strong></span><span className="stage-note-line" aria-hidden="true"/></div>
        <div className="featured-scene" key={featured?.slug ?? 'template'}>
          {featured ? <WorldPreview summary={featured}/> : <Building world={example} miniature/>}
        </div>
        <div className="house-stage-invitation" aria-live="polite">
          <h2>{featured?.name ?? 'A small beginning.'}</h2>
          <span className="house-access">{featured?.protected ? <LockKeyhole size={15} aria-hidden="true"/> : <DoorOpen size={15} aria-hidden="true"/>}{featured ? featured.protected ? 'Password protected' : 'The door is open' : 'A common-house template'}</span>
          <p>{featured ? `${featured.population} residents · ${featured.mode === 'persistent' ? 'Life continues while you’re away' : 'Life catches up when you return'}` : 'Neighbors, conversations, and room for a story to unfold.'}</p>
          {featured ? <a className="festival-action" href={`/w/${featured.slug}`}>{featured.protected ? 'Enter with a password' : 'Visit this house'}<ArrowUpRight size={20} aria-hidden="true"/></a> : <a className="festival-action" href="#worlds">Explore the neighborhood <ArrowDownRight size={20} aria-hidden="true"/></a>}
        </div>
        <span className="scene-footnote">{featured ? 'A glimpse of the house · enter to see life unfold' : 'Illustrative preview · your world will write its own story'}</span>
      </div>
      <div className="festival-understage">
        {worlds.length > 1 ? <label className="featured-picker"><span>Another little world</span><select value={featured?.slug ?? ''} onChange={e => setFeaturedSlug(e.target.value)} aria-label="Preview a house">{worlds.map(w => <option key={w.slug} value={w.slug}>{w.name}</option>)}</select></label> : <p>No goals. No finish line. Just possibilities.</p>}
        <button type="button" onClick={() => setCreate(true)}>Or, create a world of your own <Plus size={18} aria-hidden="true"/></button>
      </div>
    </section>

    <section id="worlds" className="neighborhood" aria-labelledby="neighborhood-title">
      <div className="neighborhood-heading"><div><h2 id="neighborhood-title">The neighborhood<span aria-label={`${worlds.length} worlds`}>{worlds.length}</span></h2><p>Different houses. Shared possibilities. Pick a door and come on in.</p></div><label className="neighborhood-search"><Search size={19} aria-hidden="true"/><input type="search" aria-label="Search worlds" placeholder="Find a world…" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
      <div className="neighborhood-tools"><div className="neighborhood-filters" aria-label="Filter worlds">{[['all','All worlds'],['open','Open doors'],['persistent','Always on']].map(([id,label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><span role="status">{loading ? 'Finding houses…' : `${filtered.length} ${filtered.length === 1 ? 'house' : 'houses'} to explore`}</span></div>
      {error ? <div className="neighborhood-message" role="alert"><h3>We couldn’t open the directory.</h3><p>{error}</p><button type="button" className="festival-action" onClick={() => void load()}>Try again <RotateCcw size={17} aria-hidden="true"/></button></div> : loading ? <div className="neighborhood-message" role="status"><p>Opening the neighborhood…</p></div> : filtered.length > 0 ? <div className="house-list">{filtered.map(w => <a className="house-listing" href={`/w/${w.slug}`} key={w.slug}>
        <div className="listing-preview"><WorldPreview summary={w}/></div>
        <div className="listing-copy"><h3>{w.name}</h3><span className="listing-access">{w.protected ? <LockKeyhole size={14} aria-hidden="true"/> : <DoorOpen size={14} aria-hidden="true"/>}{w.protected ? 'Password protected' : 'Everyone welcome'}</span><p>{w.description || 'A shared roof. A story still unfolding.'}</p></div>
        <div className="listing-details"><span><Users size={16} aria-hidden="true"/>{w.population} / {w.populationCap} residents</span><span>{w.mode === 'persistent' ? <InfinityIcon size={17} aria-hidden="true"/> : <Clock3 size={16} aria-hidden="true"/>}{w.mode === 'persistent' ? 'Always on' : 'Catch-up'}</span></div>
        <span className="listing-enter"><span>Visit house</span><ArrowUpRight size={23} aria-hidden="true"/></span>
      </a>)}</div> : <div className="neighborhood-message"><h3>{worlds.length ? 'No doors on this path.' : 'The neighborhood starts with you.'}</h3><p>{worlds.length ? 'Try another name or open up your filters.' : 'Create the first house and give a few neighbors a place to begin.'}</p>{worlds.length > 0 && <button type="button" className="festival-action" onClick={() => { setQuery(''); setFilter('all'); }}>Show all worlds <ArrowRight size={18} aria-hidden="true"/></button>}</div>}
      <div className="neighborhood-create"><div><h3>Make room for possibility.</h3><p>Same small beginning. An entirely different story.</p></div><button type="button" className="festival-action" onClick={() => setCreate(true)}>Create a world <Plus size={19} aria-hidden="true"/></button></div>
    </section>
    <footer className="festival-footer"><Logo/><p>A small experiment in being together.</p><span>Nothing to win. Everything to discover.<Sprout size={18} aria-hidden="true"/></span></footer>
    {create && <CreateWorld onClose={() => setCreate(false)}/>}
  </main>;
}
function TimeModePicker({ value, onChange }: { value: TimeMode; onChange: (v: TimeMode) => void }) { return <div className="mode-options">{(['fast-forward','persistent'] as const).map(mode => <button type="button" key={mode} className={value === mode ? 'mode selected' : 'mode'} onClick={() => onChange(mode)}>{mode === 'persistent' ? <InfinityIcon size={20}/> : <Clock3 size={20}/>}<b>{mode === 'persistent' ? 'Always on' : 'Catch-up'}</b><small>{mode === 'persistent' ? 'Life continues, even when everyone is away.' : 'Life catches up when someone returns.'}</small>{value === mode && <Check className="mode-check" size={15}/>}</button>)}</div>; }
function CreateWorld({ onClose }: { onClose: () => void }) {
  const [templateId,setTemplateId] = useState('common-house');
  const template = TEMPLATES[templateId];
  const [name,setName] = useState(''); const [slug,setSlug] = useState(''); const [customSlug,setCustomSlug] = useState(false); const [description,setDescription] = useState(''); const [mode,setMode] = useState<TimeMode>('fast-forward'); const [cap,setCap] = useState(12); const [password,setPassword] = useState(''); const [locked,setLocked] = useState(false); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const w = await api<WorldSummary>('/worlds', { name, slug, description, mode, populationCap: cap, password: locked ? password : '', templateId }); if (locked) await api(`/worlds/${w.slug}/unlock`, { password }); location.assign(`/w/${w.slug}`); } catch (e) { setError(getError(e)); setBusy(false); } }
  return <Modal title="Create a world" onClose={onClose}><form onSubmit={submit}><label>World name<input autoFocus required maxLength={60} placeholder="The house on Clover Lane" value={name} onChange={e => { setName(e.target.value); if (!customSlug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)); }}/></label><label>World address<div className="input-prefix"><span>/w/</span><input required minLength={3} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e => { setCustomSlug(true); setSlug(e.target.value); }}/></div></label><label>A little introduction<textarea maxLength={240} placeholder="What kind of place could this become?" value={description} onChange={e => setDescription(e.target.value)}/></label><label>World template<select value={templateId} onChange={e => setTemplateId(e.target.value)}>{Object.values(TEMPLATES).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="template-preview"><Building world={templateExamples[templateId]} miniature/><p>{template.description}</p><ol>{template.floors.map(floor => <li key={floor.name}><span style={{background:floor.color}}/>{floor.name}</li>)}</ol><small>Three floors & an elevator · World v1</small></div><label>How time passes</label><TimeModePicker value={mode} onChange={setMode}/><label className="range-label">Room for residents <b>{cap}</b><input aria-label="Population cap" type="range" min="1" max="40" value={cap} onChange={e => setCap(Number(e.target.value))}/></label><label className="checkbox-label"><input type="checkbox" checked={locked} onChange={e => setLocked(e.target.checked)}/><LockKeyhole size={15}/> Protect the door with a password</label>{locked && <label>World password<input type="password" required minLength={4} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/><small>The world remains in the public directory; its lives and history stay behind the password.</small></label>}{error && <p className="error-box" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Opening the doors…' : 'Let a little world begin'}<ArrowRight size={16}/></button><p className="form-foot">Everyone who enters can introduce events and adjust the world.</p></form></Modal>;
}
function World({ slug, insights }: { slug: string; insights: boolean }) {
  const fullscreen = useWorldFullscreen();
  const journalPanel = useJournalPanel();
  const phone = useMediaQuery(PHONE_QUERY);
  const [conversationRequest, setConversationRequest] = useState<{ id: number; entry?: LogEntry }>();
  const [openConversation, setOpenConversation] = useState<{ id: number; entry?: LogEntry }>();
  useFullscreenCanvas(fullscreen.ref, fullscreen.isFullscreen, journalPanel.collapsed);
  const [snapshot,setSnapshot] = useState<Snapshot>(); const [error,setError] = useState(''); const [locked,setLocked] = useState(false); const [missing,setMissing] = useState(false); const [password,setPassword] = useState(''); const [connected,setConnected] = useState(false); const [reload,setReload] = useState(0); const [modal,setModal] = useState<'add'|'settings'|'identity'|null>(null); const [selected,setSelected] = useState<string>(); const [tab,setTab] = useState<'journal'|'residents'|'bonds'>('journal'); const [pending,setPending] = useState(false); const [now,setNow] = useState(Date.now());
  const [identity,setIdentity] = useState<ObserverIdentity>(() => {
    try { const saved = parseObserver(localStorage.getItem(OBSERVER_KEY)); if (saved) return saved; } catch { /* Storage may be unavailable. */ }
    return { id: crypto.randomUUID(), name: `Observer ${Math.floor(Math.random()*900+100)}` };
  });
  useEffect(() => { try { localStorage.setItem(OBSERVER_KEY, JSON.stringify(identity)); } catch { /* Keep the session identity when storage is unavailable. */ } }, [identity]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== OBSERVER_KEY) return;
      const saved = parseObserver(event.newValue);
      if (saved) setIdentity(current => saved.id === current.id && saved.name !== current.name ? saved : current);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const stageRef = useRef<HTMLElement>(null);
  useWorldViewport(stageRef, !!snapshot && !locked && !missing && !insights && !fullscreen.isFullscreen);
  const sceneZoom = useSceneZoom(stageRef, !!snapshot && !locked && !missing && !insights, slug);
  const [awayTarget, setAwayTarget] = useState<string | null>(null);
  const [expandedResident, setExpandedResident] = useState(false);
  const [appearanceTarget, setAppearanceTarget] = useState<string | null>(null);
  useEffect(() => { if (!selected) setExpandedResident(false); }, [selected]);
  const serverOffset = useRef(0);
  function acceptSnapshot(s: Snapshot) { serverOffset.current = s.serverNow - Date.now(); setNow(s.serverNow); setSnapshot(s); }
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() + serverOffset.current),1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let disposed = false; let socket: WebSocket | undefined; let retry: ReturnType<typeof setTimeout>; let attempt = 0; let heartbeat: ReturnType<typeof setInterval>; const controller = new AbortController();
    async function connect() {
      try {
        const s = await api<Snapshot>(`/worlds/${slug}`, undefined, controller.signal); if (disposed) return; acceptSnapshot(s); setLocked(false); setMissing(false); setError('');
        socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/worlds/${slug}/socket?player=${encodeURIComponent(identity.id)}&name=${encodeURIComponent(identity.name)}`);
        const activeSocket = socket;
        socket.onopen = () => { if (disposed || socket !== activeSocket) return; attempt = 0; setConnected(true); heartbeat = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping'); },HEARTBEAT_MS); };
        socket.onmessage = event => { if (disposed || socket !== activeSocket) return; if (event.data === 'pong') return; try { const data = JSON.parse(event.data); if (data.type === 'snapshot') acceptSnapshot(data); } catch { /* Ignore malformed transport messages. */ } };
        socket.onclose = () => { if (disposed || socket !== activeSocket) return; clearInterval(heartbeat); setConnected(false); retry = setTimeout(connect, Math.min(20_000,1000*2**attempt++)); };
        socket.onerror = () => { if (!disposed && socket === activeSocket) activeSocket.close(); };
      } catch (e) { if (disposed) return; if (e instanceof ApiError && e.status === 401) setLocked(true); else if (e instanceof ApiError && e.status === 404) setMissing(true); else { setError(getError(e)); retry = setTimeout(connect, 5000); } }
    }
    setConnected(false);
    void connect(); return () => { disposed = true; controller.abort(); clearTimeout(retry); clearInterval(heartbeat); socket?.close(); };
  }, [slug, reload, identity]);
  async function command(c: Command, rethrow = false) { setPending(true); setError(''); try { acceptSnapshot(await api<Snapshot>(`/worlds/${slug}/commands`,c)); return true; } catch(e) { if (e instanceof ApiError && e.data.playerEvents && typeof e.data.serverNow === 'number') { serverOffset.current = e.data.serverNow - Date.now(); setNow(e.data.serverNow); setSnapshot(previous => previous ? { ...previous, playerEvents: e.data.playerEvents as PlayerEventBudget } : previous); } setError(getError(e)); if (rethrow) throw e; return false; } finally { setPending(false); } }
  if (locked) return <main className="locked-world"><div className="large-icon"><LockKeyhole size={28}/></div><h1>This door has a key.</h1><p>Enter the world’s password to join its story.</p><form onSubmit={async e => { e.preventDefault(); setPending(true); try { await api(`/worlds/${slug}/unlock`,{ password }); setLocked(false); setReload(n=>n+1); } catch(e) { setError(getError(e)); } finally { setPending(false); } }}><input autoFocus type="password" autoComplete="current-password" aria-label="World password" placeholder="World password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="primary" disabled={pending}>Open the door <ArrowRight size={16}/></button>{error && <p className="error-box" role="alert">{error}</p>}</form><a href="/" className="quiet-link"><ArrowLeft size={14}/> Back to the neighborhood</a></main>;
  if (missing) return <main className="empty-page"><h1>This world hasn’t begun yet.</h1><a href="/">Find a world in the neighborhood</a></main>;
  if (!snapshot) return <main className="empty-page"><Sprout size={30}/><p>{error || 'Finding your little corner…'}</p></main>;
  const presence = observerPresence(snapshot.presence, identity);
  const w = snapshot.world; const resident = w.characters.find(c=>c.id===selected); const appearanceResident = appearanceTarget ? w.characters.find(c=>c.id===appearanceTarget) : undefined; const remaining = Math.max(0,Math.ceil(((w.cooldowns.events || 0)-now)/1000));
  const residentModal = (onClose: () => void, back?: string) => resident && <Modal title="Resident story" className="resident-modal" onClose={onClose}><CharacterDetail onEditAppearance={()=>{setError('');setAppearanceTarget(resident.id);}} onRename={name=>command({type:'rename-character',characterId:resident.id,name},true)} wide wideBack={back} models={snapshot.models} onModel={model=>void command({type:'set-model',characterId:resident.id,model})} world={w} character={resident} onSelect={id=>{setSelected(id);setTab('residents');}} onBack={onClose} busy={pending} onAway={()=>{if(resident.away)void command({type:'set-away',characterId:resident.id,away:false});else {setError('');setAwayTarget(resident.id);}}}/></Modal>;
  const budget = snapshot.playerEvents ?? eventBudget([], now);
  return <main ref={fullscreen.ref} className={`world-page ${fullscreen.isFullscreen ? 'world-fullscreen' : ''}`}>{fullscreen.isFullscreen && <header className="fullscreen-site-header"><Logo/><ThemeControl/></header>}<div className="world-heading"><div><a className="back-link" href="/"><ArrowLeft size={13}/> The neighborhood</a><h1>{w.name}<span className={`live-chip ${connected ? '' : 'offline'}`}><span className="status-dot"/>{connected ? 'Live world' : 'Reconnecting'}</span></h1><p>{w.description}</p></div><div className="world-heading-actions"><button className="presence-group" onClick={()=>setModal('identity')} aria-label="Your observer name and online players">{presence.slice(0,3).map(p=><span title={p.name} key={p.id} style={{background:p.color}}>{p.name[0].toUpperCase()}</span>)}<small>{presence.length} here <ChevronDown size={12}/></small></button><button className="outline" onClick={()=>setModal('settings')}><Settings2 size={15}/> World settings</button></div></div>
    {error && <div className="error-box" role="alert">{error}<button className="icon-button" onClick={()=>setError('')} aria-label="Dismiss error"><X size={14}/></button></div>}
    <div className="world-view-controls"><nav className="world-view-nav" aria-label="World views"><a href={`/w/${slug}`} aria-current={!insights ? 'page' : undefined}><Globe2 size={16}/> The world</a><a href={`/w/${slug}/insights`} aria-current={insights ? 'page' : undefined}><Heart size={16}/> Community insights</a>{insights && <span>{gameTime(w.minute)}</span>}</nav>{!insights && <div className="journal-panel-controls"><button type="button" className="outline journal-panel-toggle" aria-expanded={!journalPanel.collapsed} aria-controls="world-journal-panel" onClick={()=>journalPanel.setCollapsed(!journalPanel.collapsed)}><BookOpen size={16} aria-hidden="true"/>{journalPanel.collapsed ? 'Show journal' : 'Hide journal'}</button></div>}</div>
    {insights ? <><a className="back-link insights-return" href={`/w/${slug}`}><ArrowLeft size={14}/> Back to the world</a><CommunityInsights world={w} onSelectResident={setSelected}/>{residentModal(()=>setSelected(undefined),'Back to insights')}</> : <>
    <div className={`world-layout ${journalPanel.collapsed ? 'journal-collapsed' : ''}`}><section className="world-stage" ref={stageRef}><div className="stage-toolbar"><span><span className="status-dot"/>{gameTime(w.minute)}</span><div className="stage-toolbar-actions"><TimeModeStatus mode={w.settings.mode}/><div className="scene-zoom-controls" role="group" aria-label="House zoom">{sceneZoom.canZoomOut && <button type="button" className="scene-zoom-reset" onClick={sceneZoom.reset} aria-label="Reset zoom" title="Reset zoom"><RotateCcw size={14} aria-hidden/></button>}<button type="button" onClick={sceneZoom.zoomOut} disabled={!sceneZoom.canZoomOut} aria-label="Zoom out" title="Zoom out"><ZoomOut size={15} aria-hidden/></button><button type="button" onClick={sceneZoom.zoomIn} disabled={!sceneZoom.canZoomIn} aria-label="Zoom in" title="Zoom in (or pinch the house)"><ZoomIn size={15} aria-hidden/></button></div><button ref={fullscreen.buttonRef} className="fullscreen-toggle" onClick={()=>void fullscreen.toggle()} disabled={fullscreen.changing} aria-label={fullscreen.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} aria-pressed={fullscreen.isFullscreen} title={fullscreen.isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}>{fullscreen.isFullscreen ? <Minimize size={15}/> : <Maximize size={15}/>}<span>{fullscreen.isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button></div></div><Building world={w} onOpenConversation={id=>setOpenConversation({id})} selected={selected} onSelect={id=>{setSelected(id);setTab('residents');journalPanel.setCollapsed(false);}}/><div className="stage-footer"><span><Users size={14}/> {activeCharacters(w).length} of {w.settings.populationCap} residents <i>·</i> {w.characters.filter(c=>c.away).length} away</span><a className="house-events-link" href="#house-events">House events <ArrowDownRight size={15}/></a><IntroduceResidentButton world={w} pending={pending} onClick={()=>setModal('add')}/></div></section>
      <div className="mobile-journal-control"><span>Life in the house</span><button type="button" className="outline journal-panel-toggle" aria-expanded={!journalPanel.collapsed} aria-controls="world-journal-panel" onClick={()=>journalPanel.setCollapsed(!journalPanel.collapsed)}><BookOpen size={16} aria-hidden="true"/>{journalPanel.collapsed ? 'Show journal' : 'Hide journal'}</button></div><aside id="world-journal-panel" className="world-sidebar" aria-label="World journal and residents" hidden={journalPanel.collapsed}><div className="sidebar-tabs"><button className={tab==='journal'?'active':''} onClick={()=>setTab('journal')}><BookOpen size={14}/> Journal</button><button className={tab==='residents'?'active':''} onClick={()=>setTab('residents')}><Users size={14}/> Residents</button><button className={tab==='bonds'?'active':''} onClick={()=>setTab('bonds')}><Heart size={14}/> Bonds</button></div><div className="journal-panel" hidden={tab!=='journal'}><Journal world={w} onOpenConversation={entry=>setOpenConversation({id:entry.id,entry})} conversationRequest={conversationRequest} onSelect={id=>{setSelected(id);setTab('residents');}}/></div>{tab==='journal' ? null : tab==='bonds' ? <Bonds world={w} onSelect={id=>{setSelected(id);setTab('residents');}}/> : resident ? <CharacterDetail onEditAppearance={()=>{setError('');setAppearanceTarget(resident.id);}} onRename={name=>command({type:'rename-character',characterId:resident.id,name},true)} models={snapshot.models} onModel={model=>void command({type:'set-model',characterId:resident.id,model})} world={w} character={resident} onSelect={id=>{setSelected(id);setTab('residents');}} onBack={()=>setSelected(undefined)} onExpand={()=>setExpandedResident(true)} busy={pending} onAway={()=>{if(resident.away)void command({type:'set-away',characterId:resident.id,away:false});else {setError('');setAwayTarget(resident.id);}}}/> : <Residents world={w} onSelect={setSelected} onAdd={()=>setModal('add')}/>}</aside>
    </div>
    <CommunityMetrics world={w}/>
    <section id="house-events" className="events-section"><div className="events-heading"><div><h2>Invite a little possibility.</h2></div><span>{remaining ? `Let the moment settle · ${remaining}s` : 'You set the scene. They take it from there.'}</span></div><EventAllowance budget={budget} now={now} worldReadyAt={w.cooldowns.events || 0}/><EventPicker events={serverEvents(EVENTS, snapshot.eventIds)} phone={phone} disabled={pending || !connected} wait={eventWait(now, { readyAt: w.cooldowns.events || 0, total: EVENT_COOLDOWN_MS }, budget)} now={now} onPick={eventId=>void command({type:'trigger-event',eventId})}/></section><div className="world-footnote"><Leaf size={13}/> Nothing to win. A lot to notice.<span>Changes are saved as life unfolds.</span></div>
    </>}
    {openConversation !== undefined && <ConversationModal key={`${w.slug}:${openConversation.id}`} world={w} conversationId={openConversation.id} initialEntry={openConversation.entry} onClose={()=>setOpenConversation(undefined)} onJournal={entry=>{setOpenConversation(undefined);setConversationRequest({id:entry.id,entry});setTab('journal');journalPanel.setCollapsed(false);}} onSelect={id=>{setOpenConversation(undefined);setSelected(id);setTab('residents');journalPanel.setCollapsed(false);}}/>}
    {expandedResident && !insights && tab==='residents' && residentModal(()=>setExpandedResident(false))}
    {appearanceResident && <Modal title={`${appearanceResident.name}’s look`} className="appearance-modal" onClose={()=>setAppearanceTarget(null)}><AppearanceEditor key={appearanceResident.id} character={appearanceResident} busy={pending} onSave={look=>command({type:'set-appearance',characterId:appearanceResident.id,...look},true)} onCancel={()=>setAppearanceTarget(null)}/></Modal>}
    <AwayConfirmation targetId={awayTarget} resident={insights||tab==='residents'?resident:undefined} busy={pending} error={error} onClose={()=>setAwayTarget(null)} onConfirm={async id=>{const sent=await command({type:'set-away',characterId:id,away:true});if(sent)setSelected(current=>current===id?undefined:current);return sent;}}/>
    {modal==='add' && <AddCharacter onClose={()=>setModal(null)} onSubmit={async values=>{if(await command({type:'add-character',...values}))setModal(null);}} busy={pending} error={error}/>}
    {modal==='settings' && <Settings world={w} onSaved={acceptSnapshot} onClose={()=>setModal(null)} busy={pending} error={error} onSubmit={async values=>{if(await command({type:'settings',...values}))setModal(null);}}/>}
    {modal==='identity' && <Identity name={identity.name} observerId={identity.id} connected={connected} presence={presence} onClose={()=>setModal(null)} onSave={name=>{setIdentity({...identity,name});setModal(null);}}/>}
  </main>;
}

function Journal({world,onSelect,onOpenConversation,conversationRequest}:{world:WorldState;onSelect:(id:string)=>void;onOpenConversation:(entry:LogEntry)=>void;conversationRequest?:{id:number;entry?:LogEntry}}) {
  const [older,setOlder]=useState<LogEntry[]>([]);const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');const [filter,setFilter]=useState('all');
  const map=new Map([...older,...(conversationRequest?.entry ? [conversationRequest.entry] : []),...world.history].map(e=>[e.id,e])); const entries=[...map.values()].sort((a,b)=>b.id-a.id); const items=foldJournal(entries.filter(e=>filter==='all'||filter==='stories'||(filter==='moments'?['event','friendship','ritual','arrival','departure'].includes(e.kind):['conversation','conflict'].includes(e.kind))),world,new Set(conversationRequest?[conversationRequest.id]:[])); const visible=filter==='stories'?items.filter(isStoryItem):items;
  // A directly opened archived thread must not advance ordinary history paging.
  const archiveCursor = [...older, ...world.history].reduce((cursor, entry) => Math.min(cursor, entry.id), Number.MAX_SAFE_INTEGER);
  const timelineRef = useRef<HTMLDivElement>(null);
  const handledRequest = useRef<typeof conversationRequest>(undefined);
  useEffect(() => { if (conversationRequest) setFilter('all'); }, [conversationRequest]);
  useEffect(() => {
    if (!conversationRequest || filter !== 'all' || handledRequest.current === conversationRequest) return;
    const frame = requestAnimationFrame(() => {
      const article = timelineRef.current?.querySelector<HTMLElement>(`[data-conversation-id="${conversationRequest.id}"]`);
      const thread = article?.querySelector('details');
      const summary = thread?.querySelector('summary');
      if (!thread || !summary) return;
      thread.open = true;
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      handledRequest.current = conversationRequest;
    });
    return () => cancelAnimationFrame(frame);
  }, [conversationRequest, filter]);
  async function loadOlder(){setBusy(true);setError('');try{const data=await api<{entries:LogEntry[];nextCursor:number|null}>(`/worlds/${world.slug}/history?before=${archiveCursor}`);setOlder([...older,...world.history,...data.entries]);setDone(data.nextCursor===null);}catch(e){setError(getError(e));}finally{setBusy(false);}}
  return <><div className="sidebar-intro"><h3>Life, in little moments.</h3><p>Every encounter leaves a little trace.</p><div className="journal-filters">{[['all','Everything'],['stories','Stories'],['moments','Milestones'],['talk','Conversations']].map(([id,label])=><button className={filter===id?'selected':''} key={id} onClick={()=>setFilter(id)}>{label}</button>)}</div></div><div className="journal-scroll"><div className="timeline" ref={timelineRef}>{visible.map(({entry,earlier,summary})=><article data-conversation-id={entry.conversation ? entry.id : undefined} className={`journal-entry kind-${entry.kind}${entry.highlight?' highlighted':''}`} key={entry.id}>{entry.highlight&&<span className="journal-highlight">{highlightLabels[entry.highlight]}</span>}<span className="timeline-icon">{entry.kind==='arrival'?<Plus size={12}/>:entry.kind==='event'?<Sparkles size={12}/>:entry.kind==='friendship'?<Heart size={12}/>:entry.kind==='conflict'?<Zap size={12}/>:entry.kind==='ritual'?<Moon size={12}/>:<MessageCircle size={12}/>}</span>{entry.conversation ? <><ConversationThread journal entry={entry} characters={world.characters} onSelect={onSelect}/><button type="button" className="journal-open-conversation" aria-haspopup="dialog" aria-label={`Open conversation: ${entry.conversation.title ?? entry.conversation.topic}`} onClick={()=>onOpenConversation(entry)}>Open conversation <Maximize2 size={12} aria-hidden="true"/></button>{summary&&<div className="journal-arc">{summary}</div>}{earlier.length>0&&<details className="journal-arc-earlier"><summary>{earlier.length} earlier attempt{earlier.length===1?'':'s'}</summary><ul>{earlier.map(e=><li key={e.id}><small>{gameTime(e.minute)}</small> <CharacterText text={e.text} characters={world.characters} participants={e.characters} onSelect={onSelect}/></li>)}</ul></details>}</> : <><div className="entry-meta"><span>{gameTime(entry.minute)}</span><span>{entry.kind}</span></div><p><CharacterText text={entry.text} characters={world.characters} participants={entry.characters} onSelect={onSelect}/></p>{entry.generated&&<small className="ai-label">AI-enriched dialogue</small>}</>}</article>)}</div>{!visible.length&&<p className="empty-note">These pages are waiting for a story.</p>}{error&&<p className="error-box">{error}</p>}{!done&&archiveCursor!==1&&<button className="load-more" disabled={busy} onClick={loadOlder}>{busy?'Turning back the pages…':'Earlier in the story'}<ChevronDown size={14}/></button>}<p className="journal-end"><Sprout size={14}/> The story keeps growing.</p></div></>;
}
function Avatar({character}:{character:Character}){return <span className="avatar" style={{background:`${character.color}22`}}><svg viewBox="-26 -62 52 67" aria-hidden="true"><Person character={character}/></svg></span>;}
function Residents({world,onSelect,onAdd}:{world:WorldState;onSelect:(id:string)=>void;onAdd:()=>void}) {const [away,setAway]=useState(false);const list=world.characters.filter(c=>c.away===away);return <><div className="sidebar-intro"><h3>Everyone has a story.</h3><div className="journal-filters"><button className={!away?'selected':''} onClick={()=>setAway(false)}>At home · {activeCharacters(world).length}</button><button className={away?'selected':''} onClick={()=>setAway(true)}>Away · {world.characters.filter(c=>c.away).length}</button></div></div><div className="resident-list">{list.map(c=><button key={c.id} className="resident-row" onClick={()=>onSelect(c.id)}><Avatar character={c}/><span><b>{c.name}</b><small>{c.away?'A little time elsewhere':c.activity}</small></span><span className="mood-indicator" title={`Mood: ${Math.round(c.mood)}`} style={{background:c.mood>60?'#9bab87':c.mood>30?'#d9bb81':'#c38b79'}}/><ArrowRight size={13}/></button>)}{!list.length&&<p className="empty-note">{away?'Nobody is away right now.':'The house is quiet. Welcome someone new.'}</p>}{!away&&<IntroduceResidentButton world={world} onClick={onAdd} sidebar/>}{away&&<p className="empty-note">Time away preserves memories and relationships. Open a profile to welcome someone back.</p>}</div></>;}
function CharacterDetail({models,onModel,world,character:c,onSelect,onBack,busy,onAway,backLabel='All residents',onExpand,wide,wideBack,onEditAppearance,onRename}:{onRename:(name:string)=>Promise<unknown>;onEditAppearance:()=>void;onExpand?:()=>void;wide?:boolean;wideBack?:string;world:WorldState;character:Character;onSelect:(id:string)=>void;onBack:()=>void;busy:boolean;onAway:()=>unknown;backLabel?:string;models?:Snapshot['models'];onModel:(model:string)=>void}){const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{if(!wide)heading.current?.focus({preventScroll:true});},[c.id,wide]);const bonds=Object.values(world.relationships).filter(r=>r.a===c.id||r.b===c.id).sort((a,b)=>b.affinity-a.affinity).slice(0,4);const intro=<><p className="background-label">Before the house · background</p><p className="backstory">{c.backstory}</p><p className="current-activity"><span className="status-dot"/>{c.activity}</p><div className="character-needs">{[['Mood',c.mood],['Energy',c.energy],['Belonging',c.belonging]].map(([label,value])=><div key={label}><span>{label}</span><b>{Math.round(Number(value))}</b><div className="stat-track"><span style={{width:`${value}%`}}/></div></div>)}</div></>;const state=<><ResidentState key={c.id} character={c} world={world}/></>;const bondsEl=<><h4>Threads of connection</h4>{bonds.map(r=>{const other=world.characters.find(p=>p.id===(r.a===c.id?r.b:r.a))!;return <div key={other.id} className="small-bond"><span>{other.name}{other.away?' · away':''}</span><small>{relationshipLabel(r)}</small></div>;})}</>;const history=<><PersonalHistory key={c.id} character={c} characters={world.characters} onSelect={onSelect} minute={world.minute} events={world.history}/></>;const controls=<><ModelSelection character={c} models={models} busy={busy} onChange={onModel}/><button className="outline full" disabled={busy|| (c.away&&activeCharacters(world).length>=world.settings.populationCap)} onClick={onAway}><DoorOpen size={15}/>{c.away?'Welcome back to the house':'Let them take some time away'}</button><p className="form-foot">{c.away?'Their memories and relationships are still here.':'Their story stays here, ready for their return.'}</p></>;const backText=wide?wideBack:backLabel;const toolbar=(backText||onExpand)&&<div className="detail-toolbar">{backText?<button className="back-link" onClick={onBack}><ArrowLeft size={13}/> {backText}</button>:<span/>}{onExpand&&<button className="icon-button expand-resident" onClick={onExpand} aria-label={`Open ${c.name} in a larger panel`} title="Open in larger panel"><Maximize2 size={15}/></button>}</div>;const top=<><div className="character-heading"><Avatar character={c}/><div><h2 ref={heading} tabIndex={-1}>{c.name}</h2><span className="trait">{c.trait} soul</span></div></div><ResidentNameEditor key={c.id} name={c.name} busy={busy} onSave={onRename} beside={<button type="button" className="back-link" disabled={busy} aria-label={`Edit ${c.name}’s appearance`} onClick={onEditAppearance}><Palette size={13} aria-hidden="true"/> Edit appearance</button>}/></>;return wide?<div className="character-detail wide">{toolbar}{top}<div className="detail-columns"><div>{intro}{bondsEl}{state}</div><div>{history}{controls}</div></div></div>:<div className="character-detail">{toolbar}{top}{intro}{state}{bondsEl}{history}{controls}</div>;}
function AddCharacter({onClose,onSubmit,busy,error}:{onClose:()=>void;onSubmit:(values:{name:string;trait?:Character['trait'];backstory:string})=>void;busy:boolean;error:string}){const [name,setName]=useState('');const [trait,setTrait]=useState('');const [backstory,setBackstory]=useState('');return <Modal title="Someone new at the door." onClose={onClose}><form onSubmit={e=>{e.preventDefault();onSubmit({name,trait:trait?trait as Character['trait']:undefined,backstory});}}><p className="muted">Bring a little personality. Or leave the details to chance.</p><label>Name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Let the world choose" maxLength={30}/></label><label>A little of their nature<select value={trait} onChange={e=>setTrait(e.target.value)}><option value="">A surprise</option>{TRAITS.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></label><label>What brought them here?<textarea value={backstory} onChange={e=>setBackstory(e.target.value)} maxLength={500} placeholder="A backstory, a hope, an old habit… (optional)"/></label>{error&&<p className="error-box" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Making an introduction…':'Welcome them in'}<Plus size={16}/></button></form></Modal>;}
function Settings({world,onSaved,onClose,onSubmit,busy,error}:{world:WorldState;onSaved:(snapshot:Snapshot)=>void;onClose:()=>void;onSubmit:(v:{mode:TimeMode;populationCap:number})=>void;busy:boolean;error:string}) {const [detailsBusy,setDetailsBusy]=useState(false);const [mode,setMode]=useState(world.settings.mode);const [cap,setCap]=useState(world.settings.populationCap);return <Modal title="World settings" onClose={()=>{if(!detailsBusy && !busy)onClose();}}><HouseDetailsForm disabled={busy} world={world} onSaved={onSaved} onCancel={onClose} onBusy={setDetailsBusy}/><form onSubmit={e=>{e.preventDefault();onSubmit({mode,populationCap:cap});}}><label>How time passes</label><TimeModePicker value={mode} onChange={setMode}/><label className="range-label">Population cap <b>{cap}</b><input aria-label="Population cap" type="range" min={Math.max(1,activeCharacters(world).length)} max={40} value={cap} onChange={e=>setCap(Number(e.target.value))}/></label><p className="muted">{activeCharacters(world).length} residents are at home. Away residents don’t count toward the cap.</p><div className="template-note"><Globe2 size={18}/><div><b>{TEMPLATES[world.templateId].name}</b><small>World template · v1</small></div></div>{error&&<p className="error-box" role="alert">{error}</p>}<button className="primary full" disabled={busy || detailsBusy}>{busy?'Saving…':'Save world settings'}<Check size={16}/></button><p className="form-foot">These settings change the world for everyone.</p></form></Modal>;}
function Identity({name,observerId,connected,presence,onClose,onSave}:{name:string;observerId:string;connected:boolean;presence:Snapshot['presence'];onClose:()=>void;onSave:(name:string)=>void}) {const [value,setValue]=useState(name);const [problem,setProblem]=useState('');return <Modal title="A few eyes on the world." onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(!isAppropriate(value)){setProblem('Please choose a different observer name. Kinarium is a shared space, so we can’t accept language that may be offensive.');return;}onSave(value.trim()||'Wandering observer');}}><label>Your observer name<input autoFocus value={value} maxLength={24} onChange={e=>{setValue(e.target.value);setProblem('');}}/></label>{problem&&<p className="error-box" role="alert">{problem}</p>}<button className="primary full">Save name <Check size={16}/></button></form><h4>Sharing this moment</h4>{presence.map(p=><div className="presence-row" key={p.id}><span style={{background:p.color}}>{p.name[0]}</span>{p.name}<small>{p.id === observerId ? `You · ${connected ? 'observing' : 'reconnecting'}` : 'observing'}</small></div>)}</Modal>;}

createRoot(document.getElementById('root')!).render(<App/>);
