import { Am, colors, FlagStripe, radius, Screen, spacing } from '@gamehub/ui';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAMES } from '../src/games';

export default function Hub() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.emoji}>🎲</Text>
          <Text style={styles.title}>GameHub</Text>
          <Am bold style={styles.titleAm}>
            የጨዋታ ማዕከል
          </Am>
          <FlagStripe />
          <Text style={styles.sub}>Party games for when you're all together.</Text>
        </View>

        {GAMES.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => router.push(g.route)}
            style={({ pressed }) => [styles.card, { borderColor: g.accent }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.cardEmoji}>{g.emoji}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{g.title}</Text>
              {g.titleAm ? <Am style={[styles.cardTitleAm, { color: g.accent }]}>{g.titleAm}</Am> : null}
              <Text style={styles.tagline}>{g.tagline}</Text>
              <Text style={styles.players}>{g.players}</Text>
            </View>
            <Text style={[styles.chevron, { color: g.accent }]}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  emoji: { fontSize: 64 },
  title: { color: colors.text, fontSize: 44, fontWeight: '800' },
  titleAm: { color: colors.yellow, fontSize: 24, marginBottom: spacing.sm },
  sub: { color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.md,
  },
  cardEmoji: { fontSize: 44 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  cardTitleAm: { fontSize: 16 },
  tagline: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
  players: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  chevron: { fontSize: 36, fontWeight: '300' },
});
