/**
 * What the hub needs to know to list a game. Each game library exports one of these.
 * `route` must match the folder the game's screens are mounted under in apps/gamehub/app.
 */
export type GameMeta = {
  id: string;
  title: string;
  /** Amharic title, shown under the English one. */
  titleAm?: string;
  emoji: string;
  /** One line on the hub card. */
  tagline: string;
  /** e.g. "3–16 players". */
  players: string;
  /** Card accent colour. */
  accent: string;
  route: `/${string}`;
};
