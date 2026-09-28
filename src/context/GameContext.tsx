import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BUILT_IN_CATEGORIES, BUILT_IN_WORDS, type Category, type Word } from '../data/words';
import { dealHint, type Hint, type HintMode } from '../game/hint';
import { assignImposters, MIN_PLAYERS, pickWord, pushRecent, shuffle, speakingOrder } from '../game/logic';
import { addPoints } from '../game/scoring';
import { DEFAULT_STATE, loadState, readClues, saveState, toClues, type PersistedState, type Settings } from '../storage/store';
import type { Dealt } from '../lan/engine';
import { colors } from '../theme';

export type Round = {
  players: string[];
  word: Word;
  imposters: number[];
  /** Player indices in the order they see their card. */
  revealOrder: number[];
  /** Player indices in the order they give clues. */
  speakOrder: number[];
  /** Hint difficulty this round was dealt with. */
  hintMode: HintMode;
  /** The hint the imposter was dealt (picked once, so reveal and result show the same one). */
  hint: Hint;
};

export type NewWord = Pick<Word, 'am' | 'en' | 'easy' | 'hard' | 'category'>;

type GameContextValue = {
  players: string[];
  setPlayers: (players: string[]) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  categories: Category[];
  allWords: Word[];
  customWords: Word[];
  customCategories: Category[];
  addCustomWord: (word: NewWord) => string | null;
  deleteCustomWord: (id: string) => void;
  addCustomCategory: (nameEn: string, nameAm: string) => Category;
  deleteCustomCategory: (id: string) => void;
  exportCustom: () => string;
  importCustom: (text: string) => { words: number; categories: number };
  round: Round | null;
  startRound: () => string | null;
  /** Deals a round for a LAN game with this many players, or returns an error message. */
  dealRound: (playerCount: number) => Dealt | string;
  /** One-phone leaderboard: total points per player name. */
  scores: Record<string, number>;
  addScores: (points: Record<string, number>) => void;
  resetScores: () => void;
  lanName: string;
  setLanName: (name: string) => void;
  deviceId: string;
};

const GameContext = createContext<GameContextValue | null>(null);

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const norm = (s: string) => s.trim().toLowerCase();
const wordKey = (w: NewWord) => `${w.category}|${norm(w.am)}|${norm(w.en)}`;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function GameProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [round, setRound] = useState<Round | null>(null);

  useEffect(() => {
    loadState().then((s) => {
      setData(s);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveState(data);
  }, [data, loaded]);

  const categories = useMemo(() => [...BUILT_IN_CATEGORIES, ...data.customCategories], [data.customCategories]);
  const allWords = useMemo(() => [...BUILT_IN_WORDS, ...data.customWords], [data.customWords]);

  /** Picks the next word from the enabled categories and remembers it so it doesn't repeat soon. */
  const nextWord = () => {
    const pool = allWords.filter((w) => data.settings.enabledCategories.includes(w.category));
    const word = pickWord(pool, data.recentIds);
    if (word) setData((d) => ({ ...d, recentIds: pushRecent(d.recentIds, word.id) }));
    return word;
  };

  const value: GameContextValue = {
    players: data.players,
    setPlayers: (players) => setData((d) => ({ ...d, players })),
    settings: data.settings,
    updateSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    categories,
    allWords,
    customWords: data.customWords,
    customCategories: data.customCategories,

    addCustomWord: (input) => {
      const word: NewWord = {
        am: input.am.trim(),
        en: input.en.trim(),
        easy: toClues(input.easy),
        hard: toClues(input.hard),
        category: input.category,
      };
      if (!word.am && !word.en) return 'Enter the word (in Amharic or English).';
      if (word.easy.length === 0) return 'Enter at least one easy hint for the imposter.';
      if (allWords.some((w) => wordKey(w) === wordKey(word))) return 'That word is already in this category.';
      setData((d) => ({ ...d, customWords: [...d.customWords, { ...word, id: newId('w'), custom: true }] }));
      return null;
    },

    deleteCustomWord: (id) => setData((d) => ({ ...d, customWords: d.customWords.filter((w) => w.id !== id) })),

    addCustomCategory: (nameEn, nameAm) => {
      const en = nameEn.trim();
      const am = nameAm.trim();
      const existing = categories.find((c) => (en && norm(c.nameEn) === norm(en)) || (am && c.nameAm === am));
      if (existing) return existing;
      const cat: Category = { id: newId('cat'), nameEn: en || am, nameAm: am, emoji: '📝', custom: true };
      setData((d) => ({
        ...d,
        customCategories: [...d.customCategories, cat],
        settings: { ...d.settings, enabledCategories: [...d.settings.enabledCategories, cat.id] },
      }));
      return cat;
    },

    deleteCustomCategory: (id) =>
      setData((d) => ({
        ...d,
        customCategories: d.customCategories.filter((c) => c.id !== id),
        customWords: d.customWords.filter((w) => w.category !== id),
        settings: { ...d.settings, enabledCategories: d.settings.enabledCategories.filter((c) => c !== id) },
      })),

    exportCustom: () =>
      JSON.stringify({
        app: 'ethiopian-imposter',
        version: 2,
        categories: data.customCategories,
        words: data.customWords.map(({ am, en, easy, hard, category }) => ({ am, en, easy, hard, category })),
      }),

    importCustom: (text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text.trim());
      } catch {
        throw new Error('That text is not valid shared word data. Copy the whole message and try again.');
      }
      const obj = (Array.isArray(parsed) ? { words: parsed } : parsed) as { words?: unknown; categories?: unknown } | null;
      if (!obj || typeof obj !== 'object') throw new Error('That text is not valid shared word data.');

      // Map incoming category ids to local ids, creating categories we don't have yet.
      const cats = [...data.customCategories];
      const idMap = new Map<string, string>();
      for (const c of categories) idMap.set(c.id, c.id);
      const newCatIds: string[] = [];
      for (const raw of Array.isArray(obj.categories) ? obj.categories : []) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Record<string, unknown>;
        const id = str(r.id);
        const nameEn = str(r.nameEn);
        const nameAm = str(r.nameAm);
        if (!id || (!nameEn && !nameAm) || idMap.has(id)) continue;
        const same = [...BUILT_IN_CATEGORIES, ...cats].find(
          (c) => (nameEn && norm(c.nameEn) === norm(nameEn)) || (nameAm && c.nameAm === nameAm),
        );
        if (same) {
          idMap.set(id, same.id);
          continue;
        }
        const cat: Category = { id: newId('cat'), nameEn: nameEn || nameAm, nameAm, emoji: str(r.emoji) || '📝', custom: true };
        cats.push(cat);
        newCatIds.push(cat.id);
        idMap.set(id, cat.id);
      }

      const seen = new Set(allWords.map(wordKey));
      const words = [...data.customWords];
      let added = 0;
      for (const raw of Array.isArray(obj.words) ? obj.words : []) {
        if (!raw || typeof raw !== 'object') continue;
        const r = raw as Record<string, unknown>;
        const category = idMap.get(str(r.category));
        if (!category) continue;
        const w: NewWord = {
          am: str(r.am),
          en: str(r.en),
          ...readClues(r),
          category,
        };
        if ((!w.am && !w.en) || w.easy.length === 0) continue;
        const k = wordKey(w);
        if (seen.has(k)) continue;
        seen.add(k);
        words.push({ ...w, id: newId('w'), custom: true });
        added++;
      }

      setData((d) => ({
        ...d,
        customWords: words,
        customCategories: cats,
        settings: { ...d.settings, enabledCategories: [...d.settings.enabledCategories, ...newCatIds] },
      }));
      return { words: added, categories: newCatIds.length };
    },

    round,
    startRound: () => {
      const players = data.players;
      if (players.length < MIN_PLAYERS) return `Add at least ${MIN_PLAYERS} players.`;
      const word = nextWord();
      if (!word) return 'Pick at least one category that has words.';
      const imposters = assignImposters(players.length, data.settings.imposterCount);
      setRound({
        players: [...players],
        word,
        imposters,
        revealOrder: shuffle(players.map((_, i) => i)),
        speakOrder: speakingOrder(players.length),
        hintMode: data.settings.hintMode,
        hint: dealHint(word, data.settings.hintMode, categories.find((c) => c.id === word.category)),
      });
      return null;
    },

    dealRound: (playerCount) => {
      if (playerCount < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
      const word = nextWord();
      if (!word) return 'Pick at least one category that has words.';
      const category = categories.find((c) => c.id === word.category);
      return {
        word: { am: word.am, en: word.en },
        category: category ? `${category.emoji} ${category.nameEn}` : '',
        hint: dealHint(word, data.settings.hintMode, category),
        imposters: assignImposters(playerCount, data.settings.imposterCount),
        speakOrder: speakingOrder(playerCount),
      };
    },

    scores: data.scores,
    addScores: (points) => setData((d) => ({ ...d, scores: addPoints(d.scores, points) })),
    resetScores: () => setData((d) => ({ ...d, scores: {} })),

    lanName: data.lanName,
    setLanName: (lanName) => setData((d) => ({ ...d, lanName })),
    deviceId: data.deviceId,
  };

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
