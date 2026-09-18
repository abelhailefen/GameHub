import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, BackHandler } from 'react-native';

export const goToSetup = () => router.dismissTo('/setup');
export const goHome = () => router.dismissAll();

export function confirmEndGame() {
  Alert.alert('End this game?', 'The current round will be lost.', [
    { text: 'Keep playing', style: 'cancel' },
    { text: 'Change players / settings', onPress: goToSetup },
    { text: 'Home', onPress: goHome },
  ]);
}

/**
 * Android back button on in-game screens. It never navigates back to a previous card
 * (that would let players peek); it runs `onBack` instead, which by default asks to end the game.
 */
export function useGameBackButton(onBack: () => void = confirmEndGame) {
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
