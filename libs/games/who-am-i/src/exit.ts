import { useGameBackButton as useBackButton } from '@gamehub/ui';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { routes } from './routes';

export const goToSetup = () => router.dismissTo(routes.setup);
/** Back to this game's home screen (not the hub). */
export const goHome = () => router.dismissTo(routes.home);

export function confirmQuit(onEndRound?: () => void) {
  Alert.alert('End this game?', onEndRound ? 'You can still see who guessed what.' : 'The words written so far will be lost.', [
    { text: 'Keep playing', style: 'cancel' },
    ...(onEndRound ? [{ text: 'End round: show results', onPress: onEndRound }] : []),
    { text: 'Change players / settings', onPress: goToSetup },
    { text: 'Home', onPress: goHome },
  ]);
}

/** Android back on in-game screens asks before leaving instead of going back a step (and showing a word). */
export const useGameBackButton = (onBack: () => void) => useBackButton(onBack);
