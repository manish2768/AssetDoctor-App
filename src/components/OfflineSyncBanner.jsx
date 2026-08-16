/**
 * Subtle offline / sync banner — non-intrusive STEP 8 indicator.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { SyncEngine } from '../services/offline/SyncEngine';
import { CONNECTIVITY } from '../services/offline/ConnectivityService';
import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';

export function OfflineSyncBanner({ userId }) {
  const [status, setStatus] = useState(SyncEngine.getStatus());

  useEffect(() => SyncEngine.subscribe(setStatus), []);

  const offline = status.connectivity === CONNECTIVITY.OFFLINE;
  const pending = Number(status.pending) || 0;
  const failed = Number(status.failed) || 0;

  if (!offline && !pending && !failed) return null;

  let text = '';
  let tone = styles.info;
  if (offline) {
    text = "You're offline. Changes will sync automatically.";
    tone = styles.warn;
  } else if (failed) {
    text = "Some data couldn't sync. Tap to retry.";
    tone = styles.error;
  } else if (pending) {
    text = `Syncing ${pending} item${pending === 1 ? '' : 's'}…`;
    tone = styles.info;
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        SyncEngine.retryNow(userId).catch(() => {});
      }}
      style={[styles.banner, tone]}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <View style={styles.dotRow}>
        <View
          style={[
            styles.dot,
            offline ? styles.dotOff : failed ? styles.dotFail : styles.dotSync,
          ]}
        />
        <Text style={styles.text} numberOfLines={2}>
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
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  info: { backgroundColor: '#EEF6FF' },
  warn: { backgroundColor: '#FFF7ED' },
  error: { backgroundColor: '#FEF2F2' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOff: { backgroundColor: '#EF4444' },
  dotFail: { backgroundColor: '#F59E0B' },
  dotSync: { backgroundColor: '#F59E0B' },
  text: { flex: 1, color: COLORS.text || '#1F2937', fontSize: 12, fontWeight: '600' },
});

export default OfflineSyncBanner;
