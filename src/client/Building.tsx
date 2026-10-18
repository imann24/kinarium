import './resident-stacks.css';
import { residentStacks } from './resident-stacks';
import { useId, type CSSProperties } from 'react';
import type { Character, WorldState } from '../simulation/types';
import { TEMPLATES } from '../simulation/catalog';
import { eyeColor, HAIR_COLORS, HAIR_STYLES, residentAppearance, SKIN_TONES } from '../simulation/appearance';
import { useBuildingMotion } from './useBuildingMotion';
import ResidentSpeech from './ResidentSpeech';

function Plant({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path d="M-10 0h20l-3 21H-7Z" fill="#bd8970"/><path d="M0 2v-38M0-13q-25-4-19-22Q0-34 0-13M0-23q23-4 18-24Q0-43 0-23" fill="#79936b" stroke="#637f59" strokeWidth="2"/></g>;
}
function TemplateFurniture({ templateId, floor, y }: { templateId: string; floor: number; y: number }) {
  if (templateId === 'makers-house') return <g>
    {floor === 0 && <>
      <rect x="145" y={y + 36} width="105" height="43" rx="3" fill="#bc9b79"/>
      {[0, 1, 2, 3].map(i => <path key={i} d={`M${162 + i * 23} ${y + 47}v23m-5-23h10`} stroke={i % 2 ? '#738b89' : '#71624d'} strokeWidth="4" strokeLinecap="round"/>)}
      <path d={`M150 ${y + 94}h180m-168 0v32m155-32v32`} stroke="#987451" strokeWidth="7"/>
      <rect x="147" y={y + 88} width="186" height="9" rx="2" fill="#b28e63"/>
      <rect x="206" y={y + 72} width="33" height="16" fill="#d4af7b"/><path d={`m268 ${y + 85} 19-13 16 13`} fill="none" stroke="#748f89" strokeWidth="4"/>
      <rect x="466" y={y + 90} width="86" height="35" rx="3" fill="#9b9381"/><path d={`M473 ${y + 102}h72m-72 12h72`} stroke="#d3c2a0" strokeWidth="2"/>
      <Plant x={648} y={y + 107} size={.9}/>
    </>}
    {floor === 2 && <>
      <path d={`m230 ${y + 126} 27-100 29 100m-48-31h40`} fill="none" stroke="#a17d5d" strokeWidth="5"/>
      <rect x="235" y={y + 34} width="46" height="57" fill="#f4e9d3" stroke="#bda186" strokeWidth="3"/>
      <circle cx="252" cy={y + 52} r="8" fill="#d2ad62"/><path d={`m239 ${y + 80} 14-18 10 9 15-16v32h-39Z`} fill="#90a6a0"/>
      <rect x="388" y={y + 88} width="116" height="10" rx="3" fill="#b08e70"/><path d={`M398 ${y + 98}v27m96-27v27`} stroke="#987458" strokeWidth="5"/>
      {['#bc775f', '#7c9295', '#c6a45a', '#94849e'].map((color, i) => <rect key={color} x={403 + i * 23} y={y + 74} width="13" height="14" rx="2" fill={color}/>)}
      <Plant x={648} y={y + 107} size={1.1}/>
    </>}
  </g>;
  if (templateId === 'harbor-house') return <g>
    {floor === 0 && <><circle cx="264" cy={y + 54} r="18" fill="#f1e8d4" stroke="#bc826b" strokeWidth="6"/><circle cx="264" cy={y + 54} r="9" fill="#e9d7bb"/><path d={`M351 ${y + 89}v-12h34v12`} fill="#839b9a" stroke="#627e80" strokeWidth="2"/></>}
    {floor === 1 && <><rect x="359" y={y + 28} width="58" height="42" fill="#eee7d3" stroke="#9d9f87" strokeWidth="3"/><path d={`m365 ${y + 59} 13-20 12 12 18-13m-43 26h46`} fill="none" stroke="#819caa" strokeWidth="2"/></>}
    {floor === 2 && <>
      <path d={`M167 ${y + 35}h134v66H167Z`} fill="#9db4b9" fillOpacity=".25" stroke="#7d9695" strokeWidth="3"/>
      {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${174 + i * 23} ${y + 35}v66M167 ${y + 39 + i * 12}h134`} stroke="#839c98" strokeWidth="1.5"/>)}
      <rect x="374" y={y + 86} width="122" height="10" rx="3" fill="#a19378"/><path d={`M385 ${y + 96}v29m99-29v29`} stroke="#8d8067" strokeWidth="5"/>
      <path d={`M400 ${y + 82}q12-20 24 0t24 0t24 0`} fill="none" stroke="#748f8b" strokeWidth="4"/>
      <rect x="573" y={y + 91} width="59" height="34" fill="#b39b76"/><path d={`M578 ${y + 102}h49m-49 12h49`} stroke="#8e7e64" strokeWidth="2"/>
      <circle cx="614" cy={y + 69} r="14" fill="#e3dbc1" stroke="#889c9b" strokeWidth="4"/>
    </>}
  </g>;
  if (templateId === 'courtyard-house') return <g>
    {floor === 0 && <>
      <ellipse cx="420" cy={y + 120} rx="62" ry="9" fill="#9fb4b4" opacity=".45"/>
      <path d={`M368 ${y + 122}q52-24 104 0`} fill="#b7a98c" stroke="#9a8c70" strokeWidth="3"/>
      <path d={`M420 ${y + 112}v-34m-14 10q14-20 28 0`} fill="none" stroke="#8fa9ab" strokeWidth="3" strokeLinecap="round"/>
      <rect x="188" y={y + 101} width="76" height="8" rx="3" fill="#a88d68"/><path d={`M195 ${y + 109}v17m62-17v17`} stroke="#8e7656" strokeWidth="5"/>
      <rect x="560" y={y + 101} width="76" height="8" rx="3" fill="#a88d68"/><path d={`M567 ${y + 109}v17m62-17v17`} stroke="#8e7656" strokeWidth="5"/>
      <path d={`M150 ${y + 34}q130 22 260 0`} fill="none" stroke="#a59a83" strokeWidth="1.5"/>
      {['#d5b26a', '#9db0a6', '#c88f74'].map((color, i) => <rect key={color} x={196 + i * 64} y={y + 40 + (i === 1 ? 6 : 2)} width="22" height="18" fill={color}/>)}
      <Plant x={300} y={y + 107} size={.9}/><Plant x={666} y={y + 105} size={1.15}/>
    </>}
    {floor === 1 && <>
      <rect x="196" y={y + 92} width="36" height="30" rx="7" fill="#a99a80"/><rect x="196" y={y + 78} width="10" height="44" rx="4" fill="#9a8b71"/>
      <rect x="300" y={y + 92} width="36" height="30" rx="7" fill="#a99a80"/><rect x="326" y={y + 78} width="10" height="44" rx="4" fill="#9a8b71"/>
      <circle cx="266" cy={y + 95} r="14" fill="#c4ad87"/><path d={`M266 ${y + 109}v17`} stroke="#9e8a69" strokeWidth="4"/><rect x="259" y={y + 85} width="11" height="9" rx="2" fill="#efe1be"/>
      <path d={`M266 ${y + 20}v20`} stroke="#a59a83" strokeWidth="1.5"/><Plant x={266} y={y + 62} size={.5}/>
    </>}
    {floor === 2 && <>
      {[452, 560].map(x => <g key={x}><path d={`M${x} ${y + 126}v-46`} stroke="#8c7158" strokeWidth="6"/><circle cx={x} cy={y + 62} r="28" fill="#93a878"/><circle cx={x - 14} cy={y + 50} r="16" fill="#a2b685"/>{[-12, 6, 15].map(dx => <circle key={dx} cx={x + dx} cy={y + 66 + dx / 3} r="4" fill="#d9c068"/>)}</g>)}
      <path d={`m498 ${y + 126} 10-62m14 62-10-62m-11 16h17m-19 16h20m-22 16h24`} fill="none" stroke="#a7865f" strokeWidth="3"/>
      <rect x="590" y={y + 104} width="34" height="22" fill="#b79b70"/><path d={`M590 ${y + 115}h34`} stroke="#977e58" strokeWidth="2"/>
    </>}
  </g>;
  if (templateId === 'lantern-tower') return <g>
    {floor === 0 && <>
      <circle cx="400" cy={y + 92} r="22" fill="#b49a73"/><path d={`M400 ${y + 102}v24m-12 0h24`} stroke="#977e5c" strokeWidth="5"/>
      <rect x="392" y={y + 79} width="15" height="11" rx="2" fill="#efe1be"/>
      {[352, 448].map(x => <path key={x} d={`M${x - 9} ${y + 104}h18m-15 0v22m12-22v22`} stroke="#9a7f5a" strokeWidth="4"/>)}
      <rect x="460" y={y + 50} width="54" height="6" fill="#9a8a6c"/>
      {[0, 1, 2].map(i => <path key={i} d={`M${468 + i * 15} ${y + 50}v-13h9v13`} fill="#8d9a8e" stroke="#6f7f75" strokeWidth="1.5"/>)}
    </>}
    {floor === 1 && <>
      <path d={`M326 ${y + 126}h36v-16h-24v-16h24v-16h-24v-16h24v-16h-24`} fill="none" stroke="#a48b68" strokeWidth="5" strokeLinejoin="round"/>
      <rect x="430" y={y + 40} width="60" height="84" fill="#a58c6a"/>
      {[0, 1, 2].map(row => <g key={row}><path d={`M432 ${y + 66 + row * 26}h56`} stroke="#d8c49d" strokeWidth="3"/>{[0, 1, 2, 3, 4].map(i => <rect key={i} x={436 + i * 10} y={y + 47 + row * 26} width="6" height="18" rx="1" fill={['#d0b083', '#82917b', '#bd8772', '#e4d5b5', '#969998'][(i + row) % 5]}/>)}</g>)}
    </>}
    {floor === 2 && <>
      <path d={`M396 ${y + 126}h50l-8-30h-34Z`} fill="#8f9585"/>
      <rect x="398" y={y + 40} width="46" height="56" rx="8" fill="#f4e6b4" stroke="#b8a46a" strokeWidth="4"/>
      <path d={`M406 ${y + 52}h30m-30 12h30m-30 12h30`} stroke="#d8c27c" strokeWidth="2"/>
      <path d={`M396 ${y + 36}h50l-25-16Z`} fill="#8a9381"/>
    </>}
  </g>;
  return null;
}
// Unreachable parts of a narrow floor: open air over the courtyard, or tower stone.
// A low passage on the elevator side keeps the route to the lift visible.
function LayoutMask({ templateId, span, y, sky }: { templateId: string; span?: readonly [number, number]; y: number; sky: string }) {
  if (!span) return null;
  const open = templateId === 'courtyard-house';
  const left = 135 + span[0] * 5.85 - 22, right = 135 + span[1] * 5.85 + 22;
  const fill = open ? `url(#${sky})` : '#b6ae96';
  const parts: { x: number; w: number; h: number }[] = [];
  if (left > 113) parts.push({ x: 113, w: left - 113, h: 128 });
  if (right < 704) parts.push({ x: right, w: 704 - right, h: open ? 128 : 62 });
  return <g data-layout-mask>{parts.map(({ x, w, h }) => <g key={x}>
    <rect x={x} y={y} width={w} height={h} fill={fill}/>
    {open ? <><path d={`M${x} ${y + 96}h${w}`} stroke="#9c9a83" strokeWidth="3"/>{Array.from({ length: Math.floor(w / 16) + 1 }, (_, i) => <path key={i} d={`M${x + 4 + i * 16} ${y + 96}v32`} stroke="#a8a690" strokeWidth="2"/>)}</>
      : <>{Array.from({ length: Math.ceil(h / 16) }, (_, row) => <path key={row} d={`M${x} ${y + 16 + row * 16}h${w}`} stroke="#a29a82" strokeWidth="1.5"/>)}<path d={`M${x} ${y}v${h}M${x + w} ${y}v${h}`} stroke="#9a927a" strokeWidth="4"/></>}
  </g>)}</g>;
}
export function Person({ character, small = false }: { character: Pick<Character, 'color' | 'name' | 'id' | 'appearance'>; small?: boolean }) {
  const look = residentAppearance(character);
  return <g transform={small ? 'scale(.8)' : undefined}>
    <ellipse cy="1" rx="16" ry="4" fill="#514d3d" opacity=".1"/>
    {/* Keep the original trousers visible over dark walls without recoloring them. */}
    <path d="M-7-11-8 0M7-11 8 0" fill="none" stroke="var(--resident-leg-outline, none)" strokeWidth="7" strokeLinecap="round"/>
    <path d="M-7-11-8 0M7-11 8 0" stroke="#555b50" strokeWidth="5" strokeLinecap="round"/>
    <path d="M-13-13q0-25 13-25t13 25Z" fill={character.color}/>
    <path d="M-13-28-18-15M13-28 18-17" stroke={character.color} strokeWidth="6" strokeLinecap="round"/>
    <circle cy="-43" r="12" fill={SKIN_TONES[look.skinTone]}/>
    <path d={HAIR_STYLES[look.hairStyle]} fill={HAIR_COLORS[look.hairColor]}/>
    <circle cx="-4" cy="-42" r="1.2" fill={eyeColor(look.skinTone)}/><circle cx="4" cy="-42" r="1.2" fill={eyeColor(look.skinTone)}/>
    <path d="M-2-37q2 2 4 0" fill="none" stroke="#986f54" strokeWidth="1"/>
  </g>;
}
export default function Building({ world, selected, onSelect, onOpenConversation, miniature = false }: { world: WorldState; selected?: string; onSelect?: (id: string) => void; miniature?: boolean; onOpenConversation?: (id: number) => void }) {
  const people = world.characters.filter(c => !c.away);
  const motion = useBuildingMotion(world, miniature);
  const positions = people.map(c => {
    const position = motion.position(c.id);
    return { id: c.id, x: position?.x ?? (c.inElevator ? 757 : 135 + c.x * 5.85),
      y: 236 + (2 - (position?.floor ?? c.floor)) * 143, aboard: position?.aboard ?? !!c.inElevator };
  });
  const stacks = residentStacks(positions);
  const template = TEMPLATES[world.templateId];
  const svgId = useId();
  const skyId = `${svgId}-sky`; const wallId = `${svgId}-wall`;
  const harbor = template.id === 'harbor-house';
  // Newer templates draw all their own furniture instead of the shared common-house pieces.
  const bespoke = template.floors.some(f => f.span);
  const night = world.minute % 1440 >= 1200 || world.minute % 1440 < 360;
  // The live frame trims only scenery margins; keep the sun, outside plants,
  // resident speech, elevator and bottom caption inside it. Previews keep their original frame.
  return <svg className={`building ${miniature ? 'miniature' : ''}`} viewBox={onSelect ? '32 24 856 594' : '0 0 920 630'} role={onSelect ? 'group' : 'img'} aria-label={miniature ? (world.slug === 'example' ? `${template.name} template illustration` : `${world.name}, with ${people.length} resident${people.length === 1 ? '' : 's'} at home`) : `${world.name}, ${template.name}, with ${people.length} residents`}>
    <defs>
      <linearGradient id={skyId} x2="0" y2="1"><stop stopColor={night ? 'var(--sky-night, #bfc9c8)' : harbor ? 'var(--sky-harbor, #d5e5e9)' : template.id === 'makers-house' ? 'var(--sky-makers, #eee2da)' : 'var(--sky-day, #e7ecdf)'}/><stop offset="1" stopColor="var(--sky-horizon, #f0eee2)"/></linearGradient>
      <pattern id={wallId} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#8e9078" opacity=".12"/></pattern>
    </defs>
    <rect width="920" height="630" rx="16" fill={`url(#${skyId})`}/>
    <circle cx="778" cy="68" r="33" fill={night ? '#f3ecd3' : '#f1d48f'} opacity=".85"/>
    <path d="M77 97q26-18 45 0M105 78q15-12 29 0" fill="none" stroke="#9da991" strokeWidth="2" strokeLinecap="round"/>
    <g opacity=".36" fill="#c4cfb8"><path d="M0 500V332l44-25 43 25v168M842 500V355l41-35 37 35v145"/><path d="M25 390h38v11H25m0 22h38v11H25m839-14h38v11h-38" fill="#aebda4"/></g>
    {harbor && <g fill="none" stroke="#93b4bd" strokeWidth="3" opacity=".6"><path d="M0 518q25-9 50 0t50 0M822 518q25-9 50 0t50 0M0 536q25-9 50 0t50 0M822 536q25-9 50 0t50 0"/><path d="M35 300v-68l31 51H35" fill="#f4ead1" strokeWidth="2"/></g>}
    <ellipse cx="464" cy="579" rx="350" ry="19" fill="#a7b69b" opacity=".21"/>
    <rect className="building-shell" x="97" y="100" width="726" height="457" rx="7" fill="#a9ad95"/>
    <rect x="105" y="108" width="710" height="443" fill="var(--house-frame, #f2e7cf)"/>
    {[2, 1, 0].map(floor => {
      const y = 112 + (2 - floor) * 143;
      return <g key={floor}>
        <rect x="113" y={y} width="591" height="132" className="building-room" style={{ '--room-color': template.floors[floor].color } as CSSProperties} fill={template.floors[floor].color}/>
        <rect x="113" y={y} width="591" height="132" fill={`url(#${wallId})`}/>
        <path d={`M113 ${y + 128}h591v8H113Z`} fill="#c6b399"/>
        <path d={`M113 ${y + 130}h591`} stroke="#af9f87"/>
        {[157, 350, 560].map(x => <g key={x}><path d={`M${x} ${y + 89}v-47a27 27 0 0 1 54 0v47Z`} fill={night ? 'var(--window-night, #adbab7)' : 'var(--window-day, #eef0dc)'} stroke="#b7b394" strokeWidth="5"/><path d={`M${x + 27} ${y + 16}v73m-27-38h54`} stroke="#c2bda2" strokeWidth="3"/></g>)}
        {floor === 2 && template.id === 'common-house' && <g><Plant x={250} y={y + 107} size={1.1}/><Plant x={651} y={y + 104} size={1.2}/><rect x="320" y={y + 92} width="110" height="16" rx="3" fill="#9a9b72"/><path d={`M330 ${y + 108}v21m90-21v21`} stroke="#838467" strokeWidth="5"/><Plant x={339} y={y + 73} size={.65}/><Plant x={378} y={y + 73} size={.65}/><Plant x={413} y={y + 73} size={.5}/><path d={`M477 ${y + 124}v-27q20-12 38 0v27m-36-14h34`} fill="#c4ad83" stroke="#a78f6b" strokeWidth="3"/></g>}
        {floor === 1 && !bespoke && <g><rect x="262" y={y + 44} width="51" height="78" fill="#aa906d"/><path d={`M264 ${y + 71}h47m-47 26h47`} stroke="#dbc69f" strokeWidth="3"/>{[0,1,2,3,4].map(i => <rect key={i} x={269+i*8} y={y+51} width="5" height="18" rx="1" fill={['#d0b083','#82917b','#bd8772','#e4d5b5','#969998'][i]}/>)}<rect x="449" y={y + 93} width="88" height="29" rx="6" fill="#99a089"/><rect x="449" y={y + 84} width="88" height="26" rx="7" fill="#aab198"/><path d={`M452 ${y + 100}v17m82-17v17`} stroke="#7d8c71" strokeWidth="8" strokeLinecap="round"/><path d={`M600 ${y + 124}v-69m-17 3h34l-9-17h-16Z`} fill="#e8d7a7" stroke="#a89570" strokeWidth="2"/><Plant x={165} y={y + 109} size={.8}/><rect x="369" y={y + 35} width="34" height="25" fill="#e8debd" stroke="#ad9271" strokeWidth="3"/><circle cx="386" cy={y + 46} r="6" fill="#b4bb98"/></g>}
        {floor === 0 && template.id !== 'makers-house' && !bespoke && <g><rect x="135" y={y + 85} width="94" height="40" fill="#b4ae8c"/><rect x="132" y={y + 81} width="100" height="7" rx="2" fill="#8e8b70"/><path d={`M180 ${y + 89}v34m-39-23h29m20 0h29`} stroke="#8d9075"/><rect x="147" y={y + 67} width="18" height="15" rx="3" fill="#d4c5a1"/><path d={`M165 ${y + 70}q13 1 0 8`} fill="none" stroke="#d4c5a1" strokeWidth="3"/><ellipse cx="397" cy={y + 125} rx="95" ry="8" fill="#b9a078" opacity=".3"/><path d={`M336 ${y + 96}h117m-105 0v30m94-30v30`} stroke="#9a7f5a" strokeWidth="6" strokeLinecap="round"/><rect x="335" y={y + 91} width="120" height="8" rx="3" fill="#b49a73"/><rect x="370" y={y + 81} width="12" height="10" rx="2" fill="#efe1be"/><rect x="414" y={y + 81} width="12" height="10" rx="2" fill="#c8d0ac"/><path d={`M312 ${y + 126}v-32m-1 22h21m144 10v-32m-19 22h20`} stroke="#a49370" strokeWidth="4"/><Plant x={652} y={y + 103} size={1.2}/></g>}
        <TemplateFurniture templateId={template.id} floor={floor} y={y}/>
        <LayoutMask templateId={template.id} span={template.floors[floor].span} y={y} sky={skyId}/>
        <text x="128" y={y + 18} fontSize="8" letterSpacing="1.4" fill="var(--scene-label, #7f7e67)">0{floor + 1}</text>
      </g>;
    })}
    <rect x="707" y="112" width="101" height="418" fill="#b9b9a2"/>
    <path d="M722 114v416m71-416v416" stroke="#9d9f8b" strokeWidth="2"/>
    <g data-elevator-cabin style={{ transform: `translateY(${(2-motion.elevatorFloor)*143}px)` }}><rect x="724" y="123" width="67" height="115" rx="3" fill="#dfdbc4" stroke="#9c9d87" strokeWidth="3"/><rect x="731" y="135" width="53" height="97" fill="#c8ccba"/><path d="M757 135v97" stroke="#9aab98" strokeWidth="2"/><rect x="747" y="126" width="21" height="6" rx="2" fill="#899780"/></g>
    {[0,1,2].map(i => <g key={i}><path d={`M710 ${245+i*143}h97`} stroke="#a6a893" strokeWidth="5"/><circle cx="714" cy={206+i*143} r="3" fill="#efe3b9"/></g>)}
    <rect x="88" y="94" width="744" height="15" rx="3" fill="#7b8872"/><rect x="85" y="551" width="750" height="12" rx="3" fill="#9eaa8c"/>
    <path d="M317 92v-9h263v9" fill="#aab299"/><rect x="356" y="69" width="185" height="24" rx="3" fill="#e9e8d8"/>
    <text x="448" y="85" textAnchor="middle" fontSize="9" fill="#52604b" letterSpacing={template.id === 'common-house' ? 3 : 1}>{template.id === 'common-house' ? 'A LITTLE LIFE TOGETHER' : template.name.toUpperCase()}</text>
    {people.map((c, index) => {
      const { x, y, aboard } = positions[index];
      const stacked = stacks.get(c.id) ?? 0;
      const stackLabel = stacked ? `, ${stacked} additional resident${stacked === 1 ? '' : 's'} at the same position` : '';
      return <g key={c.id} data-resident-id={c.id} data-aboard={aboard} className={`resident-sprite ${selected === c.id ? 'selected' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${c.name}, ${c.activity}${stackLabel}`} onClick={() => onSelect?.(c.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(c.id); } }}>
        {selected === c.id && <ellipse cy="0" rx="23" ry="8" fill="none" stroke="var(--scene-selection, #566f4d)" strokeWidth="2" strokeDasharray="3 3"/>}
        <Person character={c}/>
        {!miniature && <g className="resident-name-tag" style={{ '--name-tag-shift': `${Math.min(0, 710 - x)}px` } as CSSProperties}><rect x="-25" y="8" width="50" height="15" rx="7" fill="var(--scene-bubble, #f6f4e8)" fillOpacity=".9"/><text y="19" textAnchor="middle" fontSize="9" fill="var(--scene-text, #555e4c)">{c.name.slice(0, 10)}</text>{stacked > 0 && <g data-stack-count={stacked} aria-label={`${stacked} additional resident${stacked === 1 ? '' : 's'} at the same position`}>
          <title>{`${c.name} and ${stacked} additional resident${stacked === 1 ? '' : 's'} at the same position`}</title>
          <rect x="27" y="8" width={stacked < 10 ? 22 : 28} height="15" rx="7" fill="var(--scene-bubble, #f6f4e8)"/>
          <text x={stacked < 10 ? 38 : 41} y="19" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--scene-text, #555e4c)">+{stacked}</text>
        </g>}</g>}
      </g>;
    })}
    {!miniature && people.map(c => {
      const position = motion.position(c.id);
      return <ResidentSpeech key={c.id} character={c} world={world}
        visible={selected === c.id || people.filter(p => p.speech).at(-1)?.id === c.id}
        onOpenConversation={onOpenConversation}
        x={position?.x ?? (c.inElevator ? 757 : 135 + c.x * 5.85)}
        y={236 + (2 - (position?.floor ?? c.floor)) * 143}/>;
    })}
    <Plant x={72} y={546} size={1.3}/><Plant x={851} y={548} size={1.1}/>
    <path d="M57 577h807" stroke="#bec5ad" strokeWidth="2" strokeLinecap="round"/>
    <text x="460" y="608" textAnchor="middle" fontSize="10" fill="var(--scene-caption, #829076)" letterSpacing="1">{miniature ? 'THREE FLOORS. ROOM TO BECOME.' : 'EVERY LITTLE LIFE HAS A STORY. CLICK SOMEONE TO MEET THEM.'}</text>
  </svg>;
}
