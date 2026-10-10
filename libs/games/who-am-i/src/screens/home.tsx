import { Am, BackToHub, Button, colors, FlagStripe, Screen, spacing } from '@gamehub/ui';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { routes } from '../routes';

export default function Home() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <BackToHub />
        <View style={styles.hero}>
          <Text style={styles.emoji}>🤔</Text>
          <Text style={styles.title}>Who Am I?</Text>
          <Am bold style={styles.titleAm}>
            እኔ ማን ነኝ?
          </Am>
          <FlagStripe />
          <Text style={styles.sub}>Everyone can see your word except you.</Text>
        </View>

        <View style={styles.buttons}>
          <Button title="Play (one phone)" onPress={() => router.push(routes.setup)} />
          <Button title="How to Play" variant="ghost" onPress={() => router.push(routes.howToPlay)} />
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
  sub: { color: colors.muted, marginTop: spacing.md, textAlign: 'center' },
  buttons: { gap: spacing.md },
});
