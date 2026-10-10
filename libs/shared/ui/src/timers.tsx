import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from './theme';
import { Button, Chip } from './ui';

export const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** A big clock. Turns red and says "Time's up!" at zero. */
export function Countdown({ left, done }: { left: number; done: boolean }) {
  return (
    <View style={styles.timerBox}>
      <Text style={[styles.timer, done && { color: colors.red }]}>{done ? "Time's up!" : formatSeconds(left)}</Text>
    </View>
  );
}

/** Quick presets plus a free-text box, so any length can be set. 0 = off. */
export function TimerSetting({
  presets,
  value,
  onChange,
  format,
  unit,
  max,
}: {
  presets: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  unit: string;
  max: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = Math.max(0, Math.min(max, parseInt(draft.replace(/[^0-9]/g, ''), 10) || 0));
    setDraft(String(n));
    onChange(n);
  };

  return (
    <>
      <View style={styles.chips}>
        {presets.map((p) => (
          <Chip key={p} label={format(p)} selected={value === p} onPress={() => onChange(p)} />
        ))}
      </View>
      <View style={styles.customRow}>
        <Text style={styles.customLabel}>Or set your own:</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          maxLength={4}
          selectTextOnFocus
          style={styles.customInput}
        />
        <Text style={styles.customLabel}>{unit}</Text>
        <Button title="Set" variant="secondary" onPress={commit} style={styles.setBtn} />
      </View>
    </>
  );
}

/** "Off", "30s", "2 min". */
export const secondsLabel = (s: number) => (s === 0 ? 'Off' : s < 60 ? `${s}s` : `${s / 60} min`);

const styles = StyleSheet.create({
  timerBox: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  timer: { color: colors.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  customLabel: { color: colors.muted, fontSize: 14 },
  customInput: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 17,
    minWidth: 64,
    textAlign: 'center',
  },
  setBtn: { paddingVertical: 10, paddingHorizontal: spacing.md },
});
