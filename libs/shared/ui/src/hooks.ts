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
