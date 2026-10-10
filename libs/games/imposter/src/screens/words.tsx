import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Am, Button, Chip, colors, fonts, radius, Screen, SectionTitle, spacing } from '@gamehub/ui';
import { useGame } from '../context/GameContext';
import { BUILT_IN_WORDS, categoryLabel, type Clue, type Word } from '../data/words';

function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

const HINT_SLOTS = 4;
const emptyClues = (): Clue[] => Array.from({ length: HINT_SLOTS }, () => ({ am: '', en: '' }));
const clueText = (clues: Clue[]) => clues.map((c) => [c.am, c.en].filter(Boolean).join(' / ')).join(' · ');

/** Up to four Amharic / English hint pairs. */
function ClueFields({ title, clues, onChange }: { title: string; clues: Clue[]; onChange: (c: Clue[]) => void }) {
  const set = (i: number, patch: Partial<Clue>) => onChange(clues.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <>
      <Text style={styles.fieldLabel}>{title}</Text>
      {clues.map((c, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            value={c.am}
            onChangeText={(am) => set(i, { am })}
            placeholder={`ፍንጭ ${i + 1}`}
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.amInput, { flex: 1 }]}
          />
          <TextInput
            value={c.en}
            onChangeText={(en) => set(i, { en })}
            placeholder={`Hint ${i + 1}`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
      ))}
    </>
  );
}

function WordRow({ word, onDelete }: { word: Word; onDelete?: () => void }) {
  return (
    <View style={styles.wordRow}>
      <View style={{ flex: 1 }}>
        <Am style={styles.wordText}>
          {word.am || word.en}
          {word.am && word.en ? <Text style={styles.wordEn}>  {word.en}</Text> : null}
        </Am>
        <Am style={styles.hintText}>Easy: {clueText(word.easy)}</Am>
        {word.hard.length > 0 ? <Am style={styles.hintText}>Hard: {clueText(word.hard)}</Am> : null}
      </View>
      {onDelete ? (
        <Pressable hitSlop={12} onPress={onDelete}>
          <Text style={styles.remove}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Words() {
  const {
    categories,
    customWords,
    customCategories,
    addCustomWord,
    deleteCustomWord,
    addCustomCategory,
    deleteCustomCategory,
    exportCustom,
    importCustom,
  } = useGame();

  const [am, setAm] = useState('');
  const [en, setEn] = useState('');
  const [easy, setEasy] = useState(emptyClues);
  const [hard, setHard] = useState(emptyClues);
  const [category, setCategory] = useState(categories[0].id);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatAm, setNewCatAm] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const [browse, setBrowse] = useState<string | null>(null);

  const customByCategory = useMemo(() => {
    const m = new Map<string, Word[]>();
    for (const w of customWords) m.set(w.category, [...(m.get(w.category) ?? []), w]);
    return m;
  }, [customWords]);

  const createCategory = () => {
    if (!newCatEn.trim() && !newCatAm.trim()) {
      Alert.alert('Category name', 'Enter a name for the new category.');
      return;
    }
    const cat = addCustomCategory(newCatEn, newCatAm);
    setCategory(cat.id);
    setNewCatOpen(false);
    setNewCatEn('');
    setNewCatAm('');
  };

  const submit = () => {
    const error = addCustomWord({ am, en, easy, hard, category });
    if (error) {
      Alert.alert("Can't add word", error);
      return;
    }
    setAdded(am.trim() || en.trim());
    setAm('');
    setEn('');
    setEasy(emptyClues());
    setHard(emptyClues());
    setTimeout(() => setAdded(null), 2500);
  };

  const confirmDeleteCategory = (id: string, name: string) => {
    const n = customByCategory.get(id)?.length ?? 0;
    Alert.alert('Delete category?', `"${name}" and its ${n} word${n === 1 ? '' : 's'} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteCustomCategory(id);
          if (category === id) setCategory(categories[0].id);
        },
      },
    ]);
  };

  const share = async () => {
    if (customWords.length === 0 && customCategories.length === 0) {
      Alert.alert('Nothing to share yet', 'Add some of your own words first.');
      return;
    }
    await Share.share({ message: exportCustom() });
  };

  const runImport = () => {
    try {
      const res = importCustom(importText);
      Alert.alert('Imported', `Added ${res.words} word${res.words === 1 ? '' : 's'} and ${res.categories} new categor${res.categories === 1 ? 'y' : 'ies'}.`);
      setImportText('');
      setImportOpen(false);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionTitle>Add a word</SectionTitle>
          <View style={styles.card}>
            <View style={styles.row}>
              <Field label="Word (Amharic)" value={am} onChangeText={setAm} placeholder="ለምሳሌ ጭኮ" style={styles.amInput} />
              <Field label="English / Latin" value={en} onChangeText={setEn} placeholder="e.g. Chiko" />
            </View>
            <ClueFields title="Easy hints (closely related, at least one)" clues={easy} onChange={setEasy} />
            <ClueFields title="Hard hints (vague, fit many words; optional)" clues={hard} onChange={setHard} />
            <Text style={styles.help}>
              Each round the imposter sees one of these at random, depending on the difficulty chosen in Setup. With
              no hard hints, the easy ones are used.
            </Text>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chips}>
              {categories.map((c) => (
                <Chip key={c.id} label={categoryLabel(c)} selected={category === c.id} onPress={() => setCategory(c.id)} />
              ))}
              <Chip label="+ New category" selected={newCatOpen} onPress={() => setNewCatOpen(!newCatOpen)} />
            </View>

            {newCatOpen ? (
              <View style={styles.newCat}>
                <View style={styles.row}>
                  <Field label="Name (English)" value={newCatEn} onChangeText={setNewCatEn} placeholder="e.g. Our Neighbourhood" />
                  <Field label="Name (Amharic)" value={newCatAm} onChangeText={setNewCatAm} placeholder="ሰፈራችን" style={styles.amInput} />
                </View>
                <Button title="Create category" variant="secondary" onPress={createCategory} />
              </View>
            ) : null}

            <Button title="Add word" onPress={submit} style={{ marginTop: spacing.md }} />
            {added ? <Am style={styles.added}>✓ Added "{added}"</Am> : null}
          </View>

          <SectionTitle>Your words ({customWords.length})</SectionTitle>
          {customWords.length === 0 ? (
            <Text style={styles.help}>No custom words yet. Words you add show up here and in games.</Text>
          ) : (
            categories
              .filter((c) => customByCategory.has(c.id))
              .map((c) => (
                <View key={c.id} style={styles.group}>
                  <Am style={styles.groupTitle}>{categoryLabel(c)}</Am>
                  {customByCategory.get(c.id)!.map((w) => (
                    <WordRow key={w.id} word={w} onDelete={() => deleteCustomWord(w.id)} />
                  ))}
                </View>
              ))
          )}

          {customCategories.length > 0 ? (
            <>
              <SectionTitle>Your categories</SectionTitle>
              {customCategories.map((c) => (
                <View key={c.id} style={styles.wordRow}>
                  <Am style={[styles.wordText, { flex: 1 }]}>
                    {categoryLabel(c)}
                    {c.nameAm && c.nameAm !== c.nameEn ? `  ${c.nameAm}` : ''}
                  </Am>
                  <Pressable hitSlop={12} onPress={() => confirmDeleteCategory(c.id, c.nameEn)}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </>
          ) : null}

          <SectionTitle>Share with friends</SectionTitle>
          <Text style={styles.help}>
            Send your custom words to a friend (e.g. on Telegram). They copy the message and paste it into Import.
          </Text>
          <View style={styles.row}>
            <Button title="Share my words" variant="secondary" onPress={share} style={{ flex: 1 }} />
            <Button title="Import" variant="secondary" onPress={() => setImportOpen(!importOpen)} style={{ flex: 1 }} />
          </View>
          {importOpen ? (
            <View style={[styles.card, { marginTop: spacing.sm }]}>
              <TextInput
                value={importText}
                onChangeText={setImportText}
                placeholder="Paste the shared words here"
                placeholderTextColor={colors.muted}
                multiline
                style={[styles.input, styles.importInput]}
              />
              <Button title="Import words" onPress={runImport} disabled={!importText.trim()} />
            </View>
          ) : null}

          <SectionTitle>Built-in words</SectionTitle>
          <Text style={styles.help}>Tap a category to see its words.</Text>
          {categories
            .filter((c) => !c.custom)
            .map((c) => {
              const list = BUILT_IN_WORDS.filter((w) => w.category === c.id);
              const open = browse === c.id;
              return (
                <View key={c.id} style={styles.group}>
                  <Pressable onPress={() => setBrowse(open ? null : c.id)} style={styles.browseHead}>
                    <Am style={styles.groupTitle}>
                      {categoryLabel(c)} · {c.nameAm} ({list.length})
                    </Am>
                    <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
                  </Pressable>
                  {open ? list.map((w) => <WordRow key={w.id} word={w} />) : null}
                </View>
              );
            })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: { color: colors.muted, fontSize: 13, marginBottom: 4, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amInput: { fontFamily: fonts.ethiopic },
  importInput: { minHeight: 100, textAlignVertical: 'top' },
  help: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newCat: { gap: spacing.sm, marginTop: spacing.sm },
  added: { color: colors.green, textAlign: 'center', marginTop: spacing.xs },
  group: { marginBottom: spacing.md },
  groupTitle: { color: colors.yellow, fontSize: 15, marginBottom: spacing.xs, flex: 1 },
  browseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  chevron: { color: colors.muted },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  wordText: { color: colors.text, fontSize: 17 },
  wordEn: { color: colors.muted, fontSize: 14 },
  hintText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  remove: { color: colors.red, fontSize: 18, fontWeight: '700', paddingLeft: spacing.md },
});
