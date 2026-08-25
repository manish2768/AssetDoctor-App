/**
 * STEP 9 — Notification Settings
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationEngine } from '../../services/notifications/NotificationEngine';
import { DEFAULT_REMINDER_OFFSETS } from '../../services/notifications/notificationTypes';
import { ExpiryAlertService } from '../../services/notifications/ExpiryAlertService';
import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';

const CATEGORIES = [
  'Insurance',
  'PUC',
  'Warranty',
  'Service',
  'Battery',
  'Health',
  'Energy',
  'Document',
];

export function NotificationSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { assets } = useAssets();
  const [prefs, setPrefs] = useState(null);
  const [permHint, setPermHint] = useState(false);

  useEffect(() => {
    NotificationEngine.getPrefs().then(setPrefs).catch(() => {});
  }, []);

  const patch = async (partial) => {
    Haptics.tap();
    const next = await NotificationEngine.updatePrefs(partial);
    setPrefs(next);
  };

  const toggleOffset = async (day) => {
    const current = prefs?.reminderOffsets?.default || [...DEFAULT_REMINDER_OFFSETS];
    const set = new Set(current.map(Number));
    if (set.has(day)) set.delete(day);
    else set.add(day);
    const next = [...set].sort((a, b) => b - a);
    await patch({ reminderOffsets: { default: next } });
  };

  const enablePush = async () => {
    Haptics.tap();
    const result = await ExpiryAlertService.registerPushToken(user?.uid);
    if (!result.success) {
      setPermHint(true);
      Alert.alert(
        'Notifications disabled',
        'Enable notifications in system settings to receive expiry and service reminders.',
      );
      return;
    }
    setPermHint(false);
    await patch({ pushEnabled: true });
    await NotificationEngine.refreshForUser(user?.uid, assets).catch(() => {});
    Alert.alert('Enabled', 'Reminders will use 30 / 15 / 7 / 3 / 1 / day-of schedule.');
  };

  if (!prefs) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.heading}>Notification Settings</Text>
      </View>
    );
  }

  const offsets = prefs.reminderOffsets?.default || DEFAULT_REMINDER_OFFSETS;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 16 }}
    >
      <Text style={styles.heading}>Notification Settings</Text>
      {permHint ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Notifications are disabled. Enable them to receive expiry and service reminders.
          </Text>
          <Pressable onPress={enablePush} style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>Enable Notifications</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Delivery</Text>
      <Row
        label="Push notifications"
        value={!!prefs.pushEnabled}
        onChange={(v) => (v ? enablePush() : patch({ pushEnabled: false }))}
      />
      <Row
        label="In-app notifications"
        value={prefs.inAppEnabled !== false}
        onChange={(v) => patch({ inAppEnabled: v })}
      />
      <Row
        label="Generic lock-screen text"
        value={prefs.lockScreenPrivacy === 'generic'}
        onChange={(v) => patch({ lockScreenPrivacy: v ? 'generic' : 'full' })}
      />

      <Text style={styles.section}>Categories</Text>
      {CATEGORIES.map((c) => (
        <Row
          key={c}
          label={c}
          value={prefs[c] !== false}
          onChange={(v) => patch({ [c]: v })}
        />
      ))}

      <Text style={styles.section}>Reminder timing (days before)</Text>
      <View style={styles.offsetRow}>
        {DEFAULT_REMINDER_OFFSETS.map((d) => {
          const on = offsets.map(Number).includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggleOffset(d)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {d === 0 ? 'Day of' : `${d}d`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Quiet hours</Text>
      <Row
        label="Enable quiet hours"
        value={!!prefs.quietHoursEnabled}
        onChange={(v) => patch({ quietHoursEnabled: v })}
      />
      <Text style={styles.hint}>
        Default {prefs.quietHoursStart ?? 22}:00 – {prefs.quietHoursEnd ?? 7}:00. Non-critical
        push suppressed; critical still allowed.
      </Text>

      <Pressable
        style={styles.link}
        onPress={() => {
          Haptics.tap();
          navigation.navigate('NotificationCenter');
        }}
      >
        <Text style={styles.linkText}>Open Notification Center</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, onChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={!!value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#F8FAFC' },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  offsetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: COLORS.primary || '#0F766E' },
  chipText: { fontWeight: '700', color: '#475569', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
  banner: {
    backgroundColor: '#FFF7ED',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  bannerText: { color: '#9A3412', fontSize: 13, fontWeight: '600' },
  bannerBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  link: { marginTop: 24, paddingVertical: 12 },
  linkText: { color: COLORS.primary || '#0F766E', fontWeight: '800' },
});

export default NotificationSettingsScreen;
