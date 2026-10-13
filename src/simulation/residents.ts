import type { Character } from './types';

// Fictional background, not simulated memories or additional behavior rules.
export type ResidentProfile = Pick<Character, 'name' | 'trait' | 'backstory'>;
export const RESIDENT_ROSTERS = {
  'common-house': [
    { name: 'Milo', trait: 'kind', backstory: 'Milo once ran a tiny neighborhood bakery. They brought a bread tin and are learning to accept help as readily as they offer it.' },
    { name: 'Juniper', trait: 'curious', backstory: 'Juniper kept a notebook of plants growing through pavement. They came looking for a garden and people who might enjoy their questions.' },
    { name: 'Cleo', trait: 'reserved', backstory: 'Cleo restored old photographs in a quiet shop. They brought a box of blank albums, hoping this move might give them something new to keep.' },
    { name: 'Otis', trait: 'spirited', backstory: 'Otis used to paint scenery for a traveling theater. After years of packing up, they want to stay long enough to see a room change with the seasons.' },
    { name: 'Fern', trait: 'practical', backstory: 'Fern repaired bicycles behind a corner store. Their toolbox is neatly packed; their plans for this next chapter are less certain.' },
    { name: 'Remy', trait: 'kind', backstory: 'Remy spent years cooking for a busy family. They brought a book of soup recipes and hope to discover what they like when someone else chooses dinner.' },
    { name: 'Ada', trait: 'curious', backstory: 'Ada used to sort letters at a small post office. They collect unfamiliar words and came here with a dictionary full of penciled questions.' },
    { name: 'Sol', trait: 'reserved', backstory: 'Sol tended an orchard far from town. They miss the early light between the trees, but hope a shared home can be quiet without feeling lonely.' },
    { name: 'Leena', trait: 'practical', backstory: 'Leena mended coats at a market stall. They brought a tin of mismatched buttons and would like a place where unfinished things can wait until tomorrow.' },
    { name: 'Basil', trait: 'spirited', backstory: 'Basil hosted a late-night radio show with more enthusiasm than listeners. They arrived with a crate of records and a wish to hear other people’s stories.' },
    { name: 'Noor', trait: 'kind', backstory: 'Noor cared for a community reading room. They packed their favorite kettle, but left room in their suitcase for interests that have nothing to do with being useful.' },
    { name: 'Tamsin', trait: 'curious', backstory: 'Tamsin drew walking maps that always included a good bench. They are new to sharing a kitchen and wonder which small routes will become familiar here.' },
  ],
  'makers-house': [
    { name: 'Pip', trait: 'spirited', backstory: 'Pip built elaborate window displays for a modest little shop. They brought paper birds, a slightly bent ruler, and more ideas than finished plans.' },
    { name: 'Alma', trait: 'kind', backstory: 'Alma taught evening sewing classes. They hope a shared workshop will give them the courage to be a beginner at something again.' },
    { name: 'Theo', trait: 'reserved', backstory: 'Theo repaired clocks in a narrow upstairs room. They like patient work and came here hoping company might be as comfortable as silence.' },
    { name: 'Nia', trait: 'curious', backstory: 'Nia mixed inks for a small print studio. They saved the accidental colors and want to find out what else can begin with a mistake.' },
    { name: 'Hugo', trait: 'practical', backstory: 'Hugo built shelves for a library that never had enough of them. They arrived with careful measurements and a private wish to make something purely decorative.' },
    { name: 'Esme', trait: 'spirited', backstory: 'Esme made costumes for amateur dancers. They brought bright scraps and are trying to learn when an ambitious project needs a smaller first step.' },
    { name: 'Jules', trait: 'reserved', backstory: 'Jules bound notebooks in the back of a bookshop. They keep the first page of their own notebook blank, waiting for an ordinary day worth describing.' },
    { name: 'Ravi', trait: 'kind', backstory: 'Ravi repaired radios at a weekend repair table. They enjoyed the conversations as much as the work and hope to find both under one roof.' },
    { name: 'Suki', trait: 'curious', backstory: 'Suki made clay bowls that rarely matched. They brought a notebook of glaze experiments and would like to learn what other people see in familiar materials.' },
    { name: 'Dara', trait: 'practical', backstory: 'Dara painted signs for local shops. They are used to making other people’s words readable and came here with a few ideas of their own.' },
    { name: 'Ludo', trait: 'spirited', backstory: 'Ludo carved wooden toys at a market stand. They packed a tiny unfinished carousel and hope a settled address might help them finish it.' },
    { name: 'Anwen', trait: 'reserved', backstory: 'Anwen wove rugs in a family workshop. They brought a handful of familiar yarns and are quietly looking forward to choosing a pattern for themselves.' },
  ],
  'harbor-house': [
    { name: 'Marin', trait: 'practical', backstory: 'Marin kept supplies for a small ferry crew. They know how much can fit in one cupboard and are learning that a home need not run to a timetable.' },
    { name: 'Iona', trait: 'reserved', backstory: 'Iona watched the weather from a hilltop station. They brought years of cloud sketches and hope to share a view without always having to explain it.' },
    { name: 'Finn', trait: 'curious', backstory: 'Finn catalogued shells for a seaside museum. They still stop at every tide pool and came with a list of questions the labels never answered.' },
    { name: 'Pearl', trait: 'kind', backstory: 'Pearl ran a tea stall near the docks. They remember many regular orders and look forward to being known for something beyond a dependable cup.' },
    { name: 'Casper', trait: 'spirited', backstory: 'Casper played accordion on summer ferries. They brought a battered instrument and hope to find company during the quieter part of the year.' },
    { name: 'Rosa', trait: 'practical', backstory: 'Rosa repaired sails in a waterside shed. They saved the smallest scraps for patchwork and want a room where work can be put away at dusk.' },
    { name: 'Ari', trait: 'kind', backstory: 'Ari cooked on a research boat with a very small pantry. They brought recipes scribbled on envelopes and a fondness for meals that last longer than a crossing.' },
    { name: 'Mae', trait: 'reserved', backstory: 'Mae kept accounts for the harbor market. They packed a book of poems between the ledgers and hope this move leaves more time for it.' },
    { name: 'Della', trait: 'curious', backstory: 'Della photographed the same pier in every season. They came looking for a different view and wonder what becomes visible when you stop passing through.' },
    { name: 'Ewan', trait: 'practical', backstory: 'Ewan maintained benches along the promenade. They brought a few hand tools and would like to spend more afternoons sitting on something they did not have to fix.' },
    { name: 'Zoya', trait: 'spirited', backstory: 'Zoya organized small festivals on the quay. They arrived with faded bunting and are discovering that a quiet evening can be worth making room for too.' },
    { name: 'Tobin', trait: 'kind', backstory: 'Tobin delivered groceries along the coast. They knew everyone’s doorstep and came here hoping to be invited to stay on the other side of one.' },
  ],
} satisfies Record<string, readonly ResidentProfile[]>;
