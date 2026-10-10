import { colors, Screen, SectionTitle, spacing } from '@gamehub/ui';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MIN_PLAYERS, PLACE_POINTS } from '../logic';

const STEPS = [
  `Add everyone's name (${MIN_PLAYERS} or more players) and pick what kind of words to write.`,
  'Pass the phone around. Each player secretly types a word. Famous people work great, but anything goes.',
  "The words are shuffled and dealt out. Nobody gets the word they wrote, and nobody sees their own word.",
  'On your turn, tap Ready and hold the phone against your forehead, screen facing out. Everyone else can now see your word.',
  'Ask yes/no questions to work out what it is: "Am I a person?", "Can I be eaten?", "Am I in Ethiopia?"',
  'Make a guess whenever you like. If you\'re right, the others tap "Got it!". If your turn is over (time ran out, or you agreed on a set number of questions), they tap "Turn over" and the phone goes to the next player.',
  'The first to guess their word wins. Keep going to find out who comes second and third, or end the round at any time.',
];

const WIFI = [
  `Everyone opens Who Am I? → "Play on Wi-Fi" on their own phone, on the same Wi-Fi or one phone's hotspot. One player hosts, the others join.`,
  "Each phone shows who you're writing a word for. Type it in secret; you can change it until everyone is done.",
  "Your phone shows everyone's words except your own, so no forehead needed. The player whose turn it is asks the questions.",
  'Type a guess on your phone (an exact match counts by itself), or say it out loud and let the others tap "Got it!".',
];

const SCORING = [
  `First to guess: +${PLACE_POINTS[0]}`,
  `Second: +${PLACE_POINTS[1]}`,
  `Third: +${PLACE_POINTS[2]}`,
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

        <SectionTitle>Playing on Wi-Fi</SectionTitle>
        {WIFI.map((s, i) => (
          <Text key={i} style={styles.step}>
            • {s}
          </Text>
        ))}

        <SectionTitle>Points</SectionTitle>
        {SCORING.map((s, i) => (
          <Text key={i} style={styles.step}>
            • {s}
          </Text>
        ))}
        <Text style={styles.step}>
          Points add up on the leaderboard, round after round. Turn off "Points & leaderboard" in setup to just play.
        </Text>

        <SectionTitle>Tips</SectionTitle>
        <Text style={styles.step}>• Pick words the others know. A word nobody can describe isn't fun to guess.</Text>
        <Text style={styles.step}>• House rule idea: keep asking while the answers are "yes"; your turn ends on the first "no".</Text>
        <Text style={styles.step}>• Set a turn timer in setup to keep things moving.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.md },
  step: { color: colors.text, fontSize: 16, lineHeight: 23 },
  num: { color: colors.yellow, fontWeight: '800' },
});
