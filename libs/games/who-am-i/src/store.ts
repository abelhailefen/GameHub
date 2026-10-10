import { newId } from '@gamehub/core';
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
  /** Identifies this phone in Wi-Fi games, so it can rejoin after a dropped connection. */
  deviceId: string;
  /** Name last used in a Wi-Fi game. */
  lanName: string;
};

const KEY = '@gamehub/who-am-i/v1';

export const DEFAULT_STATE: PersistedState = {
  players: [],
  settings: { theme: 'anything', turnSeconds: 0, scoring: true },
  scores: {},
  deviceId: '',
  lanName: '',
};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, deviceId: newId('d') };
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...DEFAULT_STATE,
      ...saved,
      settings: { ...DEFAULT_STATE.settings, ...saved.settings },
      deviceId: saved.deviceId || newId('d'),
    };
  } catch {
    return { ...DEFAULT_STATE, deviceId: newId('d') };
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage failures shouldn't break the game; the next change retries.
  }
}
