/**
 * Privacy & Security settings — STEP 12.
 * Only exposes controls that are actually implemented.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { AppLockService } from '../../services/security/AppLockService';
import { getPrivacyPrefs, setPrivacyPrefs } from '../../services/security/privacyPrefs';
import { buildSecurityStatus } from '../../services/security/securityStatus';
import { getBackupStatus, describeRestoreFlow } from '../../services/security/BackupStatusService';
import {
  getAccountDeletionWarning,
  requestAccountDeletion,
} from '../../services/security/AccountDeletionService';
import { requestUserDataExport } from '../../services/security/dataExport';
import { setNotificationPrivacyMode } from '../../services/notifications/notificationRules';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';
import { useTheme } from '../../context/ThemeProvider';
import { TYPE, SPACING } from '../../theme/tokens';
import { useUiFeedback } from '../../context/UiFeedbackProvider';

export function PrivacySecurityScreen({ navigation }) {
  const ui = useUiFeedback();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, signOut } = useAuth();
  const { assets } = useAssets();
  const { mode, isDark, setMode } = useTheme();
  const uid = user?.uid;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [backup, setBackup] = useState(null);
  const [privacyOn, setPrivacyOn] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [st, bk, prefs] = await Promise.all([
        buildSecurityStatus({ userId: uid, isAuthenticated }),
        getBackupStatus(uid),
        getPrivacyPrefs(uid),
      ]);
      setStatus(st);
      setBackup(bk);
      setPrivacyOn(prefs.notificationPrivacy !== false);
      setNotificationPrivacyMode(prefs.notificationPrivacy !== false);
    } finally {
      setLoading(false);
    }
  }, [uid, isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onTogglePrivacy = async (value) => {
    Haptics.tap();
    setBusy(true);
    try {
      await setPrivacyPrefs(uid, { notificationPrivacy: value });
      setNotificationPrivacyMode(value);
      setPrivacyOn(value);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onEnableVault = async () => {
    Haptics.tap();
    try {
      await AppLockService.setEnabled(true);
      ui.success('Vault Lock enabled. Use your phone biometrics or PIN.');
      await refresh();
    } catch (e) {
      ui.error('Vault Lock', e?.message || 'Could not enable Vault Lock');
    }
  };

  const onExport = async () => {
    if (!uid) {
      ui.info('Export', 'Sign in to export your data.');
      return;
    }
    Haptics.tap();
    try {
      const prefs = await getPrivacyPrefs(uid);
      const payload = await requestUserDataExport(uid, uid, assets, prefs);
      ui.info(
        'Data export ready',
        `${payload.assetCount} assets prepared as JSON metadata. Full file export ships in a later release.`,
      );
    } catch (e) {
      ui.error('Export', e?.message || 'Export failed');
    }
  };

  const onDeleteAccount = async () => {
    if (!uid) {
      ui.info('Delete account', 'Sign in first.');
      return;
    }
    const warning = getAccountDeletionWarning();
    const ok = await ui.confirm({
      title: warning.title,
      message: warning.body,
      confirmLabel: 'Request deletion',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await requestAccountDeletion(uid, uid, { confirmed: true });
      ui.success(result.nextStep || 'Signed out locally.');
      if (typeof signOut === 'function') await signOut();
      navigation?.navigate?.('Login');
    } catch (e) {
      ui.error('Deletion', e?.message || 'Could not request deletion');
    } finally {
      setBusy(false);
    }
  };

  const restore = describeRestoreFlow();

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={COLORS.primary || '#0F766E'} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, paddingTop: insets.top + 8 }}
    >
      <Text style={styles.heading}>Trust Center</Text>
      <Text style={styles.sub}>
        How Asset Doctor handles your data. Only controls that exist on this account are shown.
      </Text>

      <Text style={styles.section}>Your data</Text>
      <View style={styles.card}>
        <Text style={styles.rowTitle}>Documents</Text>
        <Text style={styles.muted}>
          Documents stay in your vault and are processed for organisation and expiry tracking. We do not claim government verification or certification.
        </Text>
        <Pressable
          style={styles.linkBtn}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('NotificationSettings');
          }}
        >
          <Text style={styles.linkText}>Manage notifications</Text>
        </Pressable>
        <Text style={[styles.muted, { marginTop: 8 }]}>
          WhatsApp messages are sent only when account opt-in is true. Change this from account settings on web, or contact support if you need it updated on this device.
        </Text>
      </View>

      <Text style={styles.section}>Appearance</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowTitle}>Dark mode</Text>
            <Text style={styles.muted}>
              Proper dark surfaces — not a simple invert. Charts and forms stay readable.
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(v) => {
              Haptics.tap();
              setMode(v ? 'dark' : 'light');
            }}
            trackColor={{ false: 'rgba(148,163,184,0.35)', true: 'rgba(16,185,129,0.45)' }}
            thumbColor={isDark ? COLORS.emerald : '#E2E8F0'}
            accessibilityLabel="Dark mode"
          />
        </View>
        <Text style={[styles.muted, { marginTop: 8 }]}>Current: {mode}</Text>
      </View>

      <Text style={styles.section}>Security Status</Text>
      <View style={styles.card}>
        {(status?.items || []).map((item) => (
          <View key={item.id} style={styles.statusRow}>
            <Text style={styles.statusIcon}>{item.warn ? '⚠' : '✓'}</Text>
            <Text style={[styles.statusLabel, item.warn && styles.warnText]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Data Backup</Text>
      <View style={styles.card}>
        <Text style={styles.rowTitle}>{backup?.label || 'Backup status'}</Text>
        <Text style={styles.muted}>
          {backup?.pendingCount
            ? `${backup.pendingCount} change(s) waiting to sync`
            : restore.note}
        </Text>
        <Pressable
          style={styles.linkBtn}
          onPress={() => {
            Haptics.tap();
            ui.info('Restore', `${restore.message}\n\n${restore.strategy}`);
          }}
        >
          <Text style={styles.linkText}>How restore works on a new device</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Privacy controls</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.rowTitle}>Notification Privacy</Text>
            <Text style={styles.muted}>Hide plates and sensitive names on lock screen</Text>
          </View>
          <Switch
            value={privacyOn}
            onValueChange={onTogglePrivacy}
            disabled={busy}
            trackColor={{ false: 'rgba(148,163,184,0.35)', true: 'rgba(16,185,129,0.45)' }}
            thumbColor={privacyOn ? COLORS.emerald : '#E2E8F0'}
          />
        </View>
        <Pressable style={styles.linkBtn} onPress={onEnableVault} disabled={busy}>
          <Text style={styles.linkText}>Enable Vault Lock</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={onExport} disabled={busy}>
          <Text style={styles.linkText}>Download my data</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={onDeleteAccount} disabled={busy}>
          <Text style={[styles.linkText, { color: '#B91C1C' }]}>Delete account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#F8FAFC' },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { marginTop: 4, color: '#64748B', fontSize: 13 },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  statusRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, alignItems: 'flex-start' },
  statusIcon: { fontSize: 14, fontWeight: '800', color: '#0F766E' },
  statusLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A' },
  warnText: { color: '#B45309' },
  rowTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  muted: { fontSize: 12, color: '#64748B', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  linkBtn: { marginTop: 14 },
  linkText: { color: COLORS.primary || '#0F766E', fontWeight: '800', fontSize: 14 },
});

export default PrivacySecurityScreen;
