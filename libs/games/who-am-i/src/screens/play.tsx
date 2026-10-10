import { Am, Button, colors, Countdown, EndGameButton, radius, Screen, spacing, useCountdown } from '@gamehub/ui';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWhoAmI } from '../context';
import { confirmQuit, goHome, useGameBackButton } from '../exit';
import { currentPlayer, endRound, guessed, passTurn, stillGuessing, themeById, wordFor, type Round } from '../logic';
import { routes } from '../routes';

/**
 * pass      -> hand the phone to the next player; nothing secret on screen
 * countdown -> 3, 2, 1 while they lift it to their forehead
 * turn      -> their word, big, facing everyone else; they ask yes/no questions
 * solved    -> they got it; show the word and who's next
 */
type Phase = 'pass' | 'countdown' | 'turn' | 'solved';

const MEDALS = ['🥇', '🥈', '🥉'];
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

function Standings({ round }: { round: Round }) {
  if (round.solved.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Got it</Text>
      <View style={styles.chips}>
        {round.solved.map((p, i) => (
          <View key={p} style={styles.chip}>
            <Text style={styles.chipText}>
              {MEDALS[i] ?? `${i + 1}.`} {round.players[p]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>Still guessing: {stillGuessing(round).map((p) => round.players[p]).join(', ')}</Text>
    </View>
  );
}

export default function Play() {
  useKeepAwake();
  const { round, setRound, finishRound, settings } = useWhoAmI();
  const [phase, setPhase] = useState<Phase>('pass');
  const [count, setCount] = useState(3);
  const [lastSolved, setLastSolved] = useState<number | null>(null);

  const turnLeft = useCountdown(phase === 'turn', settings.turnSeconds, () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );

  // Give the player a moment to lift the phone to their forehead before the word appears.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('turn');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(id);
  }, [phase, count]);

  const endEarly = () => {
    if (!round) return;
    finishRound(endRound(round));
    router.replace(routes.result);
  };
  useGameBackButton(() => confirmQuit(endEarly));

  if (!round || round.target.length === 0) {
    return (
      <Screen>
        <View style={styles.centerFill}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const player = currentPlayer(round);
  const name = round.players[player];
  const theme = themeById(round.theme);

  const gotIt = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = guessed(round);
    if (next.over) {
      finishRound(next);
      router.replace(routes.result);
      return;
    }
    setRound(next);
    setLastSolved(player);
    setPhase('solved');
  };

  const turnOver = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRound(passTurn(round));
    setPhase('pass');
  };

  const ready = () => {
    setCount(3);
    setPhase('countdown');
  };

  if (phase === 'countdown') {
    return (
      <Screen>
        <View style={styles.centerFill}>
          <Text style={styles.muted}>Phone on your forehead, {name}!</Text>
          <Text style={styles.count}>{count || '…'}</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'turn') {
    return (
      <Screen>
        <View style={styles.wrap}>
          <View style={styles.turnTop}>
            <Text style={styles.turnLabel}>{name}'s word</Text>
            <Text style={styles.muted}>
              {theme.emoji} {theme.label}
            </Text>
          </View>
          <View style={styles.wordBox}>
            <Am bold style={styles.word} adjustsFontSizeToFit numberOfLines={3}>
              {wordFor(round, player)}
            </Am>
          </View>
          {settings.turnSeconds > 0 ? <Countdown left={turnLeft} done={turnLeft === 0} /> : null}
          <Text style={styles.note}>Answer {name}'s questions with yes or no. Don't say the word!</Text>
          <View style={styles.buttons}>
            <Button title="✓ Got it!" onPress={gotIt} />
            <Button title="Turn over ➜" variant="secondary" onPress={turnOver} />
          </View>
        </View>
      </Screen>
    );
  }

  if (phase === 'solved' && lastSolved !== null) {
    const place = round.solved.indexOf(lastSolved) + 1;
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.bigEmoji}>{MEDALS[place - 1] ?? '🎉'}</Text>
          <Text style={styles.solvedName}>{round.players[lastSolved]} got it!</Text>
          <Text style={styles.muted}>{place === 1 ? 'First to guess their word!' : `${ordinal(place)} to guess their word`}</Text>
          <View style={[styles.wordBox, styles.wordBoxSmall]}>
            <Am bold style={[styles.word, { fontSize: 40 }]} adjustsFontSizeToFit numberOfLines={2}>
              {wordFor(round, lastSolved)}
            </Am>
          </View>
          <Standings round={round} />
          <View style={styles.buttons}>
            <Button title={`Next: pass to ${name}`} onPress={() => setPhase('pass')} />
            <Button title="End round: show results" variant="ghost" onPress={endEarly} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <EndGameButton onPress={() => confirmQuit(endEarly)} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.muted}>
            {round.turns[player] === 0 ? 'First turn' : `Turn ${round.turns[player] + 1}`} · {theme.emoji} {theme.label}
          </Text>
          <Text style={styles.passTo}>Pass the phone to</Text>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.card}>
            <Text style={styles.rule}>1. Tap Ready, then hold the phone against your forehead, screen facing out.</Text>
            <Text style={styles.rule}>2. Ask the others yes/no questions about your word.</Text>
            <Text style={styles.rule}>3. Guess it! They tap "Got it" if you're right, or "Turn over" when your turn ends.</Text>
          </View>
          <Standings round={round} />
        </ScrollView>
        <Button title={`Ready: show ${name}'s word`} onPress={ready} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  note: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  passTo: { color: colors.text, fontSize: 20 },
  name: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  count: { color: colors.yellow, fontSize: 140, fontWeight: '800' },
  turnTop: { alignItems: 'center', gap: spacing.xs },
  turnLabel: { color: colors.text, fontSize: 18, fontWeight: '700' },
  wordBox: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.yellow,
    padding: spacing.md,
  },
  wordBoxSmall: { flex: 0, paddingVertical: spacing.xl },
  word: { color: colors.yellow, fontSize: 72, textAlign: 'center', lineHeight: 96 },
  bigEmoji: { fontSize: 64 },
  solvedName: { color: colors.green, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignSelf: 'stretch' },
  cardTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  rule: { color: colors.text, fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.cardAlt, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { color: colors.text, fontSize: 15 },
  buttons: { alignSelf: 'stretch', gap: spacing.md },
});
