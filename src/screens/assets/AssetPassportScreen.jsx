import React, { useState } from 'react';
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
import { AssetPassportCard } from '../../components/AssetPassportCard';
import { ShareService } from '../../services/share/ShareService';
import { PdfExporter } from '../../services/pdfExporter';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { useAuth } from '../../context/AuthProvider';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { calculateHealthScore } from '../../utils/healthScore';
import { formatDateIN } from '../../utils/dates';
import { getAssetFolderType } from '../../utils/assetFolders';
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
import { cleanAssetDisplayName } from '../../utils/displayAssetName';
import { computeGadgetSmartMetrics } from '../../utils/gadgetSmartMetrics';

export function AssetPassportScreen({ route, navigation }) {
  const assetId = route?.params?.assetId;
  const fromQr = !!route?.params?.fromQr;
  const { getAsset, removeAsset } = useAssets();
  const { user, profile } = useAuth();
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
  const isVehicle = getAssetFolderType(asset) === 'vehicle';
  const support = resolveSupportContact(asset);
  const pucTone = getExpiryTone(asset.pucExpiry, { urgentDays: 15 });
  const insuranceTone = getExpiryTone(asset.insuranceExpiry, { urgentDays: 30 });
  const warrantyTone = getExpiryTone(asset.warrantyExpiry, { urgentDays: 30 });
  const serviceTone = getExpiryTone(asset.nextServiceDue, { urgentDays: 15 });
  const vehicleSpecs = isVehicle ? getVehicleSpecs(asset) : null;
  const maintenanceAlert = evaluateMaintenanceVsValue(asset);

  const onEmergencyShare = async () => {
    Haptics.tap();
    setSharing(true);
    const docs = user?.uid
      ? await DocumentVaultService.listDocuments(user.uid, asset.assetId || asset.id)
      : [];
    const result = await ShareService.shareEmergencyBundle({ asset, documents: docs });
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
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
            {
              label: 'Add Service',
              onPress: () =>
                navigation.navigate('Maintenance', { assetId: asset.assetId || asset.id }),
            },
            {
              label: 'Add Expense',
              onPress: () =>
                navigation.navigate('Maintenance', {
                  assetId: asset.assetId || asset.id,
                  tab: 'add',
                }),
            },
            {
              label: 'Documents',
              onPress: () =>
                navigation.navigate('DocumentsVault', { assetId: asset.assetId || asset.id }),
            },
            {
              label: 'History',
              onPress: () =>
                navigation.navigate('Maintenance', { assetId: asset.assetId || asset.id }),
            },
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

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Coverage progress</Text>
        {asset.warrantyExpiry ? (
          <WarrantyProgressBar
            label="Warranty"
            startDate={asset.purchaseDate || asset.invoiceDate}
            endDate={asset.warrantyExpiry}
          />
        ) : null}
        {asset.insuranceExpiry ? (
          <WarrantyProgressBar
            label="Insurance"
            startDate={asset.insuranceStart || asset.purchaseDate}
            endDate={asset.insuranceExpiry}
          />
        ) : null}
        {asset.pucExpiry ? (
          <WarrantyProgressBar
            label="PUC"
            startDate={asset.purchaseDate}
            endDate={asset.pucExpiry}
            totalDays={180}
          />
        ) : null}
        {asset.nextServiceDue ? (
          <WarrantyProgressBar
            label="Next service"
            startDate={asset.lastServiceDate || asset.purchaseDate}
            endDate={asset.nextServiceDue}
          />
        ) : null}
        {!asset.warrantyExpiry &&
        !asset.insuranceExpiry &&
        !asset.pucExpiry &&
        !asset.nextServiceDue ? (
          <Text style={styles.demoNote}>Add warranty / insurance / PUC dates to track coverage.</Text>
        ) : null}
      </View>

      {maintenanceAlert?.shouldAlert ? (
        <View style={[styles.panel, { borderColor: '#F59E0B', borderWidth: 1 }]}>
          <Text style={styles.panelTitle}>Upgrade review</Text>
          <Text style={styles.demoNote}>{maintenanceAlert.message}</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Valuation</Text>
        <ValuationBlock asset={asset} />
        <Pressable
          style={styles.analyticsBtn}
          onPress={() => {
            Haptics.tap();
            navigation.navigate('AssetAnalytics', { assetId: asset.assetId || asset.id });
          }}
        >
          <Text style={styles.analyticsBtnText}>View Asset Analytics</Text>
        </Pressable>
      </View>

      {isVehicle || asset.nextServiceDue || asset.pucExpiry || asset.insuranceExpiry ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {isVehicle ? 'Vehicle Tracker · PUC & Service' : 'Service Tracker'}
          </Text>
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
          {isVehicle || asset.pucExpiry ? (
            <View style={styles.trackerRow}>
              <Text style={styles.trackerLabel}>PUC Expiry</Text>
              <Text style={[styles.trackerValue, { color: pucTone.color }]}>
                {formatDateIN(asset.pucExpiry)} · {pucTone.label}
              </Text>
            </View>
          ) : null}
          {isVehicle || asset.insuranceExpiry ? (
            <View style={styles.trackerRow}>
              <Text style={styles.trackerLabel}>Insurance Expiry</Text>
              <Text style={[styles.trackerValue, { color: insuranceTone.color }]}>
                {formatDateIN(asset.insuranceExpiry)} · {insuranceTone.label}
              </Text>
            </View>
          ) : null}
          {asset.warrantyExpiry ? (
            <View style={styles.trackerRow}>
              <Text style={styles.trackerLabel}>Warranty Expiry</Text>
              <Text style={[styles.trackerValue, { color: warrantyTone.color }]}>
                {formatDateIN(asset.warrantyExpiry)} · {warrantyTone.label}
              </Text>
            </View>
          ) : null}
          <View style={styles.trackerRow}>
            <Text style={styles.trackerLabel}>Next Service Date</Text>
            <Text style={[styles.trackerValue, { color: serviceTone.color }]}>
              {formatDateIN(asset.nextServiceDue)} · {serviceTone.label}
            </Text>
          </View>
          {isVehicle ? (
            <>
              <View style={styles.trackerRow}>
                <Text style={styles.trackerLabel}>Odometer</Text>
                <Text style={styles.trackerValue}>
                  {asset.odometerKm != null ? `${asset.odometerKm} km` : '—'}
                </Text>
              </View>
              <View style={styles.trackerRow}>
                <Text style={styles.trackerLabel}>Next Service At</Text>
                <Text style={styles.trackerValue}>
                  {asset.nextServiceOdometerKm != null
                    ? `${asset.nextServiceOdometerKm} km`
                    : '—'}
                </Text>
              </View>
              <SpecAccordion
                title="Vehicle Specs"
                defaultOpen
                rows={[
                  { label: 'RTO', value: vehicleSpecs?.rto },
                  { label: 'Fuel Norms', value: vehicleSpecs?.fuelNorm },
                  { label: 'Chassis / Frame', value: vehicleSpecs?.chassis },
                  { label: 'Engine No', value: asset.engineNumber || '—' },
                  {
                    label: 'Invoice No',
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
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Document Folders</Text>
        <Text style={styles.tip}>
          Vehicle Invoice · Insurance Policy · PUC · Warranty — stored as separate vault categories
        </Text>
        <Pressable
          style={styles.folderCta}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('DocumentsVault', {
              assetId: asset.assetId || asset.id,
            });
          }}
        >
          <Text style={styles.folderCtaText}>Open categorised Documents Vault →</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Asset Health</Text>
        <Text style={styles.score}>
          {health.score} / 100 <Text style={styles.grade}>{health.band || health.grade}</Text>
        </Text>
        {(health.why || health.tips || []).length ? (
          <>
            <Text style={[styles.panelTitle, { marginTop: 10, fontSize: 13 }]}>Why?</Text>
            {(health.why || health.tips).slice(0, 5).map((t) => (
              <Text key={t} style={styles.tip}>
                • {t}
              </Text>
            ))}
          </>
        ) : null}
        {health.breakdown ? (
          <>
            <Text style={[styles.panelTitle, { marginTop: 10, fontSize: 13 }]}>Health breakdown</Text>
            {Object.values(health.breakdown).map((row) => (
              <Text key={row.label} style={styles.tip}>
                {row.label}: {row.earned}/{row.max}
              </Text>
            ))}
          </>
        ) : null}
        {health.service?.message ? (
          <Text style={[styles.tip, { marginTop: 8 }]}>
            Next: {health.service.recommended ? 'Recommended — ' : ''}
            {health.service.message}
          </Text>
        ) : null}
      </View>

      <Pressable style={styles.supportCard} onPress={onCallSupport}>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportTitle}>
            {support ? 'Call Support / Toll-Free Helpline' : 'Claim Warranty / Support'}
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

      <Pressable
        style={styles.claimAi}
        onPress={() => {
          Haptics.tap();
          setClaimOpen(true);
        }}
      >
        <Text style={styles.btnText}>🛠️ How to Claim Warranty / Repair?</Text>
      </Pressable>

      <Pressable
        style={styles.maintenance}
        onPress={() => {
          Haptics.tap();
          navigation?.navigate?.('Maintenance', { assetId: asset.assetId || asset.id });
        }}
      >
        <Text style={styles.btnText}>🔧 Service & Maintenance</Text>
      </Pressable>

      <Pressable
        style={styles.edit}
        onPress={() => {
          Haptics.tap();
          navigation?.navigate?.('AddAsset', { assetId: asset.assetId || asset.id });
        }}
      >
        <Text style={styles.btnText}>✏️ Edit Asset</Text>
      </Pressable>

      <Pressable
        style={styles.whatsapp}
        onPress={onSharePassportPdf}
        disabled={sharingPassport}
      >
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
            <Text style={styles.btnText}>Emergency Share · Offline PDF</Text>
          )}
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondary}
        onPress={() =>
          navigation?.navigate?.('DocumentsVault', { assetId: asset.assetId || asset.id })
        }
      >
        <Text style={styles.btnText}>Open Documents Vault</Text>
      </Pressable>

      {!asset.isDemo ? (
        <Pressable style={styles.deleteBtn} onPress={onDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>Delete Asset</Text>
          )}
        </Pressable>
      ) : null}

      <ClaimAssistantSheet
        visible={claimOpen}
        asset={asset}
        onClose={() => setClaimOpen(false)}
      />
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
  score: { color: COLORS.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  grade: { fontSize: 14, color: COLORS.emerald, fontWeight: '700' },
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
    marginTop: 14,
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
  edit: {
    marginTop: 10,
    backgroundColor: COLORS.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  maintenance: {
    marginTop: 16,
    backgroundColor: '#0F766E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  claimAi: {
    marginTop: 10,
    backgroundColor: '#1E3A5F',
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
    marginHorizontal: 16,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analyticsBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

export default AssetPassportScreen;
