import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GameOptions } from '../src/components/GameOptions';
import { Leaderboard } from '../src/components/Leaderboard';
import { Button, Screen, SectionTitle } from '../src/components/ui';
import { useGame } from '../src/context/GameContext';
import { MIN_PLAYERS } from '../src/game/logic';
import { colors, radius, spacing } from '../src/theme';

export default function Setup() {
  const { players, setPlayers, startRound, scores, resetScores, settings } = useGame();
  const [name, setName] = useState('');

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

  const confirmReset = () =>
    Alert.alert('Reset the leaderboard?', "Everyone's points go back to 0.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetScores },
    ]);

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

          {settings.scoring && players.some((p) => scores[p]) ? (
            <View style={{ marginTop: spacing.lg }}>
              <Leaderboard rows={players.map((p) => ({ key: p, name: p, score: scores[p] ?? 0 }))} onReset={confirmReset} />
            </View>
          ) : null}

          <GameOptions playerCount={players.length} />
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
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
