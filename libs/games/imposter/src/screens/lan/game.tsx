import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GameOptions } from '../../components/GameOptions';
import { Am, Button, colors, EndGameButton, Leaderboard, radius, Screen, SectionTitle, SlideToReveal, spacing, WordCard } from '@gamehub/ui';
import { useLan } from '../../context/LanContext';
import { useGameBackButton } from '../../game/exit';
import { HINT_MODES } from '../../game/hint';
import { MIN_PLAYERS } from '../../game/logic';
import type { Card, View as GameView } from '../../lan/protocol';

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Counts down locally from the time left the host last reported. Buzzes once at zero. */
function useTimer(view: GameView | null) {
  const endsAt = useRef<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const buzzed = useRef(false);

  useEffect(() => {
    if (view?.timerMs === undefined) {
      endsAt.current = null;
      setLeft(null);
      return;
    }
    endsAt.current = Date.now() + view.timerMs;
    buzzed.current = view.timerMs <= 0;
    setLeft(view.timerMs);
  }, [view]);

  useEffect(() => {
    const id = setInterval(() => {
      if (endsAt.current === null) return;
      const ms = Math.max(0, endsAt.current - Date.now());
      setLeft(ms);
      if (ms === 0 && !buzzed.current) {
        buzzed.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  return left;
}

function Timer({ left }: { left: number | null }) {
  if (left === null) return null;
  return (
    <View style={styles.timerBox}>
      <Text style={[styles.timer, left === 0 && { color: colors.red }]}>{left === 0 ? "Time's up!" : fmt(left)}</Text>
    </View>
  );
}

function CardFace({ card }: { card: Card }) {
  if (card.role === 'imposter') {
    return (
      <View style={styles.center}>
        <Text style={styles.roleEmoji}>🕵️</Text>
        <Text style={[styles.roleTitle, { color: colors.red }]}>You are the IMPOSTER</Text>
        <Am style={styles.roleAm}>አስመሳዩ እርስዎ ነዎት</Am>
        {card.imposterCount > 1 ? <Text style={styles.note}>There are {card.imposterCount} imposters this round.</Text> : null}
        <WordCard am={card.hint.am} en={card.hint.en} label={card.hint.label} accent={colors.red} />
        <Text style={styles.note}>Blend in. Don't let them find out you don't know the word!</Text>
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <WordCard am={card.am} en={card.en} label="The secret word · ሚስጥራዊው ቃል" />
      {card.category ? <Am style={styles.note}>Category: {card.category}</Am> : null}
      <Text style={styles.note}>Give clues about it, but don't make it too easy for the imposter.</Text>
    </View>
  );
}

function CardSlider({ card, height, onSeen, prompt }: { card: Card; height?: number; onSeen?: () => void; prompt: string }) {
  return (
    <View style={height ? { height } : { flex: 1 }}>
      <SlideToReveal
        accent={card.role === 'imposter' ? colors.red : colors.green}
        onSeen={onSeen ?? (() => {})}
        cover={
          <View style={styles.center}>
            <View style={styles.grip} />
            <Text style={styles.coverArrow}>⬆</Text>
            <Text style={styles.coverText}>{prompt}</Text>
            <Text style={styles.note}>Don't let anyone see your screen. Let go and it hides again.</Text>
          </View>
        }
      >
        <CardFace card={card} />
      </SlideToReveal>
    </View>
  );
}

function OrderChips({ ids, name }: { ids: string[]; name: (id: string) => string }) {
  return (
    <View style={styles.order}>
      {ids.map((id, i) => (
        <View key={id} style={[styles.orderChip, i === 0 && styles.orderChipFirst]}>
          <Text style={[styles.orderNum, i === 0 && { color: colors.bg }]}>{i + 1}</Text>
          <Text style={[styles.orderName, i === 0 && { color: colors.bg }]}>{name(id)}</Text>
        </View>
      ))}
    </View>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <View style={styles.waiting}>
      <ActivityIndicator color={colors.muted} />
      <Text style={styles.waitingText}>{text}</Text>
    </View>
  );
}

export default function LanGame() {
  useKeepAwake();
  const { role, view, status, address, error, clearError, ended, clearEnded, act, leave } = useLan();
  const left = useTimer(view);
  const [seenLocal, setSeenLocal] = useState(false);
  const [guessDraft, setGuessDraft] = useState('');
  const isHost = role === 'host';

  // A new round starts with a fresh card.
  useEffect(() => {
    setSeenLocal(false);
    setGuessDraft('');
  }, [view?.round]);

  useEffect(() => {
    if (!error) return;
    Alert.alert('Heads up', error);
    clearError();
  }, [error, clearError]);

  useEffect(() => {
    if (!ended) return;
    Alert.alert('Game over', ended);
    clearEnded();
    router.back();
  }, [ended, clearEnded]);

  const confirmLeave = () =>
    Alert.alert(
      isHost ? 'End the game for everyone?' : 'Leave this game?',
      isHost ? 'All the other phones will be disconnected.' : 'You can join again later.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: isHost ? 'End game' : 'Leave',
          style: 'destructive',
          onPress: () => {
            leave();
            router.back();
          },
        },
      ],
    );
  useGameBackButton(confirmLeave);

  const header = (
    <View style={styles.header}>
      <EndGameButton onPress={confirmLeave} label={isHost ? 'End game' : 'Leave'} />
      {status === 'reconnecting' ? <Text style={styles.reconnecting}>Reconnecting…</Text> : null}
      {view && view.round > 0 ? <Text style={styles.roundText}>Round {view.round}</Text> : null}
    </View>
  );

  if (!view) {
    return (
      <Screen>
        <View style={styles.wrap}>
          {header}
          <Waiting text={role === 'client' ? `Connecting to ${address ?? 'the host'}…` : 'Starting…'} />
        </View>
      </Screen>
    );
  }

  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'Someone';
  const inRound = view.inRound.includes(view.youId);
  const roundSize = view.inRound.length;
  const scoreRows = (ids: string[], points?: Record<string, number>) =>
    ids.map((id) => ({ key: id, name: name(id), score: view.scores[id] ?? 0, delta: points?.[id], you: id === view.youId }));

  let body: ReactNode;
  let footer: ReactNode = null;

  switch (view.phase) {
    case 'lobby': {
      const connected = view.players.filter((p) => p.connected).length;
      body = (
        <ScrollView contentContainerStyle={styles.scroll}>
          {isHost ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Others join from "Play on Wi-Fi"</Text>
              <Text style={styles.rule}>
                Your game shows up there automatically on the same Wi-Fi or hotspot.
                {address ? ` If it doesn't, they can type this address: ` : ''}
                {address ? <Text style={styles.address}>{address}</Text> : null}
              </Text>
            </View>
          ) : null}

          <SectionTitle>
            Players ({connected}
            {connected < MIN_PLAYERS ? ` · need ${MIN_PLAYERS}` : ''})
          </SectionTitle>
          {view.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <Text style={[styles.playerName, !p.connected && { color: colors.muted }]}>
                {p.name}
                {p.id === view.youId ? ' (you)' : ''}
              </Text>
              {p.isHost ? <Text style={styles.tag}>host</Text> : null}
              {!p.connected ? <Text style={[styles.tag, { color: colors.red }]}>offline</Text> : null}
              {isHost && !p.isHost ? (
                <Pressable hitSlop={12} onPress={() => act({ t: 'kick', id: p.id })}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {view.settings.scoring && view.players.some((p) => view.scores[p.id]) ? (
            <View style={{ marginTop: spacing.lg }}>
              <Leaderboard
                rows={scoreRows(view.players.map((p) => p.id))}
                onReset={
                  isHost
                    ? () =>
                        Alert.alert('Reset the leaderboard?', "Everyone's points go back to 0.", [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Reset', style: 'destructive', onPress: () => act({ t: 'resetScores' }) },
                        ])
                    : undefined
                }
              />
            </View>
          ) : null}

          {isHost ? (
            <GameOptions playerCount={view.players.length} />
          ) : (
            <View style={[styles.card, { marginTop: spacing.lg }]}>
              <Text style={styles.cardTitle}>Game settings</Text>
              <Text style={styles.rule}>
                Hint: {HINT_MODES.find((m) => m.id === view.settings.hintMode)?.label} · Imposters:{' '}
                {view.settings.imposterCount}
              </Text>
              <Text style={styles.rule}>
                Discussion: {view.settings.timerMinutes ? `${view.settings.timerMinutes} min` : 'no timer'} · Voting:{' '}
                {view.settings.votingSeconds ? `${view.settings.votingSeconds}s` : 'no timer'}
              </Text>
              <Text style={styles.rule}>Points & leaderboard: {view.settings.scoring ? 'on' : 'off'}</Text>
            </View>
          )}
        </ScrollView>
      );
      footer = isHost ? (
        <Button title="Start Game" onPress={() => act({ t: 'start' })} disabled={view.players.length < MIN_PLAYERS} />
      ) : (
        <Waiting text="Waiting for the host to start…" />
      );
      break;
    }

    case 'reveal': {
      const ready = view.seen.length;
      body =
        inRound && view.card ? (
          <>
            <Text style={styles.label}>Your card</Text>
            <CardSlider
              card={view.card}
              prompt={seenLocal ? 'Slide up again to re-check' : 'Slide up to see your role'}
              onSeen={() => setSeenLocal(true)}
            />
          </>
        ) : (
          <Waiting text="A round is being played. You'll be dealt in next round." />
        );
      footer = (
        <>
          <Text style={styles.progress}>
            {ready} of {roundSize} ready
          </Text>
          {inRound && !view.seen.includes(view.youId) ? (
            <Button title="I've seen my card" onPress={() => act({ t: 'seen' })} disabled={!seenLocal} />
          ) : (
            <Waiting text="Waiting for everyone to check their card…" />
          )}
          {isHost && ready < roundSize ? (
            <Button title="Don't wait: go to clues" variant="ghost" onPress={() => act({ t: 'clues' })} />
          ) : null}
        </>
      );
      break;
    }

    case 'clues':
    case 'discuss': {
      const clues = view.phase === 'clues';
      body = (
        <ScrollView contentContainerStyle={styles.scroll}>
          {clues ? (
            <>
              <Text style={[styles.label, { textAlign: 'center' }]}>First to speak</Text>
              <Text style={styles.starter}>{name(view.speakOrder[0])}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.label, { textAlign: 'center' }]}>Discussion</Text>
              {left !== null ? <Timer left={left} /> : <Text style={styles.bigEmoji}>💬</Text>}
              <Text style={styles.bigText}>Who sounds like they don't know the word?</Text>
            </>
          )}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Speaking order</Text>
            <OrderChips ids={view.speakOrder} name={name} />
            {clues ? (
              <Text style={styles.rule}>In this order, each person says ONE word or short clue out loud.</Text>
            ) : null}
          </View>
          {view.card ? <CardSlider card={view.card} height={260} prompt="Slide up to check your card" /> : null}
        </ScrollView>
      );
      footer = isHost ? (
        clues ? (
          <>
            <Button title="Everyone gave clues: Discuss" onPress={() => act({ t: 'discuss' })} />
            <Button title="Skip to voting" variant="ghost" onPress={() => act({ t: 'startVote' })} />
          </>
        ) : (
          <Button title="Start voting" onPress={() => act({ t: 'startVote' })} />
        )
      ) : (
        <Waiting text={clues ? 'The host moves on when everyone has given a clue.' : 'The host starts the vote.'} />
      );
      break;
    }

    case 'vote': {
      const others = view.inRound.filter((id) => id !== view.youId);
      body = (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.label, { textAlign: 'center' }]}>Voting</Text>
          <Timer left={left} />
          <Text style={styles.bigText}>{inRound ? 'Who is the imposter? Tap your pick.' : 'The others are voting…'}</Text>
          {inRound ? (
            <View style={styles.voteGrid}>
              {others.map((id) => {
                const picked = view.yourVote === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      act({ t: 'vote', target: id });
                    }}
                    style={({ pressed }) => [styles.voteBtn, picked && styles.voteBtnOn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={[styles.voteName, picked && { color: colors.bg }]}>{name(id)}</Text>
                    {view.voted.includes(id) ? <Text style={[styles.votedTick, picked && { color: colors.bg }]}>voted</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={styles.progress}>
            {view.voted.length} of {roundSize} voted{view.yourVote ? ` · you picked ${name(view.yourVote)} (tap another to change)` : ''}
          </Text>
          {view.card ? <CardSlider card={view.card} height={240} prompt="Slide up to check your card" /> : null}
        </ScrollView>
      );
      footer = isHost ? (
        <Button title="Reveal the Imposter" variant="danger" onPress={() => act({ t: 'reveal' })} />
      ) : (
        <Waiting text="The host reveals the imposter when everyone has voted." />
      );
      break;
    }

    case 'guess': {
      const g = view.guessing;
      if (!g) {
        body = <Waiting text="Waiting for the host…" />;
        break;
      }
      const guesserName = name(g.imposter);
      const amGuesser = g.imposter === view.youId;
      // Only the regular players know the word, so only they can say if the guess was right.
      const knowsWord = inRound && view.card?.role === 'crew';
      const submitGuess = () => {
        const text = guessDraft.trim();
        if (!text) return;
        Alert.alert(`Guess "${text}"?`, 'You only get one try.', [
          { text: 'Change it', style: 'cancel' },
          { text: 'Lock it in', onPress: () => act({ t: 'guess', text }) },
        ]);
      };
      body = (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.resultEmoji}>🎯</Text>
          <Text style={[styles.label, { textAlign: 'center' }]}>{amGuesser ? "You've been caught!" : 'Caught!'}</Text>
          <Text style={styles.imposter}>{amGuesser ? 'You' : guesserName}</Text>
          <Text style={styles.bigText}>
            {amGuesser
              ? 'You get ONE guess at the secret word. Guess right and you still win!'
              : `${guesserName} was the imposter and gets one guess at the secret word. If it's right, the imposter still wins!`}
          </Text>
          {amGuesser && !g.guess ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your guess</Text>
              <TextInput
                value={guessDraft}
                onChangeText={setGuessDraft}
                placeholder="The secret word (Amharic or English)"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoFocus
                maxLength={60}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={submitGuess}
              />
              <Button title="Submit my guess" variant="danger" onPress={submitGuess} disabled={!guessDraft.trim()} />
            </View>
          ) : null}
          {g.guess ? (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.cardTitle}>{amGuesser ? 'You guessed' : `${guesserName} guessed`}</Text>
              <Text style={styles.guess}>“{g.guess}”</Text>
            </View>
          ) : null}
          {knowsWord && view.card ? <CardSlider card={view.card} height={240} prompt="Slide up to check the word" /> : null}
        </ScrollView>
      );
      footer = knowsWord ? (
        <>
          <Text style={styles.progress}>
            {g.guess ? 'Was that the secret word?' : `Waiting for ${guesserName} to type a guess. Said it out loud instead? You decide:`}
          </Text>
          <Button title="Right: the imposter wins" variant="danger" onPress={() => act({ t: 'judge', correct: true })} />
          <Button title="Wrong: we win!" onPress={() => act({ t: 'judge', correct: false })} />
        </>
      ) : (
        <Waiting
          text={
            amGuesser
              ? g.guess
                ? 'The others are checking your guess…'
                : 'Type your guess, or say it out loud and let the others decide.'
              : `${guesserName} is guessing…`
          }
        />
      );
      break;
    }

    case 'result': {
      const r = view.result;
      if (!r) {
        body = <Waiting text="Waiting for the host…" />;
        break;
      }
      const names = r.imposters.map(name);
      const many = names.length > 1;
      const crewWon = r.outcome === 'caught';
      const guesserName = r.guesser ? name(r.guesser) : '';
      const tally = new Map<string, number>();
      for (const t of Object.values(r.votes)) tally.set(t, (tally.get(t) ?? 0) + 1);
      const verdict =
        r.outcome === 'caught'
          ? `${guesserName} was caught${r.guess ? ` and guessed "${r.guess}"` : ''}. Wrong word, so everyone else wins!`
          : r.outcome === 'guessed'
            ? `${guesserName} was caught but guessed the word${r.guess ? ` ("${r.guess}")` : ''}. The imposter${many ? 's win' : ' wins'}!`
            : r.mostVoted.length > 1
              ? `It's a tie, so the imposter${many ? 's escape' : ' escapes'}!`
              : r.mostVoted.length === 1
                ? `You voted out ${name(r.mostVoted[0])}, who was innocent. The imposter${many ? 's win' : ' wins'}!`
                : `Nobody voted, so the imposter${many ? 's escape' : ' escapes'}!`;
      const mine = r.points[view.youId];
      body = (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultEmoji}>{crewWon ? '🎉' : '🕵️'}</Text>
          <Text style={[styles.winner, { color: crewWon ? colors.green : colors.red }]}>
            {crewWon ? 'Players win!' : many ? 'Imposters win!' : 'Imposter wins!'}
          </Text>
          <Text style={[styles.label, { textAlign: 'center' }]}>{many ? 'The imposters were' : 'The imposter was'}</Text>
          <Text style={styles.imposter}>{names.join(' & ')}</Text>
          <Text style={styles.verdict}>{verdict}</Text>
          {view.settings.scoring && mine !== undefined ? (
            <Text style={[styles.earned, { color: mine > 0 ? colors.yellow : colors.muted }]}>
              {mine > 0 ? `You earned +${mine} point${mine === 1 ? '' : 's'}` : 'No points for you this round'}
            </Text>
          ) : null}
          <WordCard am={r.word.am} en={r.word.en} label="The secret word · ሚስጥራዊው ቃል" />
          <WordCard am={r.hint.am} en={r.hint.en} label={`Imposter saw · ${r.hint.label.split(' · ')[0]}`} accent={colors.red} />
          {view.settings.scoring ? <Leaderboard rows={scoreRows(view.inRound, r.points)} /> : null}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Votes</Text>
            {[...tally]
              .sort((a, b) => b[1] - a[1])
              .map(([id, n]) => (
                <Text key={id} style={styles.rule}>
                  {name(id)}: {n} vote{n === 1 ? '' : 's'}
                  {r.imposters.includes(id) ? '  🕵️' : ''}
                </Text>
              ))}
            {Object.entries(r.votes).map(([voter, target]) => (
              <Text key={voter} style={styles.voteLine}>
                {name(voter)} → {name(target)}
              </Text>
            ))}
            {Object.keys(r.votes).length === 0 ? <Text style={styles.rule}>No votes.</Text> : null}
          </View>
        </ScrollView>
      );
      footer = isHost ? (
        <>
          <Button title="Play Again" onPress={() => act({ t: 'start' })} />
          <Button title="Back to lobby (change settings)" variant="secondary" onPress={() => act({ t: 'lobby' })} />
        </>
      ) : (
        <Waiting text="Waiting for the host to start the next round…" />
      );
      break;
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        {header}
        <View style={{ flex: 1, gap: spacing.md }}>{body}</View>
        <View style={styles.footer}>{footer}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reconnecting: { color: colors.yellow, fontWeight: '700' },
  roundText: { color: colors.muted, marginLeft: 'auto' },
  scroll: { gap: spacing.md, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  label: { color: colors.muted, fontSize: 16 },
  note: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  roleEmoji: { fontSize: 56 },
  roleTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  roleAm: { color: colors.text, fontSize: 18 },
  grip: { width: 56, height: 6, borderRadius: 3, backgroundColor: colors.muted, marginBottom: spacing.sm },
  coverArrow: { fontSize: 40, color: colors.yellow },
  coverText: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  waitingText: { color: colors.muted, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  rule: { color: colors.text, fontSize: 15, lineHeight: 21 },
  address: { color: colors.yellow, fontWeight: '800' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  playerName: { color: colors.text, fontSize: 17, flex: 1 },
  tag: { color: colors.yellow, fontSize: 13, fontWeight: '700' },
  remove: { color: colors.red, fontSize: 18, fontWeight: '700', paddingLeft: spacing.sm },
  progress: { color: colors.muted, textAlign: 'center' },
  starter: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  timerBox: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  timer: { color: colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bigEmoji: { fontSize: 56, textAlign: 'center' },
  bigText: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  order: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  orderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardAlt,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  orderChipFirst: { backgroundColor: colors.yellow },
  orderNum: { color: colors.yellow, fontWeight: '800', fontSize: 14 },
  orderName: { color: colors.text, fontSize: 15 },
  voteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  voteBtn: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  voteBtnOn: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  voteName: { color: colors.text, fontSize: 18, fontWeight: '700' },
  votedTick: { color: colors.muted, fontSize: 12, marginTop: 2 },
  resultEmoji: { fontSize: 56, textAlign: 'center' },
  imposter: { color: colors.red, fontSize: 38, fontWeight: '800', textAlign: 'center' },
  verdict: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  voteLine: { color: colors.muted, fontSize: 14 },
  winner: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  earned: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  guess: { color: colors.yellow, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
