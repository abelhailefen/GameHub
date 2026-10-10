import {
  Button,
  Chip,
  colors,
  Leaderboard,
  PlayerList,
  Screen,
  SectionTitle,
  secondsLabel,
  spacing,
  TimerSetting,
} from '@gamehub/ui';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWhoAmI } from '../context';
import { MIN_PLAYERS, PLACE_POINTS, THEMES, themeById } from '../logic';
import { routes } from '../routes';

const TURN_OPTIONS = [0, 30, 60, 120];

export default function Setup() {
  const { players, setPlayers, settings, updateSettings, scores, resetScores, startRound } = useWhoAmI();

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

          <SectionTitle>Words to write</SectionTitle>
          <View style={styles.chips}>
            {THEMES.map((t) => (
              <Chip
                key={t.id}
                label={`${t.emoji} ${t.label}`}
                selected={settings.theme === t.id}
                onPress={() => updateSettings({ theme: t.id })}
              />
            ))}
          </View>
          <Text style={styles.hint}>{themeById(settings.theme).example}. Everyone sees the theme while guessing.</Text>

          <SectionTitle>Turn timer</SectionTitle>
          <TimerSetting
            presets={TURN_OPTIONS}
            value={settings.turnSeconds}
            onChange={(turnSeconds) => updateSettings({ turnSeconds })}
            format={secondsLabel}
            unit="seconds"
            max={600}
          />
          <Text style={styles.hint}>How long each player gets to ask questions. It buzzes at zero but never ends the turn by itself.</Text>

          <SectionTitle>Points & leaderboard</SectionTitle>
          <View style={styles.chips}>
            <Chip label="On" selected={settings.scoring} onPress={() => updateSettings({ scoring: true })} />
            <Chip label="Off" selected={!settings.scoring} onPress={() => updateSettings({ scoring: false })} />
          </View>
          <Text style={styles.hint}>
            {settings.scoring
              ? `First to guess gets +${PLACE_POINTS[0]}, second +${PLACE_POINTS[1]}, third +${PLACE_POINTS[2]}.`
              : 'Just play: no points and no leaderboard. Scores so far are kept for when you turn it back on.'}
          </Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.muted, marginTop: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
