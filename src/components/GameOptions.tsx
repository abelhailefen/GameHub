import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useGame } from '../context/GameContext';
import { HINT_MODES } from '../game/hint';
import { maxImposters } from '../game/logic';
import { colors, radius, spacing } from '../theme';
import { Button, Chip, SectionTitle, categoryLabel } from './ui';

const TIMER_OPTIONS = [0, 3, 5, 8];
const VOTE_OPTIONS = [0, 30, 60, 120];
const voteLabel = (s: number) => (s === 0 ? 'Off' : s < 60 ? `${s}s` : `${s / 60} min`);

/** Quick presets plus a free-text box, so any length can be set. 0 = off. */
function TimerSetting({
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

/** Game options shared by pass-and-play setup and the LAN lobby: imposters, categories, hints, timers. */
export function GameOptions({ playerCount }: { playerCount: number }) {
  const { settings, updateSettings, categories, allWords } = useGame();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of allWords) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [allWords]);

  const maxImp = maxImposters(playerCount);

  const toggleCategory = (id: string) => {
    const on = settings.enabledCategories.includes(id);
    updateSettings({
      enabledCategories: on ? settings.enabledCategories.filter((c) => c !== id) : [...settings.enabledCategories, id],
    });
  };

  return (
    <>
      <SectionTitle>Imposters</SectionTitle>
      <View style={styles.chips}>
        {[1, 2].map((n) => (
          <Chip
            key={n}
            label={`${n} imposter${n > 1 ? 's' : ''}`}
            selected={Math.min(settings.imposterCount, maxImp) === n}
            disabled={n > maxImp}
            onPress={() => updateSettings({ imposterCount: n })}
          />
        ))}
      </View>
      {maxImp < 2 ? <Text style={styles.hint}>2 imposters needs 6+ players.</Text> : null}

      <SectionTitle>Categories</SectionTitle>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={`${categoryLabel(c)} (${counts.get(c.id) ?? 0})`}
            selected={settings.enabledCategories.includes(c.id)}
            onPress={() => toggleCategory(c.id)}
          />
        ))}
      </View>

      <SectionTitle>Imposter hint</SectionTitle>
      <View style={styles.chips}>
        {HINT_MODES.map((m) => (
          <Chip
            key={m.id}
            label={`${m.label} · ${m.sub}`}
            selected={settings.hintMode === m.id}
            onPress={() => updateSettings({ hintMode: m.id })}
          />
        ))}
      </View>
      <Text style={styles.hint}>
        {settings.hintMode === 'easy'
          ? 'Easy: a closely related word, e.g. ማር → ንብ (Bee). Picked at random from 4.'
          : settings.hintMode === 'hard'
            ? 'Hard: a vague clue that fits many words, e.g. ማር → መድኃኒት (Medicine). Picked at random from 4.'
            : 'Brutal: the imposter only sees the category.'}
      </Text>

      <SectionTitle>Discussion timer</SectionTitle>
      <TimerSetting
        presets={TIMER_OPTIONS}
        value={settings.timerMinutes}
        onChange={(timerMinutes) => updateSettings({ timerMinutes })}
        format={(m) => (m === 0 ? 'Off' : `${m} min`)}
        unit="minutes"
        max={180}
      />
      <Text style={styles.hint}>Starts when you press "Discuss", after everyone has given their clue.</Text>

      <SectionTitle>Voting timer</SectionTitle>
      <TimerSetting
        presets={VOTE_OPTIONS}
        value={settings.votingSeconds}
        onChange={(votingSeconds) => updateSettings({ votingSeconds })}
        format={voteLabel}
        unit="seconds"
        max={3600}
      />
      <Text style={styles.hint}>Counts down while you vote. It never reveals the imposter by itself.</Text>

      <SectionTitle>Points & leaderboard</SectionTitle>
      <View style={styles.chips}>
        <Chip label="On" selected={settings.scoring} onPress={() => updateSettings({ scoring: true })} />
        <Chip label="Off" selected={!settings.scoring} onPress={() => updateSettings({ scoring: false })} />
      </View>
      <Text style={styles.hint}>
        {settings.scoring
          ? 'Winners earn points each round and a leaderboard keeps the totals.'
          : 'Just play: no points and no leaderboard. Scores so far are kept for when you turn it back on.'}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, marginTop: spacing.sm },
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
