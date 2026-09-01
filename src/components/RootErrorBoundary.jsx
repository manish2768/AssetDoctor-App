/**
 * Root Error Boundary — catches render/runtime errors and shows recovery UI
 * instead of a blank white screen or Expo fatal overlay.
 */

import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  SafeAreaView,
} from 'react-native';
import Constants from 'expo-constants';

import { BRAND, COLORS } from '../theme/branding';
import { AppLogo } from './AppLogo';

function reportCrashEmail(error) {
  try {
    // eslint-disable-next-line global-require
    const { openSupportErrorEmail } = require('../services/diagnostics/DeviceDiagnostics');
    openSupportErrorEmail({
      subject: '[Asset Doctor] App crash report',
      message: 'The app crashed with this error.',
      error,
    });
  } catch {
    /* ignore */
  }
}

export class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary]', error?.message || error);
    console.error('[RootErrorBoundary] stack:', info?.componentStack || '');
    try {
      // eslint-disable-next-line global-require
      const { CrashlyticsService } = require('../services/crashlytics/CrashlyticsService');
      CrashlyticsService.recordError?.(error, {
        componentStack: String(info?.componentStack || '').slice(0, 200),
        boundary: 'root',
      });
    } catch {
      /* Crashlytics optional */
    }
  }

  retry = () => {
    this.setState((state) => ({
      error: null,
      resetKey: state.resetKey + 1,
    }));
  };

  restart = () => {
    this.setState({ error: null, resetKey: 0 });
    if (typeof this.props.onRestart === 'function') {
      this.props.onRestart();
    } else {
      this.retry();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.crash} accessibilityRole="alert">
          <View style={styles.crashInner}>
            <AppLogo size={48} style={{ marginBottom: 8 }} />
            <Text style={styles.crashBrand}>{BRAND.name}</Text>
            <Text style={styles.crashTitle}>Oops, something went wrong</Text>
            <Text style={styles.crashSub}>
              The vault hit an unexpected error. Restart to continue — your data stays private.
            </Text>
            <ScrollView style={styles.crashScroll} contentContainerStyle={{ paddingVertical: 8 }}>
              <Text style={styles.crashBody} selectable>
                {String(this.state.error?.message || this.state.error)}
              </Text>
            </ScrollView>
            <Pressable style={styles.crashBtn} onPress={this.restart}>
              <Text style={styles.crashBtnText}>Restart</Text>
            </Pressable>
            <Pressable style={[styles.crashBtn, styles.crashBtnGhost]} onPress={this.retry}>
              <Text style={styles.crashBtnTextGhost}>Try again</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => reportCrashEmail(this.state.error)}>
              <Text style={styles.linkText}>Report via Email</Text>
            </Pressable>
            <Text style={styles.crashHelp}>Support: {BRAND.supportEmail}</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.fill} key={this.state.resetKey}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.bg },
  crash: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  crashInner: {
    flex: 1,
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
    maxHeight: 180,
    marginVertical: 12,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.35)',
  },
  crashBody: { color: COLORS.rose, fontSize: 13, lineHeight: 18, fontWeight: '600' },
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
  crashBtnText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 14 },
  crashBtnTextGhost: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: COLORS.neonBlue, fontWeight: '700', fontSize: 13 },
  crashHelp: { color: COLORS.muted, textAlign: 'center', marginTop: 12, fontSize: 12 },
});

export default RootErrorBoundary;
