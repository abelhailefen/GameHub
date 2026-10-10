import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Am, Button, colors, EndGameButton, radius, Screen, SlideToReveal, spacing, WordCard } from '@gamehub/ui';
import { confirmEndGame, goHome, useGameBackButton } from '../game/exit';
import { useGame } from '../context/GameContext';
import { routes } from '../routes';

export default function Reveal() {
  const { round, categories } = useGame();
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(false);

  // New round → start from the first player in the (shuffled) reveal order again.
  useEffect(() => {
    setStep(0);
    setSeen(false);
  }, [round]);

  // Back asks to end the game instead of going back to (and peeking at) a previous card.
  useGameBackButton();

  if (!round) {
    return (
      <Screen>
        <View style={styles.center}>
          <Button title="Back to Home" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  const player = round.revealOrder[step];
  const name = round.players[player];
  const isImposter = round.imposters.includes(player);
  const isLast = step === round.revealOrder.length - 1;
  const category = categories.find((c) => c.id === round.word.category);
  const hint = round.hint;

  const next = () => {
    if (isLast) {
      router.replace(routes.discuss);
      return;
    }
    setStep(step + 1);
    setSeen(false);
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <EndGameButton onPress={confirmEndGame} />
        <View style={styles.top}>
          <Text style={styles.counter}>
            Player {step + 1} of {round.players.length}
          </Text>
          <Text style={styles.passTo}>{seen ? 'Done? Pass the phone on.' : 'Pass the phone to'}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>

        <SlideToReveal
          key={step}
          accent={isImposter ? colors.red : colors.green}
          onSeen={() => setSeen(true)}
          cover={
            <View style={styles.center}>
              <View style={styles.grip} />
              <Text style={styles.coverArrow}>⬆</Text>
              <Text style={styles.coverText}>{seen ? 'Slide up again to re-check' : 'Slide up to see your role'}</Text>
              <Text style={styles.coverSub}>Only {name} should look!</Text>
              <Text style={styles.coverSub}>Let go and it hides again.</Text>
            </View>
          }
        >
          {isImposter ? (
            <View style={styles.center}>
              <Text style={styles.roleEmoji}>🕵️</Text>
              <Text style={[styles.roleTitle, { color: colors.red }]}>You are the IMPOSTER</Text>
              <Am style={styles.roleAm}>አስመሳዩ እርስዎ ነዎት</Am>
              {round.imposters.length > 1 ? (
                <Text style={styles.roleNote}>There are {round.imposters.length} imposters this round.</Text>
              ) : null}
              <WordCard am={hint.am} en={hint.en} label={hint.label} accent={colors.red} />
              <Text style={styles.roleNote}>Blend in. Don't let them find out you don't know the word!</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <WordCard am={round.word.am} en={round.word.en} label="The secret word · ሚስጥራዊው ቃል" />
              {category ? <Am style={styles.roleNote}>Category: {category.emoji} {category.nameEn}</Am> : null}
              <Text style={styles.roleNote}>Give clues about it, but don't make it too easy for the imposter.</Text>
            </View>
          )}
        </SlideToReveal>

        <View style={styles.bottom}>
          {seen ? (
            <Button
              title={isLast ? 'Everyone has seen: Start!' : `Next: ${round.players[round.revealOrder[step + 1]]}`}
              onPress={next}
            />
          ) : (
            <View style={styles.buttonSpacer} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  top: { alignItems: 'center', gap: spacing.xs },
  counter: { color: colors.muted, fontSize: 14 },
  passTo: { color: colors.text, fontSize: 18 },
  name: { color: colors.yellow, fontSize: 38, fontWeight: '800', textAlign: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  grip: { width: 56, height: 6, borderRadius: 3, backgroundColor: colors.muted, marginBottom: spacing.sm },
  coverArrow: { fontSize: 48, color: colors.yellow },
  coverText: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  coverSub: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  roleEmoji: { fontSize: 56 },
  roleTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  roleAm: { color: colors.text, fontSize: 18 },
  roleNote: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  bottom: { minHeight: 56 },
  buttonSpacer: { height: 56 },
});
