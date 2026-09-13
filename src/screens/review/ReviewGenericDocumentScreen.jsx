/**
 * Asset Doctor — Generic Document Review Screen
 *
 * Dedicated UI displayed when a document cannot be confidently classified:
 * - Detected Type: Unknown
 * - Confidence: Low
 * - Actionable recovery options:
 *   1. Try Again / Retake Photo
 *   2. Choose Category (opens document selector modal)
 *   3. Enter Manually
 *   4. Cancel
 *
 * ZERO silent fallback to Purchase Invoice.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { GlassButton, GlassCard, Screen } from '../../components/ui/Glass';
import { Haptics } from '../../services/haptics';
import { openRescanInvoice, goHomeDashboard } from '../../navigation/navActions';
import { markScanSession, clearScanSession } from '../../utils/scanNavGuard';
import { ScanAndAddModal } from '../../components/scan/ScanAndAddModal';

export function ReviewGenericDocumentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const imageUri = params.imageUri || '';
  const errorReason = params.error || "We couldn't confidently identify this document type.";
  const rawText = params.rawOcrText || params.rawText || '';

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  // Persist review session in scanNavGuard to survive Activity kill
  React.useEffect(() => {
    markScanSession('ReviewGenericDocument', {
      scanSessionId: params.scanSessionId || `scan_${Date.now()}`,
      documentType: 'OTHER_DOCUMENT',
      reviewRoute: 'ReviewGenericDocument',
      imageUri,
      error: errorReason,
      rawOcrText: rawText,
      audit: params.audit,
    }).catch(() => {});
  }, []);

  return (
    <Screen style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              clearScanSession().catch(() => {});
              navigation.goBack();
            }}
            style={styles.closeBtn}
            hitSlop={12}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerBadge}>📄 OTHER DOCUMENT</Text>
            <Text style={styles.headerTitle}>Unclassified Document</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* NOTICE BANNER */}
          <GlassCard style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>❓</Text>
            <Text style={styles.noticeTitle}>Document could not be confidently identified</Text>
            <Text style={styles.noticeSub}>{errorReason}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaBadge}>Detected Type: Unknown</Text>
              <Text style={styles.metaBadgeLow}>Confidence: Low</Text>
            </View>
          </GlassCard>

          {/* IMAGE PREVIEW */}
          {imageUri ? (
            <GlassCard style={styles.imageCard}>
              <Image source={{ uri: imageUri }} style={styles.documentPreview} resizeMode="contain" />
            </GlassCard>
          ) : null}

          {/* EXTRACTED TEXT SNIPPET IF ANY */}
          {rawText && rawText.trim().length > 0 ? (
            <GlassCard style={styles.textCard}>
              <Text style={styles.textCardTitle}>Detected Text Preview</Text>
              <Text style={styles.textCardContent} numberOfLines={6}>
                {rawText.slice(0, 300)}...
              </Text>
            </GlassCard>
          ) : null}

          {/* ACTION BUTTONS */}
          <View style={styles.actionSection}>
            <GlassButton
              title="Choose Category & Retry"
              onPress={() => {
                Haptics.select();
                setCategoryModalVisible(true);
              }}
              style={styles.actionBtn}
            />

            <GlassButton
              title="Retake Document Photo"
              onPress={() => {
                Haptics.select();
                openRescanInvoice();
              }}
              variant="outline"
              style={styles.actionBtn}
            />

            <GlassButton
              title="Enter Details Manually"
              onPress={() => {
                Haptics.select();
                navigation.navigate('AddAsset', {
                  manualEntry: true,
                  imageUri,
                });
              }}
              variant="ghost"
              style={styles.actionBtn}
            />

            <Pressable
              onPress={() => {
                Haptics.tap();
                goHomeDashboard();
              }}
              style={styles.cancelLink}
            >
              <Text style={styles.cancelLinkText}>Cancel and return home</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* CATEGORY SELECTOR MODAL */}
        <ScanAndAddModal
          visible={categoryModalVisible}
          onClose={() => setCategoryModalVisible(false)}
          onSelectType={(docType) => {
            setCategoryModalVisible(false);
            openRescanInvoice({ selectedDocType: docType });
          }}
        />
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  scroll: {
    padding: SPACING.md,
  },
  noticeCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  noticeIcon: {
    fontSize: 36,
    marginBottom: SPACING.xs,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  noticeSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaBadgeLow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageCard: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  documentPreview: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.sm,
  },
  textCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  textCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  textCardContent: {
    fontSize: 12,
    color: COLORS.textMuted || '#9CA3AF',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  actionSection: {
    marginTop: SPACING.sm,
  },
  actionBtn: {
    marginBottom: SPACING.sm,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelLinkText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
