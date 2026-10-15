import type { Character, Snapshot } from '../simulation/types';

export function ModelSelection({ character, models, busy, onChange }: { character: Character; models: Snapshot['models']; busy: boolean; onChange: (model: string) => void }) {
  if (!models) return null;
  const removed = !!character.model && !models.allowed.includes(character.model);
  return <div className="model-selection"><label>Dialogue model for {character.name}<select value={removed ? '' : character.model ?? ''} disabled={busy} onChange={event => onChange(event.target.value)} aria-describedby={`model-help-${character.id}`}>
    <option value="">Default · {models.defaultModel ?? 'procedural dialogue'}</option>
    {models.allowed.map(model => <option key={model} value={model}>{model}</option>)}
  </select></label><p id={`model-help-${character.id}`} className="muted">{removed ? 'The saved model is no longer allowed; using the default. ' : ''}Applies to future generated dialogue. History stays intact.</p></div>;
}
