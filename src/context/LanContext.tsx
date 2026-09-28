import * as Network from 'expo-network';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ClientSession, type ClientStatus } from '../lan/client';
import { probe, scanHosts, subnetHosts, type FoundGame } from '../lan/discovery';
import { Engine } from '../lan/engine';
import { HostSession } from '../lan/host';
import { errorMessage, type NetApi } from '../lan/net';
import { BEACON_PORT, LAN_PORT, PROTOCOL_VERSION, type Action, type Beacon, type LanSettings, type View } from '../lan/protocol';
import { lanSocket, listenForBeacons, localAddresses, startBeacon } from '../../modules/lan-socket';
import { useGame } from './GameContext';

const tcp: NetApi = lanSocket;

const RESCAN_PAUSE_MS = 3000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** This phone's addresses, e.g. "192.168.1.5". Falls back to the Wi-Fi address from expo-network. */
async function myAddresses(): Promise<{ address: string; prefix: number }[]> {
  const found = localAddresses();
  if (found.length > 0) return found;
  const ip = await Network.getIpAddressAsync().catch(() => '0.0.0.0');
  return ip && ip !== '0.0.0.0' ? [{ address: ip, prefix: 24 }] : [];
}

export type DiscoveryStatus = { addresses: string[]; error?: string };

type LanContextValue = {
  role: 'host' | 'client' | null;
  view: View | null;
  status: ClientStatus | 'hosting';
  /** The host phone's address, for joining by hand if discovery doesn't find it. */
  address: string | null;
  /** Latest error from an action (e.g. "Only the host can do that"). */
  error: string | null;
  clearError: () => void;
  /** Why the session ended (host left, removed, couldn't connect…). */
  ended: string | null;
  clearEnded: () => void;
  hostGame: (name: string) => Promise<string | null>;
  joinGame: (host: string, name: string) => void;
  act: (action: Action) => void;
  leave: () => void;
  /** Keeps looking for games on this network until the returned function is called. */
  discover: (onFound: (game: FoundGame) => void, onStatus: (status: DiscoveryStatus) => void) => () => void;
};

const LanContext = createContext<LanContextValue | null>(null);

export function LanProvider({ children }: { children: ReactNode }) {
  const game = useGame();
  const [role, setRole] = useState<'host' | 'client' | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<ClientStatus | 'hosting'>('connecting');
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const hostRef = useRef<HostSession | null>(null);
  const clientRef = useRef<ClientSession | null>(null);
  const stopBeaconRef = useRef<(() => void) | null>(null);

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
    hostRef.current?.refresh();
  }, [game.settings]);

  // Close the server or connection if the app tree goes away.
  useEffect(
    () => () => {
      stopBeaconRef.current?.();
      hostRef.current?.stop();
      clientRef.current?.leave();
    },
    [],
  );

  const reset = () => {
    stopBeaconRef.current?.();
    stopBeaconRef.current = null;
    hostRef.current = null;
    clientRef.current = null;
    setRole(null);
    setView(null);
    setAddress(null);
  };

  const value: LanContextValue = {
    role,
    view,
    status,
    address,
    error,
    clearError: () => setError(null),
    ended,
    clearEnded: () => setEnded(null),

    hostGame: async (name) => {
      hostRef.current?.stop();
      clientRef.current?.leave();
      const engine = new Engine(game.deviceId, name, (n) => dealRef.current(n), () => settingsRef.current);
      const session = new HostSession(tcp, engine, name, setView);
      try {
        await session.start();
      } catch (e) {
        return errorMessage(e);
      }
      hostRef.current = session;
      clientRef.current = null;
      setEnded(null);
      setRole('host');
      setStatus('hosting');
      try {
        const beacon: Beacon = { t: 'imposter', v: PROTOCOL_VERSION, port: LAN_PORT };
        stopBeaconRef.current = startBeacon(BEACON_PORT, JSON.stringify(beacon));
      } catch {
        // Announcing is a bonus; phones can still find the game by scanning.
      }
      myAddresses()
        .then((list) => setAddress(list.length ? list.map((a) => a.address).join(' or ') : null))
        .catch(() => setAddress(null));
      return null;
    },

    joinGame: (host, name) => {
      stopBeaconRef.current?.();
      stopBeaconRef.current = null;
      hostRef.current?.stop();
      clientRef.current?.leave();
      hostRef.current = null;
      setEnded(null);
      setView(null);
      setRole('client');
      setAddress(host);
      const session = new ClientSession(tcp, host, game.deviceId, name, {
        onView: setView,
        onStatus: setStatus,
        onError: setError,
        onEnd: (message) => {
          if (clientRef.current !== session) return;
          setEnded(message);
          reset();
        },
      });
      clientRef.current = session;
      session.connect();
    },

    act: (action) => {
      if (hostRef.current) {
        const err = hostRef.current.act(action);
        if (err) setError(err);
      } else {
        clientRef.current?.act(action);
      }
    },

    leave: () => {
      stopBeaconRef.current?.();
      hostRef.current?.stop();
      clientRef.current?.leave();
      reset();
    },

    discover: (onFound, onStatus) => {
      let cancelled = false;
      const isCancelled = () => cancelled;

      // 1. Hosts announce themselves every second; check each one we hear.
      const lastProbe = new Map<string, number>();
      const stopListening = listenForBeacons(BEACON_PORT, (from, data) => {
        let beacon: Beacon;
        try {
          beacon = JSON.parse(data) as Beacon;
        } catch {
          return;
        }
        if (beacon.t !== 'imposter' || Date.now() - (lastProbe.get(from) ?? 0) < 3000) return;
        lastProbe.set(from, Date.now());
        probe(tcp, from, beacon.port || LAN_PORT).then((game) => {
          if (game && !cancelled) onFound(game);
        });
      });

      // 2. Also knock on every address on this network, over and over, in case broadcasts are blocked.
      (async () => {
        while (!cancelled) {
          const mine = await myAddresses();
          if (cancelled) break;
          if (mine.length === 0) {
            onStatus({
              addresses: [],
              error: "This phone isn't on Wi-Fi. Join the host's Wi-Fi or hotspot first, or type the host's address.",
            });
          } else {
            onStatus({ addresses: mine.map((a) => `${a.address}/${a.prefix}`) });
            const own = new Set(mine.map((a) => a.address));
            const hosts = [...new Set(mine.flatMap((a) => subnetHosts(a.address, a.prefix)))].filter((h) => !own.has(h));
            await scanHosts(tcp, hosts, onFound, isCancelled);
          }
          await wait(RESCAN_PAUSE_MS);
        }
      })().catch(() => {});

      return () => {
        cancelled = true;
        stopListening();
      };
    },
  };

  return <LanContext.Provider value={value}>{children}</LanContext.Provider>;
}

export function useLan(): LanContextValue {
  const ctx = useContext(LanContext);
  if (!ctx) throw new Error('useLan must be used inside LanProvider');
  return ctx;
}
