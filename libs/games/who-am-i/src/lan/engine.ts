// The host's game state for a Wi-Fi game. Pure logic (no networking) so it can be tested on its own.
// The round itself runs on the same functions as pass-and-play (../logic); this adds seats, phases,
// the turn timer and who may do what.

import { addPoints, type Rng } from '@gamehub/core';
import type { LanEngine } from '@gamehub/lan';
import {
  allWritten,
  cleanWord,
  currentPlayer,
  dealWords,
  endRound,
  guessed,
  guessMatches,
  MIN_PLAYERS,
  newRound,
  passTurn,
  placings,
  wordFor,
  writeWord,
  writerFor,
  type Round,
} from '../logic';
import type { Action, LanPlayer, LanSettings, Phase, RoundResult, View } from './protocol';

export const MAX_LAN_PLAYERS = 16;
const MAX_GUESS_LENGTH = 60;

type Seat = { id: string; name: string; connected: boolean };

export class Engine implements LanEngine<Action, View> {
  phase: Phase = 'lobby';
  seats: Seat[];
  round = 0;
  /** The current round, by index into roundIds. */
  private game: Round | null = null;
  private roundIds: string[] = [];
  private turnSeq = 0;
  private guessText: string | null = null;
  private timerEndsAt: number | null = null;
  private lastResult: RoundResult | null = null;
  /** Total points per player id, kept across rounds until the host resets them. */
  private scores: Record<string, number> = {};

  constructor(
    readonly hostId: string,
    hostName: string,
    private settings: () => LanSettings,
    private rng: Rng = Math.random,
  ) {
    this.seats = [{ id: hostId, name: hostName, connected: true }];
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

  /** Applies a player's action. Returns an error message to show that player, or null. */
  handle(sender: string, action: Action, now: number): string | null {
    const isHost = sender === this.hostId;
    const hostOnly = () => (isHost ? null : 'Only the host can do that.');
    const me = this.roundIds.indexOf(sender);
    const game = this.game;

    switch (action.t) {
      case 'write': {
        if (this.phase !== 'write' || !game || me < 0) return null;
        const word = cleanWord(String(action.word ?? ''));
        if (!word) return null;
        this.game = writeWord(game, me, word);
        if (allWritten(this.game)) {
          this.phase = 'play';
          this.startTurn(now);
        }
        return null;
      }

      case 'guess': {
        if (!this.isTurn(action.turn) || !game || me !== currentPlayer(game) || this.guessText !== null) return null;
        const text = String(action.text ?? '').trim().slice(0, MAX_GUESS_LENGTH);
        if (!text) return null;
        // An exact match settles it; anything else the players who can see the word decide.
        if (guessMatches(text, wordFor(game, me))) this.solve(now);
        else this.guessText = text;
        return null;
      }

      case 'gotIt':
        if (!this.isTurn(action.turn) || !game) return null;
        if (me < 0 || me === currentPlayer(game)) return 'Only the players who can see the word can say it was right.';
        this.solve(now);
        return null;

      case 'wrong':
        if (!this.isTurn(action.turn) || !game || me < 0 || me === currentPlayer(game)) return null;
        this.guessText = null;
        return null;

      case 'turnOver':
        if (!this.isTurn(action.turn) || !game || (me < 0 && !isHost)) return null;
        this.game = passTurn(game);
        this.startTurn(now);
        return null;

      case 'start': {
        const err = hostOnly();
        if (err) return err;
        if (this.phase !== 'lobby' && this.phase !== 'result') return null;
        const away = this.seats.filter((s) => !s.connected);
        if (away.length > 0) {
          return `${away.map((s) => s.name).join(', ')} ${away.length > 1 ? 'are' : 'is'} disconnected. Wait for them or remove them.`;
        }
        if (this.seats.length < MIN_PLAYERS) return `You need at least ${MIN_PLAYERS} players.`;
        this.roundIds = this.seats.map((s) => s.id);
        // Words are dealt before they're written, so everyone knows who they're writing for.
        this.game = dealWords(newRound(this.seats.map((s) => s.name), this.settings().theme, this.rng), this.rng);
        this.guessText = null;
        this.timerEndsAt = null;
        this.lastResult = null;
        this.round++;
        this.phase = 'write';
        return null;
      }

      case 'end':
        if (hostOnly()) return hostOnly();
        if (this.phase === 'play' && game) this.finish(endRound(game));
        return null;

      case 'lobby':
        if (hostOnly()) return hostOnly();
        this.phase = 'lobby';
        this.game = null;
        this.roundIds = [];
        this.guessText = null;
        this.timerEndsAt = null;
        this.lastResult = null;
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

  /** A turn action counts only during play and only for the turn it was sent in. */
  private isTurn(turn: number) {
    return this.phase === 'play' && turn === this.turnSeq;
  }

  private startTurn(now: number) {
    this.turnSeq++;
    this.guessText = null;
    const seconds = this.settings().turnSeconds;
    this.timerEndsAt = seconds > 0 ? now + seconds * 1000 : null;
  }

  /** The player whose turn it is guessed their word. */
  private solve(now: number) {
    if (!this.game) return;
    const next = guessed(this.game);
    if (next.over) this.finish(next);
    else {
      this.game = next;
      this.startTurn(now);
    }
  }

  /** Ends the round: works out the placings and adds everyone's points. */
  private finish(game: Round) {
    const ids = this.roundIds;
    const rows = placings(game).map((p) => ({
      id: ids[p.player],
      place: p.place,
      word: p.word,
      writer: ids[writerFor(game, p.player)],
      turns: p.turns,
      points: p.points,
    }));
    const points = this.settings().scoring ? Object.fromEntries(rows.map((r) => [r.id, r.points])) : {};
    this.scores = addPoints(this.scores, points);
    this.lastResult = { placings: rows, points };
    this.game = { ...game, over: true };
    this.guessText = null;
    this.timerEndsAt = null;
    this.phase = 'result';
  }

  /** What one player's phone should show. */
  viewFor(id: string, now: number): View {
    const game = this.game;
    const ids = this.roundIds;
    const me = ids.indexOf(id);
    const players: LanPlayer[] = this.seats.map((s) => ({ ...s, isHost: s.id === this.hostId }));
    const writing = this.phase === 'write' && !!game;
    const playing = this.phase === 'play' && !!game;

    // Every word but your own, until you've guessed it.
    const words: Record<string, string> = {};
    if (playing) {
      ids.forEach((pid, i) => {
        if (i !== me || game.solved.includes(i)) words[pid] = wordFor(game, i);
      });
    }

    return {
      phase: this.phase,
      youId: id,
      hostId: this.hostId,
      players,
      settings: this.settings(),
      round: this.round,
      theme: game?.theme ?? this.settings().theme,
      inRound: this.phase === 'lobby' ? [] : ids,
      writeFor: writing && me >= 0 ? ids[game.target.indexOf(me)] : undefined,
      yourWord: writing && me >= 0 ? game.words[me] || undefined : undefined,
      written: writing ? ids.filter((_, i) => game.words[i]) : [],
      turnOrder: game && this.phase !== 'lobby' ? game.turnOrder.map((i) => ids[i]) : [],
      current: playing ? ids[currentPlayer(game)] : undefined,
      turn: this.turnSeq,
      solved: game && this.phase !== 'lobby' ? game.solved.map((i) => ids[i]) : [],
      turns: game ? Object.fromEntries(ids.map((pid, i) => [pid, game.turns[i]])) : {},
      words,
      guess: playing ? (this.guessText ?? undefined) : undefined,
      timerMs: this.timerEndsAt === null ? undefined : Math.max(0, this.timerEndsAt - now),
      result: this.phase === 'result' ? (this.lastResult ?? undefined) : undefined,
      scores: this.scores,
    };
  }
}
