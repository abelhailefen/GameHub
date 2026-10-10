import { Chip, colors, SectionTitle, secondsLabel, spacing, TimerSetting } from '@gamehub/ui';
import { StyleSheet, Text, View } from 'react-native';
import { useWhoAmI } from './context';
import { PLACE_POINTS, THEMES, themeById } from './logic';

const TURN_OPTIONS = [0, 30, 60, 120];

/** Game options shared by pass-and-play setup and the Wi-Fi lobby: theme, turn timer, points. */
export function GameOptions() {
  const { settings, updateSettings } = useWhoAmI();

  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.muted, marginTop: spacing.sm },
});
