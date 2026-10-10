// A phone that joined someone else's LAN game. Reconnects by itself if the Wi-Fi blips.

import { onMessages, send, type Conn, type NetApi } from '@gamehub/lan';
import { LAN_PORT, PROTOCOL_VERSION, type Action, type ClientMsg, type HostMsg, type View } from './protocol';

export type ClientStatus = 'connecting' | 'connected' | 'reconnecting';

export type ClientEvents = {
  onView: (view: View) => void;
  onStatus: (status: ClientStatus) => void;
  /** A message about an action that didn't work (the game carries on). */
  onError: (message: string) => void;
  /** The session is over for good: refused, removed, the host ended it, or the host is unreachable. */
  onEnd: (message: string) => void;
};

const RETRY_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 60_000;

export class ClientSession {
  private conn: Conn | null = null;
  private ended = false;
  private joined = false;
  private lostAt: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private net: NetApi,
    readonly host: string,
    private id: string,
    private name: string,
    private events: ClientEvents,
    private port = LAN_PORT,
  ) {}

  connect() {
    if (this.ended) return;
    this.events.onStatus(this.joined ? 'reconnecting' : 'connecting');
    const conn = this.net.createConnection({ host: this.host, port: this.port, connectTimeout: 5000 }, () => {
      this.write({ t: 'join', id: this.id, name: this.name, v: PROTOCOL_VERSION });
    });
    this.conn = conn;
    conn.on('error', () => {});
    conn.on('close', () => {
      if (this.conn !== conn) return;
      this.conn = null;
      this.lostConnection();
    });
    onMessages<HostMsg>(conn, (msg) => this.receive(msg));
  }

  act(action: Action) {
    this.write({ t: 'act', action });
  }

  leave() {
    if (this.ended) return;
    this.write({ t: 'leave' });
    this.end(null);
  }

  private receive(msg: HostMsg) {
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

  private write(msg: ClientMsg) {
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
