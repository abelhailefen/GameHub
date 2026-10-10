import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, colors, Countdown, EndGameButton, radius, Screen, spacing, useCountdown } from '@gamehub/ui';
import { useGame } from '../context/GameContext';
import { confirmEndGame, goHome, useGameBackButton } from '../game/exit';
import { routes } from '../routes';

type Phase = 'clues' | 'talk' | 'vote';

export default function Discuss() {
  const { round, settings } = useGame();
  const [phase, setPhase] = useState<Phase>('clues');

  useGameBackButton();

  const talkSeconds = settings.timerMinutes * 60;
  const voteSeconds = settings.votingSeconds;
  const talkLeft = useCountdown(phase === 'talk', talkSeconds, () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
  const voteLeft = useCountdown(phase === 'vote', voteSeconds, () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );

  if (!round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const order = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Speaking order</Text>
      <View style={styles.order}>
        {round.speakOrder.map((p, i) => (
          <View key={p} style={[styles.orderChip, i === 0 && styles.orderChipFirst]}>
            <Text style={[styles.orderNum, i === 0 && { color: colors.bg }]}>{i + 1}</Text>
            <Text style={[styles.orderName, i === 0 && { color: colors.bg }]}>{round.players[p]}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Screen>
      <View style={styles.wrap}>
        <EndGameButton onPress={confirmEndGame} />

        {phase === 'clues' ? (
          <>
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.label}>First to speak</Text>
              <Text style={styles.starter}>{round.players[round.speakOrder[0]]}</Text>
              {order}
              <View style={styles.card}>
                <Text style={styles.rule}>In the order above, each person says ONE word or short clue about the secret word.</Text>
                <Text style={styles.rule}>Don't make it too easy — the imposter is listening.</Text>
              </View>
            </ScrollView>
            <Button title="Done giving clues: Discuss" onPress={() => setPhase('talk')} />
          </>
        ) : phase === 'talk' ? (
          <>
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.label}>Discussion</Text>
              {talkSeconds > 0 ? (
                <Countdown left={talkLeft} done={talkLeft === 0} />
              ) : (
                <Text style={styles.bigEmoji}>💬</Text>
              )}
              <Text style={styles.voteText}>Who sounds like they don't know the word?</Text>
              {order}
            </ScrollView>
            <Button title="Start voting" onPress={() => setPhase('vote')} />
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.center}>
              <Text style={styles.label}>Voting</Text>
              {voteSeconds > 0 ? <Countdown left={voteLeft} done={voteLeft === 0} /> : <Text style={styles.bigEmoji}>👉</Text>}
              <Text style={styles.voteText}>
                {voteLeft === 0 || voteSeconds === 0
                  ? 'Point at the imposter on the count of three!'
                  : 'Argue your case. Everyone points when the time runs out.'}
              </Text>
              <View style={styles.card}>
                <Text style={styles.rule}>The imposter is only revealed when you press the button below.</Text>
                <Text style={styles.rule}>If the imposter is caught, they get one guess at the word. If they guess right, they still win!</Text>
              </View>
            </ScrollView>
            <Button title="Reveal the Imposter" variant="danger" onPress={() => router.replace(routes.result)} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.md },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  label: { color: colors.muted, fontSize: 16 },
  starter: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  bigEmoji: { fontSize: 64 },
  voteText: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignSelf: 'stretch' },
  cardTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
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
  rule: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
