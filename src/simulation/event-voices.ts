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
  'new-project': {
    practical: 'Possibility, if we can make clear what we are deciding. An argument about everything at once is hard to use.',
    reserved: 'Both. I’d want time to find my view before the loudest ideas become the whole conversation.',
    curious: 'Possibility. Different opinions can reveal questions the first plan missed.',
    spirited: 'Possibility, though I’m impatient to try things. I know that impatience can crowd out a careful objection.',
    kind: 'Both. I care about how we disagree as well as what we decide to grow.',
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
