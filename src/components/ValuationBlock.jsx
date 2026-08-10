/**
 * Purchase price + current valuation with legal approx disclaimer.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';

import { COLORS } from '../theme/branding';
import { formatINR } from '../utils/format';
import { calculateDepreciation } from '../utils/depreciation';
import { calculateResaleValue } from '../utils/resaleCalculator';
import { Haptics } from '../services/haptics';

export const VALUATION_DISCLAIMER =
  'Note: Current valuation is an automated approximation based on standard depreciation rules. Actual market value may vary based on physical condition, usage, and local market demand.';

export function getCurrentValuation(asset = {}) {
  const purchase = Number(asset.value) || 0;
  const dep = calculateDepreciation({
    purchaseValue: purchase,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId || 'other',
  });
  const resale = calculateResaleValue({
    purchaseValue: purchase,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId,
    category: asset.category,
    condition: asset.condition || 'good',
  });
  // Prefer market-style resale when available; fall back to book value
  const current =
    resale.estimatedResale > 0 ? resale.estimatedResale : dep.bookValue;
  return {
    purchase,
    current,
    bookValue: dep.bookValue,
    ageYears: dep.ageYears,
    annualRate: dep.annualRate,
  };
}

export function ValuationBlock({ asset, compact = false }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const v = getCurrentValuation(asset);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>PURCHASE PRICE</Text>
          <Text style={styles.purchase}>{formatINR(v.purchase)}</Text>
        </View>
        <View style={styles.col}>
          <View style={styles.currentHeader}>
            <Text style={styles.label}>CURRENT VALUATION</Text>
            <Pressable
              onPress={() => {
                Haptics.select();
                setInfoOpen(true);
              }}
              hitSlop={8}
              accessibilityLabel="Valuation disclaimer"
            >
              <Text style={styles.infoIcon}>ⓘ</Text>
            </Pressable>
            <View style={styles.approxBadge}>
              <Text style={styles.approxText}>* Approx</Text>
            </View>
          </View>
          <Text style={styles.current}>{formatINR(v.current)}</Text>
        </View>
      </View>
      {!compact ? <Text style={styles.disclaimer}>{VALUATION_DISCLAIMER}</Text> : null}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>About Current Valuation</Text>
            <Text style={styles.modalBody}>{VALUATION_DISCLAIMER}</Text>
            <Pressable style={styles.modalBtn} onPress={() => setInfoOpen(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  wrapCompact: { gap: 4 },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  label: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  currentHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  infoIcon: { color: COLORS.neonBlue, fontSize: 12, fontWeight: '700' },
  approxBadge: {
    backgroundColor: 'rgba(0,242,254,0.12)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  approxText: { color: COLORS.neonBlue, fontSize: 9, fontWeight: '800' },
  purchase: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
  current: { color: COLORS.emerald, fontSize: 14, fontWeight: '900', marginTop: 4 },
  disclaimer: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontWeight: '900', fontSize: 16, marginBottom: 8 },
  modalBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  modalBtn: {
    marginTop: 14,
    backgroundColor: COLORS.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: { color: '#04110A', fontWeight: '900' },
});

export default ValuationBlock;
