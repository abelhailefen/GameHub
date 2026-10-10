import { Button, colors, Leaderboard, PlayerList, Screen, spacing } from '@gamehub/ui';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useWhoAmI } from '../context';
import { MIN_PLAYERS } from '../logic';
import { GameOptions } from '../options';
import { routes } from '../routes';

export default function Setup() {
  const { players, setPlayers, settings, scores, resetScores, startRound } = useWhoAmI();

  const confirmReset = () =>
    Alert.alert('Reset the leaderboard?', "Everyone's points go back to 0.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetScores },
    ]);

  const start = () => {
    const error = startRound();
    if (error) Alert.alert("Can't start yet", error);
    else router.push(routes.write);
  };

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PlayerList players={players} onChange={setPlayers} minPlayers={MIN_PLAYERS} />

          {settings.scoring && players.some((p) => scores[p]) ? (
            <View style={{ marginTop: spacing.lg }}>
              <Leaderboard rows={players.map((p) => ({ key: p, name: p, score: scores[p] ?? 0 }))} onReset={confirmReset} />
            </View>
          ) : null}

          <GameOptions />
        </ScrollView>

        <View style={styles.footer}>
          <Button title="Start: write the words" onPress={start} disabled={players.length < MIN_PLAYERS} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
