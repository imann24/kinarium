import { COLORS } from './catalog';
import type { Character, ResidentAppearance } from './types';

/**
 * Options a resident can wear. The first entries are the looks the sprite has always drawn;
 * saved looks store indexes, so new options are only ever appended. `*_ORDER` is display order.
 */
export const CLOTHING_COLORS = [...COLORS, '#4f6f8f', '#c9675f', '#8f7a5a', '#5f5a6e'] as const;
export const CLOTHING_LABELS = ['Terracotta', 'Moss', 'Mustard', 'Teal', 'Mauve', 'Periwinkle', 'Clay', 'Sage', 'Navy', 'Coral', 'Olive', 'Slate'] as const;
export const SKIN_TONES = ['#edc8a2', '#be896b', '#f6dcc2', '#d8a57e', '#9a6448', '#6e4532'] as const;
export const SKIN_TONE_LABELS = ['Light', 'Bronze', 'Fair', 'Tan', 'Brown', 'Deep'] as const;
export const SKIN_TONE_ORDER = [2, 0, 3, 1, 4, 5] as const;
export const HAIR_COLORS = ['#534f41', '#917253', '#2b2722', '#8a4a32', '#d2ae68', '#a9a59b'] as const;
export const HAIR_COLOR_LABELS = ['Dark brown', 'Chestnut', 'Black', 'Auburn', 'Blond', 'Silver'] as const;
export const HAIR_COLOR_ORDER = [2, 0, 1, 3, 4, 5] as const;
export const HAIR_STYLES = [
  'M-12-44q-5-17 12-15t12 17l-6-9q-8 6-18 7',
  'M-12-45q-4-14 12-14t12 15q-5-7-12-7t-12 6',
  'M-13-44q-2-14 12-15t14 15l-7-7-5 7-5-7-9 7',
  'M-12-46q0-11 12-11t12 11q-6-4-12-4t-12 4Z',
  'M-13-30C-15-50-8-58 0-58S15-50 13-30H9C9-38 8-44 6-46Q0-43-6-46C-8-44-9-38-9-30Z',
  'M-12-46q0-12 12-12t12 12q-6-5-12-5t-12 5ZM-4-58a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  'M-13-42a4 4 0 0 1 2-8a5 5 0 0 1 6-6a5 5 0 0 1 10 0a5 5 0 0 1 6 6a4 4 0 0 1 2 8q-3-6-13-7t-13 7Z',
] as const;
export const HAIR_STYLE_LABELS = ['Swept', 'Rounded', 'Tufted', 'Cropped', 'Long', 'Bun', 'Curly'] as const;
/** Darker eyes keep the face readable on the deepest skin tones. */
export const eyeColor = (skinTone: number) => skinTone >= 4 ? '#221a15' : '#514538';

/** Residents who were never edited keep the look their id has always given them. */
export function residentAppearance(character: Pick<Character, 'id' | 'appearance'>): ResidentAppearance {
  const variant = Number(character.id.replace(/\D/g, '')) % 3;
  return character.appearance ?? { skinTone: variant === 1 ? 1 : 0, hairStyle: variant, hairColor: variant === 2 ? 1 : 0 };
}

function option(value: unknown, count: number, label: string) {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= count) throw new Error(`Choose one of the available ${label}.`);
  return value as number;
}
export function validateAppearance(input: { color?: unknown; appearance?: unknown }): { color: string; appearance: ResidentAppearance } {
  if (typeof input.color !== 'string' || !(CLOTHING_COLORS as readonly string[]).includes(input.color)) throw new Error('Choose one of the available clothing colors.');
  const a = (input.appearance && typeof input.appearance === 'object' ? input.appearance : {}) as Record<string, unknown>;
  return { color: input.color, appearance: { skinTone: option(a.skinTone, SKIN_TONES.length, 'skin tones'), hairStyle: option(a.hairStyle, HAIR_STYLES.length, 'hair styles'), hairColor: option(a.hairColor, HAIR_COLORS.length, 'hair colors') } };
}
