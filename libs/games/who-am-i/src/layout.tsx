import { colors } from '@gamehub/ui';
import { Stack } from 'expo-router';
import { WhoAmIProvider } from './context';
import { LanProvider } from './lan/context';

/**
 * The Who Am I? navigator. Its providers live only while the game is open, so leaving to the hub
 * also closes any Wi-Fi game this phone was hosting or had joined.
 */
export default function WhoAmILayout() {
  const noBack = { headerShown: false, gestureEnabled: false } as const;

  return (
    <WhoAmIProvider>
      <LanProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="setup" options={{ title: 'New Game' }} />
          <Stack.Screen name="write" options={noBack} />
          <Stack.Screen name="play" options={noBack} />
          <Stack.Screen name="result" options={noBack} />
          <Stack.Screen name="how-to-play" options={{ title: 'How to Play' }} />
          <Stack.Screen name="lan/index" options={{ title: 'Play on Wi-Fi' }} />
          <Stack.Screen name="lan/game" options={noBack} />
        </Stack>
      </LanProvider>
    </WhoAmIProvider>
  );
}
