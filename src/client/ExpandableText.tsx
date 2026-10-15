import { useState } from 'react';
import './expandable-text.css';

/** Plain text only: expansion never wraps or intercepts other controls. */
export function ExpandableText({ text, label, previewLength = 31, onExpand }: {
  text: string; label: string; previewLength?: number; onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated = text.length > previewLength;
  if (!truncated) return <span className="expandable-text">{text}</span>;
  return <button type="button" className="expandable-text" aria-label={expanded ? `${label}: ${text}` : `Show full ${label}`}
    aria-expanded={expanded} onClick={() => { if (!expanded) { setExpanded(true); onExpand?.(); } }}>
    {expanded ? text : `${text.slice(0, previewLength - 2)}…`}
  </button>;
}

export function SpeechBubble({ text, name, x, y }: { text: string; name: string; x: number; y: number }) {
  const [expanded, setExpanded] = useState(false);
  const width = expanded ? 300 : 156;
  // Keep the reading area inside the live viewBox, including elevator riders.
  const left = Math.max(36, Math.min(x - width / 2, 884 - width));
  const top = expanded ? Math.max(28, Math.min(y - 89, 180)) : y - 89;
  return <foreignObject className={`speech-box ${expanded ? 'expanded' : ''}`} x={left} y={top} width={width} height={expanded ? 400 : 32}>
    <ExpandableText text={text} label={`${name}'s speech`} onExpand={() => setExpanded(true)}/>
  </foreignObject>;
}
