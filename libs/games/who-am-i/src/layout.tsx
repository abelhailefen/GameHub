import { colors } from '@gamehub/ui';
import { Stack } from 'expo-router';
import { WhoAmIProvider } from './context';

export default function WhoAmILayout() {
  const noBack = { headerShown: false, gestureEnabled: false } as const;

  return (
    <WhoAmIProvider>
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
      </Stack>
    </WhoAmIProvider>
  );
}
