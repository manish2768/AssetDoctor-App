/**
 * Purchase price + current valuation with legal approx disclaimer.
 * Vehicles show stepped market Estimated Resale Value.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';

import { COLORS } from '../theme/branding';
import { formatINR, clamp } from '../utils/format';
import { yearsSince } from '../utils/dates';
import { calculateDepreciation } from '../utils/depreciation';
import {
  calculateResaleValue,
  calculateVehicleMarketDepreciation,
  isVehicleCategoryId,
} from '../utils/resaleCalculator';
import { Haptics } from '../services/haptics';
import { toVaultValue } from '../utils/parseMoneyValue';

export const VALUATION_DISCLAIMER =
  'Note: Current valuation is an automated approximation based on standard depreciation rules. Actual market value may vary based on physical condition, usage, and local market demand.';

/** Resolve purchase price from vault + OCR aliases. */
export function resolvePurchasePrice(asset = {}) {
  const candidates = [
    asset.purchasePrice,
    asset.value,
    asset.totalAmount,
    asset.price,
    asset.invoiceMeta?.totalAmount,
    asset.invoiceMeta?.grandTotal,
    asset.ocrExtract?.total_amount,
  ];
  for (const c of candidates) {
    const n = toVaultValue(c, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * Simple 10–15% annual depreciation for Home cards (age from purchase date).
 */
export function estimateSimpleCurrentValue(asset = {}) {
  const purchase = resolvePurchasePrice(asset);
  if (purchase <= 0) return 0;
  if (isVehicleCategoryId(asset.categoryId, asset.category)) {
    return calculateVehicleMarketDepreciation({
      purchaseValue: purchase,
      purchaseDate: asset.purchaseDate || asset.invoiceDate || asset.registrationDate,
      registrationYear: asset.registrationYear || asset.year,
    }).estimatedResale;
  }
  const ageYears = yearsSince(asset.purchaseDate || asset.invoiceDate);
  const cat = String(asset.categoryId || asset.smartCategory || asset.category || '').toLowerCase();
  let annualRate = 0.125;
  if (/mobile|phone|laptop|tablet|gadget/.test(cat)) annualRate = 0.15;
  else if (/ac|fridge|tv|washer|appliance|home|geyser|microwave/.test(cat)) annualRate = 0.1;
  const residualFactor = clamp(1 - annualRate * ageYears, 0.3, 1);
  return Math.round(purchase * residualFactor);
}

export function getCurrentValuation(asset = {}) {
  const purchase = resolvePurchasePrice(asset);
  const purchaseDate = asset.purchaseDate || asset.invoiceDate || null;
  const simpleCurrent = estimateSimpleCurrentValue(asset);
  const dep = calculateDepreciation({
    purchaseValue: purchase,
    purchaseDate,
    categoryId: asset.categoryId || 'other',
  });
  const resale = calculateResaleValue({
    purchaseValue: purchase,
    purchaseDate,
    registrationYear: asset.registrationYear || asset.year,
    categoryId: asset.categoryId,
    category: asset.category,
    condition: asset.condition || 'good',
  });
  const current =
    simpleCurrent > 0
      ? simpleCurrent
      : resale.estimatedResale > 0
        ? resale.estimatedResale
        : dep.bookValue;
  return {
    purchase,
    current,
    bookValue: dep.bookValue,
    ageYears: dep.ageYears || yearsSince(purchaseDate),
    annualRate: dep.annualRate,
    resale,
    isVehicle: Boolean(resale.vehicleMarket),
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
            <Text style={styles.label}>
              {v.isVehicle ? 'EST. RESALE VALUE' : 'CURRENT VALUATION'}
            </Text>
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
      {v.isVehicle && !compact ? (
        <Text style={styles.vehicleNote}>
          Estimated Resale Value: {formatINR(v.current)} (Approx based on standard market
          depreciation)
        </Text>
      ) : null}
      {!compact ? <Text style={styles.disclaimer}>{VALUATION_DISCLAIMER}</Text> : null}

      <Modal visible={infoOpen} transparent animationType="fade" onRequestClose={() => setInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {v.isVehicle ? 'About Estimated Resale Value' : 'About Current Valuation'}
            </Text>
            <Text style={styles.modalBody}>
              {v.isVehicle
                ? 'Calculated in-app (no paid API): Year 1 −15%, Years 2–3 −10%/yr, Year 4+ −8%/yr from purchase / registration year. Actual market value may differ.'
                : VALUATION_DISCLAIMER}
            </Text>
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
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  approxText: { color: COLORS.neonBlue, fontSize: 9, fontWeight: '800' },
  purchase: { color: COLORS.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
  current: { color: COLORS.emerald, fontSize: 14, fontWeight: '900', marginTop: 4 },
  vehicleNote: {
    color: COLORS.neonBlue,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 2,
  },
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
  modalBtnText: { color: COLORS.onPrimary, fontWeight: '900' },
});

export default ValuationBlock;
