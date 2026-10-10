// Who Am I? round logic. Pure functions over an immutable Round, so it can be tested on its own.
//
// 1. Every player secretly writes a word.
// 2. The words are dealt out so nobody gets the word they wrote.
// 3. Players take turns holding the phone to their forehead: everyone else sees the word and answers
//    yes/no questions. Guess it and you're placed; the first to guess wins.

import { shuffledIndices, type Rng } from '@gamehub/core';

export const MIN_PLAYERS = 2;
export const MAX_WORD_LENGTH = 40;
/** Points for 1st, 2nd and 3rd to guess their word. */
export const PLACE_POINTS = [3, 2, 1];

export type Theme = { id: string; label: string; emoji: string; example: string };

export const THEMES: Theme[] = [
  { id: 'anything', label: 'Anything', emoji: '✨', example: 'A person, animal, thing or place' },
  { id: 'people', label: 'Famous people', emoji: '⭐', example: 'e.g. Teddy Afro, Haile Gebrselassie' },
  { id: 'animals', label: 'Animals', emoji: '🐾', example: 'e.g. Lion, Gelada baboon' },
  { id: 'food', label: 'Food & drinks', emoji: '🍲', example: 'e.g. Doro wat, Macchiato' },
  { id: 'places', label: 'Places', emoji: '📍', example: 'e.g. Lalibela, Paris' },
  { id: 'things', label: 'Things', emoji: '📦', example: 'e.g. Jebena, Umbrella' },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export type Round = {
  players: string[];
  theme: string;
  /** Order the phone goes round for writing words. */
  writeOrder: number[];
  /** words[i] is the word player i wrote ('' until written). */
  words: string[];
  /** target[i] is the player whose word player i has to guess. Never i itself. Empty until dealt. */
  target: number[];
  /** Order players take turns in. */
  turnOrder: number[];
  /** Index into turnOrder of the player whose turn it is. */
  turn: number;
  /** Players who guessed their word, first to last. */
  solved: number[];
  /** Turns each player has had. */
  turns: number[];
  /** The round is finished: only one player is left guessing, or it was ended early. */
  over: boolean;
};

/** A random permutation where nobody maps to themselves. Needs n >= 2. */
export function derangement(n: number, rng: Rng = Math.random): number[] {
  if (n < 2) throw new Error('A derangement needs at least 2 items.');
  // Rejection sampling: about 1 in e shuffles qualifies, so this takes ~3 tries on average.
  for (;;) {
    const p = shuffledIndices(n, rng);
    if (p.every((v, i) => v !== i)) return p;
  }
}

export function newRound(players: readonly string[], theme: string, rng: Rng = Math.random): Round {
  return {
    players: [...players],
    theme,
    writeOrder: shuffledIndices(players.length, rng),
    words: players.map(() => ''),
    target: [],
    turnOrder: [],
    turn: 0,
    solved: [],
    turns: players.map(() => 0),
    over: false,
  };
}

export const cleanWord = (word: string) => word.trim().replace(/\s+/g, ' ').slice(0, MAX_WORD_LENGTH);

const squash = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[\s.,!?'"’`\-_/()።፣፤፥፦]/g, '');

/** True when a typed guess is clearly the word. Close calls are left to the players. */
export function guessMatches(guess: string, word: string): boolean {
  const g = squash(guess);
  return !!g && g === squash(word);
}

export function writeWord(round: Round, player: number, word: string): Round {
  return { ...round, words: round.words.map((w, i) => (i === player ? cleanWord(word) : w)) };
}

export const allWritten = (round: Round) => round.words.every((w) => w.length > 0);

/** Hands out the words (never your own) and picks who goes first. */
export function dealWords(round: Round, rng: Rng = Math.random): Round {
  return {
    ...round,
    target: derangement(round.players.length, rng),
    turnOrder: shuffledIndices(round.players.length, rng),
    turn: 0,
  };
}

export const currentPlayer = (round: Round) => round.turnOrder[round.turn];
/** The word this player is trying to guess. */
export const wordFor = (round: Round, player: number) => round.words[round.target[player]];
/** Who wrote the word this player is trying to guess. */
export const writerFor = (round: Round, player: number) => round.target[player];
export const stillGuessing = (round: Round) => round.turnOrder.filter((p) => !round.solved.includes(p));

/** Moves to the next player in turn order who hasn't guessed their word yet. */
function advance(round: Round): Round {
  const n = round.turnOrder.length;
  for (let step = 1; step <= n; step++) {
    const turn = (round.turn + step) % n;
    if (!round.solved.includes(round.turnOrder[turn])) return { ...round, turn };
  }
  return round;
}

const countTurn = (round: Round, player: number) => round.turns.map((t, i) => (i === player ? t + 1 : t));

/** The current player guessed their word. The round ends when only one player is left guessing. */
export function guessed(round: Round): Round {
  if (round.over) return round;
  const player = currentPlayer(round);
  const next: Round = { ...round, solved: [...round.solved, player], turns: countTurn(round, player) };
  if (stillGuessing(next).length <= 1) return { ...next, over: true };
  return advance(next);
}

/** The current player's turn ends without guessing. */
export function passTurn(round: Round): Round {
  if (round.over) return round;
  return advance({ ...round, turns: countTurn(round, currentPlayer(round)) });
}

export const endRound = (round: Round): Round => ({ ...round, over: true });

export type Placing = {
  player: number;
  name: string;
  /** 1 = first to guess. Null if they never got it. */
  place: number | null;
  word: string;
  writer: string;
  turns: number;
  points: number;
};

/** Everyone in finishing order: those who guessed first, then the ones who didn't. */
export function placings(round: Round): Placing[] {
  const row = (player: number, place: number | null): Placing => ({
    player,
    name: round.players[player],
    place,
    word: wordFor(round, player),
    writer: round.players[writerFor(round, player)],
    turns: round.turns[player],
    points: place === null ? 0 : (PLACE_POINTS[place - 1] ?? 0),
  });
  return [...round.solved.map((p, i) => row(p, i + 1)), ...stillGuessing(round).map((p) => row(p, null))];
}

/** Points earned this round, keyed by player name. */
export function roundPoints(round: Round): Record<string, number> {
  return Object.fromEntries(placings(round).map((p) => [p.name, p.points]));
}
