/**
 * Asset Passport — redesigned hierarchy (presentation only).
 * Does not alter OCR, vault, or health scoring algorithms.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useAssets } from '../../context/AssetProvider';
import { ShareService } from '../../services/share/ShareService';
import { PdfExporter } from '../../services/pdfExporter';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { useAuth } from '../../context/AuthProvider';
import { COLORS } from '../../theme/branding';
import { CONTEXTUAL_SURFACE, getContextualTint } from '../../theme/contextualBackgrounds';
import { Haptics } from '../../services/haptics';
import { calculateHealthScore } from '../../utils/healthScore';
import { formatDateIN } from '../../utils/dates';
import { getAssetFolderType } from '../../utils/assetFolders';
import { getExpiryTone } from '../../utils/warrantyStatus';
import { ValuationBlock, getCurrentValuation } from '../../components/ValuationBlock';
import { WarrantyProgressBar } from '../../components/WarrantyProgressBar';
import { evaluateMaintenanceVsValue } from '../../utils/maintenanceValueAlert';
import { resolveSupportContact } from '../../constants/brandDirectory';
import { IndiaNumberPlate } from '../../components/vehicle/IndiaNumberPlate';
import { SpecAccordion } from '../../components/vehicle/SpecAccordion';
import { getVehicleSpecs } from '../../utils/vehicleSpecs';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { ClaimAssistantSheet } from '../../components/ClaimAssistantSheet';
import { InsightActionCard } from '../../components/ui/InsightActionCard';
import {
  cleanAssetDisplayName,
  formatRegistrationDisplay,
  maskImeiDisplay,
} from '../../utils/displayAssetName';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import { estimateApplianceEnergy } from '../../services/assets/energyIntelligence';
import { estimatedEnergyCostForAsset } from '../../services/finance/energyCostAnalytics';
import { evaluateAssetIntelligence } from '../../services/intelligence/AssetIntelligenceEngine';
import { formatWhatWhyDo } from '../../services/intelligence/types';
import { normalizeAssetFields } from '../../services/assets/normalizeAssetFields';
import {
  resolveCanonicalWarrantyExpiry,
  resolveWarrantyStartDate,
  resolveWarrantyText,
} from '../../utils/warrantyDates';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { formatIdentityMask } from '../../services/vehicles/insuranceVehicleMatch';
import { resolveMeasuredBatteryLabel } from '../../utils/homeAssetCardMeta';
import { commandHealthLabel } from '../../utils/commandHealthLabel';
import { formatINRExact } from '../../utils/format';
import { DEFAULT_TARIFF_PER_KWH } from '../../theme/branding';

function InfoRow({ label, value, tone }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, tone ? { color: tone } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function MaskedRow({ label, fullValue, maskedValue }) {
  const [revealed, setRevealed] = useState(false);
  if (!fullValue && !maskedValue) return null;
  const show = revealed ? fullValue : maskedValue || formatIdentityMask(fullValue) || '••••';
  return (
    <Pressable
      style={styles.infoRow}
      onPress={() => {
        Haptics.select();
        setRevealed((v) => !v);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${revealed ? 'hide' : 'reveal'}`}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>
        {show}
        <Text style={styles.revealHint}>{revealed ? '  Hide' : '  Reveal'}</Text>
      </Text>
    </Pressable>
  );
}

function DocStatusRow({ label, status, detail }) {
  const tone =
    status === 'on_file' ? COLORS.emerald : status === 'expired' ? COLORS.rose : COLORS.muted;
  const statusLabel =
    status === 'on_file' ? 'On file' : status === 'expired' ? 'Expired' : 'Not added';
  return (
    <View style={styles.docRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.docLabel}>{label}</Text>
        {detail ? (
          <Text style={styles.docDetail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.docStatus, { color: tone }]}>{statusLabel}</Text>
    </View>
  );
}

function expiryStatus(date, urgentDays = 30) {
  if (!date) return { status: 'missing', detail: null };
  const tone = getExpiryTone(date, { urgentDays });
  if (tone.id === 'expired') {
    return { status: 'expired', detail: formatDateIN(date) };
  }
  return { status: 'on_file', detail: formatDateIN(date) };
}

export function AssetPassportScreen({ route, navigation }) {
  const assetId = String(route?.params?.assetId || route?.params?.id || '').trim();
  const fromQr = !!route?.params?.fromQr;
  const { getAsset, removeAsset, loading: assetsLoading } = useAssets();
  const { user, profile } = useAuth();
  const [fetchedAsset, setFetchedAsset] = useState(null);
  const [fetchDone, setFetchDone] = useState(false);

  const memoryAsset = assetId ? getAsset(assetId) : null;

  useEffect(() => {
    let cancelled = false;
    setFetchedAsset(null);
    setFetchDone(false);
    if (!assetId) {
      setFetchDone(true);
      return undefined;
    }
    if (memoryAsset) {
      setFetchDone(true);
      return undefined;
    }
    if (assetsLoading) return undefined;

    (async () => {
      try {
        const uid = user?.uid;
        if (!uid) {
          if (!cancelled) setFetchDone(true);
          return;
        }
        const { AssetService } = require('../../services/assets/AssetService');
        const result = await AssetService.fetchAssetSnapshot(uid, assetId);
        if (!cancelled) {
          setFetchedAsset(result?.success ? result.asset : null);
          setFetchDone(true);
        }
      } catch (error) {
        console.warn('[AssetPassport] fetch failed:', error?.message || error);
        if (!cancelled) {
          setFetchedAsset(null);
          setFetchDone(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, memoryAsset, assetsLoading, user?.uid]);

  const rawAsset = memoryAsset || fetchedAsset;
  const normalized = useMemo(
    () => (rawAsset ? normalizeAssetFields({ ...rawAsset }) : null),
    [rawAsset],
  );
  const warrantyExpiry = normalized ? resolveCanonicalWarrantyExpiry(normalized) : null;
  const warrantyText = normalized ? resolveWarrantyText(normalized) : null;
  const asset = normalized
    ? {
        ...normalized,
        warrantyExpiry,
      }
    : null;
  const caps = resolveAssetCapabilities(asset || {});
  const intel = asset
    ? evaluateAssetIntelligence(asset, {}, { skipCache: false, includeClaimPack: true })
    : null;
  const [sharing, setSharing] = useState(false);
  const [sharingPassport, setSharingPassport] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bottomPad = useTabSafeBottomPadding({ extra: 24 });

  if (!assetId) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>Asset not found</Text>
        <Text style={[styles.missing, { marginTop: 8, opacity: 0.7, fontSize: 13 }]}>
          Missing asset id — open this asset again from Home.
        </Text>
      </View>
    );
  }

  if ((!asset && (assetsLoading || !fetchDone)) || (!asset && !fetchDone)) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>Loading asset…</Text>
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>Asset not found</Text>
        <Text style={[styles.missing, { marginTop: 8, opacity: 0.7, fontSize: 13 }]}>
          This asset is not in your current vault. If you just switched login method, pull to
          refresh Home after sync completes.
        </Text>
      </View>
    );
  }

  const health = calculateHealthScore(asset);
  const healthLabel = commandHealthLabel(health.band || health.grade) || health.band || health.grade;
  const isVehicle = getAssetFolderType(asset) === 'vehicle';
  const isGadget = getAssetFolderType(asset) === 'gadget' || caps.supportsBatteryHealth;
  const support = resolveSupportContact(asset);
  const pucTone = getExpiryTone(asset.pucExpiry, { urgentDays: 15 });
  const insuranceTone = getExpiryTone(asset.insuranceExpiry, { urgentDays: 30 });
  const warrantyTone = getExpiryTone(warrantyExpiry, { urgentDays: 30 });
  const serviceTone = getExpiryTone(asset.nextServiceDue, { urgentDays: 15 });
  const vehicleSpecs = isVehicle ? getVehicleSpecs(asset) : null;
  const maintenanceAlert = evaluateMaintenanceVsValue(asset);
  const displayName = cleanAssetDisplayName(asset.assetName, {
    registration: asset.registration,
  });
  const plate = formatRegistrationDisplay(asset.registration);
  const imeiFull = String(asset.imei || '').replace(/\D/g, '');
  const imeiMasked = maskImeiDisplay(asset.imei || asset.serialNumber);
  const valuation = getCurrentValuation(asset);
  const battery = caps.supportsBatteryHealth ? resolveMeasuredBatteryLabel(asset) : null;
  const serviceHistory = Array.isArray(asset.serviceHistory)
    ? asset.serviceHistory
    : Array.isArray(asset.maintenanceLogs)
      ? asset.maintenanceLogs
      : [];
  const serviceCount = serviceHistory.length;
  const lastService =
    asset.lastServiceDate ||
    serviceHistory[0]?.date ||
    serviceHistory[0]?.serviceDate ||
    null;

  const showEnergy = caps.supportsEnergyTracking === true;
  const energyWatts = Number(asset.wattage || asset.powerWatts || asset.energyProfile?.ratedPowerWatts) || 0;
  const energyHours =
    Number(asset.avgDailyHours || asset.dailyHours || asset.energyProfile?.usageHoursPerDay) || 0;
  const energyDays =
    Number(asset.usageDaysPerMonth || asset.energyProfile?.usageDaysPerMonth) > 0
      ? Number(asset.usageDaysPerMonth || asset.energyProfile?.usageDaysPerMonth)
      : 30;
  const energyTariff =
    Number(asset.electricityTariff || asset.energyProfile?.electricityTariff) > 0
      ? Number(asset.electricityTariff || asset.energyProfile?.electricityTariff)
      : DEFAULT_TARIFF_PER_KWH;
  const energyEst =
    showEnergy && energyWatts > 0 && energyHours >= 0
      ? estimateApplianceEnergy({
          ratedPowerWatts: energyWatts,
          usageHoursPerDay: energyHours,
          usageDaysPerMonth: energyDays,
          tariffPerKwh: energyTariff,
          voltage: asset.voltage ?? asset.energyProfile?.voltage,
        })
      : estimatedEnergyCostForAsset(asset, energyTariff);

  const typeLabel =
    asset.categoryLabel ||
    asset.category ||
    (isVehicle ? 'Vehicle' : isGadget ? 'Phone / Gadget' : 'Asset');

  const primaryIdLine = isVehicle
    ? plate || 'Registration not set'
    : imeiMasked
      ? `IMEI ${imeiMasked}`
      : asset.serialNumber
        ? `S/N ···${String(asset.serialNumber).slice(-4)}`
        : 'Identifier not set';

  const docs = [];
  if (isVehicle || caps.supportsInsurance) {
    const ins = expiryStatus(asset.insuranceExpiry, 30);
    docs.push({
      label: 'Insurance',
      ...ins,
      detail: ins.detail || (asset.policyNumber ? 'Policy on file' : null),
    });
  }
  if (isVehicle) {
    docs.push({
      label: 'RC',
      status: plate ? 'on_file' : 'missing',
      detail: plate || null,
    });
    docs.push({ label: 'PUC', ...expiryStatus(asset.pucExpiry, 15) });
  }
  docs.push({ label: 'Warranty', ...expiryStatus(warrantyExpiry, 30) });
  if (isVehicle || caps.supportsServiceHistory) {
    docs.push({
      label: 'Service Bills',
      status: serviceCount > 0 ? 'on_file' : 'missing',
      detail: serviceCount > 0 ? `${serviceCount} record${serviceCount === 1 ? '' : 's'}` : null,
    });
  }
  docs.push({
    label: 'Other documents',
    status: asset.billImageUrl || asset.documentId ? 'on_file' : 'missing',
    detail: asset.billImageUrl || asset.documentId ? 'Bill / vault link' : null,
  });

  const onEmergencyShare = async () => {
    Haptics.tap();
    setSharing(true);
    const vaultDocs = user?.uid
      ? await DocumentVaultService.listDocuments(user.uid, asset.assetId || asset.id)
      : [];
    const result = await ShareService.shareEmergencyBundle({ asset, documents: vaultDocs });
    setSharing(false);
    if (!result.success) Alert.alert('Emergency Share', result.error || 'Could not create PDF');
  };

  const onSharePassportPdf = async () => {
    Haptics.tap();
    setSharingPassport(true);
    const result = await PdfExporter.shareAssetPassportPdf({
      asset,
      owner: {
        name: profile?.name || user?.displayName || '',
        phone: profile?.phone || user?.phoneNumber || '',
      },
      preferWhatsApp: true,
    });
    setSharingPassport(false);
    if (!result.success) {
      Alert.alert('Passport PDF', result.error || 'Could not share Asset Passport');
    }
  };

  const onCallSupport = async () => {
    Haptics.tap();
    if (!support?.phone) {
      Alert.alert(
        'Add customer care',
        'Save the manufacturer phone number or pick a known brand to use 1-tap helpline.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Edit asset',
            onPress: () =>
              navigation?.navigate?.('AddAsset', { assetId: asset.assetId || asset.id }),
          },
        ],
      );
      return;
    }
    try {
      await Linking.openURL(`tel:${support.phone}`);
    } catch (error) {
      Alert.alert('Customer care', error?.message || 'Could not open dialer.');
    }
  };

  const onDelete = () => {
    Haptics.tap();
    Alert.alert(
      'Delete Asset',
      `Remove “${asset.assetName}” from your vault? This hides it from Home and reminders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await removeAsset(asset.assetId || asset.id);
            setDeleting(false);
            if (!result?.success) {
              Alert.alert('Delete failed', result?.error || 'Could not delete asset');
              return;
            }
            Haptics.success();
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('MainTabs', { screen: 'Home' });
          },
        },
      ],
    );
  };

  const openMaintenance = () => {
    Haptics.tap();
    navigation?.navigate?.('Maintenance', { assetId: asset.assetId || asset.id });
  };
  const openEdit = () => {
    Haptics.tap();
    navigation?.navigate?.('AddAsset', { assetId: asset.assetId || asset.id });
  };
  const openEnergyDetail = () => {
    Haptics.tap();
    navigation?.navigate?.('ApplianceEnergyDetail', {
      assetId: asset.assetId || asset.id,
    });
  };
  const openVault = () => {
    Haptics.tap();
    navigation?.navigate?.('DocumentsVault', { assetId: asset.assetId || asset.id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: getContextualTint(CONTEXTUAL_SURFACE.PASSPORT),
        }}
      />
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {asset.isDemo ? (
        <Text style={styles.demoNote}>Demo preview — sign in to save your own assets & docs</Text>
      ) : null}

      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <CategoryIcon
            name={asset.categoryId || asset.icon || 'other'}
            size={40}
            color={COLORS.emerald}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerName} numberOfLines={2}>
              {displayName || asset.assetName}
            </Text>
            <Text style={styles.headerType}>{typeLabel}</Text>
            <Text style={styles.headerId} numberOfLines={1}>
              {primaryIdLine}
            </Text>
          </View>
          <View style={styles.healthPill}>
            <Text style={styles.healthPillScore}>{health.score}</Text>
            <Text style={styles.healthPillLabel}>{healthLabel || 'Health'}</Text>
          </View>
        </View>
        {isVehicle && vehicleSpecs?.rawRegistration ? (
          <IndiaNumberPlate registration={vehicleSpecs.rawRegistration} style={{ marginTop: 12 }} />
        ) : null}
      </View>

      {fromQr ? (
        <View style={styles.qrActions}>
          {[
            { label: 'Add Service', onPress: openMaintenance },
            { label: 'Documents', onPress: openVault },
            { label: 'Edit', onPress: openEdit },
          ].map((a) => (
            <Pressable key={a.label} style={styles.qrChip} onPress={a.onPress}>
              <Text style={styles.qrChipText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionEyebrow}>Asset Health</Text>
      <View style={styles.panel}>
        <Text style={styles.scoreLine}>
          {health.score}
          <Text style={styles.scoreOver}> / 100</Text>
          <Text style={styles.grade}> · {healthLabel || health.band || '—'}</Text>
        </Text>
        {(health.why || health.tips || []).slice(0, 3).map((t) => (
          <Text key={t} style={styles.tip}>
            · {t}
          </Text>
        ))}
        {health.service?.message ? (
          <Text style={[styles.tip, { marginTop: 8, color: COLORS.text }]}>
            Next: {health.service.recommended ? 'Recommended — ' : ''}
            {health.service.message}
          </Text>
        ) : null}
      </View>

      <Text style={styles.sectionEyebrow}>Key Information</Text>
      <View style={styles.panel}>
        {isVehicle ? (
          <>
            <InfoRow label="Registration" value={plate || 'Not available'} />
            <InfoRow
              label="Model"
              value={asset.model || asset.brandName || displayName || asset.assetName}
            />
            {asset.odometerKm != null ? (
              <InfoRow
                label="Odometer"
                value={`${Number(asset.odometerKm).toLocaleString('en-IN')} km`}
              />
            ) : null}
            <SpecAccordion
              title="Technical details"
              defaultOpen={false}
              rows={[
                { label: 'Chassis / Frame', value: vehicleSpecs?.chassis || asset.chassisNumber },
                { label: 'Engine No', value: asset.engineNumber },
                { label: 'RTO', value: vehicleSpecs?.rto },
                { label: 'Fuel Norms', value: vehicleSpecs?.fuelNorm },
              ].filter((r) => r.value && r.value !== '—')}
            />
          </>
        ) : (
          <>
            <InfoRow
              label="Model"
              value={asset.model || asset.brandName || displayName || asset.assetName}
            />
            {imeiFull || imeiMasked ? (
              <MaskedRow
                label="IMEI"
                fullValue={imeiFull || asset.imei}
                maskedValue={imeiMasked}
              />
            ) : (
              <InfoRow label="IMEI" value="Not available" />
            )}
            {asset.serialNumber && !imeiFull ? (
              <MaskedRow
                label="Serial"
                fullValue={String(asset.serialNumber)}
                maskedValue={`···${String(asset.serialNumber).slice(-4)}`}
              />
            ) : null}
            {caps.supportsBatteryHealth ? (
              <InfoRow
                label="Battery health"
                value={battery?.available ? battery.text : 'Not available'}
              />
            ) : null}
            <InfoRow
              label="Purchase date"
              value={formatDateIN(asset.purchaseDate || asset.invoiceDate)}
            />
          </>
        )}
      </View>

      <Text style={styles.sectionEyebrow}>Warranty & Coverage</Text>
      <View style={styles.panel}>
        {warrantyExpiry ? (
          <>
            <WarrantyProgressBar
              label="Warranty"
              startDate={asset.purchaseDate || asset.invoiceDate || resolveWarrantyStartDate(asset)}
              endDate={warrantyExpiry}
            />
            <InfoRow
              label="Warranty expiry"
              value={`${formatDateIN(warrantyExpiry)} · ${warrantyTone.label}`}
              tone={warrantyTone.color}
            />
          </>
        ) : (
          <InfoRow label="Warranty" value="Not available" />
        )}
        {warrantyText ? <InfoRow label="Warranty terms" value={warrantyText} /> : null}
        {(isVehicle || caps.supportsInsurance) && asset.insuranceExpiry ? (
          <>
            <WarrantyProgressBar
              label="Insurance"
              startDate={asset.insuranceStart || asset.purchaseDate}
              endDate={asset.insuranceExpiry}
            />
            <InfoRow
              label="Insurance expiry"
              value={`${formatDateIN(asset.insuranceExpiry)} · ${insuranceTone.label}`}
              tone={insuranceTone.color}
            />
            {asset.insurer || asset.policyNumber ? (
              <InfoRow
                label="Policy"
                value={[asset.insurer, asset.policyNumber].filter(Boolean).join(' · ')}
              />
            ) : null}
          </>
        ) : isVehicle || caps.supportsInsurance ? (
          <InfoRow label="Insurance" value="Not available" />
        ) : null}
        {(isVehicle || caps.supportsPUC) && asset.pucExpiry ? (
          <>
            <WarrantyProgressBar
              label="PUC"
              startDate={asset.purchaseDate}
              endDate={asset.pucExpiry}
              totalDays={180}
            />
            <InfoRow
              label="PUC expiry"
              value={`${formatDateIN(asset.pucExpiry)} · ${pucTone.label}`}
              tone={pucTone.color}
            />
          </>
        ) : isVehicle || caps.supportsPUC ? (
          <InfoRow label="PUC" value="Not available" />
        ) : null}
      </View>

      {(isVehicle || caps.supportsServiceHistory || asset.nextServiceDue || serviceCount > 0) && (
        <>
          <Text style={styles.sectionEyebrow}>Service / Maintenance</Text>
          <View style={styles.panel}>
            <InfoRow label="Latest service" value={formatDateIN(lastService) || 'Not available'} />
            <InfoRow
              label="Next service"
              value={
                asset.nextServiceDue
                  ? `${formatDateIN(asset.nextServiceDue)} · ${serviceTone.label}`
                  : 'Not available'
              }
              tone={asset.nextServiceDue ? serviceTone.color : undefined}
            />
            {isVehicle && asset.nextServiceOdometerKm != null ? (
              <InfoRow
                label="Next service at"
                value={`${Number(asset.nextServiceOdometerKm).toLocaleString('en-IN')} km`}
              />
            ) : null}
            <InfoRow label="Service records" value={`${serviceCount} total`} />
            {serviceHistory.slice(0, 5).map((row, idx) => {
              const date = row.date || row.serviceDate || row.repairDate;
              const odo = row.odometerKm ?? row.odometer;
              const workshop = row.workshop || row.serviceProvider || row.vendor || row.storeName;
              const cost = row.totalAmount ?? row.cost ?? row.costInr ?? row.amount;
              const type = row.serviceType || row.category || row.title || 'Service';
              return (
                <View key={row.id || row.historyId || `svc-${idx}`} style={styles.svcHistRow}>
                  <Text style={styles.svcHistTitle} numberOfLines={1}>
                    {type}
                  </Text>
                  <Text style={styles.svcHistMeta}>
                    {[
                      date ? formatDateIN(date) : null,
                      odo != null ? `${Number(odo).toLocaleString('en-IN')} km` : null,
                      workshop || null,
                      cost != null && Number(cost) > 0 ? formatINRExact(cost) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Details not available'}
                  </Text>
                </View>
              );
            })}
            <Pressable style={styles.inlineLink} onPress={openMaintenance}>
              <Text style={styles.inlineLinkText}>Open service history →</Text>
            </Pressable>
          </View>
        </>
      )}

      {showEnergy ? (
        <>
          <Text style={styles.sectionEyebrow}>Energy</Text>
          <View style={styles.panel}>
            <InfoRow
              label="Power"
              value={energyWatts > 0 ? `${energyWatts} W` : 'Not available'}
            />
            <InfoRow
              label="Estimated usage"
              value={energyHours > 0 ? `${energyHours} hrs/day` : 'Not available'}
            />
            <InfoRow
              label="Consumption"
              value={
                energyEst?.estimatedMonthlyConsumptionKwh != null
                  ? `~${energyEst.estimatedMonthlyConsumptionKwh} kWh/month`
                  : energyEst?.monthlyKwh != null
                    ? `~${energyEst.monthlyKwh} kWh/month`
                    : 'Not enough data yet.'
              }
            />
            <InfoRow
              label="Cost"
              value={
                energyEst?.estimatedMonthlyCost != null
                  ? `~${formatINRExact(energyEst.estimatedMonthlyCost)}/month`
                  : energyEst?.monthlyCost != null
                    ? `~${formatINRExact(energyEst.monthlyCost)}/month`
                    : 'Not enough data yet.'
              }
            />
            <Pressable style={styles.inlineLink} onPress={openEdit}>
              <Text style={styles.inlineLinkText}>Edit usage assumptions →</Text>
            </Pressable>
            <Pressable style={styles.inlineLink} onPress={openEnergyDetail}>
              <Text style={styles.inlineLinkText}>Open energy detail →</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={styles.sectionEyebrow}>Documents</Text>
      <View style={styles.panel}>
        {docs.map((d) => (
          <DocStatusRow key={d.label} label={d.label} status={d.status} detail={d.detail} />
        ))}
        <Pressable style={styles.folderCta} onPress={openVault}>
          <Text style={styles.folderCtaText}>Open Documents Vault →</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionEyebrow}>Valuation</Text>
      <View style={styles.panel}>
        <InfoRow
          label="Purchase price"
          value={
            valuation?.purchase > 0
              ? `₹${Number(valuation.purchase).toLocaleString('en-IN')}`
              : 'Not available'
          }
        />
        <InfoRow
          label="Current estimated value"
          value={
            valuation?.current > 0 && !valuation.unavailable
              ? `₹${Number(valuation.current).toLocaleString('en-IN')} (estimate)`
              : 'Estimate unavailable'
          }
        />
        <Text style={styles.estimateNote}>
          Estimates are indicative only — not a guaranteed market price.
        </Text>
        <ValuationBlock asset={asset} compact />
      </View>

      {intel?.available && (intel.recommendations?.length || intel.repairReplace?.available) ? (
        <>
          <Text style={styles.sectionEyebrow}>Insights</Text>
          <View style={styles.panel}>
            {(intel.recommendations || []).slice(0, 2).map((rec) => {
              const tri =
                rec.supportingData ||
                formatWhatWhyDo({
                  what: rec.title,
                  why: (rec.reasons || []).join(' ') || rec.description,
                  whatShouldIDo: rec.action,
                  priority: rec.priority,
                });
              return (
                <InsightActionCard
                  key={rec.id || tri.what}
                  what={tri.what}
                  why={tri.why}
                  whatShouldIDo={tri.whatShouldIDo}
                  priority={tri.priority || rec.priority}
                  ctaLabel={
                    /warranty|claim/i.test(`${tri.what} ${rec.action || ''}`)
                      ? 'Open claim pack'
                      : caps.supportsServiceHistory
                        ? 'Open service'
                        : 'Edit asset'
                  }
                  onCta={() => {
                    if (/warranty|claim/i.test(`${tri.what} ${rec.action || ''}`)) {
                      setClaimOpen(true);
                      return;
                    }
                    if (caps.supportsServiceHistory) {
                      openMaintenance();
                      return;
                    }
                    openEdit();
                  }}
                />
              );
            })}
            {maintenanceAlert?.shouldAlert ? (
              <Text style={styles.demoNote}>{maintenanceAlert.message}</Text>
            ) : null}
          </View>
        </>
      ) : null}

      <Pressable style={styles.primaryBtn} onPress={openMaintenance}>
        <Text style={styles.primaryBtnText}>Service & Maintenance</Text>
      </Pressable>
      <Pressable style={styles.primaryBtnAlt} onPress={openEdit}>
        <Text style={styles.primaryBtnText}>Edit Asset</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={onSharePassportPdf} disabled={sharingPassport}>
        {sharingPassport ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={styles.secondaryBtnText}>Share Passport</Text>
        )}
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={openVault}>
        <Text style={styles.secondaryBtnText}>Open Documents Vault</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={onCallSupport}>
        <Text style={styles.secondaryBtnText}>
          {support?.phone ? `Call support · ${support.label}` : 'Claim / Support'}
        </Text>
      </Pressable>
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => {
          Haptics.tap();
          setClaimOpen(true);
        }}
      >
        <Text style={styles.secondaryBtnText}>How to claim warranty</Text>
      </Pressable>
      {ShareService.isEmergencyShareEligible(asset) ? (
        <Pressable style={styles.secondaryBtn} onPress={onEmergencyShare} disabled={sharing}>
          {sharing ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.secondaryBtnText}>Emergency Share · Offline PDF</Text>
          )}
        </Pressable>
      ) : null}

      {!asset.isDemo ? (
        <Pressable style={styles.deleteBtn} onPress={onDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>Delete Asset</Text>
          )}
        </Pressable>
      ) : null}

      <ClaimAssistantSheet visible={claimOpen} asset={asset} onClose={() => setClaimOpen(false)} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  missing: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  demoNote: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 8,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerName: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  headerType: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  headerId: { color: COLORS.neonBlue, fontSize: 13, fontWeight: '800', marginTop: 4 },
  healthPill: {
    alignItems: 'center',
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  healthPillScore: { color: COLORS.emerald, fontWeight: '900', fontSize: 18 },
  healthPillLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  sectionEyebrow: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  panel: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  scoreLine: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  scoreOver: { fontSize: 14, color: COLORS.muted, fontWeight: '700' },
  grade: { fontSize: 14, color: COLORS.emerald, fontWeight: '700' },
  tip: { color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', flex: 1 },
  infoValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    flex: 1.3,
    textAlign: 'right',
  },
  revealHint: { color: COLORS.neonBlue, fontWeight: '700', fontSize: 11 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  docLabel: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  docDetail: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  docStatus: { fontWeight: '800', fontSize: 11 },
  folderCta: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(8,145,178,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(8,145,178,0.28)',
  },
  folderCtaText: { color: COLORS.neonBlue, fontWeight: '800', fontSize: 12 },
  inlineLink: { marginTop: 10, minHeight: 40, justifyContent: 'center' },
  inlineLinkText: { color: COLORS.neonBlue, fontWeight: '800', fontSize: 13 },
  estimateNote: { color: COLORS.muted, fontSize: 11, marginTop: 8, marginBottom: 4 },
  svcHistRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  svcHistTitle: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  svcHistMeta: { color: COLORS.muted, fontSize: 11, marginTop: 2, lineHeight: 16 },
  qrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  qrChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qrChipText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnAlt: {
    marginTop: 10,
    backgroundColor: COLORS.indigo || '#4338CA',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  deleteBtn: {
    marginTop: 28,
    marginBottom: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  deleteText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

export default AssetPassportScreen;
