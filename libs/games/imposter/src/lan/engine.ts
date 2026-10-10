// The host's game state for a LAN game. Pure logic (no networking) so it can be tested on its own.

import type { Hint } from '../game/hint';
import { MIN_PLAYERS } from '../game/logic';
import { addPoints } from '@gamehub/core';
import { guessMatches, roundPoints, type Outcome } from '../game/scoring';
import type { Action, Card, LanPlayer, LanSettings, Phase, RoundResult, View } from './protocol';

export const MAX_LAN_PLAYERS = 16;

export type Dealt = {
  word: { am: string; en: string };
  /** Category label shown to regular players, e.g. "🍲 Food & Drinks". */
  category: string;
  hint: Hint;
  /** Indices into the player list passed to deal(). */
  imposters: number[];
  speakOrder: number[];
};

/** Deals a round for this many players, or returns an error message. */
export type Deal = (playerCount: number) => Dealt | string;

type Seat = { id: string; name: string; connected: boolean };

export class Engine {
  phase: Phase = 'lobby';
  seats: Seat[];
  round = 0;
  private dealt: Dealt | null = null;
  private roundIds: string[] = [];
  private seen = new Set<string>();
  private votes = new Map<string, string>();
  private timerEndsAt: number | null = null;
  private lastResult: RoundResult | null = null;
  /** The imposter voted out this round, while they get their guess. */
  private guesser: string | null = null;
  private guessText: string | null = null;
  /** Total points per player id, kept across rounds until the host resets them. */
  private scores: Record<string, number> = {};

  constructor(
    readonly hostId: string,
    hostName: string,
    private deal: Deal,
    private settings: () => LanSettings,
  ) {
    this.seats = [{ id: hostId, name: hostName, connected: true }];
  }

  get connectedCount() {
    return this.seats.filter((s) => s.connected).length;
  }

  /** A phone joins, or rejoins after losing its connection. Returns an error message to refuse. */
  join(id: string, rawName: string): string | null {
    const name = rawName.trim().slice(0, 24);
    const existing = this.seats.find((s) => s.id === id);
    if (existing) {
      existing.connected = true;
      return null;
    }
    if (!name) return 'Enter your name first.';
    if (this.phase !== 'lobby' && this.phase !== 'result') {
      return 'This game is in the middle of a round. Try again when the round is over.';
    }
    if (this.seats.length >= MAX_LAN_PLAYERS) return `This game is full (${MAX_LAN_PLAYERS} players).`;
    if (this.seats.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return `Someone called "${name}" is already in this game. Use a different name.`;
    }
    this.seats.push({ id, name, connected: true });
    return null;
  }

  disconnect(id: string) {
    const seat = this.seats.find((s) => s.id === id);
    if (seat && id !== this.hostId) seat.connected = false;
  }

  /** A player left on purpose. Between rounds their seat is freed; mid-round it is kept. */
  leave(id: string) {
    if (id === this.hostId) return;
    if (this.phase === 'lobby' || this.phase === 'result') this.seats = this.seats.filter((s) => s.id !== id);
    else this.disconnect(id);
  }

  private isImposter(id: string) {
    return !!this.dealt && this.dealt.imposters.some((i) => this.roundIds[i] === id);
  }

  /** Applies a player's action. Returns an error message to show that player, or null. */
  handle(sender: string, action: Action, now: number): string | null {
    const isHost = sender === this.hostId;
    const hostOnly = () => (isHost ? null : 'Only the host can do that.');
    const inRound = this.roundIds.includes(sender);

    switch (action.t) {
      case 'seen':
        if (this.phase !== 'reveal' || !inRound) return null;
        this.seen.add(sender);
        if (this.roundIds.every((id) => this.seen.has(id))) this.phase = 'clues';
        return null;

      case 'vote': {
        if (this.phase !== 'vote' || !inRound) return null;
        if (action.target === sender || !this.roundIds.includes(action.target)) return null;
        this.votes.set(sender, action.target);
        return null;
      }

      case 'start': {
        const err = hostOnly();
        if (err) return err;
        if (this.phase !== 'lobby' && this.phase !== 'result') return null;
        const away = this.seats.filter((s) => !s.connected);
        if (away.length > 0) {
          return `${away.map((s) => s.name).join(', ')} ${away.length > 1 ? 'are' : 'is'} disconnected. Wait for them or remove them.`;
        }
        if (this.seats.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
        const dealt = this.deal(this.seats.length);
        if (typeof dealt === 'string') return dealt;
        this.dealt = dealt;
        this.roundIds = this.seats.map((s) => s.id);
        this.seen.clear();
        this.votes.clear();
        this.timerEndsAt = null;
        this.lastResult = null;
        this.guesser = null;
        this.guessText = null;
        this.round++;
        this.phase = 'reveal';
        return null;
      }

      case 'clues':
        if (hostOnly()) return hostOnly();
        if (this.phase === 'reveal') this.phase = 'clues';
        return null;

      case 'discuss': {
        if (hostOnly()) return hostOnly();
        if (this.phase !== 'reveal' && this.phase !== 'clues') return null;
        const minutes = this.settings().timerMinutes;
        this.timerEndsAt = minutes > 0 ? now + minutes * 60_000 : null;
        this.phase = 'discuss';
        return null;
      }

      case 'startVote': {
        if (hostOnly()) return hostOnly();
        if (this.phase !== 'clues' && this.phase !== 'discuss') return null;
        const seconds = this.settings().votingSeconds;
        this.timerEndsAt = seconds > 0 ? now + seconds * 1000 : null;
        this.phase = 'vote';
        return null;
      }

      case 'reveal': {
        if (hostOnly()) return hostOnly();
        if (this.phase !== 'vote' || !this.dealt) return null;
        this.timerEndsAt = null;
        const { mostVoted } = this.tally();
        if (mostVoted.length === 1 && this.isImposter(mostVoted[0])) {
          // Caught: they get one guess at the word before it is shown to them.
          this.guesser = mostVoted[0];
          this.guessText = null;
          this.phase = 'guess';
        } else {
          this.finish('escaped');
        }
        return null;
      }

      case 'guess': {
        if (this.phase !== 'guess' || sender !== this.guesser || this.guessText !== null || !this.dealt) return null;
        const text = String(action.text ?? '').trim().slice(0, 60);
        if (!text) return null;
        this.guessText = text;
        // An exact match settles it; anything else the players who know the word decide.
        if (guessMatches(text, this.dealt.word)) this.finish('guessed');
        return null;
      }

      case 'judge':
        if (this.phase !== 'guess') return null;
        if (!inRound || this.isImposter(sender)) return 'Only the players who know the word can decide.';
        this.finish(action.correct ? 'guessed' : 'caught');
        return null;

      case 'lobby':
        if (hostOnly()) return hostOnly();
        this.phase = 'lobby';
        this.dealt = null;
        this.roundIds = [];
        this.timerEndsAt = null;
        this.lastResult = null;
        this.guesser = null;
        this.guessText = null;
        // People who dropped out while playing are cleared once everyone is back in the lobby.
        this.seats = this.seats.filter((s) => s.connected);
        return null;

      case 'kick':
        if (hostOnly()) return hostOnly();
        if (action.id === this.hostId) return null;
        if (this.phase !== 'lobby' && this.phase !== 'result') return 'You can only remove players between rounds.';
        this.seats = this.seats.filter((s) => s.id !== action.id);
        return null;

      case 'resetScores':
        if (hostOnly()) return hostOnly();
        if (this.phase !== 'lobby' && this.phase !== 'result') return 'You can only reset the scores between rounds.';
        this.scores = {};
        return null;
    }
  }

  private tally() {
    const counts = new Map<string, number>();
    for (const target of this.votes.values()) counts.set(target, (counts.get(target) ?? 0) + 1);
    const max = Math.max(0, ...counts.values());
    const mostVoted = max > 0 ? [...counts].filter(([, n]) => n === max).map(([id]) => id) : [];
    return { mostVoted };
  }

  /** Ends the round: works out the result and adds everyone's points. */
  private finish(outcome: Outcome) {
    const dealt = this.dealt;
    if (!dealt) return;
    const imposters = dealt.imposters.map((i) => this.roundIds[i]);
    const votes = Object.fromEntries(this.votes);
    const { mostVoted } = this.tally();
    const guesser = this.guesser ?? undefined;
    const points = this.settings().scoring ? roundPoints({ players: this.roundIds, imposters, outcome, guesser, votes }) : {};
    this.scores = addPoints(this.scores, points);
    this.lastResult = {
      imposters,
      word: dealt.word,
      hint: dealt.hint,
      votes,
      mostVoted,
      caught: outcome !== 'escaped',
      outcome,
      guesser,
      guess: this.guessText ?? undefined,
      points,
    };
    this.timerEndsAt = null;
    this.phase = 'result';
  }

  private cardFor(id: string): Card | undefined {
    const dealt = this.dealt;
    const index = this.roundIds.indexOf(id);
    if (!dealt || index < 0) return undefined;
    if (dealt.imposters.includes(index)) {
      return { role: 'imposter', hint: dealt.hint, imposterCount: dealt.imposters.length };
    }
    return { role: 'crew', am: dealt.word.am, en: dealt.word.en, category: dealt.category };
  }

  /** What one player's phone should show. */
  viewFor(id: string, now: number): View {
    const players: LanPlayer[] = this.seats.map((s) => ({ ...s, isHost: s.id === this.hostId }));
    // Players who were dealt in but have since left still need a name on the result screen.
    const inPhase = this.phase !== 'lobby';
    return {
      phase: this.phase,
      youId: id,
      hostId: this.hostId,
      players,
      settings: this.settings(),
      round: this.round,
      inRound: inPhase ? this.roundIds : [],
      card: inPhase && this.phase !== 'result' ? this.cardFor(id) : undefined,
      seen: [...this.seen],
      speakOrder: this.dealt && inPhase ? this.dealt.speakOrder.map((i) => this.roundIds[i]) : [],
      timerMs: this.timerEndsAt === null ? undefined : Math.max(0, this.timerEndsAt - now),
      voted: this.phase === 'vote' ? [...this.votes.keys()] : [],
      yourVote: this.phase === 'vote' ? this.votes.get(id) : undefined,
      guessing:
        this.phase === 'guess' && this.guesser ? { imposter: this.guesser, guess: this.guessText ?? undefined } : undefined,
      result: this.phase === 'result' ? (this.lastResult ?? undefined) : undefined,
      scores: this.scores,
    };
  }
}
