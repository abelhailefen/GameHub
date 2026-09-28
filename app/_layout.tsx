import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from '../src/context/GameContext';
import { LanProvider } from '../src/context/LanContext';
import { colors, fonts } from '../src/theme';

// Hold the splash screen until the Ethiopic font is ready, then fade it out.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  // Load only the two weights we use (importing the package index would bundle all nine).
  const [fontsLoaded, fontError] = useFonts({
    [fonts.ethiopic]: require('@expo-google-fonts/noto-sans-ethiopic/400Regular/NotoSansEthiopic_400Regular.ttf'),
    [fonts.ethiopicBold]: require('@expo-google-fonts/noto-sans-ethiopic/700Bold/NotoSansEthiopic_700Bold.ttf'),
  });

  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const noBack = { headerShown: false, gestureEnabled: false } as const;

  return (
    <SafeAreaProvider>
      <GameProvider>
        <LanProvider>
          <StatusBar style="light" />
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
            <Stack.Screen name="reveal" options={noBack} />
            <Stack.Screen name="discuss" options={noBack} />
            <Stack.Screen name="result" options={noBack} />
            <Stack.Screen name="words" options={{ title: 'Manage Words' }} />
            <Stack.Screen name="how-to-play" options={{ title: 'How to Play' }} />
            <Stack.Screen name="lan/index" options={{ title: 'Play on Wi-Fi' }} />
            <Stack.Screen name="lan/game" options={noBack} />
          </Stack>
        </LanProvider>
      </GameProvider>
    </SafeAreaProvider>
  );
}
