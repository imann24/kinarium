import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from './useMediaQuery';

// Real reading time, independent of simulation minutes and snapshot frequency.
export const EXPANDED_SPEECH_MS = 45_000;
import './expandable-text.css';

/** Plain text only: expansion never wraps or intercepts other controls. */
export function ExpandableText({ text, label, previewLength = 31, onExpand, expandable = false, initiallyExpanded = false }: {
  text: string; label: string; previewLength?: number; onExpand?: () => void; expandable?: boolean; initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const truncated = text.length > previewLength;
  if (!truncated && !expandable) return <span className="expandable-text">{text}</span>;
  return <button type="button" className="expandable-text" aria-label={expanded ? `${label}: ${text}` : `Show full ${label}`}
    aria-expanded={expanded} onClick={() => { if (!expanded) { setExpanded(true); onExpand?.(); } }}>
    {expanded ? text : (truncated ? `${text.slice(0, previewLength - 2)}…` : text)}
  </button>;
}

export function SpeechBubble({ text, name, x, y, residentId, conversationLabel = 'Open conversation', onOpenConversation, onExpand, onDismiss }: {
  text: string; name: string; x: number; y: number; residentId: string;
  conversationLabel?: string; onOpenConversation?: () => void; onExpand: () => void; onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // The scene shrinks to phone width, so expanded speech reads in a viewport-sized sheet instead.
  const sheet = useMediaQuery('(max-width: 760px)') && expanded;
  const bubbleRef = useRef<SVGElement | null>(null);
  const setBubble = (el: SVGElement | null) => { bubbleRef.current = el; };
  const sheetRef = useRef<HTMLDivElement>(null);
  const [deadline, setDeadline] = useState<number>();
  const [remaining, setRemaining] = useState(EXPANDED_SPEECH_MS);
  const dismissRef = useRef(onDismiss);
  function dismiss() {
    const bubble = bubbleRef.current;
    const reading = [bubble, sheetRef.current].some(el => el?.contains(document.activeElement));
    // Never steal focus from a conversation modal when its source bubble expires.
    if (reading && !document.querySelector('dialog[open]')) {
      bubble?.closest('svg')?.querySelector<HTMLElement>(`[data-resident-id="${CSS.escape(residentId)}"]`)?.focus({ preventScroll: true });
    }
    onDismiss();
  }
  useEffect(() => { dismissRef.current = dismiss; });
  useEffect(() => {
    if (!sheet) return;
    // The tapped preview unmounts as the sheet opens; keep the reader's place.
    if (!document.activeElement || document.activeElement === document.body) sheetRef.current?.querySelector<HTMLElement>('.expandable-text')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!sheetRef.current?.contains(event.target as Node) && !document.querySelector('dialog[open]')) dismissRef.current();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [sheet]);
  useEffect(() => {
    if (deadline === undefined) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      setRemaining(left);
      if (left === 0) dismissRef.current();
      else timer = setTimeout(tick, Math.min(100, left));
    };
    tick();
    return () => clearTimeout(timer);
  }, [deadline]);
  const width = expanded ? 300 : 156;
  // Keep the reading area inside the live viewBox, including elevator riders.
  const left = Math.max(36, Math.min(x - width / 2, 884 - width));
  const top = expanded ? Math.max(28, Math.min(y - 89, 180)) : y - 89;
  const content = (children: ReactNode) => <div className="speech-content" onKeyDown={e => {
    if (expanded && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(); }
  }}>{children}</div>;
  const body = <>
    {expanded && <div className="speech-heading"><strong className="speech-speaker">{name}</strong><button type="button" className="speech-dismiss" aria-label={`Dismiss ${name}'s speech`} title="Dismiss speech" onClick={dismiss}><X size={18} aria-hidden/></button></div>}
    <ExpandableText text={text} label={`${name}'s speech`} expandable initiallyExpanded={sheet} onExpand={() => { setExpanded(true); setDeadline(performance.now() + EXPANDED_SPEECH_MS); onExpand(); }}/>
    {expanded && (onOpenConversation ? <button type="button" className="speech-conversation" onClick={onOpenConversation}>{conversationLabel}</button> : <small className="speech-unlinked">No linked conversation</small>)}
    {expanded && <div className="speech-lifetime" role="progressbar" aria-label="Time until speech dismisses" aria-valuemin={0} aria-valuemax={EXPANDED_SPEECH_MS / 1000} aria-valuenow={Math.ceil(remaining / 1000)}><span style={{ transform: `scaleX(${remaining / EXPANDED_SPEECH_MS})` }}/></div>}
  </>;
  if (sheet) {
    const host = bubbleRef.current?.closest<HTMLElement>('.world-page') ?? document.body;
    return <g ref={setBubble} className="speech-anchor">
      {createPortal(<div ref={sheetRef} className="speech-box expanded speech-sheet">{content(body)}</div>, host)}
    </g>;
  }
  return <foreignObject ref={setBubble} className={`speech-box ${expanded ? 'expanded' : ''}`} x={left} y={top} width={width} height={expanded ? 400 : 32}>
    {content(body)}
  </foreignObject>;
}
