import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUILT_IN_CATEGORIES, type Category, type Clue, type Word } from '../data/words';
import type { HintMode } from '../game/hint';

export type Settings = {
  imposterCount: number;
  enabledCategories: string[];
  timerMinutes: number; // 0 = no discussion timer
  votingSeconds: number; // 0 = no voting timer
  hintMode: HintMode;
};

export type PersistedState = {
  players: string[];
  settings: Settings;
  customWords: Word[];
  customCategories: Category[];
  recentIds: string[];
};

const KEY = '@imposter/state/v1';

export const DEFAULT_STATE: PersistedState = {
  players: [],
  settings: {
    imposterCount: 1,
    enabledCategories: BUILT_IN_CATEGORIES.map((c) => c.id),
    timerMinutes: 0,
    votingSeconds: 60,
    hintMode: 'hard',
  },
  customWords: [],
  customCategories: [],
  recentIds: [],
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Cleans a list of clues, dropping empty ones. */
export function toClues(v: unknown): Clue[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => (c && typeof c === 'object' ? { am: text((c as Clue).am), en: text((c as Clue).en) } : null))
    .filter((c): c is Clue => !!c && (!!c.am || !!c.en));
}

/**
 * Reads a saved or shared word. Older versions stored a single hint as hintAm/hintEn and
 * vagueAm/vagueEn; those become one-item clue lists.
 */
export function readClues(r: Record<string, unknown>): { easy: Clue[]; hard: Clue[] } {
  const easy = toClues(r.easy);
  const hard = toClues(r.hard);
  const oldEasy = { am: text(r.hintAm), en: text(r.hintEn) };
  const oldHard = { am: text(r.vagueAm), en: text(r.vagueEn) };
  if (easy.length === 0 && (oldEasy.am || oldEasy.en)) easy.push(oldEasy);
  if (hard.length === 0 && (oldHard.am || oldHard.en)) hard.push(oldHard);
  return { easy, hard };
}

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_STATE,
      ...saved,
      settings: { ...DEFAULT_STATE.settings, ...saved.settings },
      customWords: (saved.customWords ?? []).map((w) => ({
        ...w,
        ...readClues(w as unknown as Record<string, unknown>),
      })),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage failures shouldn't break the game; the next change retries.
  }
}
