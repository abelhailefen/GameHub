// Built-in word bank. The words themselves live in ./bank/<category>.ts.
//
// To add a word that ships with the app for everyone, add a row to the right category file:
//   [Amharic word, English, [4 easy clues as Am, En pairs], [4 hard clues as Am, En pairs]]
//
// Each round the imposter sees ONE hint, picked at random from the list for the difficulty chosen in Setup:
//   easy     -> an easy clue: closely related, a strong nudge
//   hard     -> a hard clue: same world, but it fits many words (the default)
//   category -> just the category name
// Words can also be added from the "Manage Words" screen.

import { culture } from './bank/culture';
import { everyday } from './bank/everyday';
import { famous } from './bank/famous';
import { food } from './bank/food';
import { places } from './bank/places';
import { world } from './bank/world';

export type CategoryId = string;

export type Clue = { am: string; en: string };

export type Word = {
  id: string;
  am: string;
  en: string;
  /** Closely related clues. At least one. */
  easy: Clue[];
  /** Vaguer clues. May be empty on custom words; the easy clues are used instead. */
  hard: Clue[];
  category: CategoryId;
  custom?: boolean;
};

export type Category = {
  id: CategoryId;
  nameAm: string;
  nameEn: string;
  emoji: string;
  custom?: boolean;
};

/** Clues flattened as [am, en, am, en, ...]. */
export type Row = [am: string, en: string, easy: string[], hard: string[]];

export const BUILT_IN_CATEGORIES: Category[] = [
  { id: 'food', nameAm: 'ምግብና መጠጥ', nameEn: 'Food & Drinks', emoji: '🍲' },
  { id: 'places', nameAm: 'ቦታዎች', nameEn: 'Places & Cities', emoji: '📍' },
  { id: 'culture', nameAm: 'ባህልና በዓላት', nameEn: 'Culture & Holidays', emoji: '🎉' },
  { id: 'everyday', nameAm: 'የዕለት ኑሮ', nameEn: 'Everyday Life', emoji: '🏠' },
  { id: 'famous', nameAm: 'ታዋቂ ሰዎች', nameEn: 'Famous People', emoji: '⭐' },
  { id: 'world', nameAm: 'ዓለም አቀፍ', nameEn: 'Around the World', emoji: '🌍' },
];

const slug = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pairs = (flat: string[]): Clue[] => {
  const out: Clue[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ am: flat[i], en: flat[i + 1] });
  return out;
};

const build = (category: CategoryId, rows: Row[]): Word[] =>
  rows.map(([am, en, easy, hard]) => ({
    id: `${category}-${slug(en)}`,
    am,
    en,
    easy: pairs(easy),
    hard: pairs(hard),
    category,
  }));

export const BUILT_IN_WORDS: Word[] = [
  ...build('food', food),
  ...build('places', places),
  ...build('culture', culture),
  ...build('everyday', everyday),
  ...build('famous', famous),
  ...build('world', world),
];

export const categoryLabel = (c: Category) => `${c.emoji} ${c.nameEn}`;
