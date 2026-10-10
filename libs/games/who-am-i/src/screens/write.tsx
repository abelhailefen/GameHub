import { Button, colors, EndGameButton, radius, Screen, spacing } from '@gamehub/ui';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useWhoAmI } from '../context';
import { confirmQuit, goHome, useGameBackButton } from '../exit';
import { cleanWord, dealWords, MAX_WORD_LENGTH, themeById, writeWord } from '../logic';
import { routes } from '../routes';

/** The phone goes round once: each player secretly writes a word for someone else to guess. */
export default function Write() {
  const { round, setRound } = useWhoAmI();
  const [step, setStep] = useState(0);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState('');

  useGameBackButton(() => confirmQuit());

  if (!round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const player = round.writeOrder[step];
  const name = round.players[player];
  const isLast = step === round.writeOrder.length - 1;
  const theme = themeById(round.theme);

  const lockIn = () => {
    if (!cleanWord(draft)) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = writeWord(round, player, draft);
    setDraft('');
    setWriting(false);
    if (isLast) {
      setRound(dealWords(next));
      router.replace(routes.play);
    } else {
      setRound(next);
      setStep(step + 1);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.wrap}>
          <EndGameButton onPress={() => confirmQuit()} />

          {!writing ? (
            <>
              <View style={styles.center}>
                <Text style={styles.counter}>
                  Word {step + 1} of {round.players.length}
                </Text>
                {step > 0 ? <Text style={styles.done}>✓ {round.players[round.writeOrder[step - 1]]}'s word is locked in</Text> : null}
                <Text style={styles.passTo}>Pass the phone to</Text>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.note}>Only {name} should look at the screen.</Text>
              </View>
              <Button title={`I'm ${name}: write my word`} onPress={() => setWriting(true)} />
            </>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
                <Text style={styles.passTo}>{name}, write a word</Text>
                <View style={styles.themeBox}>
                  <Text style={styles.themeTitle}>
                    {theme.emoji} {theme.label}
                  </Text>
                  <Text style={styles.note}>{theme.example}</Text>
                </View>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Your word"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  autoFocus
                  autoCorrect={false}
                  maxLength={MAX_WORD_LENGTH}
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={lockIn}
                />
                <Text style={styles.note}>
                  It goes to a random player (never back to you). Pick something they could guess with yes/no questions.
                </Text>
              </ScrollView>
              <Button title={isLast ? 'Lock it in: start guessing!' : 'Lock it in'} onPress={lockIn} disabled={!cleanWord(draft)} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  counter: { color: colors.muted, fontSize: 14 },
  done: { color: colors.green, fontSize: 15, fontWeight: '700' },
  passTo: { color: colors.text, fontSize: 20, textAlign: 'center' },
  name: { color: colors.yellow, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  note: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  themeBox: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignSelf: 'stretch', gap: spacing.xs },
  themeTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  input: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.yellow,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 22,
    textAlign: 'center',
  },
});
