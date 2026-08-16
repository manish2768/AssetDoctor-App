/**
 * Subtle offline / sync banner — theme-aware STEP 8 indicator.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { SyncEngine } from '../services/offline/SyncEngine';
import { CONNECTIVITY } from '../services/offline/ConnectivityService';
import { useThemeColors } from '../context/ThemeProvider';
import { TYPE } from '../theme/tokens';
import { Haptics } from '../services/haptics';

export function OfflineSyncBanner({ userId }) {
  const colors = useThemeColors();
  const [status, setStatus] = useState(SyncEngine.getStatus());

  useEffect(() => SyncEngine.subscribe(setStatus), []);

  const offline = status.connectivity === CONNECTIVITY.OFFLINE;
  const pending = Number(status.pending) || 0;
  const failed = Number(status.failed) || 0;

  if (!offline && !pending && !failed) return null;

  let text = '';
  let bg = colors.infoSoft;
  let dot = colors.info;
  let a11y = 'Synced';
  if (offline) {
    text = "You're offline. Changes will sync automatically.";
    bg = colors.warningSoft;
    dot = colors.warning;
    a11y = 'Offline';
  } else if (failed) {
    text = "Couldn't sync your data. Tap to retry.";
    bg = colors.errorSoft;
    dot = colors.error;
    a11y = 'Sync failed';
  } else if (pending) {
    text = `Syncing ${pending} item${pending === 1 ? '' : 's'}…`;
    bg = colors.infoSoft;
    dot = colors.info;
    a11y = 'Syncing';
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        SyncEngine.retryNow(userId).catch(() => {});
      }}
      style={[styles.banner, { backgroundColor: bg, borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${a11y}. ${text}`}
    >
      <View style={styles.dotRow}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={[TYPE.caption, { flex: 1, color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export default OfflineSyncBanner;
