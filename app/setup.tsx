import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, Screen, SectionTitle, categoryLabel } from '../src/components/ui';
import { useGame } from '../src/context/GameContext';
import { HINT_MODES } from '../src/game/hint';
import { maxImposters, MIN_PLAYERS } from '../src/game/logic';
import { colors, radius, spacing } from '../src/theme';

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

export default function Setup() {
  const { players, setPlayers, settings, updateSettings, categories, allWords, startRound } = useGame();
  const [name, setName] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of allWords) m.set(w.category, (m.get(w.category) ?? 0) + 1);
    return m;
  }, [allWords]);

  const maxImp = maxImposters(players.length);

  const addPlayer = () => {
    const n = name.trim();
    if (!n) return;
    if (players.some((p) => p.toLowerCase() === n.toLowerCase())) {
      Alert.alert('Name already added', `"${n}" is already playing. Use a different name.`);
      return;
    }
    setPlayers([...players, n]);
    setName('');
  };

  const toggleCategory = (id: string) => {
    const on = settings.enabledCategories.includes(id);
    updateSettings({
      enabledCategories: on ? settings.enabledCategories.filter((c) => c !== id) : [...settings.enabledCategories, id],
    });
  };

  const start = () => {
    const error = startRound();
    if (error) Alert.alert("Can't start yet", error);
    else router.push('/reveal');
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionTitle>Players ({players.length})</SectionTitle>
          <View style={styles.addRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Player name"
              placeholderTextColor={colors.muted}
              style={styles.input}
              onSubmitEditing={addPlayer}
              submitBehavior="submit"
              returnKeyType="done"
              autoCapitalize="words"
            />
            <Button title="Add" onPress={addPlayer} style={styles.addBtn} />
          </View>
          {players.map((p, i) => (
            <View key={p} style={styles.playerRow}>
              <Text style={styles.playerNum}>{i + 1}</Text>
              <Text style={styles.playerName}>{p}</Text>
              <Pressable hitSlop={12} onPress={() => setPlayers(players.filter((x) => x !== p))}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))}
          {players.length < MIN_PLAYERS ? (
            <Text style={styles.hint}>Add at least {MIN_PLAYERS} players.</Text>
          ) : null}

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
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Start Game" onPress={start} disabled={players.length < MIN_PLAYERS} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 17,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: { paddingHorizontal: spacing.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  playerNum: { color: colors.yellow, fontWeight: '800', width: 28, fontSize: 16 },
  playerName: { color: colors.text, fontSize: 17, flex: 1 },
  remove: { color: colors.red, fontSize: 18, fontWeight: '700' },
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
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
