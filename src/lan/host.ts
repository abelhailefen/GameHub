// Runs the LAN game on the host phone: a TCP server that relays players' actions to the Engine
// and sends every phone its own View after each change.

import type { Engine } from './engine';
import { errorMessage, onMessages, send, type Conn, type NetApi, type ServerLike } from './net';
import { LAN_PORT, PROTOCOL_VERSION, type Action, type ClientMsg, type HostMsg, type View } from './protocol';

export class HostSession {
  private server: ServerLike | null = null;
  /** Open connections and the player each one belongs to (null until it joins). */
  private conns = new Map<Conn, string | null>();
  private closed = false;

  constructor(
    private net: NetApi,
    readonly engine: Engine,
    private hostName: string,
    /** Called with the host's own view whenever anything changes. */
    private onChange: (view: View) => void,
    private port = LAN_PORT,
  ) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.net.createServer((conn) => this.accept(conn));
      server.on('error', (e) => {
        if (!this.server) reject(new Error(`Couldn't start the game on this phone: ${errorMessage(e)}`));
      });
      server.listen({ port: this.port, host: '0.0.0.0', reuseAddress: true }, () => {
        this.server = server;
        resolve();
        this.broadcast();
      });
    });
  }

  /** The host's own actions (the host is a player too). Returns an error message, or null. */
  act(action: Action): string | null {
    const error = this.engine.handle(this.engine.hostId, action, Date.now());
    this.broadcast();
    return error;
  }

  /** Re-send everyone's view, e.g. after the host changed a setting. */
  refresh() {
    this.broadcast();
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    for (const conn of this.conns.keys()) {
      send(conn, { t: 'closed' } satisfies HostMsg);
      conn.destroy();
    }
    this.conns.clear();
    this.server?.close();
    this.server = null;
  }

  private accept(conn: Conn) {
    if (this.closed) {
      conn.destroy();
      return;
    }
    this.conns.set(conn, null);
    conn.on('error', () => {});
    conn.on('close', () => {
      const id = this.conns.get(conn);
      this.conns.delete(conn);
      // Only mark them gone if they haven't already reconnected on a new socket.
      if (id && ![...this.conns.values()].includes(id)) {
        this.engine.disconnect(id);
        this.broadcast();
      }
    });
    onMessages<ClientMsg>(conn, (msg) => this.receive(conn, msg));
  }

  private receive(conn: Conn, msg: ClientMsg) {
    const id = this.conns.get(conn) ?? null;
    switch (msg.t) {
      case 'hello':
        send(conn, {
          t: 'info',
          name: this.hostName,
          players: this.engine.seats.length,
          phase: this.engine.phase,
          v: PROTOCOL_VERSION,
        } satisfies HostMsg);
        return;

      case 'join': {
        if (msg.v !== PROTOCOL_VERSION) {
          this.reject(conn, 'This phone and the host have different versions of the app. Update both to the same version.');
          return;
        }
        if (typeof msg.id !== 'string' || !msg.id || msg.id === this.engine.hostId) {
          this.reject(conn, 'Could not join this game.');
          return;
        }
        const error = this.engine.join(msg.id, String(msg.name ?? ''));
        if (error) {
          this.reject(conn, error);
          return;
        }
        // A rejoin replaces the old socket for the same player.
        for (const [other, otherId] of this.conns) {
          if (other !== conn && otherId === msg.id) {
            this.conns.delete(other);
            other.destroy();
          }
        }
        this.conns.set(conn, msg.id);
        this.broadcast();
        return;
      }

      case 'act': {
        if (!id || !msg.action) return;
        const error = this.engine.handle(id, msg.action, Date.now());
        if (error) send(conn, { t: 'error', message: error } satisfies HostMsg);
        this.broadcast();
        return;
      }

      case 'leave':
        if (!id) return;
        this.conns.delete(conn);
        this.engine.leave(id);
        conn.destroy();
        this.broadcast();
        return;
    }
  }

  private reject(conn: Conn, message: string) {
    send(conn, { t: 'rejected', message } satisfies HostMsg);
    this.conns.delete(conn);
    setTimeout(() => conn.destroy(), 300);
  }

  private broadcast() {
    if (this.closed) return;
    const now = Date.now();
    const seated = new Set(this.engine.seats.map((s) => s.id));
    for (const [conn, id] of this.conns) {
      if (!id) continue;
      if (!seated.has(id)) {
        // The host removed this player.
        send(conn, { t: 'kicked' } satisfies HostMsg);
        this.conns.delete(conn);
        setTimeout(() => conn.destroy(), 300);
        continue;
      }
      send(conn, { t: 'view', view: this.engine.viewFor(id, now) } satisfies HostMsg);
    }
    this.onChange(this.engine.viewFor(this.engine.hostId, now));
  }
}
