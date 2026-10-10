import {
  Am,
  Button,
  colors,
  Countdown,
  EndGameButton,
  Leaderboard,
  radius,
  Screen,
  SectionTitle,
  secondsLabel,
  spacing,
  useRemoteCountdown,
} from '@gamehub/ui';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useGameBackButton } from '../../exit';
import { useLan } from '../../lan/context';
import type { View as GameView } from '../../lan/protocol';
import { MAX_WORD_LENGTH, MIN_PLAYERS, themeById } from '../../logic';
import { GameOptions } from '../../options';

const MEDALS = ['🥇', '🥈', '🥉'];
const medal = (place: number) => MEDALS[place - 1] ?? `${place}.`;

function Waiting({ text }: { text: string }) {
  return (
    <View style={styles.waiting}>
      <ActivityIndicator color={colors.muted} />
      <Text style={styles.waitingText}>{text}</Text>
    </View>
  );
}

/** Everyone's words, like sticky notes on foreheads: you see all of them except your own. */
function Board({ view, name }: { view: GameView; name: (id: string) => string }) {
  const offline = new Set(view.players.filter((p) => !p.connected).map((p) => p.id));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Everyone's words</Text>
      {view.turnOrder.map((id) => {
        const place = view.solved.indexOf(id) + 1;
        const word = view.words[id];
        const asking = id === view.current;
        return (
          <View key={id} style={[styles.boardRow, asking && styles.boardRowOn]}>
            <Text style={styles.boardMark}>{place ? medal(place) : asking ? '❓' : '·'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardName}>
                {name(id)}
                {id === view.youId ? ' (you)' : ''}
                {offline.has(id) ? <Text style={styles.offline}>  offline</Text> : null}
              </Text>
              {word !== undefined ? (
                <Am style={[styles.boardWord, place > 0 && { color: colors.muted }]}>{word}</Am>
              ) : (
                <Text style={styles.boardHidden}>Your word is hidden from you</Text>
              )}
            </View>
            {asking ? <Text style={styles.tag}>asking</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

export default function LanGame() {
  useKeepAwake();
  const { role, view, status, address, error, clearError, ended, clearEnded, act, leave } = useLan();
  const left = useRemoteCountdown(view?.timerMs, view);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [guessDraft, setGuessDraft] = useState('');
  const isHost = role === 'host';

  // A new round starts with a blank page.
  useEffect(() => {
    setDraft('');
    setEditing(false);
  }, [view?.round]);

  // A new turn: clear the guess box, and buzz the phone whose turn it is.
  const myTurn = view?.phase === 'play' && view.current === view.youId;
  useEffect(() => {
    setGuessDraft('');
    if (myTurn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [view?.turn, myTurn]);

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

  const name = (id: string | undefined) => view.players.find((p) => p.id === id)?.name ?? 'Someone';
  const inRound = view.inRound.includes(view.youId);
  const theme = themeById(view.theme);
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
            <GameOptions />
          ) : (
            <View style={[styles.card, { marginTop: spacing.lg }]}>
              <Text style={styles.cardTitle}>Game settings</Text>
              <Text style={styles.rule}>
                Words: {themeById(view.settings.theme).emoji} {themeById(view.settings.theme).label}
              </Text>
              <Text style={styles.rule}>
                Turn timer: {view.settings.turnSeconds ? secondsLabel(view.settings.turnSeconds) : 'off'} · Points &
                leaderboard: {view.settings.scoring ? 'on' : 'off'}
              </Text>
            </View>
          )}
        </ScrollView>
      );
      footer = isHost ? (
        <Button title="Start: write the words" onPress={() => act({ t: 'start' })} disabled={view.players.length < MIN_PLAYERS} />
      ) : (
        <Waiting text="Waiting for the host to start…" />
      );
      break;
    }

    case 'write': {
      const target = view.writeFor;
      const waitingOn = view.inRound.filter((id) => !view.written.includes(id));
      const offline = waitingOn.filter((id) => !view.players.find((p) => p.id === id)?.connected);
      const lockIn = () => {
        const word = draft.trim();
        if (!word) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        act({ t: 'write', word });
        setEditing(false);
      };
      body = (
        <ScrollView contentContainerStyle={styles.centerScroll} keyboardShouldPersistTaps="handled">
          {!inRound || !target ? (
            <Waiting text="A round is being played. You'll be dealt in next round." />
          ) : view.yourWord && !editing ? (
            <>
              <Text style={styles.done}>✓ Locked in</Text>
              <Text style={styles.passTo}>You wrote</Text>
              <Am bold style={styles.writtenWord}>
                {view.yourWord}
              </Am>
              <Text style={styles.passTo}>
                for <Text style={styles.nameInline}>{name(target)}</Text>
              </Text>
              <Button
                title="Change it"
                variant="ghost"
                onPress={() => {
                  setDraft(view.yourWord ?? '');
                  setEditing(true);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.passTo}>Write a word for</Text>
              <Text style={styles.bigName}>{name(target)}</Text>
              <View style={styles.themeBox}>
                <Text style={styles.themeTitle}>
                  {theme.emoji} {theme.label}
                </Text>
                <Text style={styles.note}>{theme.example}</Text>
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Your word"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoFocus
                autoCorrect={false}
                maxLength={MAX_WORD_LENGTH}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                onSubmitEditing={lockIn}
              />
              <Text style={styles.note}>
                Everyone but {name(target)} will see it. Pick something they could guess with yes/no questions.
              </Text>
              <Button title="Lock it in" onPress={lockIn} disabled={!draft.trim()} style={{ alignSelf: 'stretch' }} />
            </>
          )}
        </ScrollView>
      );
      footer = (
        <>
          <Text style={styles.progress}>
            {view.written.length} of {view.inRound.length} words written
            {waitingOn.length ? ` · waiting for ${waitingOn.map(name).join(', ')}` : ''}
          </Text>
          {isHost && offline.length ? (
            <>
              <Text style={styles.progress}>
                {offline.map(name).join(', ')} {offline.length > 1 ? 'are' : 'is'} offline. Wait for them to reconnect, or go
                back to the lobby to remove them.
              </Text>
              <Button title="Back to lobby" variant="ghost" onPress={() => act({ t: 'lobby' })} />
            </>
          ) : null}
        </>
      );
      break;
    }

    case 'play': {
      const current = view.current;
      const asker = name(current);
      const turn = view.turn;
      const timer = left !== null ? <Countdown left={Math.ceil(left / 1000)} done={left === 0} /> : null;
      const latest = view.solved[view.solved.length - 1];
      const latestBanner = latest ? (
        <Text style={styles.latest}>
          {medal(view.solved.length)} {name(latest)} got it: <Am style={{ color: colors.yellow }}>{view.words[latest]}</Am>
        </Text>
      ) : null;
      const submitGuess = () => {
        const text = guessDraft.trim();
        if (text) act({ t: 'guess', turn, text });
      };

      if (myTurn) {
        body = (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {latestBanner}
            <Text style={styles.yourTurn}>Your turn!</Text>
            <Text style={styles.bigText}>Ask yes/no questions about your word. Everyone else can see it.</Text>
            <Text style={styles.note}>
              {theme.emoji} {theme.label}
            </Text>
            {timer}
            <View style={styles.card}>
              {view.guess ? (
                <>
                  <Text style={styles.cardTitle}>You guessed</Text>
                  <Text style={styles.guess}>“{view.guess}”</Text>
                  <Waiting text="The others are checking…" />
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>Think you know it?</Text>
                  <TextInput
                    value={guessDraft}
                    onChangeText={setGuessDraft}
                    placeholder="Type your guess"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, styles.inputSmall]}
                    autoCorrect={false}
                    maxLength={60}
                    returnKeyType="done"
                    submitBehavior="blurAndSubmit"
                    onSubmitEditing={submitGuess}
                  />
                  <Button title="Guess" onPress={submitGuess} disabled={!guessDraft.trim()} />
                  <Text style={styles.note}>Or just say it out loud: the others tap "Got it!" if you're right.</Text>
                </>
              )}
            </View>
            <Board view={view} name={name} />
          </ScrollView>
        );
        footer = <Button title="End my turn ➜" variant="secondary" onPress={() => act({ t: 'turnOver', turn })} />;
      } else {
        body = (
          <ScrollView contentContainerStyle={styles.scroll}>
            {latestBanner}
            <Text style={[styles.label, { textAlign: 'center' }]}>{asker}'s turn · their word is</Text>
            <View style={styles.wordBox}>
              <Am bold style={styles.word} adjustsFontSizeToFit numberOfLines={3}>
                {current ? view.words[current] : ''}
              </Am>
              <Text style={styles.note}>
                {theme.emoji} {theme.label}
              </Text>
            </View>
            {timer}
            {view.guess ? (
              <View style={[styles.card, { alignItems: 'center' }]}>
                <Text style={styles.cardTitle}>{asker} guessed</Text>
                <Text style={styles.guess}>“{view.guess}”</Text>
                {inRound ? (
                  <View style={styles.judgeRow}>
                    <Button title="✓ Right" onPress={() => act({ t: 'gotIt', turn })} style={{ flex: 1 }} />
                    <Button title="✗ Wrong" variant="danger" onPress={() => act({ t: 'wrong', turn })} style={{ flex: 1 }} />
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.note}>Answer {asker}'s questions with yes or no. Don't say the word!</Text>
            )}
            <Board view={view} name={name} />
          </ScrollView>
        );
        footer = inRound ? (
          <>
            {!view.guess ? <Button title={`✓ ${asker} got it!`} onPress={() => act({ t: 'gotIt', turn })} /> : null}
            <Button title="Turn over ➜" variant="secondary" onPress={() => act({ t: 'turnOver', turn })} />
          </>
        ) : (
          <Waiting text="The others are playing…" />
        );
      }
      if (isHost) {
        footer = (
          <>
            {footer}
            <Button
              title="End round: show results"
              variant="ghost"
              onPress={() =>
                Alert.alert('End this round?', "Everyone's words are shown. Only players who already guessed get points.", [
                  { text: 'Keep playing', style: 'cancel' },
                  { text: 'End round', onPress: () => act({ t: 'end' }) },
                ])
              }
            />
          </>
        );
      }
      break;
    }

    case 'result': {
      const r = view.result;
      if (!r) {
        body = <Waiting text="Waiting for the host…" />;
        break;
      }
      const winner = r.placings.find((p) => p.place === 1);
      const mine = r.points[view.youId];
      body = (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.resultEmoji}>{winner ? '🏆' : '🤷'}</Text>
          <Text style={styles.winner}>
            {winner ? (winner.id === view.youId ? 'You win!' : `${name(winner.id)} wins!`) : 'Nobody guessed their word'}
          </Text>
          {winner ? (
            <Text style={styles.note}>
              First to guess, in {winner.turns} turn{winner.turns === 1 ? '' : 's'}.
            </Text>
          ) : null}
          {view.settings.scoring && mine !== undefined ? (
            <Text style={[styles.earned, { color: mine > 0 ? colors.yellow : colors.muted }]}>
              {mine > 0 ? `You earned +${mine} point${mine === 1 ? '' : 's'}` : 'No points for you this round'}
            </Text>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Everyone's words</Text>
            {r.placings.map((p) => (
              <View key={p.id} style={styles.boardRow}>
                <Text style={styles.boardMark}>{p.place ? medal(p.place) : '·'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boardName}>
                    {name(p.id)}
                    {p.id === view.youId ? ' (you)' : ''}
                    {p.place ? '' : <Text style={styles.missed}>  didn't get it</Text>}
                  </Text>
                  <Am style={styles.boardWord}>{p.word}</Am>
                  <Text style={styles.meta}>
                    Written by {name(p.writer)} · {p.turns} turn{p.turns === 1 ? '' : 's'}
                  </Text>
                </View>
                {view.settings.scoring && p.points ? <Text style={styles.delta}>+{p.points}</Text> : null}
              </View>
            ))}
          </View>

          {view.settings.scoring ? <Leaderboard rows={scoreRows(view.inRound, r.points)} /> : null}
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrap}>
          {header}
          <View style={{ flex: 1, gap: spacing.md }}>{body}</View>
          <View style={styles.footer}>{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reconnecting: { color: colors.yellow, fontWeight: '700' },
  roundText: { color: colors.muted, marginLeft: 'auto' },
  scroll: { gap: spacing.md, paddingBottom: spacing.lg },
  centerScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 16 },
  note: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  waitingText: { color: colors.muted, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignSelf: 'stretch' },
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
  done: { color: colors.green, fontSize: 15, fontWeight: '700' },
  passTo: { color: colors.text, fontSize: 20, textAlign: 'center' },
  bigName: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  nameInline: { color: colors.yellow, fontWeight: '800' },
  writtenWord: { color: colors.yellow, fontSize: 36, textAlign: 'center' },
  themeBox: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignSelf: 'stretch', gap: spacing.xs },
  themeTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  input: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.yellow,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 22,
    textAlign: 'center',
  },
  inputSmall: { backgroundColor: colors.bg, fontSize: 18, paddingVertical: 12 },
  latest: { color: colors.text, fontSize: 15, textAlign: 'center' },
  yourTurn: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  bigText: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  wordBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.yellow,
    padding: spacing.md,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  word: { color: colors.yellow, fontSize: 52, textAlign: 'center', lineHeight: 72 },
  guess: { color: colors.yellow, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  judgeRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  boardRowOn: { backgroundColor: colors.cardAlt, borderRadius: radius.sm },
  boardMark: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 18, fontWeight: '800' },
  boardName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  boardWord: { color: colors.yellow, fontSize: 18 },
  boardHidden: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
  offline: { color: colors.red, fontSize: 13, fontWeight: '400' },
  missed: { color: colors.muted, fontSize: 14, fontWeight: '400' },
  meta: { color: colors.muted, fontSize: 13 },
  delta: { color: colors.green, fontSize: 16, fontWeight: '800' },
  resultEmoji: { fontSize: 56, textAlign: 'center' },
  winner: { color: colors.yellow, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  earned: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
});
