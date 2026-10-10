import { shuffledIndices, type Rng } from '@gamehub/core';
import type { Word } from '../data/words';

export const MIN_PLAYERS = 3;
export const RECENT_LIMIT = 20;

export function maxImposters(playerCount: number): number {
  return playerCount >= 6 ? 2 : 1;
}

/** Random word from the pool, avoiding recently used ones when possible. */
export function pickWord(pool: readonly Word[], recentIds: readonly string[], rng: Rng = Math.random): Word | null {
  if (pool.length === 0) return null;
  const recent = new Set(recentIds);
  const fresh = pool.filter((w) => !recent.has(w.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

/** Indices of the players who are imposters. */
export function assignImposters(playerCount: number, imposterCount: number, rng: Rng = Math.random): number[] {
  const count = Math.max(1, Math.min(imposterCount, maxImposters(playerCount)));
  const order = shuffledIndices(playerCount, rng);
  return order.slice(0, count).sort((a, b) => a - b);
}

/** Order players give clues in: a plain shuffle, so everyone (imposters included) is equally likely to go first. */
export function speakingOrder(playerCount: number, rng: Rng = Math.random): number[] {
  return shuffledIndices(playerCount, rng);
}

export function pushRecent(recentIds: readonly string[], id: string): string[] {
  return [id, ...recentIds.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
}
