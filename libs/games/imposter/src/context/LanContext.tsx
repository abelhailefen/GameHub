import { useLanSession, type LanSession } from '@gamehub/lan/session';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Engine } from '../lan/engine';
import { IMPOSTER_LAN, type Action, type LanSettings, type View } from '../lan/protocol';
import { useGame } from './GameContext';

type LanContextValue = Omit<LanSession<Action, View>, 'hostGame'> & {
  hostGame: (name: string) => Promise<string | null>;
};

const LanContext = createContext<LanContextValue | null>(null);

export function LanProvider({ children }: { children: ReactNode }) {
  const game = useGame();
  const session = useLanSession<Action, View>(IMPOSTER_LAN, game.deviceId);

  // The engine outlives renders, so it reads the latest dealer and settings through refs.
  const dealRef = useRef(game.dealRound);
  dealRef.current = game.dealRound;
  const settingsRef = useRef<LanSettings>(game.settings);
  settingsRef.current = {
    imposterCount: game.settings.imposterCount,
    hintMode: game.settings.hintMode,
    timerMinutes: game.settings.timerMinutes,
    votingSeconds: game.settings.votingSeconds,
    scoring: game.settings.scoring,
  };

  // Settings changed on the host: everyone's lobby shows the new ones.
  useEffect(() => {
    session.refresh();
  }, [game.settings]);

  const value: LanContextValue = {
    ...session,
    hostGame: (name) =>
      session.hostGame(name, new Engine(game.deviceId, name, (n) => dealRef.current(n), () => settingsRef.current)),
  };

  return <LanContext.Provider value={value}>{children}</LanContext.Provider>;
}

export function useLan(): LanContextValue {
  const ctx = useContext(LanContext);
  if (!ctx) throw new Error('useLan must be used inside LanProvider');
  return ctx;
}
