import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { dataStore, storage } from '@/state/app';
import { FONT_SOURCES } from '@/ui/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Launch always opens the saved island (rendered from the stored object), else Malé unsaved.
    Promise.all([storage.loadIsland(), storage.loadRecents()]).then(([saved, recents]) => {
      if (!alive) return;
      dataStore.init(saved, recents);
      dataStore.start();
      setDataReady(true);
    });
    // JS timers pause in the background: run the clock as soon as we're back.
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') dataStore.tick();
    });
    return () => {
      alive = false;
      sub.remove();
      dataStore.stop();
    };
  }, []);

  const ready = (fontsLoaded || !!fontError) && dataReady;
  // The JS splash (src/ui/Splash.tsx) takes over on the same #FBF6EC background.
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
