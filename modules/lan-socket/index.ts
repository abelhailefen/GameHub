// JS side of the LanSocket native module, shaped like the NetApi the LAN game code expects.

import { NativeModule, requireNativeModule } from 'expo-modules-core';
import type { Conn, NetApi, ServerLike } from '../../src/lan/net';

type Events = {
  onConnection(e: { serverId: number; id: number }): void;
  onConnect(e: { id: number }): void;
  onData(e: { id: number; data: string }): void;
  onClose(e: { id: number }): void;
  onBeacon(e: { address: string; data: string }): void;
};

export type NetAddress = { name: string; address: string; prefix: number };

declare class LanSocketModule extends NativeModule<Events> {
  listen(port: number): Promise<number>;
  closeServer(serverId: number): void;
  connect(host: string, port: number, timeoutMs: number): number;
  write(id: number, data: string): void;
  close(id: number): void;
  addresses(): NetAddress[];
  startBeacon(port: number, message: string): void;
  stopBeacon(): void;
  startDiscovery(port: number): void;
  stopDiscovery(): void;
}

const Native = requireNativeModule<LanSocketModule>('LanSocket');

type Handlers = {
  data: ((d: string) => void)[];
  connect: (() => void)[];
  close: (() => void)[];
  error: ((e: unknown) => void)[];
};

const sockets = new Map<number, NativeConn>();
const servers = new Map<number, (conn: Conn) => void>();

class NativeConn implements Conn {
  private handlers: Handlers = { data: [], connect: [], close: [], error: [] };
  private closed = false;

  constructor(readonly id: number) {
    sockets.set(id, this);
  }

  write(data: string) {
    if (!this.closed) Native.write(this.id, data);
  }

  destroy() {
    if (!this.closed) Native.close(this.id);
  }

  on(event: 'data', cb: (data: string) => void): void;
  on(event: 'connect' | 'close', cb: () => void): void;
  on(event: 'error', cb: (err: unknown) => void): void;
  on(event: keyof Handlers, cb: (arg: never) => void) {
    (this.handlers[event] as ((arg: never) => void)[]).push(cb);
  }

  emitData(data: string) {
    for (const h of this.handlers.data) h(data);
  }

  emitConnect() {
    for (const h of this.handlers.connect) h();
  }

  emitClose() {
    if (this.closed) return;
    this.closed = true;
    sockets.delete(this.id);
    for (const h of this.handlers.close) h();
  }
}

Native.addListener('onConnection', ({ serverId, id }) => {
  const onConnection = servers.get(serverId);
  if (onConnection) onConnection(new NativeConn(id));
  else Native.close(id);
});
Native.addListener('onConnect', ({ id }) => sockets.get(id)?.emitConnect());
Native.addListener('onData', ({ id, data }) => sockets.get(id)?.emitData(data));
Native.addListener('onClose', ({ id }) => sockets.get(id)?.emitClose());

export const lanSocket: NetApi = {
  createServer(onConnection) {
    let serverId: number | null = null;
    let closed = false;
    const errorHandlers: ((e: unknown) => void)[] = [];
    const server: ServerLike = {
      listen({ port }, cb) {
        Native.listen(port)
          .then((id) => {
            if (closed) {
              Native.closeServer(id);
              return;
            }
            serverId = id;
            servers.set(id, onConnection);
            cb?.();
          })
          .catch((e: unknown) => errorHandlers.forEach((h) => h(e)));
      },
      close() {
        closed = true;
        if (serverId !== null) {
          servers.delete(serverId);
          Native.closeServer(serverId);
        }
      },
      on(_event, cb) {
        errorHandlers.push(cb);
      },
    };
    return server;
  },

  createConnection({ host, port, connectTimeout = 5000 }, onConnect) {
    const conn = new NativeConn(Native.connect(host, port, connectTimeout));
    if (onConnect) conn.on('connect', onConnect);
    return conn;
  },
};

/** Mobile data, VPN and tunnel interfaces: never where the other phones are. */
const NOT_LOCAL_WIFI = /^(rmnet|ccmni|pdp|v4-|clat|dummy|tun|ppp|ims|ipsec)/;

/** This phone's IPv4 addresses on Wi-Fi / hotspot interfaces. */
export function localAddresses(): NetAddress[] {
  try {
    return Native.addresses().filter(
      (a) => a.address && !a.address.startsWith('127.') && !NOT_LOCAL_WIFI.test(a.name),
    );
  } catch {
    return [];
  }
}

/** Host: announce the game on the network until stopped. */
export function startBeacon(port: number, message: string): () => void {
  Native.startBeacon(port, message);
  return () => Native.stopBeacon();
}

/** Joining phone: hear hosts' announcements. Returns a function that stops listening. */
export function listenForBeacons(port: number, onBeacon: (address: string, data: string) => void): () => void {
  const sub = Native.addListener('onBeacon', ({ address, data }) => onBeacon(address, data));
  try {
    Native.startDiscovery(port);
  } catch {
    // Port busy or no network: subnet scanning still works.
  }
  return () => {
    sub.remove();
    Native.stopDiscovery();
  };
}
