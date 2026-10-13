import type { Character, WorldState } from '../simulation/types';
import { TEMPLATES } from '../simulation/catalog';
import { useBuildingMotion } from './useBuildingMotion';

function Plant({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path d="M-10 0h20l-3 21H-7Z" fill="#bd8970"/><path d="M0 2v-38M0-13q-25-4-19-22Q0-34 0-13M0-23q23-4 18-24Q0-43 0-23" fill="#79936b" stroke="#637f59" strokeWidth="2"/></g>;
}
export function Person({ character, small = false }: { character: Pick<Character, 'color' | 'name' | 'id'>; small?: boolean }) {
  const variant = Number(character.id.replace(/\D/g, '')) % 3;
  return <g transform={small ? 'scale(.8)' : undefined}>
    <ellipse cy="1" rx="16" ry="4" fill="#514d3d" opacity=".1"/>
    <path d="M-7-11-8 0M7-11 8 0" stroke="#555b50" strokeWidth="5" strokeLinecap="round"/>
    <path d="M-13-13q0-25 13-25t13 25Z" fill={character.color}/>
    <path d="M-13-28-18-15M13-28 18-17" stroke={character.color} strokeWidth="6" strokeLinecap="round"/>
    <circle cy="-43" r="12" fill={variant === 1 ? '#be896b' : '#edc8a2'}/>
    <path d={variant === 0 ? 'M-12-44q-5-17 12-15t12 17l-6-9q-8 6-18 7' : variant === 1 ? 'M-12-45q-4-14 12-14t12 15q-5-7-12-7t-12 6' : 'M-13-44q-2-14 12-15t14 15l-7-7-5 7-5-7-9 7'} fill={variant === 2 ? '#917253' : '#534f41'}/>
    <circle cx="-4" cy="-42" r="1.2" fill="#514538"/><circle cx="4" cy="-42" r="1.2" fill="#514538"/>
    <path d="M-2-37q2 2 4 0" fill="none" stroke="#986f54" strokeWidth="1"/>
  </g>;
}
export default function Building({ world, selected, onSelect, miniature = false }: { world: WorldState; selected?: string; onSelect?: (id: string) => void; miniature?: boolean }) {
  const people = world.characters.filter(c => !c.away);
  const motion = useBuildingMotion(world, miniature);
  const template = TEMPLATES[world.templateId];
  const night = world.minute % 1440 >= 1200 || world.minute % 1440 < 360;
  return <svg className={`building ${miniature ? 'miniature' : ''}`} viewBox="0 0 920 630" role={onSelect ? 'group' : 'img'} aria-label={miniature ? `${template.name} template illustration` : `${world.name}, a three-floor house with ${people.length} residents`}>
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stopColor={night ? '#bfc9c8' : '#e7ecdf'}/><stop offset="1" stopColor="#f0eee2"/></linearGradient>
      <pattern id="wall" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#8e9078" opacity=".12"/></pattern>
    </defs>
    <rect width="920" height="630" rx="16" fill="url(#sky)"/>
    <circle cx="778" cy="68" r="33" fill={night ? '#f3ecd3' : '#f1d48f'} opacity=".85"/>
    <path d="M77 97q26-18 45 0M105 78q15-12 29 0" fill="none" stroke="#9da991" strokeWidth="2" strokeLinecap="round"/>
    <g opacity=".36" fill="#c4cfb8"><path d="M0 500V332l44-25 43 25v168M842 500V355l41-35 37 35v145"/><path d="M25 390h38v11H25m0 22h38v11H25m839-14h38v11h-38" fill="#aebda4"/></g>
    <ellipse cx="464" cy="579" rx="350" ry="19" fill="#a7b69b" opacity=".21"/>
    <rect x="97" y="100" width="726" height="457" rx="7" fill="#a9ad95"/>
    <rect x="105" y="108" width="710" height="443" fill="#f2e7cf"/>
    {[2, 1, 0].map(floor => {
      const y = 112 + (2 - floor) * 143;
      return <g key={floor}>
        <rect x="113" y={y} width="591" height="132" fill={template.floors[floor].color}/>
        <rect x="113" y={y} width="591" height="132" fill="url(#wall)"/>
        <path d={`M113 ${y + 128}h591v8H113Z`} fill="#c6b399"/>
        <path d={`M113 ${y + 130}h591`} stroke="#af9f87"/>
        {[157, 350, 560].map(x => <g key={x}><path d={`M${x} ${y + 89}v-47a27 27 0 0 1 54 0v47Z`} fill={night ? '#adbab7' : '#eef0dc'} stroke="#b7b394" strokeWidth="5"/><path d={`M${x + 27} ${y + 16}v73m-27-38h54`} stroke="#c2bda2" strokeWidth="3"/></g>)}
        <text x="128" y={y + 18} fontSize="8" letterSpacing="1.4" fill="#7f7e67">0{floor + 1}</text>
        {floor === 2 && <g><Plant x={250} y={y + 107} size={1.1}/><Plant x={651} y={y + 104} size={1.2}/><rect x="320" y={y + 92} width="110" height="16" rx="3" fill="#9a9b72"/><path d={`M330 ${y + 108}v21m90-21v21`} stroke="#838467" strokeWidth="5"/><Plant x={339} y={y + 73} size={.65}/><Plant x={378} y={y + 73} size={.65}/><Plant x={413} y={y + 73} size={.5}/><path d={`M477 ${y + 124}v-27q20-12 38 0v27m-36-14h34`} fill="#c4ad83" stroke="#a78f6b" strokeWidth="3"/></g>}
        {floor === 1 && <g><rect x="262" y={y + 44} width="51" height="78" fill="#aa906d"/><path d={`M264 ${y + 71}h47m-47 26h47`} stroke="#dbc69f" strokeWidth="3"/>{[0,1,2,3,4].map(i => <rect key={i} x={269+i*8} y={y+51} width="5" height="18" rx="1" fill={['#d0b083','#82917b','#bd8772','#e4d5b5','#969998'][i]}/>)}<rect x="449" y={y + 93} width="88" height="29" rx="6" fill="#99a089"/><rect x="449" y={y + 84} width="88" height="26" rx="7" fill="#aab198"/><path d={`M452 ${y + 100}v17m82-17v17`} stroke="#7d8c71" strokeWidth="8" strokeLinecap="round"/><path d={`M600 ${y + 124}v-69m-17 3h34l-9-17h-16Z`} fill="#e8d7a7" stroke="#a89570" strokeWidth="2"/><Plant x={165} y={y + 109} size={.8}/><rect x="369" y={y + 35} width="34" height="25" fill="#e8debd" stroke="#ad9271" strokeWidth="3"/><circle cx="386" cy={y + 46} r="6" fill="#b4bb98"/></g>}
        {floor === 0 && <g><rect x="135" y={y + 85} width="94" height="40" fill="#b4ae8c"/><rect x="132" y={y + 81} width="100" height="7" rx="2" fill="#8e8b70"/><path d={`M180 ${y + 89}v34m-39-23h29m20 0h29`} stroke="#8d9075"/><rect x="147" y={y + 67} width="18" height="15" rx="3" fill="#d4c5a1"/><path d={`M165 ${y + 70}q13 1 0 8`} fill="none" stroke="#d4c5a1" strokeWidth="3"/><ellipse cx="397" cy={y + 125} rx="95" ry="8" fill="#b9a078" opacity=".3"/><path d={`M336 ${y + 96}h117m-105 0v30m94-30v30`} stroke="#9a7f5a" strokeWidth="6" strokeLinecap="round"/><rect x="335" y={y + 91} width="120" height="8" rx="3" fill="#b49a73"/><rect x="370" y={y + 81} width="12" height="10" rx="2" fill="#efe1be"/><rect x="414" y={y + 81} width="12" height="10" rx="2" fill="#c8d0ac"/><path d={`M312 ${y + 126}v-32m-1 22h21m144 10v-32m-19 22h20`} stroke="#a49370" strokeWidth="4"/><Plant x={652} y={y + 103} size={1.2}/></g>}
      </g>;
    })}
    <rect x="707" y="112" width="101" height="418" fill="#b9b9a2"/>
    <path d="M722 114v416m71-416v416" stroke="#9d9f8b" strokeWidth="2"/>
    <g data-elevator-cabin style={{ transform: `translateY(${(2-motion.elevatorFloor)*143}px)` }}><rect x="724" y="123" width="67" height="115" rx="3" fill="#dfdbc4" stroke="#9c9d87" strokeWidth="3"/><rect x="731" y="135" width="53" height="97" fill="#c8ccba"/><path d="M757 135v97" stroke="#9aab98" strokeWidth="2"/><rect x="747" y="126" width="21" height="6" rx="2" fill="#899780"/></g>
    {[0,1,2].map(i => <g key={i}><path d={`M710 ${245+i*143}h97`} stroke="#a6a893" strokeWidth="5"/><circle cx="714" cy={206+i*143} r="3" fill="#efe3b9"/></g>)}
    <rect x="88" y="94" width="744" height="15" rx="3" fill="#7b8872"/><rect x="85" y="551" width="750" height="12" rx="3" fill="#9eaa8c"/>
    <path d="M317 92v-9h263v9" fill="#aab299"/><rect x="356" y="69" width="185" height="24" rx="3" fill="#e9e8d8"/>
    <text x="448" y="85" textAnchor="middle" fontSize="9" fill="#73806b" letterSpacing="3">A LITTLE LIFE TOGETHER</text>
    {people.map(c => {
      const position = motion.position(c.id);
      const x = position?.x ?? (c.inElevator ? 757 : 135 + c.x * 5.85);
      const y = 236 + (2-(position?.floor ?? c.floor))*143;
      const hasSpeech = !miniature && c.speech && (selected === c.id || people.filter(p => p.speech).at(-1)?.id === c.id);
      return <g key={c.id} data-resident-id={c.id} data-aboard={position?.aboard ?? !!c.inElevator} className={`resident-sprite ${selected === c.id ? 'selected' : ''}`} style={{ transform: `translate(${x}px, ${y}px)` }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${c.name}, ${c.activity}`} onClick={() => onSelect?.(c.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(c.id); } }}>
        {selected === c.id && <ellipse cy="0" rx="23" ry="8" fill="none" stroke="#566f4d" strokeWidth="2" strokeDasharray="3 3"/>}
        <Person character={c}/>
        {!miniature && <><rect x="-25" y="8" width="50" height="15" rx="7" fill="#f6f4e8" fillOpacity=".9"/><text y="19" textAnchor="middle" fontSize="9" fill="#555e4c">{c.name.slice(0, 10)}</text></>}
        {hasSpeech && <g className="speech"><rect x="-78" y="-89" width="156" height="24" rx="8" fill="#fffdf4" stroke="#dddcca"/><path d="m-4-65 5 6 5-6" fill="#fffdf4"/><text textAnchor="middle" y="-74" fontSize="9" fill="#58624d">{c.speech!.length > 31 ? `${c.speech!.slice(0, 29)}…` : c.speech}</text></g>}
      </g>;
    })}
    <Plant x={72} y={546} size={1.3}/><Plant x={851} y={548} size={1.1}/>
    <path d="M57 577h807" stroke="#bec5ad" strokeWidth="2" strokeLinecap="round"/>
    <text x="460" y="608" textAnchor="middle" fontSize="10" fill="#829076" letterSpacing="1">{miniature ? 'THREE FLOORS. ROOM TO BECOME.' : 'EVERY LITTLE LIFE HAS A STORY. CLICK SOMEONE TO MEET THEM.'}</text>
  </svg>;
}
