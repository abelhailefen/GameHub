// What Who Am I? sends over Wi-Fi. The transport and session messages are shared (@gamehub/lan);
// this file has the game's own actions and the View each phone gets. A phone never receives the
// word its own player is trying to guess until they've guessed it.

import type { LanConfig, LanPlayer } from '@gamehub/lan';
import type { Settings } from '../store';

export type { LanPlayer };

/** Its own ports, so Imposter and Who Am I? hosts never show up in each other's game lists. */
export const WHO_AM_I_LAN: LanConfig = { game: 'who-am-i', port: 47810, beaconPort: 47811, version: 1 };

/**
 * lobby  -> players join, the host picks settings
 * write  -> everyone writes a word for the player they were dealt
 * play   -> turns: the player whose turn it is asks yes/no questions about their word
 * result -> who guessed what, and points
 */
export type Phase = 'lobby' | 'write' | 'play' | 'result';

export type LanSettings = Settings;

export type Placing = {
  id: string;
  /** 1 = first to guess. Null if they never got it. */
  place: number | null;
  word: string;
  /** Who wrote this player's word. */
  writer: string;
  turns: number;
  points: number;
};

export type RoundResult = {
  /** Everyone in finishing order: those who guessed first, then the ones who didn't. */
  placings: Placing[];
  /** Points each player earned this round. */
  points: Record<string, number>;
};

export type View = {
  phase: Phase;
  youId: string;
  hostId: string;
  players: LanPlayer[];
  settings: LanSettings;
  /** Rounds started in this game. */
  round: number;
  /** Theme id of the current round. */
  theme: string;
  /** Ids of the players dealt into the current round. */
  inRound: string[];

  // write phase
  /** The player this phone writes a word for. */
  writeFor?: string;
  /** The word this phone wrote (it can be changed until everyone is done). */
  yourWord?: string;
  /** Players who have written their word. */
  written: string[];

  // play phase
  turnOrder: string[];
  /** Whose turn it is. */
  current?: string;
  /** Changes every turn. Turn actions carry it, so a late tap can't land on the next player's turn. */
  turn: number;
  /** Players who guessed their word, first to last. */
  solved: string[];
  /** Turns each player has had. */
  turns: Record<string, number>;
  /** Player id -> the word they're guessing. Leaves out this phone's own word until it is guessed. */
  words: Record<string, string>;
  /** A guess the current player typed, waiting for the others to say if it's right. */
  guess?: string;
  /** Milliseconds left on the turn timer when this view was sent. */
  timerMs?: number;

  result?: RoundResult;
  /** Total points per player id, across the rounds played in this game. */
  scores: Record<string, number>;
};

/** Things a player can do. Host-only actions are ignored when sent by anyone else. */
export type Action =
  | { t: 'write'; word: string }
  // the player whose turn it is
  | { t: 'guess'; turn: number; text: string }
  // anyone who can see the word: they said it out loud, or their typed guess was right
  | { t: 'gotIt'; turn: number }
  // anyone who can see the word: the typed guess was wrong
  | { t: 'wrong'; turn: number }
  // anyone in the round, including the player whose turn it is
  | { t: 'turnOver'; turn: number }
  // host only
  | { t: 'start' }
  | { t: 'end' }
  | { t: 'lobby' }
  | { t: 'kick'; id: string }
  | { t: 'resetScores' };
