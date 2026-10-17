import { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers, pattern } from 'obscenity';

// Word-boundary matching with leetspeak/repeat/confusable normalization keeps
// names like "Scunthorpe", "Dickens" or "Cassidy" from being flagged by substring.
const matcher = new RegExpMatcher({
  ...new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .addPhrase(phrase => phrase.setMetadata({ originalWord: 'nazi' }).addPattern(pattern`|nazi|`).addPattern(pattern`|nazis|`))
    .build(),
  ...englishRecommendedTransformers,
});

const SEPARATORS = /[\s.\-_*,|/\\]+/g;

function flagged(text: string) {
  if (matcher.hasMatch(text)) return true;
  // Catch "f u c k" / "f.u.c.k" by also checking with single-character runs joined.
  const joined = text.replace(/(?<=\b\w)[\s.\-_*,|/\\]+(?=\w\b)/g, '');
  if (joined !== text && matcher.hasMatch(joined)) return true;
  const collapsed = text.replace(SEPARATORS, '');
  return collapsed !== text && /^(?:\S[\s.\-_*,|/\\]+){3,}\S$/.test(text.trim()) && matcher.hasMatch(collapsed);
}

/** Throws a friendly error when user-written text contains profanity or slurs. */
export function assertAppropriate(text: unknown, label: string) {
  if (typeof text === 'string' && text && flagged(text)) {
    throw new Error(`Please choose a different ${label}. Kinarium is a shared space, so we can’t accept language that may be offensive.`);
  }
}

export const isAppropriate = (text: string) => !flagged(text);
