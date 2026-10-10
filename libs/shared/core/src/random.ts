export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 0..n-1 in random order. */
export const shuffledIndices = (n: number, rng: Rng = Math.random) =>
  shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );

/** Short random id, e.g. "w-lx3k9a-4f2c1". */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
