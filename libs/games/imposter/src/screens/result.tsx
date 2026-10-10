import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirmEndGame, goHome, goToSetup, useGameBackButton } from '../game/exit';
import { Button, colors, Leaderboard, radius, Screen, spacing, WordCard } from '@gamehub/ui';
import { useGame } from '../context/GameContext';
import { roundPoints, type Outcome } from '../game/scoring';
import { routes } from '../routes';

/**
 * who   -> the imposter is revealed (not the word). Did the group vote them out?
 * guess -> caught: the imposter says their one guess out loud while the word is still hidden
 * judge -> the word is shown; was the guess right?
 * done  -> result and points
 */
type Step = 'who' | 'guess' | 'judge' | 'done';

export default function Result() {
  const { round: currentRound, startRound, scores, addScores, settings } = useGame();
  // Freeze the round this screen was opened for. "Play Again" starts the next round while this
  // screen is still animating out; reading the live round would flash the NEW imposter and word.
  const [round] = useState(currentRound);
  const [step, setStep] = useState<Step>('who');
  const [guesser, setGuesser] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [points, setPoints] = useState<Record<string, number>>({});

  // Until the points are in, back asks before throwing the round away. After that it just returns to setup.
  useGameBackButton(step === 'done' ? goToSetup : confirmEndGame);

  if (!round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const imposterNames = round.imposters.map((i) => round.players[i]);
  const hint = round.hint;

  const finish = (result: Outcome, caughtName: string | null) => {
    const earned = settings.scoring
      ? roundPoints({ players: round.players, imposters: imposterNames, outcome: result, guesser: caughtName ?? undefined })
      : {};
    addScores(earned);
    setPoints(earned);
    setOutcome(result);
    setStep('done');
    Haptics.notificationAsync(
      result === 'caught' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
  };

  const playAgain = () => {
    const error = startRound();
    if (error) Alert.alert("Can't start", error);
    else router.replace(routes.reveal);
  };

  if (step === 'who') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.emoji}>🕵️</Text>
          <Text style={styles.label}>{imposterNames.length > 1 ? 'The imposters are' : 'The imposter is'}</Text>
          <Text style={styles.imposter}>{imposterNames.join(' & ')}</Text>
          <View style={styles.card}>
            <Text style={styles.question}>Who did you vote out?</Text>
            <Text style={styles.rule}>
              Don't show the word yet. If you caught {imposterNames.length > 1 ? 'an imposter' : 'the imposter'}, they get one guess
              at the secret word first.
            </Text>
          </View>
          <View style={styles.buttons}>
            {imposterNames.map((n) => (
              <Button
                key={n}
                title={`We caught ${n}!`}
                onPress={() => {
                  setGuesser(n);
                  setStep('guess');
                }}
              />
            ))}
            <Button title="Someone else, or it was a tie" variant="danger" onPress={() => finish('escaped', null)} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (step === 'guess') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.emoji}>🎯</Text>
          <Text style={styles.imposter}>{guesser}</Text>
          <Text style={styles.bigText}>You've been caught, but you can still win!</Text>
          <View style={styles.card}>
            <Text style={styles.rule}>Say your ONE guess at the secret word out loud now.</Text>
            <Text style={styles.rule}>Only show the word after they've guessed.</Text>
          </View>
          <View style={styles.buttons}>
            <Button title="They've guessed: show the word" onPress={() => setStep('judge')} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (step === 'judge') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.wrap}>
          <WordCard am={round.word.am} en={round.word.en} label="The secret word · ሚስጥራዊው ቃል" />
          <Text style={styles.bigText}>Did {guesser} guess it?</Text>
          <View style={styles.buttons}>
            <Button title={`Yes, ${guesser} got it`} variant="danger" onPress={() => finish('guessed', guesser)} />
            <Button title="No, wrong word" onPress={() => finish('caught', guesser)} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const crewWon = outcome === 'caught';
  const verdict =
    outcome === 'caught'
      ? `${guesser} was caught and missed the word. Everyone else wins!`
      : outcome === 'guessed'
        ? `${guesser} was caught but guessed the word. The ${imposterNames.length > 1 ? 'imposters win' : 'imposter wins'}!`
        : `The ${imposterNames.length > 1 ? 'imposters got' : 'imposter got'} away with it!`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.emoji}>{crewWon ? '🎉' : '🕵️'}</Text>
        <Text style={[styles.winner, { color: crewWon ? colors.green : colors.red }]}>
          {crewWon ? 'Players win!' : imposterNames.length > 1 ? 'Imposters win!' : 'Imposter wins!'}
        </Text>
        <Text style={styles.verdict}>{verdict}</Text>

        <View style={styles.cards}>
          <WordCard am={round.word.am} en={round.word.en} label="The secret word · ሚስጥራዊው ቃል" />
          <WordCard am={hint.am} en={hint.en} label={`Imposter saw · ${hint.label.split(' · ')[0]}`} accent={colors.red} />
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
  label: { color: colors.muted, fontSize: 18 },
  imposter: { color: colors.red, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  winner: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  verdict: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  bigText: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  question: { color: colors.text, fontSize: 20, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, alignSelf: 'stretch' },
  rule: { color: colors.text, fontSize: 15, lineHeight: 21 },
  cards: { alignSelf: 'stretch', gap: spacing.md },
  buttons: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
});
