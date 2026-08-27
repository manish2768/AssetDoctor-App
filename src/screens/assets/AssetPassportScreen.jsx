/**
 * Asset Doctor — Master Asset Detail / Passport Screen
 * Premium asset passport with overview metrics, relationally linked documents, and chronological timeline.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { calculateHealthScore } from '../../utils/healthScore';
import { formatDateIN, daysUntil } from '../../utils/dates';
import { formatINR } from '../../utils/format';
import { calculateCostToUse } from '../../utils/costToUse';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import {
  IconButton,
  StatusBadge,
  HealthScore,
  SectionHeader,
  MetricCard,
  TimelineItem,
  DocumentRow,
  PrimaryButton,
  SecondaryButton,
} from '../../components/design-system';
import { PremiumIcon } from '../../design-system/icons';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

export function AssetPassportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { getAsset, removeAsset } = useAssets();
  const { isAuthenticated } = useAuth();

  const assetId = route?.params?.assetId;
  const asset = getAsset(assetId);

  const [deleting, setDeleting] = useState(false);

  if (!asset) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[TYPE.h2, { color: colors.text }]}>Asset not found</Text>
        <SecondaryButton
          title="Back to Assets"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  const health = calculateHealthScore(asset);
  const caps = resolveAssetCapabilities(asset);
  const isVehicle = caps.supportsOdometer === true || !!asset.registration;

  // Calculate Ownership Duration
  const purchaseDate = asset.purchaseDate || asset.invoiceDate || asset.createdAt;
  const ownershipYears = useMemo(() => {
    if (!purchaseDate) return '1 yr';
    const start = new Date(purchaseDate).getTime();
    if (isNaN(start)) return '1 yr';
    const diffDays = Math.max(1, (Date.now() - start) / (1000 * 60 * 60 * 24));
    const yrs = (diffDays / 365.25).toFixed(1);
    return `${yrs} yrs`;
  }, [purchaseDate]);

  // Estimated Current Value
  const purchasePrice = Number(asset.purchasePrice || asset.invoiceAmount || asset.totalAmount || 0);
  const costRow = calculateCostToUse(asset);
  const currentValue =
    costRow?.success && Number(costRow.estimatedResale) > 0 ? Math.round(costRow.estimatedResale) : null;

  // Linked Documents
  const linkedDocs = useMemo(() => {
    const docs = [];

    if (asset.insurancePolicyNumber || asset.insuranceExpiry) {
      const insDays = daysUntil(asset.insuranceExpiry);
      docs.push({
        id: 'ins-doc',
        type: 'Insurance Policy',
        name: asset.insurerName || 'Vehicle Insurance',
        identifier: asset.insurancePolicyNumber || asset.registration,
        dateText: asset.insuranceExpiry ? `Valid until ${formatDateIN(asset.insuranceExpiry)}` : '',
        verified: true,
        daysLeft: insDays,
      });
    }

    if (asset.pucExpiry) {
      const pucDays = daysUntil(asset.pucExpiry);
      docs.push({
        id: 'puc-doc',
        type: 'PUC Certificate',
        name: 'Pollution Under Control',
        identifier: asset.registration,
        dateText: `Valid until ${formatDateIN(asset.pucExpiry)}`,
        verified: true,
        daysLeft: pucDays,
      });
    }

    if (asset.lastServiceDate || asset.odometerKm || asset.serviceHistory?.length) {
      docs.push({
        id: 'svc-doc',
        type: 'Service Invoice',
        name: asset.workshopName || 'Authorized Service',
        identifier: asset.odometerKm ? `${asset.odometerKm.toLocaleString()} KM` : '',
        dateText: asset.lastServiceDate ? formatDateIN(asset.lastServiceDate) : 'Latest service recorded',
        verified: true,
      });
    }

    if (asset.warrantyExpiry) {
      const warDays = daysUntil(asset.warrantyExpiry);
      docs.push({
        id: 'war-doc',
        type: 'Warranty Card',
        name: asset.brand || asset.manufacturer || asset.assetName,
        identifier: asset.serialNumber || asset.imei,
        dateText: `Valid until ${formatDateIN(asset.warrantyExpiry)}`,
        verified: true,
        daysLeft: warDays,
      });
    }

    return docs;
  }, [asset]);

  // Timeline Events
  const timelineEvents = useMemo(() => {
    const events = [];

    if (purchaseDate) {
      events.push({
        id: 'ev-purch',
        date: formatDateIN(purchaseDate),
        title: 'Asset Added & Protected',
        subtitle: purchasePrice > 0 ? `Registered with value ₹${purchasePrice.toLocaleString()}` : 'Initial record created',
      });
    }

    if (asset.lastServiceDate) {
      events.push({
        id: 'ev-svc',
        date: formatDateIN(asset.lastServiceDate),
        title: 'Service Maintenance Recorded',
        subtitle: asset.odometerKm ? `Odometer: ${asset.odometerKm.toLocaleString()} KM` : 'Service completed',
      });
    }

    if (asset.insuranceExpiry) {
      events.push({
        id: 'ev-ins',
        date: formatDateIN(asset.insuranceExpiry),
        title: 'Insurance Expiry Target',
        subtitle: asset.insurerName || 'Coverage policy',
      });
    }

    if (!events.length) {
      events.push({
        id: 'ev-default',
        date: formatDateIN(new Date().toISOString()),
        title: 'Asset Active in Vault',
        subtitle: 'All document records synced securely',
      });
    }

    return events;
  }, [asset, purchaseDate, purchasePrice]);

  const onShare = async () => {
    Haptics.tap();
    try {
      await Share.share({
        message: `Asset Doctor Passport: ${asset.assetName} (${asset.registration || asset.serialNumber || 'Protected'})\nHealth Score: ${health}/100\nManaged securely via Asset Doctor.`,
        title: `${asset.assetName} Passport`,
      });
    } catch (e) {
      // Ignored
    }
  };

  const onDelete = async () => {
    const ok = await ui.confirm({
      title: 'Delete Asset?',
      message: `Are you sure you want to remove ${asset.assetName} from your vault?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await removeAsset(asset.assetId || asset.id, asset.billStoragePath);
      if (res?.success) {
        navigation.goBack();
      } else {
        ui.error('Delete failed', res?.error || 'Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={() => navigation.goBack()}
          variant="surface"
          size={44}
        />
        <Text style={[TYPE.h2, { color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: 8 }]} numberOfLines={1}>
          Asset Passport
        </Text>
        <IconButton
          icon={<PremiumIcon name="share" size={18} color={colors.text} />}
          label="Share"
          onPress={onShare}
          variant="surface"
          size={44}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ASSET PASSPORT HERO */}
        <View
          style={[
            styles.passportCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            elevation(2, colors.shadow),
          ]}
        >
          <View style={styles.passportTopRow}>
            <View style={[styles.passportIconBox, { backgroundColor: colors.accentLight }]}>
              <CategoryIcon
                category={asset.categoryId || asset.icon || 'car'}
                size={28}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[TYPE.h1, { color: colors.text }]} numberOfLines={1}>
                {asset.assetName}
              </Text>
              <Text style={[TYPE.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                {asset.registration ? `${asset.registration} · ` : ''}
                {asset.categoryLabel || asset.category || 'Asset'}
              </Text>
            </View>
            <HealthScore score={health} />
          </View>

          {/* Quick Identity Tags */}
          <View style={styles.identityTagRow}>
            {asset.registration ? (
              <View style={[styles.idTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]}>
                  REG: {asset.registration}
                </Text>
              </View>
            ) : null}
            {asset.serialNumber ? (
              <View style={[styles.idTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]}>
                  SN: {asset.serialNumber}
                </Text>
              </View>
            ) : null}
            {asset.imei ? (
              <View style={[styles.idTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]}>
                  IMEI: {asset.imei}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* OVERVIEW SECTION */}
        <SectionHeader title="Overview" />
        <View style={styles.metricGrid}>
          <MetricCard
            title="Purchase"
            value={purchasePrice > 0 ? formatINR(purchasePrice) : '—'}
            subtitle={purchaseDate ? formatDateIN(purchaseDate) : 'Not recorded'}
          />
          <MetricCard
            title="Current Value"
            value={currentValue ? formatINR(currentValue) : '—'}
            subtitle="Estimated"
          />
          <MetricCard
            title="Ownership"
            value={ownershipYears}
            subtitle="Active"
          />
        </View>

        {/* DOCUMENTS SECTION */}
        <SectionHeader
          title="Documents"
          subtitle={`${linkedDocs.length} ${linkedDocs.length === 1 ? 'document' : 'documents'} linked`}
          style={{ marginTop: SPACING.md }}
        />
        {linkedDocs.length > 0 ? (
          linkedDocs.map((doc) => (
            <DocumentRow
              key={doc.id}
              documentType={doc.type}
              assetName={doc.name}
              identifier={doc.identifier}
              dateText={doc.dateText}
              verified={doc.verified}
            />
          ))
        ) : (
          <View style={[styles.noDocsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>
              No documents linked to this asset yet. Scan a bill to link automatically.
            </Text>
          </View>
        )}

        {/* TIMELINE SECTION */}
        <SectionHeader title="Timeline" style={{ marginTop: SPACING.md }} />
        <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {timelineEvents.map((ev, idx) => (
            <TimelineItem
              key={ev.id}
              date={ev.date}
              title={ev.title}
              subtitle={ev.subtitle}
              isLast={idx === timelineEvents.length - 1}
            />
          ))}
        </View>

        {/* ACTIONS */}
        <View style={styles.actionButtonsWrap}>
          <PrimaryButton
            title="Scan Document for this Asset"
            onPress={() => navigation.getParent()?.navigate?.('ScanBill')}
            size="md"
            style={{ marginBottom: SPACING.xs }}
          />
          <SecondaryButton
            title={deleting ? 'Deleting...' : 'Delete Asset'}
            onPress={onDelete}
            disabled={deleting}
            size="md"
            textStyle={{ color: colors.danger }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  passportCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  passportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passportIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  idTag: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -4,
  },
  noDocsCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
  },
  actionButtonsWrap: {
    marginTop: SPACING.lg,
  },
});
