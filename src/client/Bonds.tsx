import { useMemo, useState } from 'react';
import { ChevronRight, Handshake, Heart, HeartCrack, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react';
import type { WorldState } from '../simulation/types';
import { Person } from './Building';
import { relationshipLabel, type BondKind } from './relationship-label';
import { communityInsights, pairRecords, recentActivity } from './community-insights';
import RelationshipModal from './RelationshipModal';

const bondIcons: Record<BondKind, LucideIcon> = {
  close: Heart, warm: Heart, trusted: Handshake, familiar: MessageCircle,
  repairing: Handshake, easing: Handshake, strained: HeartCrack,
  forming: Sparkles, unmet: Sparkles,
};

export default function Bonds({ world, onSelect }: { world: WorldState; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState<string>();
  const activity = useMemo(() => recentActivity(world), [world]);
  const bonds = communityInsights(world).met
    .sort((a, b) => Math.abs(b.relationship.affinity) - Math.abs(a.relationship.affinity));
  const chosen = bonds.find(({ relationship: r }) => `${r.a}:${r.b}` === open);

  return <>
    <div className="sidebar-intro bonds-intro">
      <h3>The ties that make a place.</h3>
      <p>Connections between residents at home. Saved relationships remain in profiles and Insights.</p>
    </div>
    <div className="bonds-list" role="region" aria-label="Resident bonds" tabIndex={0}>
      {bonds.map(({ a, b, relationship: r, kind }) => {
        const BondIcon = bondIcons[kind];
        const affinity = Math.max(-100, Math.min(100, r.affinity));
        const trust = Math.max(0, Math.min(100, r.trust));
        return <button type="button" className="bond-card" data-kind={kind} key={`${r.a}:${r.b}`}
          aria-haspopup="dialog" onClick={() => setOpen(`${r.a}:${r.b}`)}>
          <span className="bond-card-heading">
            <span className="bond-pair" aria-hidden="true">
              {[a, b].map(character => <span className="bond-pair-portrait" key={character.id}>
                <svg viewBox="-26 -62 52 67"><Person character={character}/></svg>
              </span>)}
            </span>
            <span className="bond-card-identity">
              <b>{a.name} <span>&</span> {b.name}</b>
              <small><BondIcon size={12} aria-hidden="true"/>{relationshipLabel(r)} · {r.encounters} encounters</small>
            </span>
            <ChevronRight className="bond-card-chevron" size={16} aria-hidden="true"/>
          </span>
          <span className="bond-card-scores">
            <span className={`bond-card-score${affinity < 0 ? ' negative' : ''}`}>
              <span className="bond-card-score-label"><span>Affinity</span><strong>{affinity > 0 ? '+' : ''}{Math.round(affinity)}</strong></span>
              <span className="bond-card-gauge diverging" role="img" aria-label={`Affinity ${Math.round(affinity)} on a scale from −100 to 100`}>
                <span style={{ width: `${Math.abs(affinity) / 2}%`, left: `${affinity >= 0 ? 50 : 50 + affinity / 2}%` }}/>
              </span>
            </span>
            <span className="bond-card-score">
              <span className="bond-card-score-label"><span>Trust</span><strong>{Math.round(trust)}%</strong></span>
              <span className="bond-card-gauge" role="img" aria-label={`Trust ${Math.round(trust)} out of 100`}>
                <span style={{ width: `${trust}%` }}/>
              </span>
            </span>
          </span>
        </button>;
      })}
      {!bonds.length && <p className="empty-note">No encounters between residents currently at home.</p>}
    </div>
    {chosen && <RelationshipModal relationship={chosen.relationship} a={chosen.a} b={chosen.b}
      records={pairRecords(activity.entries, chosen.a.id, chosen.b.id)} onClose={() => setOpen(undefined)}
      onSelectResident={id => { setOpen(undefined); onSelect(id); }}/>}
  </>;
}
