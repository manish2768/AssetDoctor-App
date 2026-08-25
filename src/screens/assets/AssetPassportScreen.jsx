import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { useAssets } from '../../context/AssetProvider';
import { AssetPassportCard } from '../../components/AssetPassportCard';
import { ShareService } from '../../services/share/ShareService';
import { PdfExporter } from '../../services/pdfExporter';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { useAuth } from '../../context/AuthProvider';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { calculateHealthScore } from '../../utils/healthScore';
import { formatDateIN } from '../../utils/dates';
import { getExpiryTone } from '../../utils/warrantyStatus';
import { ValuationBlock } from '../../components/ValuationBlock';
import { WarrantyBadge } from '../../components/WarrantyBadge';
import { WarrantyProgressBar } from '../../components/WarrantyProgressBar';
import { evaluateMaintenanceVsValue } from '../../utils/maintenanceValueAlert';
import { resolveSupportContact } from '../../constants/brandDirectory';
import { IndiaNumberPlate } from '../../components/vehicle/IndiaNumberPlate';
import { VehicleStatusBadges } from '../../components/vehicle/VehicleStatusBadges';
import { SpecAccordion } from '../../components/vehicle/SpecAccordion';
import { getVehicleSpecs } from '../../utils/vehicleSpecs';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { ClaimAssistantSheet } from '../../components/ClaimAssistantSheet';
import { computeGadgetSmartMetrics } from '../../utils/gadgetSmartMetrics';
import { HealthScoreExplain } from '../../components/HealthScoreExplain';
import { vaultCopyForAsset, resolveIntelligenceLayout } from '../../design-system/assetIntelligenceSchema';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import { SmartActionCard } from '../../components/SmartActionCard';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import {
  categoryHealthFactors,
  resolvePrimaryNextAction,
} from '../../utils/nextActionUi';

function TrackerRow({ label, value, color, styles: s }) {
  return (
    <View style={s.trackerRow}>
      <Text style={s.trackerLabel}>{label}</Text>
      <Text style={[s.trackerValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export function AssetPassportScreen({ route, navigation }) {
  const assetId = route?.params?.assetId;
  const fromQr = !!route?.params?.fromQr;
  const { getAsset, removeAsset } = useAssets();
  const { user, profile } = useAuth();
  const ui = useUiFeedback();
  const asset = getAsset(assetId);
  const [sharing, setSharing] = useState(false);
  const [sharingPassport, setSharingPassport] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bottomPad = useTabSafeBottomPadding({ extra: 24 });

  if (!asset) {
    return (
      <View style={styles.root}>
        <Text style={styles.missing}>Asset not found</Text>
      </View>
    );
  }

  const health = calculateHealthScore(asset);
  const caps = resolveAssetCapabilities(asset);
  const layout = resolveIntelligenceLayout(asset);
  const isVehicle = caps.supportsOdometer === true;
  const isAc = String(asset.categoryId || '').toLowerCase() === 'ac';
  const support = resolveSupportContact(asset);
  const pucTone = getExpiryTone(asset.pucExpiry, { urgentDays: 15 });
  const insuranceTone = getExpiryTone(asset.insuranceExpiry, { urgentDays: 30 });
  const warrantyTone = getExpiryTone(asset.warrantyExpiry, { urgentDays: 30 });
  const serviceTone = getExpiryTone(asset.nextServiceDue, { urgentDays: 15 });
  const vehicleSpecs = isVehicle ? getVehicleSpecs(asset) : null;
  const maintenanceAlert = evaluateMaintenanceVsValue(asset);
  const nextAction = resolvePrimaryNextAction(asset);
  const healthFactors = categoryHealthFactors(asset, health);
  const gadgetMetrics = caps.supportsBatteryHealth ? computeGadgetSmartMetrics(asset) : null;

  const hasCoverage =
    asset.warrantyExpiry ||
    (caps.supportsInsurance && asset.insuranceExpiry) ||
    (caps.supportsPUC && asset.pucExpiry) ||
    asset.nextServiceDue;

  const hasMaintenanceSection =
    layout.fieldsBySection.maintenance?.length > 0 &&
    (isVehicle ||
      caps.supportsServiceHistory ||
      asset.nextServiceDue ||
      asset.odometerKm != null ||
      isAc);

  const hasWarrantySection = caps.supportsWarranty && (asset.warrantyExpiry || asset.warrantyMonths);
  const hasHistorySection = caps.supportsServiceHistory;
  const vaultCopy = vaultCopyForAsset(asset);

  const importantSubtitle = [
    caps.supportsOdometer && asset.odometerKm != null ? `${asset.odometerKm} km` : null,
    caps.supportsBatteryHealth && gadgetMetrics
      ? `Battery ${gadgetMetrics.batteryHealthPercent}%`
      : null,
    asset.warrantyExpiry ? `Warranty · ${formatDateIN(asset.warrantyExpiry)}` : null,
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ') || 'Key dates and valuation at a glance';

  const onEmergencyShare = async () => {
    Haptics.tap();
    setSharing(true);
    const docs = user?.uid
      ? await DocumentVaultService.listDocuments(user.uid, asset.assetId || asset.id)
      : [];
    const result = await ShareService.shareEmergencyBundle({ asset, documents: docs });
    setSharing(false);
    if (!result.success) ui.error('Emergency Share', result.error || 'Could not create PDF');
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
      ui.error('Passport PDF', result.error || 'Could not share Asset Passport');
    }
  };

  const onCallSupport = async () => {
    Haptics.tap();
    if (!support?.phone) {
      const goEdit = await ui.confirm({
        title: 'Add customer care',
        message:
          'Save the manufacturer phone number or pick a known brand to use 1-tap helpline.',
        confirmLabel: 'Edit asset',
        cancelLabel: 'Later',
      });
      if (goEdit) {
        navigation?.navigate?.('AddAsset', { assetId: asset.assetId || asset.id });
      }
      return;
    }
    try {
      await Linking.openURL(`tel:${support.phone}`);
    } catch (error) {
      ui.error('Customer care', error?.message || 'Could not open dialer.');
    }
  };

  const onDelete = async () => {
    Haptics.tap();
    const confirmed = await ui.confirm({
      title: 'Delete Asset',
      message: `Remove “${asset.assetName}” from your vault? This hides it from Home and reminders.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    const result = await removeAsset(asset.assetId || asset.id);
    setDeleting(false);
    if (!result?.success) {
      ui.error('Delete failed', result?.error || 'Could not delete asset');
      return;
    }
    Haptics.success();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const navigateMaintenance = () =>
    navigation?.navigate?.('Maintenance', { assetId: asset.assetId || asset.id });

  const navigateDocuments = () =>
    navigation?.navigate?.('DocumentsVault', { assetId: asset.assetId || asset.id });

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
      {/* 1. ASSET HEADER — always visible */}
      <Text style={styles.title}>Asset Passport</Text>
      {asset.isDemo ? (
        <Text style={styles.demoNote}>Demo preview — sign in to save your own assets & docs</Text>
      ) : null}

      <View style={styles.badgeRow}>
        <WarrantyBadge warrantyExpiry={asset.warrantyExpiry} />
      </View>

      <AssetPassportCard asset={asset} />

      {fromQr ? (
        <View style={styles.qrActions}>
          {[
            { label: 'Add Service', onPress: navigateMaintenance },
            {
              label: 'Add Expense',
              onPress: () =>
                navigation.navigate('Maintenance', {
                  assetId: asset.assetId || asset.id,
                  tab: 'add',
                }),
            },
            { label: 'Documents', onPress: navigateDocuments },
            { label: 'History', onPress: navigateMaintenance },
          ].map((a) => (
            <Pressable
              key={a.label}
              style={styles.qrChip}
              onPress={() => {
                Haptics.tap();
                a.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Text style={styles.qrChipText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 2. HEALTH — always prominent */}
      <View style={styles.panel}>
        <HealthScoreExplain
          score={health.score}
          label={health.band || health.grade}
          factors={healthFactors}
          footnote={
            (health.why || health.tips || []).length
              ? (health.why || health.tips).slice(0, 2).join(' · ')
              : undefined
          }
        />
      </View>

      {maintenanceAlert?.shouldAlert ? (
        <View style={[styles.panel, { borderColor: '#F59E0B', borderWidth: 1 }]}>
          <Text style={styles.panelTitle}>Upgrade review</Text>
          <Text style={styles.demoNote}>{maintenanceAlert.message}</Text>
        </View>
      ) : null}

      {/* 3. PRIMARY ACTION */}
      {nextAction ? (
        <SmartActionCard
          title={nextAction.title}
          why={nextAction.why}
          metric={nextAction.metric}
          priority={nextAction.priority}
          ctaLabel={nextAction.ctaLabel}
          onPress={() => {
            Haptics.tap();
            if (/service|filter|maintenance/i.test(nextAction.title)) {
              navigateMaintenance();
            } else if (/document|review/i.test(nextAction.title)) {
              navigateDocuments();
            }
          }}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {/* 4. IMPORTANT INFORMATION — default expanded */}
      <CollapsibleSection
        title="Important information"
        subtitle={importantSubtitle}
        defaultOpen
        badge={health.score != null ? `${health.score}%` : undefined}
      >
        {hasCoverage ? (
          <View style={styles.innerBlock}>
            <Text style={styles.panelTitle}>Coverage progress</Text>
            {asset.warrantyExpiry ? (
              <WarrantyProgressBar
                label="Warranty"
                startDate={asset.purchaseDate || asset.invoiceDate}
                endDate={asset.warrantyExpiry}
              />
            ) : null}
            {caps.supportsInsurance && asset.insuranceExpiry ? (
              <WarrantyProgressBar
                label="Insurance"
                startDate={asset.insuranceStart || asset.purchaseDate}
                endDate={asset.insuranceExpiry}
              />
            ) : null}
            {caps.supportsPUC && asset.pucExpiry ? (
              <WarrantyProgressBar
                label="PUC"
                startDate={asset.purchaseDate}
                endDate={asset.pucExpiry}
                totalDays={180}
              />
            ) : null}
            {asset.nextServiceDue ? (
              <WarrantyProgressBar
                label={isAc ? 'Filter / service' : 'Next service'}
                startDate={asset.lastServiceDate || asset.purchaseDate}
                endDate={asset.nextServiceDue}
              />
            ) : null}
          </View>
        ) : (
          <Text style={styles.tip}>
            Add warranty{caps.supportsInsurance ? ' / insurance' : ''}
            {caps.supportsPUC ? ' / PUC' : ''} dates to track coverage.
          </Text>
        )}

        {caps.supportsBatteryHealth && gadgetMetrics ? (
          <View style={styles.innerBlock}>
            <TrackerRow
              label="Battery health (est.)"
              value={`${gadgetMetrics.batteryHealthPercent}%`}
              styles={styles}
            />
            <TrackerRow
              label="Live resale (est.)"
              value={`₹${gadgetMetrics.liveResaleValue.toLocaleString('en-IN')}`}
              styles={styles}
            />
          </View>
        ) : null}

        {caps.supportsOdometer && asset.odometerKm != null ? (
          <View style={styles.innerBlock}>
            <TrackerRow
              label="Odometer"
              value={`${asset.odometerKm} km`}
              styles={styles}
            />
            {asset.nextServiceOdometerKm != null ? (
              <TrackerRow
                label="Next service at"
                value={`${asset.nextServiceOdometerKm} km`}
                styles={styles}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.innerBlock}>
          <Text style={styles.panelTitle}>Valuation</Text>
          <ValuationBlock asset={asset} />
        </View>
      </CollapsibleSection>

      {/* 5. MAINTENANCE — collapsed by default */}
      {hasMaintenanceSection ? (
        <CollapsibleSection
          title="Maintenance"
          subtitle={
            isVehicle
              ? 'Odometer, service, insurance & compliance'
              : isAc
                ? 'Filter cleaning & service schedule'
                : 'Service dates & upkeep'
          }
          defaultOpen={false}
          badge={
            asset.nextServiceDue
              ? formatDateIN(asset.nextServiceDue)
              : caps.supportsOdometer && asset.odometerKm != null
                ? `${asset.odometerKm} km`
                : undefined
          }
        >
          {isVehicle && vehicleSpecs?.rawRegistration ? (
            <IndiaNumberPlate registration={vehicleSpecs.rawRegistration} style={{ marginBottom: 12 }} />
          ) : null}
          {isVehicle ? (
            <VehicleStatusBadges
              pucExpiry={asset.pucExpiry}
              insuranceExpiry={asset.insuranceExpiry}
              warrantyExpiry={asset.warrantyExpiry}
              style={{ marginBottom: 10 }}
            />
          ) : null}
          {caps.supportsPUC && asset.pucExpiry ? (
            <TrackerRow
              label="PUC expiry"
              value={`${formatDateIN(asset.pucExpiry)} · ${pucTone.label}`}
              color={pucTone.color}
              styles={styles}
            />
          ) : null}
          {caps.supportsInsurance && asset.insuranceExpiry ? (
            <TrackerRow
              label="Insurance expiry"
              value={`${formatDateIN(asset.insuranceExpiry)} · ${insuranceTone.label}`}
              color={insuranceTone.color}
              styles={styles}
            />
          ) : null}
          {caps.supportsServiceHistory || asset.nextServiceDue ? (
            <TrackerRow
              label={isAc ? 'Filter / service date' : 'Next service date'}
              value={
                asset.nextServiceDue
                  ? `${formatDateIN(asset.nextServiceDue)} · ${serviceTone.label}`
                  : '—'
              }
              color={asset.nextServiceDue ? serviceTone.color : undefined}
              styles={styles}
            />
          ) : null}
          {caps.supportsOdometer ? (
            <>
              <TrackerRow
                label="Odometer"
                value={asset.odometerKm != null ? `${asset.odometerKm} km` : '—'}
                styles={styles}
              />
              <TrackerRow
                label="Next service at"
                value={
                  asset.nextServiceOdometerKm != null
                    ? `${asset.nextServiceOdometerKm} km`
                    : '—'
                }
                styles={styles}
              />
              {caps.supportsFuelTracking && asset.fuelNorm ? (
                <TrackerRow label="Fuel / norms" value={asset.fuelNorm} styles={styles} />
              ) : null}
              <SpecAccordion
                title="Vehicle specs"
                defaultOpen={false}
                rows={[
                  { label: 'RTO', value: vehicleSpecs?.rto },
                  { label: 'Fuel norms', value: vehicleSpecs?.fuelNorm },
                  { label: 'Chassis / frame', value: vehicleSpecs?.chassis },
                  { label: 'Engine no.', value: asset.engineNumber || '—' },
                  {
                    label: 'Invoice no.',
                    value: asset.invoiceMeta?.invoiceNumber || '—',
                  },
                  {
                    label: 'Seller GSTIN',
                    value: asset.invoiceMeta?.shopGstin || '—',
                  },
                ]}
              />
            </>
          ) : null}
          <Pressable style={styles.sectionCta} onPress={navigateMaintenance}>
            <Text style={styles.sectionCtaText}>Open service & maintenance →</Text>
          </Pressable>
        </CollapsibleSection>
      ) : null}

      {/* DOCUMENTS */}
      {layout.fieldsBySection.documents?.length ? (
        <CollapsibleSection
          title="Documents"
          subtitle={vaultCopy.subtitle}
          defaultOpen={false}
        >
          <Text style={styles.tip}>{vaultCopy.empty}</Text>
          <Pressable style={styles.folderCta} onPress={navigateDocuments}>
            <Text style={styles.folderCtaText}>Open categorised Documents Vault →</Text>
          </Pressable>
        </CollapsibleSection>
      ) : null}

      {/* WARRANTY */}
      {hasWarrantySection ? (
        <CollapsibleSection
          title="Warranty"
          subtitle={
            asset.warrantyExpiry
              ? `${formatDateIN(asset.warrantyExpiry)} · ${warrantyTone.label}`
              : 'Track manufacturer coverage'
          }
          defaultOpen={false}
          badge={asset.warrantyMonths ? `${asset.warrantyMonths} mo` : undefined}
        >
          {asset.warrantyExpiry ? (
            <TrackerRow
              label="Warranty expiry"
              value={`${formatDateIN(asset.warrantyExpiry)} · ${warrantyTone.label}`}
              color={warrantyTone.color}
              styles={styles}
            />
          ) : null}
          {asset.brandName ? (
            <TrackerRow label="Brand" value={asset.brandName} styles={styles} />
          ) : null}
          {asset.purchaseDate ? (
            <TrackerRow
              label="Purchase date"
              value={formatDateIN(asset.purchaseDate)}
              styles={styles}
            />
          ) : null}
          <Pressable
            style={styles.claimAiInline}
            onPress={() => {
              Haptics.tap();
              setClaimOpen(true);
            }}
          >
            <Text style={styles.btnText}>How to claim warranty / repair?</Text>
          </Pressable>
        </CollapsibleSection>
      ) : null}

      {/* HISTORY */}
      {hasHistorySection ? (
        <CollapsibleSection
          title="History"
          subtitle="Service & repair records"
          defaultOpen={false}
        >
          {asset.lastServiceDate ? (
            <TrackerRow
              label="Last service"
              value={formatDateIN(asset.lastServiceDate)}
              styles={styles}
            />
          ) : (
            <Text style={styles.tip}>No service history logged yet.</Text>
          )}
          <Pressable style={styles.sectionCta} onPress={navigateMaintenance}>
            <Text style={styles.sectionCtaText}>View full service history →</Text>
          </Pressable>
        </CollapsibleSection>
      ) : null}

      {/* ADDITIONAL DETAILS — actions & extras */}
      <CollapsibleSection
        title="Additional details"
        subtitle="Support, sharing & asset management"
        defaultOpen={false}
      >
        <Pressable style={styles.supportCard} onPress={onCallSupport}>
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>
              {support ? 'Call support / toll-free helpline' : 'Claim warranty / support'}
            </Text>
            <Text style={styles.tip}>
              {support
                ? `${support.label} · ${support.phone}${
                    support.source === 'directory' ? ' · brand directory' : ''
                  }`
                : 'Add manufacturer customer care for 1-tap calling'}
            </Text>
          </View>
          <Text style={styles.supportCta}>Call</Text>
        </Pressable>

        {asset.serialNumber ? (
          <TrackerRow label="Serial / IMEI" value={asset.serialNumber} styles={styles} />
        ) : null}
        {asset.storeName ? (
          <TrackerRow label="Store / dealer" value={asset.storeName} styles={styles} />
        ) : null}

        <Pressable
          style={styles.analyticsBtn}
          onPress={() => {
            Haptics.tap();
            navigation.navigate('AssetAnalytics', { assetId: asset.assetId || asset.id });
          }}
        >
          <Text style={styles.analyticsBtnText}>View asset analytics</Text>
        </Pressable>

        <Pressable
          style={styles.edit}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('AddAsset', { assetId: asset.assetId || asset.id });
          }}
        >
          <Text style={styles.btnText}>Edit asset</Text>
        </Pressable>

        <Pressable style={styles.whatsapp} onPress={onSharePassportPdf} disabled={sharingPassport}>
          {sharingPassport ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <Text style={styles.btnTextDark}>Share Asset Passport PDF · WhatsApp</Text>
          )}
        </Pressable>

        {ShareService.isEmergencyShareEligible(asset) ? (
          <Pressable style={styles.secondary} onPress={onEmergencyShare} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.btnText}>Emergency share · offline PDF</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable style={styles.secondary} onPress={navigateDocuments}>
          <Text style={styles.btnText}>Open documents vault</Text>
        </Pressable>

        {!asset.isDemo ? (
          <Pressable style={styles.deleteBtn} onPress={onDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteText}>Delete asset</Text>
            )}
          </Pressable>
        ) : null}
      </CollapsibleSection>

      <ClaimAssistantSheet visible={claimOpen} asset={asset} onClose={() => setClaimOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  badgeRow: { marginBottom: 10 },
  demoNote: {
    color: COLORS.amber,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  missing: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
  panel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  innerBlock: { marginTop: 10 },
  qrActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  qrChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qrChipText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  panelTitle: { color: COLORS.muted, fontSize: 11, fontWeight: '800', marginBottom: 8 },
  tip: { color: COLORS.muted, fontSize: 12, marginTop: 6 },
  folderCta: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(79,70,229,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.35)',
  },
  folderCtaText: { color: '#A5B4FC', fontWeight: '800', fontSize: 12 },
  sectionCta: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,118,110,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.35)',
  },
  sectionCtaText: { color: '#5EEAD4', fontWeight: '800', fontSize: 12 },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  trackerLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600', flex: 1 },
  trackerValue: { color: COLORS.text, fontSize: 12, fontWeight: '800', flex: 1.2, textAlign: 'right' },
  supportCard: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,242,254,0.4)',
    backgroundColor: 'rgba(0,242,254,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportTitle: { color: COLORS.text, fontWeight: '900', fontSize: 15 },
  supportCta: { color: COLORS.emerald, fontWeight: '900', fontSize: 13 },
  claimAiInline: {
    marginTop: 12,
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  edit: {
    marginTop: 10,
    backgroundColor: COLORS.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  whatsapp: {
    marginTop: 10,
    backgroundColor: COLORS.emerald,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deleteBtn: {
    marginTop: 18,
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  deleteText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  btnText: { color: COLORS.text, fontWeight: '800' },
  btnTextDark: { color: COLORS.onPrimary, fontWeight: '900' },
  analyticsBtn: {
    marginTop: 10,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analyticsBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default AssetPassportScreen;
