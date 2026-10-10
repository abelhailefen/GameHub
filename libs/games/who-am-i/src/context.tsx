import { addPoints } from '@gamehub/core';
import { colors } from '@gamehub/ui';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MIN_PLAYERS, newRound, roundPoints, type Round } from './logic';
import { DEFAULT_STATE, loadState, saveState, type PersistedState, type Settings } from './store';

/** A finished round and the points it gave out. */
export type RoundResult = { round: Round; points: Record<string, number> };

type WhoAmIValue = {
  players: string[];
  setPlayers: (players: string[]) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  scores: Record<string, number>;
  resetScores: () => void;
  round: Round | null;
  setRound: (round: Round) => void;
  /** Starts a new round with the current players, or returns an error message. */
  startRound: () => string | null;
  /** Ends the round: works out the points and adds them to the leaderboard. */
  finishRound: (round: Round) => void;
  result: RoundResult | null;
};

const WhoAmIContext = createContext<WhoAmIValue | null>(null);

export function WhoAmIProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PersistedState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);

  useEffect(() => {
    loadState().then((s) => {
      setData(s);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveState(data);
  }, [data, loaded]);

  const value: WhoAmIValue = {
    players: data.players,
    setPlayers: (players) => setData((d) => ({ ...d, players })),
    settings: data.settings,
    updateSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    scores: data.scores,
    resetScores: () => setData((d) => ({ ...d, scores: {} })),
    round,
    setRound,

    startRound: () => {
      if (data.players.length < MIN_PLAYERS) return `Add at least ${MIN_PLAYERS} players.`;
      setRound(newRound(data.players, data.settings.theme));
      setResult(null);
      return null;
    },

    finishRound: (finished) => {
      const points = data.settings.scoring ? roundPoints(finished) : {};
      setData((d) => ({ ...d, scores: addPoints(d.scores, points) }));
      setRound(finished);
      setResult({ round: finished, points });
    },

    result,
  };

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.yellow} size="large" />
      </View>
    );
  }

  return <WhoAmIContext.Provider value={value}>{children}</WhoAmIContext.Provider>;
}

export function useWhoAmI(): WhoAmIValue {
  const ctx = useContext(WhoAmIContext);
  if (!ctx) throw new Error('useWhoAmI must be used inside WhoAmIProvider');
  return ctx;
}
