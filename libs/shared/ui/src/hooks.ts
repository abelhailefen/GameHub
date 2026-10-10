import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android back button on in-game screens. It never navigates back to a previous card
 * (that would let players peek); it runs `onBack` instead, usually a "leave the game?" prompt.
 */
export function useGameBackButton(onBack: () => void) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );
}

/** Counts down only while `active`. Reaching zero just notifies — it never advances the game. */
export function useCountdown(active: boolean, total: number, onDone: () => void) {
  const [left, setLeft] = useState(total);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active || total <= 0) return;
    setLeft(total);
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onDoneRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, total]);

  return left;
}

/**
 * Wi-Fi games: counts down locally from the time left the host last reported, so every phone shows
 * the same clock. Pass the view the time came with as `received`; a new view restarts the count.
 * Buzzes once at zero. Returns milliseconds left, or null when there's no timer.
 */
export function useRemoteCountdown(timerMs: number | undefined, received: unknown) {
  const endsAt = useRef<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const buzzed = useRef(false);

  useEffect(() => {
    if (timerMs === undefined) {
      endsAt.current = null;
      setLeft(null);
      return;
    }
    endsAt.current = Date.now() + timerMs;
    buzzed.current = timerMs <= 0;
    setLeft(timerMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [received]);

  useEffect(() => {
    const id = setInterval(() => {
      if (endsAt.current === null) return;
      const ms = Math.max(0, endsAt.current - Date.now());
      setLeft(ms);
      if (ms === 0 && !buzzed.current) {
        buzzed.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  return left;
}
