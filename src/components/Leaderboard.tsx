import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export type ScoreRow = { key: string; name: string; score: number; /** Points earned this round. */ delta?: number; you?: boolean };

const MEDALS = ['🥇', '🥈', '🥉'];

/** Players ranked by total points. Players on the same score share a rank. */
export function Leaderboard({ rows, title = 'Leaderboard', onReset }: { rows: ScoreRow[]; title?: string; onReset?: () => void }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const anyPoints = sorted.some((r) => r.score > 0);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>🏆 {title}</Text>
        {onReset && anyPoints ? (
          <Pressable hitSlop={12} onPress={onReset}>
            <Text style={styles.reset}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
      {sorted.map((r, i) => {
        const rank = sorted.findIndex((o) => o.score === r.score);
        const leader = anyPoints && rank === 0;
        return (
          <View key={r.key} style={[styles.row, leader && styles.rowLeader]}>
            <Text style={styles.rank}>{anyPoints && rank < 3 ? MEDALS[rank] : `${rank + 1}`}</Text>
            <Text style={[styles.name, leader && { color: colors.yellow }]} numberOfLines={1}>
              {r.name}
              {r.you ? <Text style={styles.you}> (you)</Text> : null}
            </Text>
            {r.delta ? <Text style={styles.delta}>+{r.delta}</Text> : null}
            <Text style={[styles.score, leader && { color: colors.yellow }]}>{r.score}</Text>
          </View>
        );
      })}
      {!anyPoints ? <Text style={styles.empty}>No points yet. Win a round to get on the board!</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, alignSelf: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  title: { color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  reset: { color: colors.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  rowLeader: { backgroundColor: colors.cardAlt },
  rank: { width: 28, textAlign: 'center', color: colors.muted, fontSize: 16, fontWeight: '800' },
  name: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  you: { color: colors.muted, fontWeight: '400' },
  delta: { color: colors.green, fontSize: 14, fontWeight: '800' },
  score: { minWidth: 32, textAlign: 'right', color: colors.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.sm },
});
