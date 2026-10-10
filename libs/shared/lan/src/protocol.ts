// Messages between the host phone and the other phones in a Wi-Fi game.
// One JSON object per line over TCP. The host is the only source of truth: players send
// actions, the host answers each phone with its own View (so secrets only reach who may see them).
// Games choose their own Action and View types; everything else here is shared.

/** Identifies one game's Wi-Fi traffic. Each game uses its own ports, so hosts of different games never find each other. */
export type LanConfig = {
  /** Tag in the host's UDP announcement, e.g. "imposter". */
  game: string;
  /** TCP port the host listens on. */
  port: number;
  /** UDP port hosts broadcast their "I'm hosting" announcement on. */
  beaconPort: number;
  /** Bump when the game's messages change; phones on different versions refuse each other. */
  version: number;
};

export type LanPlayer = { id: string; name: string; connected: boolean; isHost: boolean };

/** What a host says about itself to a phone looking for games. */
export type GameInfo = { name: string; players: number; phase: string; v: number };

export type Beacon = { t: string; v: number; port: number };

export type ClientMsg<A> =
  | { t: 'hello' }
  | { t: 'join'; id: string; name: string; v: number }
  | { t: 'act'; action: A }
  | { t: 'leave' };

export type HostMsg<V> =
  | ({ t: 'info' } & GameInfo)
  | { t: 'view'; view: V }
  | { t: 'error'; message: string }
  | { t: 'rejected'; message: string }
  | { t: 'kicked' }
  | { t: 'closed' };

/** The host-side game state a HostSession drives. Pure logic, no networking. */
export interface LanEngine<A, V> {
  readonly hostId: string;
  readonly phase: string;
  readonly seats: readonly { id: string }[];
  /** A phone joins, or rejoins after losing its connection. Returns an error message to refuse. */
  join(id: string, name: string): string | null;
  disconnect(id: string): void;
  /** A player left on purpose. */
  leave(id: string): void;
  /** Applies a player's action. Returns an error message to show that player, or null. */
  handle(sender: string, action: A, now: number): string | null;
  /** What one player's phone should show. */
  viewFor(id: string, now: number): V;
}
