import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, Screen, SectionTitle, spacing } from '@gamehub/ui';
import { POINTS } from '../game/scoring';

const STEPS = [
  'Add everyone\'s name (3 or more players) and pick categories.',
  'Pass the phone around. Each player presses and holds to secretly see their card.',
  'Everyone gets the same secret word, except the imposter. The imposter only gets a hint. Pick how much help that hint gives in Setup: Easy (a closely related word), Hard (a vague clue that fits many words) or Brutal (just the category). Every word has several hints, so the same word can give a different hint next time.',
  'Take turns around the circle. Each person says ONE word or short clue about the secret word. Not too obvious, or the imposter will figure it out!',
  'The imposter listens, uses the hint and bluffs to blend in.',
  'When everyone has given a clue, press "Discuss" to start the discussion timer. Then press "Start voting" for the voting countdown. The imposter is only revealed when you press the reveal button.',
  'If the imposter is caught, they get one guess at the secret word before it is shown. Guess right and the imposter still wins!',
];

const SCORING = [
  `Imposter caught and misses the word: everyone else gets +${POINTS.crewWin}.`,
  `Imposter escapes, or guesses the word: each imposter gets +${POINTS.imposterWin}.`,
  `Guessing the word after being caught: +${POINTS.guessBonus} extra for that imposter.`,
  `Wi-Fi games: +${POINTS.goodVote} for every player who voted for an imposter, win or lose.`,
];

export default function HowToPlay() {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <SectionTitle>How to play</SectionTitle>
        {STEPS.map((s, i) => (
          <Text key={i} style={styles.step}>
            <Text style={styles.num}>{i + 1}. </Text>
            {s}
          </Text>
        ))}

        <SectionTitle>Points</SectionTitle>
        {SCORING.map((s, i) => (
          <Text key={i} style={styles.step}>
            • {s}
          </Text>
        ))}
        <Text style={styles.step}>Points add up on the leaderboard, round after round. Reset it from the setup screen (or the lobby on Wi-Fi). Don't want points? Turn off "Points & leaderboard" in the game settings.</Text>

        <SectionTitle>Playing on Wi-Fi</SectionTitle>
        <Text style={styles.step}>
          Everyone can use their own phone. Connect all phones to the same Wi-Fi, or turn on one phone's hotspot and
          have the others join it. No internet is needed.
        </Text>
        <Text style={styles.step}>
          One person taps "Host a new game". The others open "Play on Wi-Fi" and tap the game when it appears. Each
          player sees their card on their own phone, votes on their own phone, and the host controls the round.
        </Text>

        <SectionTitle>Tips</SectionTitle>
        <Text style={styles.step}>• Regular players: be vague enough that the imposter can't guess the word.</Text>
        <Text style={styles.step}>• Imposter: listen to the others first. Your hint points you in the right direction.</Text>
        <Text style={styles.step}>• Add your own words (inside jokes, your neighbourhood, your favourite spots) in Manage Words.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  step: { color: colors.text, fontSize: 16, lineHeight: 23 },
  num: { color: colors.yellow, fontWeight: '800' },
});
