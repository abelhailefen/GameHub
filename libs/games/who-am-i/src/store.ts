import AsyncStorage from '@react-native-async-storage/async-storage';

export type Settings = {
  /** Theme id, see THEMES. */
  theme: string;
  /** Length of each turn. 0 = no timer. */
  turnSeconds: number;
  /** Award points and show the leaderboard. */
  scoring: boolean;
};

export type PersistedState = {
  players: string[];
  settings: Settings;
  /** Total points per player name. */
  scores: Record<string, number>;
};

const KEY = '@gamehub/who-am-i/v1';

export const DEFAULT_STATE: PersistedState = {
  players: [],
  settings: { theme: 'anything', turnSeconds: 0, scoring: true },
  scores: {},
};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    return { ...DEFAULT_STATE, ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings } };
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
