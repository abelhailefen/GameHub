import { Am, Button, colors, Leaderboard, radius, Screen, spacing } from '@gamehub/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWhoAmI } from '../context';
import { goHome, goToSetup, useGameBackButton } from '../exit';
import { placings } from '../logic';
import { routes } from '../routes';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Result() {
  const { result: current, startRound, scores, settings } = useWhoAmI();
  // Freeze the result this screen opened with: "Play Again" clears it while this screen animates out.
  const [result] = useState(current);

  useGameBackButton(goToSetup);

  if (!result) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const { round, points } = result;
  const rows = placings(round);
  const winner = rows.find((r) => r.place === 1);

  const playAgain = () => {
    const error = startRound();
    if (error) Alert.alert("Can't start", error);
    else router.replace(routes.write);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.emoji}>{winner ? '🏆' : '🤷'}</Text>
        <Text style={styles.winner}>{winner ? `${winner.name} wins!` : 'Nobody guessed their word'}</Text>
        {winner ? (
          <Text style={styles.sub}>
            First to guess, in {winner.turns} turn{winner.turns === 1 ? '' : 's'}.
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Everyone's words</Text>
          {rows.map((r) => (
            <View key={r.player} style={styles.row}>
              <Text style={styles.rank}>{r.place ? (MEDALS[r.place - 1] ?? `${r.place}.`) : '·'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {r.name}
                  {r.place ? '' : <Text style={styles.missed}>  didn't get it</Text>}
                </Text>
                <Am style={styles.word}>{r.word}</Am>
                <Text style={styles.meta}>
                  Written by {r.writer} · {r.turns} turn{r.turns === 1 ? '' : 's'}
                </Text>
              </View>
              {settings.scoring && r.points ? <Text style={styles.delta}>+{r.points}</Text> : null}
            </View>
          ))}
        </View>

        {settings.scoring ? (
          <Leaderboard rows={round.players.map((p) => ({ key: p, name: p, score: scores[p] ?? 0, delta: points[p] }))} />
        ) : null}

        <View style={styles.buttons}>
          <Button title="Play Again (same players)" onPress={playAgain} />
          <Button title="Change Players / Settings" variant="secondary" onPress={goToSetup} />
          <Button title="Home" variant="ghost" onPress={goHome} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 56 },
  winner: { color: colors.yellow, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignSelf: 'stretch' },
  cardTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rank: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 18, fontWeight: '800' },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  missed: { color: colors.muted, fontSize: 14, fontWeight: '400' },
  word: { color: colors.yellow, fontSize: 18 },
  meta: { color: colors.muted, fontSize: 13 },
  delta: { color: colors.green, fontSize: 16, fontWeight: '800' },
  buttons: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
});
