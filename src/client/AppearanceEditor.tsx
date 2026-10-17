import './appearance-editor.css';
import { CLOTHING_LABELS, HAIR_COLOR_LABELS, HAIR_COLORS, HAIR_STYLE_LABELS, HAIR_STYLES, residentAppearance, SKIN_TONE_LABELS, SKIN_TONES } from '../simulation/appearance';
import { COLORS } from '../simulation/catalog';
import type { Character, ResidentAppearance } from '../simulation/types';

type Look = { color: string; appearance: ResidentAppearance };

function Swatches({ label, colors, names, selected, busy, onPick }: { label: string; colors: readonly string[]; names: readonly string[]; selected: number; busy: boolean; onPick: (index: number) => void }) {
  return <div className="appearance-row" role="group" aria-label={label}><span>{label}</span><div className="appearance-options">
    {colors.map((color, i) => <button key={color} type="button" className="appearance-swatch" style={{ background: color }} aria-label={names[i]} title={names[i]} aria-pressed={i === selected} disabled={busy} onClick={() => i !== selected && onPick(i)}/>)}
  </div></div>;
}

/** Lets a viewer restyle a resident from the sprite's existing palette and hair shapes. */
export function AppearanceEditor({ character, busy, onChange }: { character: Character; busy: boolean; onChange: (look: Look) => void }) {
  const appearance = residentAppearance(character);
  const update = (patch: Partial<Look['appearance']>, color = character.color) => onChange({ color, appearance: { ...appearance, ...patch } });
  return <div className="appearance-editor"><h4>Their look</h4>
    <Swatches label="Clothing" colors={COLORS} names={CLOTHING_LABELS} selected={COLORS.indexOf(character.color)} busy={busy} onPick={i => update({}, COLORS[i])}/>
    <Swatches label="Skin" colors={SKIN_TONES} names={SKIN_TONE_LABELS} selected={appearance.skinTone} busy={busy} onPick={skinTone => update({ skinTone })}/>
    <div className="appearance-row" role="group" aria-label="Hair style"><span>Hair style</span><div className="appearance-options">
      {HAIR_STYLES.map((path, i) => <button key={path} type="button" className="appearance-style" aria-label={HAIR_STYLE_LABELS[i]} title={HAIR_STYLE_LABELS[i]} aria-pressed={i === appearance.hairStyle} disabled={busy} onClick={() => i !== appearance.hairStyle && update({ hairStyle: i })}>
        <svg viewBox="-16 -62 32 32" aria-hidden="true"><circle cy="-43" r="12" fill={SKIN_TONES[appearance.skinTone]}/><path d={path} fill={HAIR_COLORS[appearance.hairColor]}/></svg>
      </button>)}
    </div></div>
    <Swatches label="Hair color" colors={HAIR_COLORS} names={HAIR_COLOR_LABELS} selected={appearance.hairColor} busy={busy} onPick={hairColor => update({ hairColor })}/>
    <p className="muted">Changes show for everyone watching this house.</p>
  </div>;
}
