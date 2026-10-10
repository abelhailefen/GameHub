// The phone side of a Wi-Fi game as a React hook: host or join a game, send actions, and find games
// on this network. Each game wraps it in its own context and supplies the engine that runs its rules.

import * as Network from 'expo-network';
import { useEffect, useRef, useState } from 'react';
import { ClientSession, type ClientStatus } from './client';
import { probe, scanHosts, subnetHosts, type FoundGame } from './discovery';
import { HostSession } from './host';
import { lanSocket, listenForBeacons, localAddresses, startBeacon } from './native';
import { errorMessage, type NetApi } from './net';
import type { Beacon, LanConfig, LanEngine } from './protocol';

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

export type LanSession<A, V> = {
  role: 'host' | 'client' | null;
  view: V | null;
  status: ClientStatus | 'hosting';
  /** The host phone's address, for joining by hand if discovery doesn't find it. */
  address: string | null;
  /** Latest error from an action (e.g. "Only the host can do that"). */
  error: string | null;
  clearError: () => void;
  /** Why the session ended (host left, removed, couldn't connect…). */
  ended: string | null;
  clearEnded: () => void;
  /** Starts hosting with this engine. Resolves with an error message, or null. */
  hostGame: (name: string, engine: LanEngine<A, V>) => Promise<string | null>;
  joinGame: (host: string, name: string) => void;
  act: (action: A) => void;
  /** Host: re-send everyone's view, e.g. after a setting changed. */
  refresh: () => void;
  leave: () => void;
  /** Keeps looking for games on this network until the returned function is called. */
  discover: (onFound: (game: FoundGame) => void, onStatus: (status: DiscoveryStatus) => void) => () => void;
};

/** `deviceId` identifies this phone across reconnects; keep it stable (store it). */
export function useLanSession<A, V>(config: LanConfig, deviceId: string): LanSession<A, V> {
  const [role, setRole] = useState<'host' | 'client' | null>(null);
  const [view, setView] = useState<V | null>(null);
  const [status, setStatus] = useState<ClientStatus | 'hosting'>('connecting');
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  const hostRef = useRef<HostSession<A, V> | null>(null);
  const clientRef = useRef<ClientSession<A, V> | null>(null);
  const stopBeaconRef = useRef<(() => void) | null>(null);

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

  return {
    role,
    view,
    status,
    address,
    error,
    clearError: () => setError(null),
    ended,
    clearEnded: () => setEnded(null),

    hostGame: async (name, engine) => {
      hostRef.current?.stop();
      clientRef.current?.leave();
      const session = new HostSession<A, V>(tcp, config, engine, name, setView);
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
        const beacon: Beacon = { t: config.game, v: config.version, port: config.port };
        stopBeaconRef.current = startBeacon(config.beaconPort, JSON.stringify(beacon));
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
      const session = new ClientSession<A, V>(tcp, config, host, deviceId, name, {
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

    refresh: () => hostRef.current?.refresh(),

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
      const stopListening = listenForBeacons(config.beaconPort, (from, data) => {
        let beacon: Beacon;
        try {
          beacon = JSON.parse(data) as Beacon;
        } catch {
          return;
        }
        if (beacon.t !== config.game || Date.now() - (lastProbe.get(from) ?? 0) < 3000) return;
        lastProbe.set(from, Date.now());
        probe(tcp, from, { ...config, port: beacon.port || config.port }).then((game) => {
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
            await scanHosts(tcp, hosts, config, onFound, isCancelled);
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
}
