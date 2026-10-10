/** Adds a round's points onto the running totals. */
export function addPoints(scores: Record<string, number>, points: Record<string, number>): Record<string, number> {
  const next = { ...scores };
  for (const [k, n] of Object.entries(points)) next[k] = (next[k] ?? 0) + n;
  return next;
}
