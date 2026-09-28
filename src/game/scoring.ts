// Points for a round. Shared by the one-phone game (players keyed by name) and LAN games (keyed by id).

/** How a round ended. */
export type Outcome =
  /** The imposter was voted out and missed the word: the regular players win. */
  | 'caught'
  /** Nobody (or the wrong person) was voted out: the imposters win. */
  | 'escaped'
  /** The imposter was voted out but guessed the word: the imposters still win. */
  | 'guessed';

export const POINTS = {
  /** Each regular player, when they catch the imposter. */
  crewWin: 1,
  /** Each regular player who voted for an imposter (LAN games, where votes are known). */
  goodVote: 1,
  /** Each imposter, when the imposters win. */
  imposterWin: 2,
  /** Extra for the imposter who guessed the word after being caught. */
  guessBonus: 1,
};

export const imposterWon = (outcome: Outcome) => outcome !== 'caught';

export function roundPoints(opts: {
  players: readonly string[];
  imposters: readonly string[];
  outcome: Outcome;
  /** The caught imposter who guessed. */
  guesser?: string;
  /** voter -> suspect, when known. */
  votes?: Record<string, string>;
}): Record<string, number> {
  const { players, imposters, outcome, guesser, votes } = opts;
  const points: Record<string, number> = {};
  for (const p of players) {
    let n = 0;
    if (imposters.includes(p)) {
      if (imposterWon(outcome)) n += POINTS.imposterWin;
      if (outcome === 'guessed' && p === guesser) n += POINTS.guessBonus;
    } else {
      if (outcome === 'caught') n += POINTS.crewWin;
      const vote = votes?.[p];
      if (vote && imposters.includes(vote)) n += POINTS.goodVote;
    }
    points[p] = n;
  }
  return points;
}

export function addPoints(scores: Record<string, number>, points: Record<string, number>): Record<string, number> {
  const next = { ...scores };
  for (const [k, n] of Object.entries(points)) next[k] = (next[k] ?? 0) + n;
  return next;
}

const squash = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .trim()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[\s.,!?'"’`\-_/()።፣፤፥፦]/g, '');

/** True when a typed guess is clearly the secret word (in Amharic or English). Close calls are left to the players. */
export function guessMatches(guess: string, word: { am: string; en: string }): boolean {
  const g = squash(guess);
  if (!g) return false;
  return [word.am, word.en].some((w) => w && squash(w) === g);
}
