/**
 * Asset Doctor — Master Human-Friendly Root Error Boundary
 *
 * Catches any unhandled render / runtime errors:
 * - Clear, calm, reassuring human copy
 * - Assures the user their vault data is 100% safe
 * - Primary "Try again" + Secondary "Go to Home" actions
 * - Technical details collapsed by default under expandable accordion
 */

import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
} from 'react-native';

import { BRAND, COLORS } from '../theme/branding';
import { AppLogo } from './AppLogo';
import { RADIUS, SPACING, TYPE, elevation } from '../theme/tokens';
import { goHomeDashboard } from '../navigation/navActions';

function reportCrashEmail(error) {
  try {
    const { openSupportErrorEmail } = require('../services/diagnostics/DeviceDiagnostics');
    openSupportErrorEmail({
      subject: '[Asset Doctor] App diagnostic report',
      message: 'The app encountered an unexpected error state.',
      error,
    });
  } catch {
    /* ignore */
  }
}

export class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: 0, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[RootErrorBoundary]', error?.message || error);
    console.error('[RootErrorBoundary] stack:', info?.componentStack || '');
    try {
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
      showDetails: false,
    }));
  };

  restart = () => {
    this.setState({ error: null, resetKey: 0, showDetails: false });
    if (typeof this.props.onRestart === 'function') {
      this.props.onRestart();
    } else {
      try {
        goHomeDashboard();
      } catch {
        this.retry();
      }
    }
  };

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.container} accessibilityRole="alert">
          <View style={styles.inner}>
            <AppLogo size={52} style={{ marginBottom: 12 }} />
            <Text style={styles.brand}>{BRAND.name}</Text>
            <Text style={styles.title}>Something needs attention</Text>
            <Text style={styles.subtitle}>
              Your asset vault data is completely safe. We hit a temporary hiccup loading this view.
            </Text>

            <View style={styles.actionGroup}>
              <Pressable style={styles.primaryBtn} onPress={this.retry}>
                <Text style={styles.primaryBtnText}>Try again</Text>
              </Pressable>

              <Pressable style={styles.secondaryBtn} onPress={this.restart}>
                <Text style={styles.secondaryBtnText}>Go to Home</Text>
              </Pressable>
            </View>

            {/* Collapsible Technical Details */}
            <Pressable
              style={styles.detailsToggle}
              onPress={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
            >
              <Text style={styles.detailsToggleText}>
                {this.state.showDetails ? '▲ Hide technical details' : '▼ View technical details'}
              </Text>
            </Pressable>

            {this.state.showDetails ? (
              <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
                <Text style={styles.errorText} selectable>
                  {String(this.state.error?.message || this.state.error)}
                </Text>
                <Pressable
                  style={{ marginTop: 12 }}
                  onPress={() => reportCrashEmail(this.state.error)}
                >
                  <Text style={styles.reportLink}>Report error via email →</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: '#0B1628',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,143,135,0.25)',
  },
  brand: {
    color: '#00B8A9',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  actionGroup: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#0F8F87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 15,
  },
  detailsToggle: {
    marginTop: SPACING.md,
    padding: 8,
  },
  detailsToggleText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    maxHeight: 140,
    width: '100%',
    backgroundColor: '#050A12',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  reportLink: {
    color: '#00B8A9',
    fontSize: 12,
    fontWeight: '600',
  },
});
