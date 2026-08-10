import 'react-native-gesture-handler';

import '@react-native-firebase/app';

import React, { Component } from 'react';
import {
  StatusBar,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  LogBox,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { AuthProvider } from './src/context/AuthProvider';
import { AssetProvider } from './src/context/AssetProvider';
import { AppLockProvider } from './src/context/AppLockProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ProfileSetupModal } from './src/components/profile/ProfileSetupModal';
import { BRAND, COLORS } from './src/theme/branding';

// Keep Metro / device logs noisy for blank-screen diagnosis
LogBox.ignoreLogs([]);

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
}

function reportCrashEmail(error) {
  const appVersion = Constants.expoConfig?.version || 'unknown';
  const subject = encodeURIComponent('[Asset Doctor] App crash report');
  const body = encodeURIComponent(
    [
      'The app crashed with this error:',
      '',
      String(error?.message || error),
      '',
      String(error?.stack || ''),
      '',
      '---',
      `App version: ${appVersion}`,
      `Support: ${BRAND.supportEmail}`,
    ].join('\n'),
  );
  Linking.openURL(`mailto:${BRAND.supportEmail}?subject=${subject}&body=${body}`).catch(() => {});
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AssetDoctor] UI crash:', error?.message || error);
    console.error('[AssetDoctor] componentStack:', info?.componentStack || '');
    try {
      // eslint-disable-next-line global-require
      const { CrashlyticsService } = require('./src/services/crashlytics/CrashlyticsService');
      CrashlyticsService.recordError(error, {
        componentStack: info?.componentStack,
      });
    } catch {
      /* Crashlytics optional until native rebuild */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.crash}>
          <Text style={styles.crashBrand}>{BRAND.name}</Text>
          <Text style={styles.crashTitle}>Something went wrong</Text>
          <Text style={styles.crashSub}>
            The screen hit an error. You can retry or email this report so we can fix it.
          </Text>
          <ScrollView style={styles.crashScroll} contentContainerStyle={{ paddingVertical: 8 }}>
            <Text style={styles.crashBody} selectable>
              {String(this.state.error?.message || this.state.error)}
            </Text>
          </ScrollView>
          <Pressable style={styles.crashBtn} onPress={() => reportCrashEmail(this.state.error)}>
            <Text style={styles.crashBtnText}>Report via Email</Text>
          </Pressable>
          <Pressable
            style={[styles.crashBtn, styles.crashBtnGhost]}
            onPress={() =>
              this.setState((state) => ({
                error: null,
                resetKey: state.resetKey + 1,
              }))
            }
          >
            <Text style={styles.crashBtnTextGhost}>Try again</Text>
          </Pressable>
          <Text style={styles.crashHelp}>Support: {BRAND.supportEmail}</Text>
        </SafeAreaView>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

export default function App() {
  React.useEffect(() => {
    bootstrapSideEffects();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ErrorBoundary>
        <View style={styles.root}>
          <AppLockProvider>
            <AuthProvider>
              <AssetProvider>
                <ErrorBoundary>
                  <RootNavigator />
                  <ProfileSetupModal />
                </ErrorBoundary>
              </AssetProvider>
            </AuthProvider>
          </AppLockProvider>
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  crash: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    padding: 24,
  },
  crashBrand: {
    color: COLORS.emerald,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  crashTitle: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  crashSub: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  crashScroll: {
    maxHeight: 220,
    marginVertical: 12,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
  },
  crashBody: { color: '#B91C1C', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  crashBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  crashBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  crashBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  crashBtnTextGhost: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  crashHelp: { color: COLORS.muted, textAlign: 'center', marginTop: 12, fontSize: 12 },
});
