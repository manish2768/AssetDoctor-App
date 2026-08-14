/**
 * Energy Calculator — Gadgets & Home Appliances monthly cost overview.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { COLORS, SPACING, BRAND } from '../../theme/branding';
import { SMART_CATEGORIES } from '../../services/ocr/categoryClassifier';
import {
  resolveDefaultPowerRating,
  aggregateEnergyPortfolio,
} from '../../services/energy/EnergyService';
import { estimatePowerCost, isApplianceAsset } from '../../utils/powerCost';
import { formatINRExact } from '../../utils/format';
import { Haptics } from '../../services/haptics';
import { openScanInvoice } from '../../navigation/navActions';

function isEnergyEligible(asset) {
  if (!asset || asset.deletedAt || asset.isDemo) return false;
  const smart = String(asset.smartCategory || asset.invoiceMeta?.smartCategory || '').toLowerCase();
  const folder = String(asset.folderType || asset.categoryId || asset.category || '').toLowerCase();
  if (
    smart === SMART_CATEGORIES.GADGETS ||
    smart === SMART_CATEGORIES.HOME_APPLIANCES ||
    smart === 'gadgets' ||
    smart === 'home_appliances'
  ) {
    return true;
  }
  if (
    /gadget|phone|mobile|laptop|tablet|appliance|home|ac|fridge|tv|washer|geyser|microwave/.test(
      folder,
    )
  ) {
    return true;
  }
  return isApplianceAsset(asset) || Boolean(asset.isElectricAppliance);
}

function withEstimates(asset) {
  const name = asset.assetName || asset.productName || 'Appliance';
  const rating = resolveDefaultPowerRating({
    productName: name,
    categoryId: asset.categoryId || '',
    smartCategory: asset.smartCategory || '',
  });
  const wattage = Number(asset.wattage) > 0 ? Number(asset.wattage) : rating.wattage;
  const hours =
    Number(asset.avgDailyHours) > 0 ? Number(asset.avgDailyHours) : rating.avgDailyHours;
  const cost =
    Number(asset.estimatedMonthlyBillCost) > 0
      ? Number(asset.estimatedMonthlyBillCost)
      : estimatePowerCost({
          wattage,
          avgDailyHours: hours,
          powerFactor: rating.powerFactor,
        }).monthlyCost || 0;
  return {
    id: asset.assetId || asset.id,
    name,
    wattage,
    hours,
    monthlyCost: cost,
    smartCategory: asset.smartCategory || '',
  };
}

export function EnergyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { assets } = useAssets();

  const rows = useMemo(() => {
    return (assets || [])
      .filter(isEnergyEligible)
      .map(withEstimates)
      .filter((r) => r.wattage > 0 || r.monthlyCost > 0)
      .sort((a, b) => b.monthlyCost - a.monthlyCost);
  }, [assets]);

  const totalMonthly = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.monthlyCost) || 0), 0),
    [rows],
  );

  const highUse = useMemo(() => rows.filter((r) => r.monthlyCost >= 300).slice(0, 5), [rows]);

  const portfolio = useMemo(() => aggregateEnergyPortfolio(assets || []), [assets]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 100 },
        ]}
      >
        <Text style={styles.eyebrow}>ENERGY CALCULATOR</Text>
        <Text style={styles.title}>Appliance power bill</Text>
        <Text style={styles.sub}>
          Estimates for Gadgets & Home Appliances in your vault (default wattage × daily hours).
        </Text>

        <GlassCard glow style={{ marginTop: 14 }}>
          <Text style={styles.statLabel}>Estimated monthly cost</Text>
          <Text style={styles.statValue}>{formatINRExact(totalMonthly)}</Text>
          <Text style={styles.statHint}>
            {rows.length} electric item{rows.length === 1 ? '' : 's'} · tariff ₹
            {portfolio?.tariffPerKwh ?? 8}/kWh
          </Text>
        </GlassCard>

        {highUse.length ? (
          <GlassCard style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>High-consumption items</Text>
            {highUse.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.wattage}W · {item.hours}h/day
                  </Text>
                </View>
                <Text style={styles.rowCost}>{formatINRExact(item.monthlyCost)}</Text>
              </View>
            ))}
          </GlassCard>
        ) : null}

        <GlassCard style={{ marginTop: 12 }}>
          <Text style={styles.sectionTitle}>All gadgets & appliances</Text>
          {rows.length === 0 ? (
            <View>
              <Text style={styles.empty}>
                No Gadgets / Home Appliances found yet. Scan a bill for a TV, AC, fridge, or phone
                to see estimates.
              </Text>
              <Pressable
                style={styles.cta}
                onPress={() => {
                  Haptics.tap();
                  openScanInvoice();
                }}
              >
                <Text style={styles.ctaText}>Scan an appliance bill →</Text>
              </Pressable>
            </View>
          ) : (
            rows.map((item) => (
              <Pressable
                key={item.id}
                style={styles.row}
                onPress={() => {
                  Haptics.select();
                  navigation?.navigate?.('Home', {
                    screen: 'AssetPassport',
                    params: { assetId: item.id },
                  });
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.wattage}W · ~{item.hours}h/day
                  </Text>
                </View>
                <Text style={styles.rowCost}>{formatINRExact(item.monthlyCost)}</Text>
              </Pressable>
            ))
          )}
        </GlassCard>

        <Text style={styles.footNote}>
          {BRAND.name} uses typical Indian appliance wattage defaults. Edit hours on the asset
          passport for sharper bills.
        </Text>
        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

export default EnergyScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 16 },
  eyebrow: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 6 },
  sub: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  statLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  statValue: { color: COLORS.emerald, fontSize: 32, fontWeight: '900', marginTop: 4 },
  statHint: { color: COLORS.muted, fontSize: 12, marginTop: 6 },
  sectionTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowName: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  rowMeta: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  rowCost: { color: COLORS.emerald, fontWeight: '800', fontSize: 14 },
  empty: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },
  cta: { marginTop: 12, paddingVertical: 10 },
  ctaText: { color: COLORS.emerald, fontWeight: '800' },
  footNote: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 16 },
});
