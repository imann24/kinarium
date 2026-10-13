import { useMemo } from 'react';
import { gameTime } from '../simulation/engine';
import type { WorldState } from '../simulation/types';
import { houseNarrative } from './house-narrative';

export default function HouseNarrative({ world }: { world: WorldState }) {
  const narrative = useMemo(() => houseNarrative(world), [world]);
  return <section className="house-narrative" aria-labelledby="house-narrative-title">
    <div><p className="eyebrow">THE HOUSE, IN A FEW WORDS</p><h3 id="house-narrative-title">A little of the story.</h3></div>
    <div className="house-narrative-copy">
      <p>{narrative.atmosphere}</p>
      {narrative.moments.length ? <p>{narrative.moments.map(moment => <span key={moment.id}>{moment.text} <small>({gameTime(moment.minute)})</small>{' '}</span>)}</p> : <p>{narrative.empty}</p>}
      <p className="insights-note">Selected retained moments · last six simulation hours. Records may be incomplete.</p>
      <details><summary>About this reading</summary><p>Whole house, including recorded interactions with residents now away. Selected moments from the last six simulation hours; current atmosphere uses the house’s togetherness and tension scores. The statistics filters do not change this reading.</p><p>{narrative.coverage} This is a selection, not a complete history or an explanation of anyone’s feelings.</p></details>
    </div>
  </section>;
}
