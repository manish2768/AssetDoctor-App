import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import React from 'react';
import { StatusBar, View, StyleSheet, LogBox, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { RootErrorBoundary } from './src/components/RootErrorBoundary';
import { AuthProvider } from './src/context/AuthProvider';
import { AssetProvider } from './src/context/AssetProvider';
import { AppLockProvider } from './src/context/AppLockProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ProfileSetupModal } from './src/components/profile/ProfileSetupModal';
import { COLORS } from './src/theme/branding';
import {
  ensureFirebaseApp,
  waitForFirebaseApp,
} from './src/config/firebaseApp';

LogBox.ignoreLogs([]);

/** Soft probe only — never block / never throw at module load. */
try {
  ensureFirebaseApp();
} catch (e) {
  console.warn('[AssetDoctor] Firebase early init skipped:', e?.message || e);
}

function installGlobalErrorLogger() {
  try {
    const { ErrorUtils } = global;
    if (!ErrorUtils?.getGlobalHandler || !ErrorUtils?.setGlobalHandler) return;
    const previous = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.error(
        '[AssetDoctor] GLOBAL',
        isFatal ? 'FATAL' : 'ERROR',
        error?.message || error,
        error?.stack || '',
      );
      if (typeof previous === 'function') previous(error, isFatal);
    });
  } catch (e) {
    console.warn('[AssetDoctor] ErrorUtils install failed:', e?.message || e);
  }
}

installGlobalErrorLogger();

function bootstrapSideEffects() {
  try {
    ensureFirebaseApp();
  } catch (e) {
    console.warn('[AssetDoctor] Firebase app soft-load skipped:', e?.message || e);
  }

  try {
    // eslint-disable-next-line global-require
    require('./src/services/auth/googleSignIn').configureGoogleSignIn();
  } catch (e) {
    console.warn('[AssetDoctor] configureGoogleSignIn:', e?.message || e);
  }

  try {
    // eslint-disable-next-line global-require
    const { CrashlyticsService } = require('./src/services/crashlytics/CrashlyticsService');
    CrashlyticsService.init();
  } catch (e) {
    console.warn('[AssetDoctor] Crashlytics init:', e?.message || e);
  }

  try {
    // eslint-disable-next-line global-require
    const { initializeAppCheckIfAvailable } = require('./src/services/security/AppCheckBootstrap');
    initializeAppCheckIfAvailable().then((r) => {
      if (r?.skipped && __DEV__) {
        console.log('[AssetDoctor] App Check skipped:', r.reason);
      }
    });
  } catch (e) {
    console.warn('[AssetDoctor] App Check bootstrap:', e?.message || e);
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  /** App remount key for ErrorBoundary Restart */
  const [bootKey, setBootKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // Non-blocking: warm Firebase in background; do not hold UI hostage.
    (async () => {
      try {
        await waitForFirebaseApp({ timeoutMs: 4000, intervalMs: 80 });
      } catch (e) {
        console.warn('[AssetDoctor] Firebase wait skipped:', e?.message || e);
      }
      if (cancelled) return;
      bootstrapSideEffects();
    })();
    return () => {
      cancelled = true;
    };
  }, [bootKey]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.root, styles.boot]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root} key={bootKey}>
      <RootErrorBoundary onRestart={() => setBootKey((k) => k + 1)}>
        <SafeAreaProvider>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
          <View style={styles.root}>
            <AppLockProvider>
              <AuthProvider>
                <AssetProvider>
                  <RootErrorBoundary onRestart={() => setBootKey((k) => k + 1)}>
                    <RootNavigator />
                    <ProfileSetupModal />
                  </RootErrorBoundary>
                </AssetProvider>
              </AuthProvider>
            </AppLockProvider>
          </View>
        </SafeAreaProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  boot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
