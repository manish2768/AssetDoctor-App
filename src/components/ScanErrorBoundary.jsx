/**
 * Screen-level Error Boundary for Scan Invoice.
 * On crash → show recovery UI; never auto-redirect to Home / MainTabs.
 */

import React, { Component } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { BRAND, COLORS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';

export class ScanErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ScanErrorBoundary]', error?.message || error);
    console.error('[ScanErrorBoundary] stack:', info?.componentStack || '');
    try {
      // eslint-disable-next-line global-require
      const { CrashlyticsService } = require('../services/crashlytics/CrashlyticsService');
      CrashlyticsService.recordError?.(error, {
        componentStack: String(info?.componentStack || '').slice(0, 200),
        boundary: 'scan',
      });
      // eslint-disable-next-line global-require
      const { pushDiagnosticLog } = require('../services/diagnostics/DeviceDiagnostics');
      pushDiagnosticLog(`ScanError: ${error?.message || error}`);
    } catch {
      /* optional */
    }
  }

  reportError = async () => {
    Haptics.tap();
    try {
      // eslint-disable-next-line global-require
      const { openSupportErrorEmail } = require('../services/diagnostics/DeviceDiagnostics');
      await openSupportErrorEmail({
        subject: '[Asset Doctor] Scan Error',
        message: 'Scanner crashed while capturing / reading a document.',
        error: this.state.error,
      });
    } catch {
      /* ignore */
    }
  };

  goBackSafe = () => {
    Haptics.tap();
    this.setState({ error: null });
    try {
      if (this.props.navigation?.canGoBack?.()) {
        this.props.navigation.goBack();
        return;
      }
      // Stay in scan flow — never MainTabs / Home / popToTop / reset
      this.props.navigation?.navigate?.('ScanBill');
    } catch {
      /* stay on recovery UI — no automatic Home redirect */
    }
  };

  retry = () => {
    Haptics.tap();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.title}>Scanner hit an error</Text>
          <Text style={styles.sub}>
            Camera / OCR failed safely. Go back to the previous screen or try again.
          </Text>
          <Text style={styles.err} selectable>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          <Pressable style={styles.btn} onPress={this.retry}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={this.reportError}>
            <Text style={styles.btnGhostText}>Report Error</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={this.goBackSafe}>
            <Text style={styles.btnGhostText}>Go back</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  brand: {
    color: COLORS.emerald,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  sub: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  err: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: '#FFF1F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  btn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { color: '#fff', fontWeight: '900' },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: { color: COLORS.text, fontWeight: '700' },
});

export default ScanErrorBoundary;
