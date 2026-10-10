// Messages between the host phone and the other phones in a LAN game.
// One JSON object per line over TCP. The host is the only source of truth: players send
// actions, the host answers with a personal View (each phone only ever receives its own card).

import type { Hint, HintMode } from '../game/hint';
import type { Outcome } from '../game/scoring';

export const LAN_PORT = 47800;
/** UDP port hosts broadcast their "I'm hosting" announcement on. */
export const BEACON_PORT = 47801;
export const PROTOCOL_VERSION = 2;

/** 'guess': the imposter was voted out and gets one guess at the word before anything is revealed. */
export type Phase = 'lobby' | 'reveal' | 'clues' | 'discuss' | 'vote' | 'guess' | 'result';

export type LanPlayer = { id: string; name: string; connected: boolean; isHost: boolean };

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

export type ClientMsg =
  | { t: 'hello' }
  | { t: 'join'; id: string; name: string; v: number }
  | { t: 'act'; action: Action }
  | { t: 'leave' };

export type Beacon = { t: 'imposter'; v: number; port: number };

export type GameInfo = { name: string; players: number; phase: Phase; v: number };

export type HostMsg =
  | ({ t: 'info' } & GameInfo)
  | { t: 'view'; view: View }
  | { t: 'error'; message: string }
  | { t: 'rejected'; message: string }
  | { t: 'kicked' }
  | { t: 'closed' };
