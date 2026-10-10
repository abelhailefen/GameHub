import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from './theme';
import { Button, SectionTitle } from './ui';

/** Add / remove player names. Names are unique, ignoring case. */
export function PlayerList({
  players,
  onChange,
  minPlayers,
}: {
  players: string[];
  onChange: (players: string[]) => void;
  minPlayers: number;
}) {
  const [name, setName] = useState('');

  const addPlayer = () => {
    const n = name.trim();
    if (!n) return;
    if (players.some((p) => p.toLowerCase() === n.toLowerCase())) {
      Alert.alert('Name already added', `"${n}" is already playing. Use a different name.`);
      return;
    }
    onChange([...players, n]);
    setName('');
  };

  return (
    <>
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
          <Pressable hitSlop={12} onPress={() => onChange(players.filter((x) => x !== p))}>
            <Text style={styles.remove}>✕</Text>
          </Pressable>
        </View>
      ))}
      {players.length < minPlayers ? <Text style={styles.hint}>Add at least {minPlayers} players.</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
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
});
