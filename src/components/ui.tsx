import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import type { Category } from '../data/words';
import { colors, fonts, radius, spacing } from '../theme';

export function Screen({ children, edges = ['top', 'bottom', 'left', 'right'] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** Text that may contain Ge'ez script. */
export function Am({ style, bold, ...props }: TextProps & { bold?: boolean }) {
  return <Text {...props} style={[styles.am, bold && { fontFamily: fonts.ethiopicBold }, style]} />;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const bg = { primary: colors.green, secondary: colors.cardAlt, danger: colors.red, ghost: 'transparent' }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && styles.ghost,
        style,
      ]}
    >
      <Am style={styles.buttonText} bold>
        {title}
      </Am>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipOn, disabled && { opacity: 0.35 }]}
    >
      <Am style={[styles.chipText, selected && { color: colors.bg }]}>{label}</Am>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** Big Amharic word with the English underneath (or English alone for English-only custom words). */
export function WordCard({ am, en, label, accent = colors.yellow }: { am: string; en: string; label?: string; accent?: string }) {
  return (
    <View style={[styles.wordCard, { borderColor: accent }]}>
      {label ? <Am style={styles.wordLabel}>{label}</Am> : null}
      <Am bold style={[styles.wordMain, { color: accent }]} adjustsFontSizeToFit numberOfLines={2}>
        {am || en}
      </Am>
      {am && en ? <Text style={styles.wordSub}>{en}</Text> : null}
    </View>
  );
}

export function EndGameButton({ onPress, label = 'End game' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={({ pressed }) => [styles.endGame, pressed && { opacity: 0.6 }]}>
      <Text style={styles.endGameText}>✕ {label}</Text>
    </Pressable>
  );
}

export function FlagStripe() {
  return (
    <View style={styles.flag}>
      <View style={[styles.flagBar, { backgroundColor: colors.green }]} />
      <View style={[styles.flagBar, { backgroundColor: colors.yellow }]} />
      <View style={[styles.flagBar, { backgroundColor: colors.red }]} />
    </View>
  );
}

export const categoryLabel = (c: Category) => `${c.emoji} ${c.nameEn}`;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  am: { fontFamily: fonts.ethiopic, color: colors.text },
  button: {
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.text, fontSize: 17 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.yellow, borderColor: colors.yellow },
  chipText: { color: colors.text, fontSize: 14 },
  section: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  wordCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  wordLabel: { color: colors.muted, fontSize: 14, marginBottom: spacing.sm },
  wordMain: { fontSize: 44, textAlign: 'center', lineHeight: 64 },
  wordSub: { color: colors.text, fontSize: 20, marginTop: spacing.xs, textAlign: 'center' },
  endGame: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  endGameText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  flag: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', width: 120 },
  flagBar: { flex: 1 },
});
