// The small slice of a TCP socket API the LAN game needs. react-native-tcp-socket provides it on
// phones, and Node's `net` module matches it too, which is what the tests use.

export interface Conn {
  write(data: string): unknown;
  destroy(): unknown;
  setEncoding?(encoding: 'utf8'): unknown;
  on(event: 'data', cb: (data: string | { toString(): string }) => void): unknown;
  on(event: 'connect' | 'close', cb: () => void): unknown;
  on(event: 'error', cb: (err: unknown) => void): unknown;
}

export interface ServerLike {
  listen(options: { port: number; host?: string; reuseAddress?: boolean }, cb?: () => void): unknown;
  close(): unknown;
  on(event: 'error', cb: (err: unknown) => void): unknown;
}

export interface NetApi {
  createServer(onConnection: (conn: Conn) => void): ServerLike;
  createConnection(options: { host: string; port: number; connectTimeout?: number }, onConnect?: () => void): Conn;
}

/** Splits a socket's stream into JSON messages, one per line. Bad lines are ignored. */
export function onMessages<T>(conn: Conn, handler: (msg: T) => void) {
  let buffer = '';
  conn.setEncoding?.('utf8');
  conn.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString();
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: T;
      try {
        msg = JSON.parse(line) as T;
      } catch {
        continue;
      }
      handler(msg);
    }
    // Nothing legitimate is this large; drop it rather than grow forever.
    if (buffer.length > 1_000_000) buffer = '';
  });
}

export function send(conn: Conn, msg: unknown) {
  try {
    conn.write(JSON.stringify(msg) + '\n');
  } catch {
    // The socket is closing; its close handler cleans up.
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
