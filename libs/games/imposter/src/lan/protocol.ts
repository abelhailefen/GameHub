// What the Imposter game sends over Wi-Fi. The transport and session messages are shared
// (@gamehub/lan); this file has the game's own actions and the View each phone gets (each phone
// only ever receives its own card).

import type { LanConfig, LanPlayer } from '@gamehub/lan';
import type { Hint, HintMode } from '../game/hint';
import type { Outcome } from '../game/scoring';

export type { LanPlayer };

export const IMPOSTER_LAN: LanConfig = { game: 'imposter', port: 47800, beaconPort: 47801, version: 2 };

/** 'guess': the imposter was voted out and gets one guess at the word before anything is revealed. */
export type Phase = 'lobby' | 'reveal' | 'clues' | 'discuss' | 'vote' | 'guess' | 'result';

export type LanSettings = {
  imposterCount: number;
  hintMode: HintMode;
  timerMinutes: number;
  votingSeconds: number;
  /** Award points and show the leaderboard. */
  scoring: boolean;
};

export type Card =
  | { role: 'crew'; am: string; en: string; category: string }
  | { role: 'imposter'; hint: Hint; imposterCount: number };

export type RoundResult = {
  imposters: string[];
  word: { am: string; en: string };
  hint: Hint;
  /** voter id -> suspect id */
  votes: Record<string, string>;
  /** Players with the most votes (more than one on a tie). */
  mostVoted: string[];
  /** One player got the most votes and they are an imposter. */
  caught: boolean;
  outcome: Outcome;
  /** The caught imposter who got to guess, and what they guessed (if they typed it). */
  guesser?: string;
  guess?: string;
  /** Points each player earned this round. */
  points: Record<string, number>;
};

/** The guess phase. Only says who was caught; the word is never in an imposter's view before the result. */
export type Guessing = {
  imposter: string;
  guess?: string;
};

export type View = {
  phase: Phase;
  youId: string;
  hostId: string;
  players: LanPlayer[];
  settings: LanSettings;
  round: number;
  /** Ids of the players dealt into the current round. */
  inRound: string[];
  /** This phone's card; only present for players in the round. */
  card?: Card;
  seen: string[];
  speakOrder: string[];
  /** Milliseconds left on the discussion or voting timer when this view was sent. */
  timerMs?: number;
  voted: string[];
  yourVote?: string;
  guessing?: Guessing;
  result?: RoundResult;
  /** Total points per player id, across the rounds played in this game. */
  scores: Record<string, number>;
};

/** Things a player can do. Host-only actions are ignored when sent by anyone else. */
export type Action =
  | { t: 'seen' }
  | { t: 'vote'; target: string }
  // the caught imposter
  | { t: 'guess'; text: string }
  // a regular player (they know the word): was the guess right?
  | { t: 'judge'; correct: boolean }
  // host only
  | { t: 'start' }
  | { t: 'clues' }
  | { t: 'discuss' }
  | { t: 'startVote' }
  | { t: 'reveal' }
  | { t: 'lobby' }
  | { t: 'kick'; id: string }
  | { t: 'resetScores' };
