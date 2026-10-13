import { EVENT_REPLIES } from './event-voices';
import { EVENTS, TEMPLATES } from './catalog';
import { dialogueMemory, memoryExcerpt, statefulProgression } from './dialogue-context';
import type { Character, Trait, WorldState } from './types';

type Scene = { id: string; topic: string; lines: string[]; relevance: number; eventText?: string };
const voice = (c: Character, lines: Record<Trait, string>) => lines[c.trait];
// Local deterministic tie-breaking does not consume the simulation's random stream.
function jitter(key: string) {
  let hash = 2166136261;
  for (const c of key) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) % 5;
}

/** Complete, responsive arcs: variation changes the question and its development. */
export function chooseConversationScene(world: WorldState, a: Character, b: Character, positive: boolean): Scene {
  const room = TEMPLATES[world.templateId].floors[a.floor]?.name.toLowerCase() ?? 'the shared space';
  const space = TEMPLATES[world.templateId].floors[2].name.toLowerCase();
  const history = world.history.filter(e => e.conversation && e.minute <= world.minute);
  const pair = history.filter(e => e.characters.includes(a.id) && e.characters.includes(b.id));
  const relationship = Object.values(world.relationships).find(r => [r.a, r.b].includes(a.id) && [r.a, r.b].includes(b.id));
  const close = (relationship?.trust ?? 0) > 60;
  const scenes: Scene[] = [];
  const add = (id: string, topic: string, lines: string[], relevance = 10) => scenes.push({ id, topic, lines, relevance });
  if (positive) {
    add('company', 'Company without pressure', [
      a.trait === 'reserved' ? 'I want company, but I’m not always ready to talk. Does that make sense?' : 'Would you rather be invited into the conversation or have room to listen?',
      voice(b, { reserved: 'I’d rather listen at first. Being quiet doesn’t mean I want to be left out.', practical: 'I find it easier to talk over a meal. Having something ordinary to do takes the pressure off.', spirited: 'Invite me in. I like a lively exchange, as long as nobody has to perform.', curious: 'An invitation helps. I like finding out what a quiet person is thinking, without prying.', kind: 'I like being invited, with enough room to say no without hurting anyone.' }),
      voice(a, { practical: 'What would make an invitation easy to decline without having to explain?', curious: 'What makes an invitation feel different from an expectation to you?', reserved: 'I like knowing silence is allowed. Being asked to fill it can make me withdraw.', spirited: 'I can enjoy a lively conversation without needing everyone to join in at once.', kind: 'I want the invitation to feel like a choice, not another thing someone owes us.' }),
      'Yes. Being included is different from being expected to entertain everyone.',
      close ? 'I feel able to be quiet with you. That is a kind of company I value.' : 'I’m still learning what comfortable company feels like between us.',
      'There can be room for both a conversation and a little silence.',
    ], a.trait === 'reserved' || b.belonging < 45 ? 18 : 10);
    add('curiosity', `What draws us to ${room}`, [
      a.trait === 'curious' ? `What do you notice first about ${room}? I wonder how differently we see it.` : `What makes ${room} feel like a place you would choose to spend time?`,
      voice(b, { curious: 'The details I haven’t figured out yet. Familiar places can still surprise me.', practical: 'Whether there is something useful to do. I relax more easily when I have a purpose.', reserved: 'Whether I can stay at the edge for a while. I like having time to take a place in.', spirited: 'Whether there is room to try something different. Too much sameness makes me restless.', kind: 'Whether someone new could feel welcome here. That changes how a room feels to me.' }),
      'Would that still matter if you had the whole room to yourself?',
      'Yes, though sharing it changes things. Other people notice possibilities I miss.',
      'I like that a place can mean different things without any of us being wrong about it.',
      'And we don’t have to turn it into the same place for everyone.',
    ], a.trait === 'curious' ? 18 : 10);
    add('rest', 'Rest without earning it', [
      a.energy < 40 ? 'I’m low on energy. Why does taking a rest sometimes feel harder than staying busy?' : 'Do you find it easy to rest, or does part of you keep looking for something to do?',
      voice(b, { practical: 'I keep thinking of unfinished things. It is hard to call a pause useful.', curious: 'My mind keeps asking questions even when I want it to stop.', reserved: 'Quiet helps, but I need to feel that nobody is waiting for me to speak.', spirited: 'I get restless. Sometimes I want a change more than a complete stop.', kind: 'I worry that someone might need me. That can make a quiet moment feel selfish.' }),
      'If a friend felt that way, would you expect them to keep going?',
      'No. I suppose I set a different standard for myself. Knowing that doesn’t switch it off.',
      'Maybe noticing the difference is enough for this conversation. I don’t have a cure for it.',
    ], a.energy < 40 || b.energy < 40 || a.mood < 40 || b.mood < 40 ? 22 : 10);
    add('play', 'A little room for silliness', [
      'Does everything we do together need to be useful? I like the idea of something delightfully pointless.',
      voice(b, { spirited: 'I’m in favor of pointless delight. Though defending it sounds suspiciously like work.', practical: 'I would probably try to organize the pointlessness. That may defeat the purpose.', curious: 'Now I want to know what makes something pointless. We may have found a very serious question.', reserved: 'I like the idea, as long as enjoying it quietly counts.', kind: 'It counts if it makes room for people to enjoy themselves, I think.' }),
      'Perhaps the test is whether anyone minds if it turns out badly.',
      'That sounds freeing. A little awkwardness might even be part of the appeal.',
    ], a.mood > 75 && b.mood > 60 ? 22 : a.trait === 'spirited' && a.mood > 60 ? 22 : 8);
  }
  add('decisions', `Who gets a say in ${space}`, [
    `If we change ${space}, I want everyone to get a say. Would you find that frustrating?`,
    b.trait === 'spirited' ? 'A little, yes. I worry we would spend all our time debating and never try anything.' : 'I’d worry that asking everyone would mean nothing ever got decided.',
    positive ? 'What would make listening feel useful rather than like a delay?' : 'A quick decision can still leave someone feeling shut out. Speed is not the only thing at stake.',
    b.trait === 'practical' ? 'Knowing what is actually open for discussion. Otherwise it is hard to tell when enough has been said.' : 'A chance to disagree without having to win everyone over. I don’t need agreement on every detail.',
    positive ? 'So being heard could matter even when the decision goes another way.' : 'I still want more room for quieter voices. I don’t think we have found the balance yet.',
    'That leaves a real question: how would we know when someone has actually been heard?',
  ], positive ? 4 : 18);
  add('help', positive ? 'Help that leaves room for choice' : 'When help feels like interference', [
    positive ? 'When you’re struggling with something, do you want help right away or space to try?' : 'I’m uneasy about the line between helping and taking over. Where is that line for you?',
    voice(b, { practical: 'Ask what I am trying to do first. A useful answer to the wrong problem isn’t much help.', curious: 'Give me a chance to work it out. Understanding the problem can matter as much as solving it.', reserved: 'Ask quietly. Being offered help in front of everyone can make me feel exposed.', spirited: 'Let me try my own way, even if it looks messy. I don’t enjoy being managed.', kind: 'An offer helps, but I want refusing it to feel possible too.' }),
    a.trait === 'kind' ? 'I can be so eager to ease a difficulty that I miss the wish to handle it alone.' : 'I’m not always sure how to tell patience from leaving someone to struggle.',
    (relationship?.trust ?? 50) < 35 ? 'I’m not ready to have you decide that for me. Please ask rather than assume.' : close && (relationship?.affinity ?? 0) < 0 ? 'I trust you to ask, even when we rub each other the wrong way. Trust doesn’t mean we like every suggestion.' : (relationship?.affinity ?? 0) < 0 ? 'I don’t always find our exchanges easy. Asking first would help me say what I actually want.' : close ? 'With you, I feel able to say no. That makes an offer easier to hear.' : 'There may not be a sign you can read from across the room. I would rather be asked.',
    positive ? 'A question leaves more choice than an assumption. That is worth remembering.' : 'I can see why you want that choice. I’m still uncomfortable with how easy it is to misread each other.',
  ], a.trait === 'kind' || (relationship?.trust ?? 50) < 35 ? 18 : 10);
  add('resources', positive ? 'Enough to share' : 'Fairness when supplies are limited', [
    world.resources < 40 ? 'Supplies are low. What would make sharing feel fair without turning every need into an argument?' : 'Does sharing fairly mean equal amounts, or leaving more for whoever needs it most?',
    voice(b, { practical: 'I want to know what is available before deciding. Fairness needs something concrete to work with.', kind: 'Equal amounts can hide very unequal needs. I’d want room to say that something isn’t enough.', curious: 'I wonder who gets to define a need. That seems like the difficult part.', reserved: 'I worry about having to explain myself in front of everyone just to ask for enough.', spirited: 'I dislike a rule that sounds fair but gives nobody room to use their judgment.' }),
    voice(a, { practical: 'How could we compare two urgent needs without making up facts about either?', curious: 'What would we need to understand before comparing two people’s needs?', reserved: 'What if someone finds it hard to explain their need in front of everybody?', spirited: 'Could a rule leave room for judgment when two people both need more?', kind: 'How could we hear both people without making either feel selfish for asking?' }),
    positive ? 'Then a rule alone may not settle it. They would still need a way to hear each other.' : 'That is where I get stuck. Someone can feel overlooked even when nobody means to be unfair.',
    positive ? 'I would rather leave that question open than pretend there is one easy answer.' : 'I’m not satisfied with the answer yet, but at least that is the part we disagree about.',
  ], world.resources < 40 ? 24 : 8);

  if (a.belonging < 25 || b.belonging < 25) {
    add('belonging', 'Finding a place without performing', [
      a.belonging < 25 ? 'I don’t quite feel part of things here. How much of yourself do you feel you have to explain to belong?' : 'Do you feel you can be yourself here, or does joining in take effort?',
      b.belonging < 25 ? 'It takes effort. I’m not sure where I fit, and I don’t want to pretend otherwise.' : 'I don’t think anyone should have to explain everything about themselves to be welcome.',
      a.trait === 'practical' ? 'What would make joining in less work, without asking you to become someone else?' : 'Would an invitation help, or could it feel like another expectation?',
      b.trait === 'reserved' ? 'An invitation without an audience would help. I like room to answer quietly.' : 'Being able to say no and still feel included matters to me.',
      'That leaves room for a choice. I wouldn’t want belonging to become a performance.',
    ], 28);
  }
  // Consider each resident's own account independently; neither can read the
  // other's memories. Archived source records may be absent, but provenance is required.
  for (const [speaker, other, speakerIndex] of [[a, b, 0], [b, a, 1]] as const) {
    const memory = dialogueMemory(world, speaker, other);
    const excerpt = memory && memoryExcerpt(memory);
    if (!memory || !excerpt) continue;
    const recalledLine = `I remember it this way: “${excerpt}”`;
    const perspective = memory.tone === 'tense' ? 'It still feels unsettled to me. I want room to explain it without having to win an argument.' : memory.tone === 'warm' ? 'It matters to me because I felt connected. I don’t want to assume it felt the same to you.' : 'I’m still deciding what it means to me. Remembering it doesn’t give me a simple answer.';
    add(`memory:${speaker.id}`, memory.kind === 'friendship' ? 'What a friendship means to us' : memory.tone === 'tense' ? 'What stayed unresolved' : 'Two perspectives on a shared moment', speakerIndex === 0 ? [
      recalledLine, 'What part of that memory matters most to you now?', perspective,
      'I can listen to how it stayed with you without claiming my experience was identical.',
    ] : [
      'Is there a moment between us you keep thinking about?', recalledLine,
      'What part of it matters most to you now?', perspective,
      'I’m glad you could tell me your side. I won’t assume that tells me everything.',
    ], memory.kind === 'friendship' ? 27 : 15);
  }

  const previous = pair.filter(e => e.conversation?.status !== 'active').at(-1);
  const ownedMemory = dialogueMemory(world, a, b);
  const recalled = ownedMemory?.kind === 'conflict' ? ownedMemory : undefined;
  if (previous?.conversation || recalled) {
    const quote = previous?.conversation?.turns.filter(t => t.speakerId === b.id && t.text.length <= 110 && !/[“”]/.test(t.text)).at(-1)?.text;
    add('revisit', previous?.conversation?.topic ?? 'Returning to a disagreement', [
      quote ? `Last time you said, “${quote}” Would you put it the same way now?` : recalled || previous?.conversation?.tone === 'tense' ? 'Our disagreement is still on my mind. Is there a part you would want me to understand better?' : 'Our last conversation is still on my mind. Is there a part you would put differently now?',
      positive ? 'I might put it less firmly. The feeling matters to me, but I’m not sure my first words captured it.' : 'I still feel strongly about it. I don’t want a calmer conversation to be mistaken for agreement.',
      'Which matters more right now: finding an answer, or having room to explain your view?',
      b.trait === 'practical' ? 'An answer would help, but not one that skips over why we see it differently.' : 'Room to explain. I don’t think being understood has to mean being agreed with.',
      close ? 'I trust that we can leave something unresolved without losing the rest of our connection.' : 'I can listen without claiming we have settled it. That seems a more honest place to pause.',
    ], previous?.conversation?.tone === 'tense' || recalled ? 24 : 12);
  }
  const event = [...world.history].reverse().find(e => e.kind === 'event' && world.minute - e.minute >= 0 && world.minute - e.minute < 120);
  const definition = EVENTS.find(e => e.text === event?.text);
  if (event && definition) {
    const questions: Record<string, string> = {
      'shared-meal': 'After the shared meal, I wonder what makes eating together comfortable for you.',
      'care-package': 'That unexpected gift makes me wonder: is it easy for you to accept kindness?',
      'story-night': 'Story night leaves me wondering which parts of ourselves we choose to tell.',
      'new-project': 'The garden plan has brought out different opinions. Is that possibility or trouble to you?',
      'power-outage': 'After the lights went out, I keep thinking about how uncertainty affects us. What is hardest for you?',
      rumor: 'That rumor is bothering me. How do we talk about uncertainty without spreading it?',
    };
    const opening = questions[definition.id];
    const reply = voice(b, EVENT_REPLIES[definition.id]);
    scenes.push({ id: `event:${definition.id}`, topic: definition.name, eventText: event.text,
      relevance: pair.some(e => e.minute >= event.minute && e.conversation?.topic === definition.name) ? 8 : 100,
      lines: [opening, reply, positive ? 'Would being able to ask a question make that easier?' : 'I’m not sure a question is enough when people are already on edge.',
        b.trait === 'reserved' ? 'Only if there is room not to answer immediately. I need time to find my words.' : 'It depends on whether the question leaves room for an answer nobody expected.',
        positive ? 'I’d like that room too. I don’t want us to rush past the complicated part.' : 'Then we may need to leave it complicated for now. I still see it differently.'] });
  }
  const recent = history.slice(-12).reverse();
  const score = (s: Scene) => s.relevance + jitter(`${world.seed}:${world.nextLog}:${a.id}:${b.id}:${s.id}`)
    - recent.reduce((penalty, e, i) => penalty + (e.conversation?.sceneId === s.id || (s.id !== 'revisit' && e.conversation?.topic === s.topic) ? (e.characters.includes(a.id) && e.characters.includes(b.id) ? 120 : 45) / (i + 1) : 0), 0);
  const selected = scenes.sort((x, y) => score(y) - score(x))[0];
  // Memory arcs already express a specific perspective; don't interrupt that
  // disclosure with a generic state aside. Fatigue can still shorten the exchange.
  return { ...selected, lines: selected.id.startsWith('memory:') && a.energy >= 30 && b.energy >= 30 ? selected.lines : statefulProgression(selected.lines, a, b, positive) };
}
