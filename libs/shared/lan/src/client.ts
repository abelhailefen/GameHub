// A phone that joined someone else's Wi-Fi game. Reconnects by itself if the Wi-Fi blips.

import { onMessages, send, type Conn, type NetApi } from './net';
import type { ClientMsg, HostMsg, LanConfig } from './protocol';

export type ClientStatus = 'connecting' | 'connected' | 'reconnecting';

export type ClientEvents<V> = {
  onView: (view: V) => void;
  onStatus: (status: ClientStatus) => void;
  /** A message about an action that didn't work (the game carries on). */
  onError: (message: string) => void;
  /** The session is over for good: refused, removed, the host ended it, or the host is unreachable. */
  onEnd: (message: string) => void;
};

const RETRY_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 60_000;

export class ClientSession<A, V> {
  private conn: Conn | null = null;
  private ended = false;
  private joined = false;
  private lostAt: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private net: NetApi,
    private config: LanConfig,
    readonly host: string,
    private id: string,
    private name: string,
    private events: ClientEvents<V>,
  ) {}

  connect() {
    if (this.ended) return;
    this.events.onStatus(this.joined ? 'reconnecting' : 'connecting');
    const conn = this.net.createConnection({ host: this.host, port: this.config.port, connectTimeout: 5000 }, () => {
      this.write({ t: 'join', id: this.id, name: this.name, v: this.config.version });
    });
    this.conn = conn;
    conn.on('error', () => {});
    conn.on('close', () => {
      if (this.conn !== conn) return;
      this.conn = null;
      this.lostConnection();
    });
    onMessages<HostMsg<V>>(conn, (msg) => this.receive(msg));
  }

  act(action: A) {
    this.write({ t: 'act', action });
  }

  leave() {
    if (this.ended) return;
    this.write({ t: 'leave' });
    this.end(null);
  }

  private receive(msg: HostMsg<V>) {
    switch (msg.t) {
      case 'view':
        this.joined = true;
        this.lostAt = null;
        this.events.onStatus('connected');
        this.events.onView(msg.view);
        return;
      case 'error':
        this.events.onError(msg.message);
        return;
      case 'rejected':
        this.end(msg.message);
        return;
      case 'kicked':
        this.end('The host removed you from the game.');
        return;
      case 'closed':
        this.end('The host ended the game.');
        return;
    }
  }

  private lostConnection() {
    if (this.ended) return;
    if (!this.joined) {
      this.end("Couldn't connect to that game. Make sure you're on the same Wi-Fi or hotspot as the host.");
      return;
    }
    const now = Date.now();
    this.lostAt ??= now;
    if (now - this.lostAt > GIVE_UP_AFTER_MS) {
      this.end('Lost connection to the host.');
      return;
    }
    this.events.onStatus('reconnecting');
    this.retryTimer = setTimeout(() => this.connect(), RETRY_EVERY_MS);
  }

  private write(msg: ClientMsg<A>) {
    if (this.conn) send(this.conn, msg);
  }

  private end(message: string | null) {
    if (this.ended) return;
    this.ended = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const conn = this.conn;
    this.conn = null;
    // Give a final message (e.g. "leave") a moment to go out before closing.
    if (conn) setTimeout(() => conn.destroy(), 200);
    if (message !== null) this.events.onEnd(message);
  }
}
