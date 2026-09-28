import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Am, Button, FlagStripe, Screen } from '../src/components/ui';
import { useGame } from '../src/context/GameContext';
import { colors, spacing } from '../src/theme';

export default function Home() {
  const { allWords, categories } = useGame();

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>🕵️</Text>
          <Text style={styles.title}>Imposter</Text>
          <Am bold style={styles.titleAm}>
            አስመሳዩ ማነው?
          </Am>
          <FlagStripe />
          <Text style={styles.stats}>
            {allWords.length} Ethiopian words · {categories.length} categories
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button title="Play (one phone)" onPress={() => router.push('/setup')} />
          <Button title="Play on Wi-Fi (each on own phone)" variant="secondary" onPress={() => router.push('/lan')} />
          <Button title="Manage Words" variant="secondary" onPress={() => router.push('/words')} />
          <Button title="How to Play" variant="ghost" onPress={() => router.push('/how-to-play')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emoji: { fontSize: 72 },
  title: { color: colors.text, fontSize: 44, fontWeight: '800' },
  titleAm: { color: colors.yellow, fontSize: 26, marginBottom: spacing.sm },
  stats: { color: colors.muted, marginTop: spacing.md },
  buttons: { gap: spacing.md },
});
