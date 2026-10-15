import { useEffect, useState } from 'react';
import type { Character, WorldState } from '../simulation/types';
import { SpeechBubble } from './ExpandableText';

type Utterance = { key: string; text: string; conversationId?: number };

/** Keep expanded text readable after the simulation moves to the next speaker. */
export default function ResidentSpeech({ character, visible, world, x, y, onOpenConversation }: {
  character: Character; visible: boolean; world: WorldState; x: number; y: number;
  onOpenConversation?: (id: number) => void;
}) {
  const [reading, setReading] = useState<Utterance>();
  const [dismissed, setDismissed] = useState<string>();
  const current: Utterance | undefined = character.speech ? {
    key: JSON.stringify([character.id, character.speechConversationId, character.speechUntil, character.speech]),
    text: character.speech, conversationId: character.speechConversationId,
  } : undefined;
  const currentKey = current?.key;
  useEffect(() => {
    // A genuinely new utterance replaces the old bubble, even with identical text.
    if (currentKey && reading && currentKey !== reading.key) setReading(undefined);
  }, [currentKey, reading]);
  const utterance = current ?? reading;
  if (!utterance || utterance.key === dismissed || (!visible && reading?.key !== utterance.key)) return null;
  const id = utterance.conversationId;
  const linked = Number.isSafeInteger(id) && id! > 0 && id! < Number.MAX_SAFE_INTEGER
    && !world.history.some(e => e.id === id && (!e.conversation || !e.characters.includes(character.id)));
  return <SpeechBubble key={utterance.key} text={utterance.text} name={character.name} residentId={character.id} x={x} y={y}
    onExpand={() => setReading(utterance)}
    onDismiss={() => { setDismissed(utterance.key); setReading(undefined); }}
    onOpenConversation={onOpenConversation && linked ? () => onOpenConversation(id!) : undefined}/>;
}
