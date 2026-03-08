import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import {
  Lato_400Regular,
  Lato_700Bold,
  Lato_400Regular_Italic,
} from '@expo-google-fonts/lato';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#0A0E1A' },
} as const;

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Lato_400Regular,
    Lato_700Bold,
    Lato_400Regular_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={NAV_THEME.dark}>
      <StatusBar style="light" />
      <Stack screenOptions={SCREEN_OPTIONS} />
      <PortalHost />
    </ThemeProvider>
  );
}
