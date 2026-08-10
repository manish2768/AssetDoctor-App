/**
 * Appliance Energy — auto bill estimate for owned appliances only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { PowerLogService } from '../../services/power/PowerLogService';
import { openLogin } from '../../navigation/authGate';
import {
  estimatePowerCost,
  isApplianceAsset,
  resolveAppliancePower,
} from '../../utils/powerCost';
import { aggregateEnergyPortfolio } from '../../services/energy/EnergyService';
import { DEFAULT_TARIFF_PER_KWH, COLORS, SPACING } from '../../theme/branding';
import { formatINRExact } from '../../utils/format';
import { Haptics } from '../../services/haptics';
import { DonutChart } from '../../components/charts/DonutChart';
import { EnergyDoctorTip } from '../../components/EnergyDoctorTip';

export function AssetEnergyScreen({ navigation }) {
  const { user, isAuthenticated } = useAuth();
  const { assets, dailyPower } = useAssets();
  const portfolio = useMemo(() => aggregateEnergyPortfolio(assets, DEFAULT_TARIFF_PER_KWH), [assets]);
  const poweredAssets = useMemo(
    () =>
      assets.filter(
        (a) => a?.isElectricAppliance === true || isApplianceAsset(a),
      ),
    [assets],
  );
  const [assetId, setAssetId] = useState('');
  const [hours, setHours] = useState('4');
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  const donutSlices = useMemo(
    () =>
      (portfolio.breakdown || []).map((row) => ({
        id: row.assetId,
        label: row.assetName,
        value: row.dailyKwh,
      })),
    [portfolio.breakdown],
  );

  const monthlyEstimate =
    portfolio.monthlyCostInr || dailyPower.monthlyCostInr || 0;

  useEffect(() => {
    if (!user?.uid) {
      setLogs([]);
      return undefined;
    }
    return PowerLogService.listenToLogs(user.uid, setLogs);
  }, [user?.uid]);

  useEffect(() => {
    if (!poweredAssets.length) {
      setAssetId('');
      return;
    }
    if (!poweredAssets.some((a) => (a.assetId || a.id) === assetId)) {
      const first = poweredAssets[0];
      setAssetId(first.assetId || first.id);
      const resolved = resolveAppliancePower(first);
      setHours(String(resolved.dailyHours || 4));
    }
  }, [assetId, poweredAssets]);

  const selected = poweredAssets.find((a) => (a.assetId || a.id) === assetId);
  const resolved = resolveAppliancePower(selected || {});
  const estimate = estimatePowerCost({
    powerWatts: resolved.powerWatts,
    hoursUsed: Number(hours) || 0,
    powerFactor: resolved.powerFactor,
    tariffPerKwh: DEFAULT_TARIFF_PER_KWH,
  });

  const onSelectAppliance = (item) => {
    Haptics.select();
    setAssetId(item.assetId || item.id);
    const next = resolveAppliancePower(item);
    setHours(String(next.dailyHours || 4));
  };

  const onLogUsage = async () => {
    Haptics.tap();
    if (!isAuthenticated || !user?.uid) {
      openLogin(navigation);
      return;
    }
    if (!selected || Number(hours) <= 0) return;
    setBusy(true);
    const result = await PowerLogService.logUsage(user.uid, {
      assetId: selected.assetId || selected.id,
      assetName: selected.assetName,
      powerWatts: resolved.powerWatts,
      powerFactor: resolved.powerFactor,
      hoursUsed: Number(hours),
    });
    setBusy(false);
    if (result.success) Haptics.success();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Appliance Bill Estimate</Text>
      <Text style={styles.sub}>
        We estimate electricity cost only for appliances in your vault — no manual math needed.
      </Text>

      <View style={styles.finalCard}>
        <Text style={styles.eyebrow}>FINAL ESTIMATED BILL</Text>
        <Text style={styles.finalValue}>
          {formatINRExact(monthlyEstimate)}
        </Text>
        <Text style={styles.finalUnit}>per month</Text>
        <View style={styles.finalRow}>
          <View style={styles.finalStat}>
            <Text style={styles.finalStatValue}>
              {formatINRExact(portfolio.costInr || dailyPower.costInr || 0)}
            </Text>
            <Text style={styles.finalStatLabel}>/ day</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.finalStat}>
            <Text style={styles.finalStatValue}>
              {(portfolio.dailyKwh || dailyPower.dailyKwh || 0).toFixed(2)}
            </Text>
            <Text style={styles.finalStatLabel}>kWh / day</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.finalStat}>
            <Text style={styles.finalStatValue}>
              {portfolio.tracked || dailyPower.tracked || 0}
            </Text>
            <Text style={styles.finalStatLabel}>appliances</Text>
          </View>
        </View>
        <Text style={styles.friendlyNote}>
          Based on each appliance&apos;s wattage and typical daily hours at ₹{DEFAULT_TARIFF_PER_KWH}
          /kWh.
        </Text>
      </View>

      <EnergyDoctorTip
        breakdown={portfolio.breakdown || []}
        monthlyCost={monthlyEstimate}
        style={{ marginTop: 16 }}
      />

      {donutSlices.length ? (
        <View style={styles.chartCard}>
          <Text style={styles.label}>Daily energy mix</Text>
          <DonutChart
            slices={donutSlices}
            centerLabel={`${(portfolio.dailyKwh || dailyPower.dailyKwh || 0).toFixed(1)}`}
            centerSub="kWh / day"
          />
        </View>
      ) : null}

      {poweredAssets.length ? (
        <>
          <Text style={styles.label}>Adjust one appliance</Text>
          <FlatList
            horizontal
            data={poweredAssets}
            keyExtractor={(item) => item.assetId || item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => {
              const id = item.assetId || item.id;
              const active = id === assetId;
              return (
                <Pressable
                  onPress={() => onSelectAppliance(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item.icon || '🔌'} {item.assetName}
                  </Text>
                </Pressable>
              );
            }}
          />

          <View style={styles.meterCard}>
            <Text style={styles.eyebrow}>THIS APPLIANCE TODAY</Text>
            <Text style={styles.meterValue}>{formatINRExact(estimate.costInr)}</Text>
            <Text style={styles.sub}>
              {resolved.powerWatts}W for {hours || 0} hours today — about{' '}
              {estimate.kwh.toFixed(2)} kWh, roughly {formatINRExact(estimate.costInr * 30)} per
              month.
            </Text>
          </View>

          <Text style={styles.label}>Hours used today</Text>
          <TextInput
            style={styles.input}
            value={hours}
            onChangeText={setHours}
            keyboardType="decimal-pad"
            placeholder="Hours"
            placeholderTextColor={COLORS.muted}
          />
          <Pressable
            style={[styles.primary, (busy || Number(hours) <= 0) && styles.disabled]}
            onPress={onLogUsage}
            disabled={busy || Number(hours) <= 0}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <Text style={styles.primaryText}>Save today&apos;s usage</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No appliances yet</Text>
          <Text style={styles.sub}>
            Add AC, fridge, TV, washing machine, laptop or phone. Scan the purchase bill and the
            system will try to read wattage / power factor automatically.
          </Text>
          <Pressable
            style={[styles.primary, { marginTop: 12 }]}
            onPress={() => {
              Haptics.tap();
              // Power is a direct tab screen — navigate sibling tab, do NOT use getParent()
              // (parent is RootStack and would drop the AddAsset params).
              navigation.navigate('Assets', {
                screen: 'AddAsset',
                params: { categoryId: 'appliance', category: 'Appliance' },
              });
            }}
          >
            <Text style={styles.primaryText}>Add appliance</Text>
          </Pressable>
        </View>
      )}

      <Text style={[styles.label, styles.logsLabel]}>Recent usage logs</Text>
      {logs.length ? (
        logs.map((log) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logTitle}>{log.assetName || 'Appliance'}</Text>
            <Text style={styles.sub}>
              {log.hoursUsed}h · {log.kwh} kWh · {formatINRExact(log.costInr)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.sub}>No usage logs yet — estimate above still uses daily hours.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: 48 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  finalCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  eyebrow: {
    color: COLORS.amber,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  finalValue: { color: COLORS.text, fontSize: 34, fontWeight: '900', marginTop: 6 },
  finalUnit: { color: COLORS.muted, fontWeight: '700', marginTop: 2 },
  finalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  finalStat: { flex: 1 },
  finalStatValue: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  finalStatLabel: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  divider: { width: 1, height: 34, backgroundColor: COLORS.border, marginHorizontal: 8 },
  friendlyNote: { color: COLORS.muted, fontSize: 12, marginTop: 14, lineHeight: 17 },
  chartCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  label: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
  },
  chips: { gap: 8, paddingRight: 10 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.card,
  },
  chipActive: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.successSoft,
  },
  chipText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: COLORS.emerald },
  meterCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  meterValue: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 5 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  primary: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.emerald,
  },
  disabled: { opacity: 0.45 },
  primaryText: { color: COLORS.onPrimary, fontWeight: '900' },
  empty: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  emptyTitle: { color: COLORS.text, fontWeight: '800' },
  logsLabel: { marginTop: 26 },
  logRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
    backgroundColor: COLORS.card,
  },
  logTitle: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
});

export default AssetEnergyScreen;
