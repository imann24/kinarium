import { useEffect, useRef, useState } from 'react';

// Real reading time, independent of simulation minutes and snapshot frequency.
export const EXPANDED_SPEECH_MS = 45_000;
import './expandable-text.css';

/** Plain text only: expansion never wraps or intercepts other controls. */
export function ExpandableText({ text, label, previewLength = 31, onExpand, expandable = false }: {
  text: string; label: string; previewLength?: number; onExpand?: () => void; expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
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
  const bubbleRef = useRef<SVGForeignObjectElement>(null);
  const [deadline, setDeadline] = useState<number>();
  const [remaining, setRemaining] = useState(EXPANDED_SPEECH_MS);
  const dismissRef = useRef(onDismiss);
  function dismiss() {
    const bubble = bubbleRef.current;
    // Never steal focus from a conversation modal when its source bubble expires.
    if (bubble?.contains(document.activeElement) && !document.querySelector('dialog[open]')) {
      bubble.closest('svg')?.querySelector<HTMLElement>(`[data-resident-id="${CSS.escape(residentId)}"]`)?.focus({ preventScroll: true });
    }
    onDismiss();
  }
  useEffect(() => { dismissRef.current = dismiss; });
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
  return <foreignObject ref={bubbleRef} className={`speech-box ${expanded ? 'expanded' : ''}`} x={left} y={top} width={width} height={expanded ? 400 : 32}>
    <div className="speech-content" onKeyDown={e => {
      if (expanded && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(); }
    }}>
      {expanded && <div className="speech-heading"><strong className="speech-speaker">{name}</strong><button type="button" className="speech-dismiss" aria-label={`Dismiss ${name}'s speech`} title="Dismiss speech" onClick={dismiss}>×</button></div>}
      <ExpandableText text={text} label={`${name}'s speech`} expandable onExpand={() => { setExpanded(true); setDeadline(performance.now() + EXPANDED_SPEECH_MS); onExpand(); }}/>
      {expanded && (onOpenConversation ? <button type="button" className="speech-conversation" onClick={onOpenConversation}>{conversationLabel}</button> : <small className="speech-unlinked">No linked conversation</small>)}
      {expanded && <div className="speech-lifetime" role="progressbar" aria-label="Time until speech dismisses" aria-valuemin={0} aria-valuemax={EXPANDED_SPEECH_MS / 1000} aria-valuenow={Math.ceil(remaining / 1000)}><span style={{ transform: `scaleX(${remaining / EXPANDED_SPEECH_MS})` }}/></div>}
    </div>
  </foreignObject>;
}
