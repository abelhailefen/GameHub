import { useLanSession, type LanSession } from '@gamehub/lan/session';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useWhoAmI } from '../context';
import { Engine } from './engine';
import { WHO_AM_I_LAN, type Action, type LanSettings, type View } from './protocol';

type LanContextValue = Omit<LanSession<Action, View>, 'hostGame'> & {
  hostGame: (name: string) => Promise<string | null>;
};

const LanContext = createContext<LanContextValue | null>(null);

export function LanProvider({ children }: { children: ReactNode }) {
  const game = useWhoAmI();
  const session = useLanSession<Action, View>(WHO_AM_I_LAN, game.deviceId);

  // The engine outlives renders, so it reads the latest settings through a ref.
  const settingsRef = useRef<LanSettings>(game.settings);
  settingsRef.current = game.settings;

  // Settings changed on the host: everyone's lobby shows the new ones.
  useEffect(() => {
    session.refresh();
  }, [game.settings]);

  const value: LanContextValue = {
    ...session,
    hostGame: (name) => session.hostGame(name, new Engine(game.deviceId, name, () => settingsRef.current)),
  };

  return <LanContext.Provider value={value}>{children}</LanContext.Provider>;
}

export function useLan(): LanContextValue {
  const ctx = useContext(LanContext);
  if (!ctx) throw new Error('useLan must be used inside LanProvider');
  return ctx;
}
