import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { goHome, goToSetup, useGameBackButton } from '../src/game/exit';
import { Button, Screen, WordCard } from '../src/components/ui';
import { useGame } from '../src/context/GameContext';
import { colors, spacing } from '../src/theme';

export default function Result() {
  const { round: currentRound, startRound } = useGame();
  // Freeze the round this screen was opened for. "Play Again" starts the next round while this
  // screen is still animating out; reading the live round would flash the NEW imposter and word.
  const [round] = useState(currentRound);

  // The round is over, so back just returns to setup.
  useGameBackButton(goToSetup);

  if (!round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={() => router.dismissAll()} />
        </View>
      </Screen>
    );
  }

  const imposterNames = round.imposters.map((i) => round.players[i]);
  const hint = round.hint;

  const playAgain = () => {
    const error = startRound();
    if (error) Alert.alert("Can't start", error);
    else router.replace('/reveal');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.emoji}>🕵️</Text>
        <Text style={styles.label}>{imposterNames.length > 1 ? 'The imposters were' : 'The imposter was'}</Text>
        <Text style={styles.imposter}>{imposterNames.join(' & ')}</Text>

        <View style={styles.cards}>
          <WordCard am={round.word.am} en={round.word.en} label="The secret word · ሚስጥራዊው ቃል" />
          <WordCard am={hint.am} en={hint.en} label={`Imposter saw · ${hint.label.split(' · ')[0]}`} accent={colors.red} />
        </View>

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
  wrap: { flexGrow: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 56 },
  label: { color: colors.muted, fontSize: 18 },
  imposter: { color: colors.red, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  cards: { alignSelf: 'stretch', gap: spacing.md, marginVertical: spacing.lg },
  buttons: { alignSelf: 'stretch', gap: spacing.md },
});
