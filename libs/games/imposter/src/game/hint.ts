import type { Category, Clue, Word } from '../data/words';

export type HintMode = 'easy' | 'hard' | 'category';

export const HINT_MODES: { id: HintMode; label: string; sub: string }[] = [
  { id: 'easy', label: 'Easy', sub: 'clue word' },
  { id: 'hard', label: 'Hard', sub: 'vague clue' },
  { id: 'category', label: 'Brutal', sub: 'category only' },
];

export type Hint = { am: string; en: string; label: string };

/**
 * Deals the imposter's hint for a round. Every word has several easy and several hard clues;
 * one is picked at random so the same word doesn't always give the same hint.
 */
export function dealHint(word: Word, mode: HintMode, category?: Category, rng: () => number = Math.random): Hint {
  if (mode === 'category') {
    return {
      am: category?.nameAm ?? '',
      en: category ? `${category.emoji} ${category.nameEn}` : '',
      label: 'Only the category · ምድብ ብቻ',
    };
  }
  // Custom words may have no hard clues; fall back to the easy ones.
  const list: Clue[] = mode === 'hard' && word.hard.length > 0 ? word.hard : word.easy;
  const clue = list[Math.floor(rng() * list.length)] ?? { am: '', en: '' };
  return { am: clue.am, en: clue.en, label: 'Your hint · ፍንጭ' };
}
