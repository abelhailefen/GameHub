import { colors, fonts } from '@gamehub/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

  // Each game folder has its own _layout with its own Stack and state.
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="imposter" />
        <Stack.Screen name="who-am-i" />
      </Stack>
    </SafeAreaProvider>
  );
}
