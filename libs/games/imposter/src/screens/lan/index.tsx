import { router } from 'expo-router';
import { LanFinder, Screen } from '@gamehub/ui';
import { useGame } from '../../context/GameContext';
import { useLan } from '../../context/LanContext';
import { routes } from '../../routes';

export default function LanHome() {
  const { lanName, setLanName } = useGame();
  const { hostGame, joinGame, discover } = useLan();

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <LanFinder
        savedName={lanName}
        onSaveName={setLanName}
        discover={discover}
        hostGame={hostGame}
        joinGame={joinGame}
        onEnter={() => router.push(routes.lanGame)}
      />
    </Screen>
  );
}
