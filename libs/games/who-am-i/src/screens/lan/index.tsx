import { LanFinder, Screen } from '@gamehub/ui';
import { router } from 'expo-router';
import { useWhoAmI } from '../../context';
import { useLan } from '../../lan/context';
import { routes } from '../../routes';

export default function LanHome() {
  const { lanName, setLanName } = useWhoAmI();
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
