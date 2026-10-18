import type { Trait } from './types';

// Answer the actual event question through a personal preference, not an
// invented action, a fixed stereotype, or knowledge of another resident's mind.
export const EVENT_REPLIES: Record<string, Record<Trait, string>> = {
  'shared-meal': {
    practical: 'Having something ordinary to do helps me relax. I don’t have to produce conversation out of nothing.',
    reserved: 'Being allowed to listen while I eat. An empty silence can feel comfortable if nobody rushes to fill it.',
    curious: 'Finding out what someone enjoys, without expecting a whole life story over one meal.',
    spirited: 'Room for a lively exchange, and for people to step out of it. I don’t want enthusiasm to feel compulsory.',
    kind: 'Knowing that someone who says little still has a place. I don’t measure comfort by how much a person talks.',
  },
  'care-package': {
    practical: 'I appreciate useful things. Accepting them is harder if I can’t tell whether anything is expected in return.',
    reserved: 'I like the kindness, but I can feel exposed when attention turns to how grateful I ought to look.',
    curious: 'I wonder what made someone choose those things. Not knowing can be touching as well as puzzling.',
    spirited: 'I enjoy the surprise. I’m less comfortable if gratitude starts to feel like an obligation.',
    kind: 'Giving feels easier to me than receiving. I can forget that kindness need not be something I earn.',
  },
  'story-night': {
    practical: 'I listen for what matters to the teller, rather than trying to extract a lesson from every story.',
    reserved: 'I like having a choice about which parts stay private. A story doesn’t have to explain all of me.',
    curious: 'The parts left untold interest me, but curiosity doesn’t give me a right to ask for them.',
    spirited: 'I like a story that surprises me. I wouldn’t want someone to polish away everything awkward.',
    kind: 'I want to listen without making the teller feel responsible for comforting the room.',
  },
  'community-gathering': {
    practical: 'A question everyone can answer beats a long agenda. I’d start with one thing we could improve together.',
    reserved: 'A small conversation at the edge of the room. I have more to say when I’m not competing to be heard.',
    curious: 'The idea I didn’t expect. I want to ask someone what they see here that I keep missing.',
    spirited: 'A lively argument about something small, followed by a laugh. Agreement isn’t the only way to connect.',
    kind: 'An invitation that reaches the person hovering near the door. I’d like to be brave enough to make it.',
  },
  'vulnerable-share': {
    practical: 'I’d like to admit when I don’t have an answer. Being useful all the time is a tiring ambition.',
    reserved: 'One honest sentence would count for me. I don’t need to tell my whole story to mean it.',
    curious: 'I’d ask what someone wishes people understood, and let them choose how much to say.',
    spirited: 'I’d admit that confidence can be a bit of a costume. That is harder than making a joke.',
    kind: 'I’d like to say when I need help instead of waiting for somebody to notice.',
  },
  'group-meditation': {
    practical: 'A short pause suits me. I don’t need a perfectly clear mind for a breath to be worthwhile.',
    reserved: 'Quiet company appeals to me. We can share a moment without having to explain it.',
    curious: 'I notice how quickly a thought turns into another question. I’d like to watch that without chasing it.',
    spirited: 'Sitting still is a challenge I can laugh about. I’d try a few breaths, rather than aim for perfection.',
    kind: 'I like a pause where nobody needs me to fix anything. I’d like to let myself have that.',
  },
  'quiet-day': {
    practical: 'I keep noticing small jobs. Leaving one undone for a day is a stranger kind of rest than sleep.',
    reserved: 'Easy. Nobody needing an answer from me is the most restful thing this house can offer.',
    curious: 'I rest by noticing things. I just don’t have to turn them into conversation straight away.',
    spirited: 'Harder than I expected. I like company, and a quiet day can feel like being left out of something.',
    kind: 'I struggle to stop checking on people. I’m learning that their rest doesn’t depend on me.',
  },
  'new-project': {
    practical: 'Possibility, if we can make clear what we are deciding. An argument about everything at once is hard to use.',
    reserved: 'Both. I’d want time to find my view before the loudest ideas become the whole conversation.',
    curious: 'Possibility. Different opinions can reveal questions the first plan missed.',
    spirited: 'Possibility, though I’m impatient to try things. I know that impatience can crowd out a careful objection.',
    kind: 'Both. I care about how we disagree as well as what we decide to grow.',
  },
  'chore-partners': {
    practical: 'Shared work gives me something to say. I’d rather learn about someone through a job than through small talk.',
    reserved: 'I liked having a reason to be beside someone. The work filled the silence so I didn’t have to.',
    curious: 'You learn how a person thinks from the way they fold a towel. I didn’t expect that.',
    spirited: 'Fun, once we stopped being polite about it. A little teasing made the chore go faster.',
    kind: 'I worried about giving my partner the worse half. I’d like to trust that we can just split it fairly.',
  },
  'clearing-air': {
    practical: 'Uncomfortable, but useful. A disagreement with a name is easier to work on than a mood in the hallway.',
    reserved: 'Hard. I need time after saying something like that before I can talk about it again.',
    curious: 'I learned how many disagreements started from a misunderstanding. That doesn’t make them less real.',
    spirited: 'I said more than I meant to. I’d still rather say it than let it simmer.',
    kind: 'I wanted everyone to feel safe, and it couldn’t be comfortable for everyone. I’m learning that’s all right.',
  },
  'power-outage': {
    practical: 'Not knowing what information is reliable. A small clear fact helps me more than confident guessing.',
    reserved: 'The pressure to react immediately. I need a moment to work out what I’m feeling.',
    curious: 'Not being able to separate what we know from what we suspect. Uncertainty makes every explanation tempting.',
    spirited: 'Feeling stalled. I want something to do, though acting just to escape the feeling may not help.',
    kind: 'Wondering whether everyone has enough support, while knowing I can’t answer that for them.',
  },
  rumor: {
    practical: 'Separate what we actually know from what we heard. Repeating a guess doesn’t make it evidence.',
    reserved: 'I’d rather leave a gap than turn someone’s private life into a question everyone expects them to answer.',
    curious: 'I can be curious without filling in the missing pieces. A question is not permission to invent an answer.',
    spirited: 'It is tempting to challenge it loudly, but that could spread the very story I’m questioning.',
    kind: 'I’d think about how it might feel to be the person discussed. Concern isn’t a reason to speak for them.',
  },
};
