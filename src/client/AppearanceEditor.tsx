import './appearance-editor.css';
import { useRef, useState } from 'react';
import { CLOTHING_COLORS, CLOTHING_LABELS, HAIR_COLOR_LABELS, HAIR_COLOR_ORDER, HAIR_COLORS, HAIR_STYLE_LABELS, HAIR_STYLES, residentAppearance, SKIN_TONE_LABELS, SKIN_TONE_ORDER, SKIN_TONES } from '../simulation/appearance';
import type { Character, ResidentAppearance } from '../simulation/types';
import { Person } from './Building';

export type Look = { color: string; appearance: ResidentAppearance };

function Swatches({ label, colors, names, order = colors.map((_, i) => i), selected, disabled, onPick }: { label: string; colors: readonly string[]; names: readonly string[]; order?: readonly number[]; selected: number; disabled: boolean; onPick: (index: number) => void }) {
  return <div className="appearance-row" role="group" aria-label={label}><span>{label}</span><div className="appearance-options">
    {order.map(i => [colors[i], i] as const).map(([color, i]) => <button key={color} type="button" className="appearance-swatch" style={{ background: color }} aria-label={names[i]} title={names[i]} aria-pressed={i === selected} disabled={disabled} onClick={() => onPick(i)}/>)}
  </div></div>;
}

/** Previews a resident in the sprite's existing palette and hair shapes, and saves the chosen look once. */
export function AppearanceEditor({ character, busy, onSave, onCancel }: { character: Character; busy: boolean; onSave: (look: Look) => Promise<unknown>; onCancel: () => void }) {
  const [look, setLook] = useState<Look>(() => ({ color: character.color, appearance: residentAppearance(character) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const { appearance } = look;
  const disabled = busy || saving;
  const update = (patch: Partial<ResidentAppearance>, color = look.color) => { setError(''); setLook({ color, appearance: { ...appearance, ...patch } }); };
  const unchanged = look.color === character.color && JSON.stringify(appearance) === JSON.stringify(residentAppearance(character));
  return <form className="appearance-editor" onSubmit={async e => {
    e.preventDefault();
    if (disabled || submitting.current) return;
    if (unchanged) { onCancel(); return; }
    submitting.current = true; setSaving(true); setError('');
    try { await onSave(look); onCancel(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save their look. Please try again.'); }
    finally { submitting.current = false; setSaving(false); }
  }}>
    <div className="appearance-preview" style={{ background: `${look.color}22` }}><svg viewBox="-26 -62 52 67" role="img" aria-label={`Preview of ${character.name}`}><Person character={{ ...character, ...look }}/></svg></div>
    <div className="appearance-choices">
      <Swatches label="Clothing" colors={CLOTHING_COLORS} names={CLOTHING_LABELS} selected={(CLOTHING_COLORS as readonly string[]).indexOf(look.color)} disabled={disabled} onPick={i => update({}, CLOTHING_COLORS[i])}/>
      <Swatches label="Skin" colors={SKIN_TONES} names={SKIN_TONE_LABELS} order={SKIN_TONE_ORDER} selected={appearance.skinTone} disabled={disabled} onPick={skinTone => update({ skinTone })}/>
      <div className="appearance-row" role="group" aria-label="Hair style"><span>Hair style</span><div className="appearance-options">
        {HAIR_STYLES.map((path, i) => <button key={path} type="button" className="appearance-style" aria-label={HAIR_STYLE_LABELS[i]} title={HAIR_STYLE_LABELS[i]} aria-pressed={i === appearance.hairStyle} disabled={disabled} onClick={() => update({ hairStyle: i })}>
          <svg viewBox="-16 -64 32 34" aria-hidden="true"><circle cy="-43" r="12" fill={SKIN_TONES[appearance.skinTone]}/><path d={path} fill={HAIR_COLORS[appearance.hairColor]}/></svg>
        </button>)}
      </div></div>
      <Swatches label="Hair color" colors={HAIR_COLORS} names={HAIR_COLOR_LABELS} order={HAIR_COLOR_ORDER} selected={appearance.hairColor} disabled={disabled} onPick={hairColor => update({ hairColor })}/>
    </div>
    <p className="muted">Changes show for everyone watching this house.</p>
    {error && <p className="error-box" role="alert">{error}</p>}
    <div className="appearance-actions"><button className="primary" disabled={disabled}>{saving ? 'Saving…' : 'Save look'}</button><button type="button" className="outline" disabled={saving} onClick={onCancel}>Cancel</button></div>
  </form>;
}
