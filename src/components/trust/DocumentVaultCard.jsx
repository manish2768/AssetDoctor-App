import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS, HIT, elevation } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { AssetDoctorProtectedBadge } from './AssetDoctorProtectedBadge';
import { DocumentQualityBadge } from './DocumentQualityBadge';
import {
  VAULT_MORE_ACTIONS,
  vaultActionAvailability,
  resolveProtectionBadgeState,
  classifyDocumentQuality,
} from '../../trust/protectionStatus';

export function DocumentVaultCard({
  item,
  asset,
  onView,
  onShare,
  onMoreAction,
  style,
}) {
  const colors = useThemeColors();
  const [moreOpen, setMoreOpen] = useState(false);
  const badge = resolveProtectionBadgeState({
    asset,
    documents: [item],
  });
  const quality = classifyDocumentQuality({
    confidence: item.confidence,
    needsReview: item.needsReview,
    needsManualReview: item.needsManualReview,
    scanQuality: item.scanQuality,
  });

  const run = (id) => {
    Haptics.tap();
    setMoreOpen(false);
    onMoreAction?.(id, item);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
    >
      <Text style={[TYPE.label, { color: colors.textMuted }]}>{String(item.type || 'Document').toUpperCase()}</Text>
      <Text style={[TYPE.h3, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
        {item.assetName || asset?.assetName || 'Asset'}
      </Text>
      <View style={{ marginTop: 8 }}>
        <AssetDoctorProtectedBadge state={badge} compact />
      </View>
      <View style={styles.meta}>
        <Text style={[TYPE.caption, { color: colors.textMuted }]}>
          Status: {item.daysLeft != null && item.daysLeft < 0 ? 'Expired' : 'Active'}
        </Text>
        {item.dateText ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>{item.dateText}</Text>
        ) : null}
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          Linked Asset: {item.assetName || asset?.assetName || 'Not linked'}
        </Text>
        <View style={{ marginTop: 6 }}>
          <DocumentQualityBadge quality={quality} />
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onView} style={styles.action} accessibilityRole="button" accessibilityLabel="View">
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>View</Text>
        </Pressable>
        <Pressable
          onPress={() => run('share')}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Share"
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>Share</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.tap();
            setMoreOpen(true);
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="More"
        >
          <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]}>More</Text>
        </Pressable>
      </View>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)}>
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {VAULT_MORE_ACTIONS.map((action) => {
              const avail = vaultActionAvailability(action, item);
              return (
                <Pressable
                  key={action.id}
                  onPress={() => {
                    if (!avail.available) {
                      onMoreAction?.('unavailable', item, avail.reason || action.label);
                      return;
                    }
                    run(action.id);
                  }}
                  style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <Text style={[TYPE.body, { color: avail.available ? colors.text : colors.textMuted }]}>
                    {action.label}
                  </Text>
                  {!avail.available ? (
                    <Text style={[TYPE.micro, { color: colors.textMuted }]}>Unavailable</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  meta: { marginTop: SPACING.sm },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: 8,
  },
  action: {
    minHeight: HIT.min,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,15,0.55)',
    justifyContent: 'flex-end',
  },
  menu: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: 8,
    paddingBottom: 28,
  },
  menuRow: {
    minHeight: HIT.min,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default DocumentVaultCard;
