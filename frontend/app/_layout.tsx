import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: '#0A0E1A' },
} as const;

export default function RootLayout() {
  return (
    <ThemeProvider value={NAV_THEME.dark}>
      <StatusBar style="light" />
      <Stack screenOptions={SCREEN_OPTIONS} />
      <PortalHost />
    </ThemeProvider>
  );
}
