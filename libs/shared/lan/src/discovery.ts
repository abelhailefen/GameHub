// Finds games on the same Wi-Fi or hotspot by knocking on every address in this phone's subnet.
// That needs nothing beyond plain TCP, so it also works on phone hotspots where broadcast and
// mDNS discovery are often blocked.

import { onMessages, send, type NetApi } from './net';
import type { ClientMsg, GameInfo, HostMsg, LanConfig } from './protocol';

export type FoundGame = GameInfo & { host: string };

const PROBE_TIMEOUT_MS = 1500;
const PARALLEL = 48;

/** Asks one address whether it is hosting this game. Resolves null if not. */
export function probe(
  net: NetApi,
  host: string,
  config: Pick<LanConfig, 'port' | 'version'>,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<FoundGame | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: FoundGame | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      conn.destroy();
      resolve(result);
    };
    const conn = net.createConnection({ host, port: config.port, connectTimeout: timeoutMs }, () =>
      send(conn, { t: 'hello' } satisfies ClientMsg<never>),
    );
    const timer = setTimeout(() => finish(null), timeoutMs + 500);
    conn.on('error', () => finish(null));
    conn.on('close', () => finish(null));
    onMessages<HostMsg<unknown>>(conn, (msg) => {
      if (msg.t === 'info') {
        finish({ host, name: msg.name, players: msg.players, phase: msg.phase, v: msg.v ?? config.version });
      }
    });
  });
}

const toInt = (ip: string) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
const toIp = (n: number) => [24, 16, 8, 0].map((shift) => Math.floor(n / 2 ** shift) % 256).join('.');

/**
 * Every other address on this network. Networks bigger than /22 (over 1,000 addresses) are cut
 * down to the /24 around this phone; broadcast announcements cover the rest.
 */
export function subnetHosts(ownIp: string, prefix = 24): string[] {
  const parts = ownIp.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p)) || ownIp === '0.0.0.0') return [];
  const bits = Math.min(30, Math.max(22, prefix));
  const size = 2 ** (32 - bits);
  const base = Math.floor(toInt(ownIp) / size) * size;
  const hosts: string[] = [];
  // Skip the network and broadcast addresses.
  for (let i = 1; i < size - 1; i++) hosts.push(toIp(base + i));
  return hosts.filter((ip) => ip !== ownIp);
}

/** Probes these addresses, reporting games as they are found. Stop early with `isCancelled`. */
export async function scanHosts(
  net: NetApi,
  hosts: string[],
  config: Pick<LanConfig, 'port' | 'version'>,
  onFound: (game: FoundGame) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const queue = [...hosts];
  const worker = async () => {
    while (queue.length > 0 && !isCancelled()) {
      const host = queue.shift()!;
      const game = await probe(net, host, config);
      if (game && !isCancelled()) onFound(game);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}
