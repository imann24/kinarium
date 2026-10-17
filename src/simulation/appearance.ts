import { COLORS } from './catalog';
import type { Character, ResidentAppearance } from './types';

/** The looks the resident sprite has always drawn; edits only choose among them. */
export const SKIN_TONES = ['#edc8a2', '#be896b'] as const;
export const HAIR_COLORS = ['#534f41', '#917253'] as const;
export const HAIR_STYLES = ['M-12-44q-5-17 12-15t12 17l-6-9q-8 6-18 7', 'M-12-45q-4-14 12-14t12 15q-5-7-12-7t-12 6', 'M-13-44q-2-14 12-15t14 15l-7-7-5 7-5-7-9 7'] as const;
export const SKIN_TONE_LABELS = ['Light', 'Deep'] as const;
export const HAIR_COLOR_LABELS = ['Dark', 'Chestnut'] as const;
export const HAIR_STYLE_LABELS = ['Swept', 'Rounded', 'Tufted'] as const;
export const CLOTHING_LABELS = ['Terracotta', 'Moss', 'Mustard', 'Teal', 'Mauve', 'Periwinkle', 'Clay', 'Sage'] as const;

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
  if (typeof input.color !== 'string' || !COLORS.includes(input.color)) throw new Error('Choose one of the available clothing colors.');
  const a = (input.appearance && typeof input.appearance === 'object' ? input.appearance : {}) as Record<string, unknown>;
  return { color: input.color, appearance: { skinTone: option(a.skinTone, SKIN_TONES.length, 'skin tones'), hairStyle: option(a.hairStyle, HAIR_STYLES.length, 'hair styles'), hairColor: option(a.hairColor, HAIR_COLORS.length, 'hair colors') } };
}
