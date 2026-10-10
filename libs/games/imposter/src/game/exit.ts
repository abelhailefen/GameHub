import { useGameBackButton as useBackButton } from '@gamehub/ui';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { routes } from '../routes';

export const goToSetup = () => router.dismissTo(routes.setup);
/** Back to this game's home screen (not the hub). */
export const goHome = () => router.dismissTo(routes.home);

export function confirmEndGame() {
  Alert.alert('End this game?', 'The current round will be lost.', [
    { text: 'Keep playing', style: 'cancel' },
    { text: 'Change players / settings', onPress: goToSetup },
    { text: 'Home', onPress: goHome },
  ]);
}

/** Android back on in-game screens: by default asks to end the game instead of going back to a previous card. */
export const useGameBackButton = (onBack: () => void = confirmEndGame) => useBackButton(onBack);
