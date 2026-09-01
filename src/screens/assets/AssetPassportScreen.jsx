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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { calculateHealthScore } from '../../utils/healthScore';
import { formatDateIN, daysUntil } from '../../utils/dates';
import { formatINRCompact, formatOwnershipDuration } from '../../utils/format';
import { calculateCostToUse } from '../../utils/costToUse';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import {
  IconButton,
  HealthScore,
  SectionHeader,
  MetricCard,
  TimelineItem,
  DocumentRow,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
} from '../../components/design-system';
import { PremiumIcon } from '../../design-system/icons';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { QuickFuelLogModal } from '../../components/fuel/QuickFuelLogModal';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';
import { AssetDoctorProtectedBadge } from '../../components/trust/AssetDoctorProtectedBadge';
import { ProtectionScoreCard } from '../../components/trust/ProtectionScoreCard';
import { SharePassportSheet } from '../../components/trust/SharePassportSheet';
import { TAB_BAR_HEIGHT } from '../../theme/tabMetrics';
import {
  DELETE_UX,
  userFacingDeleteError,
} from '../../services/assets/assetDeleteFlow';
import {
  resolveProtectionBadgeState,
  calculateProtectionScore,
  buildAssetTimeline,
  passportIdentityFields,
  passportProtectionFields,
  passportServiceFields,
  emptyStateForKind,
} from '../../trust/protectionStatus';

export function AssetPassportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { getAsset, removeAsset } = useAssets();
  const { isAuthenticated } = useAuth();

  const assetId = route?.params?.assetId;
  const asset = getAsset(assetId);

  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [fuelOpen, setFuelOpen] = useState(false);

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
  const ownershipYears = useMemo(
    () => formatOwnershipDuration(purchaseDate),
    [purchaseDate],
  );

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
        daysLeft: warDays,
      });
    }

    return docs;
  }, [asset]);

  const timelineEvents = useMemo(
    () =>
      buildAssetTimeline(asset, []).map((ev) => ({
        id: ev.id,
        date: formatDateIN(ev.date),
        title: ev.title,
        subtitle: ev.subtitle,
      })),
    [asset],
  );

  const protection = useMemo(
    () => calculateProtectionScore({ asset, documents: linkedDocs }),
    [asset, linkedDocs],
  );
  const protectionBadge = useMemo(
    () => resolveProtectionBadgeState({ asset, documents: linkedDocs }),
    [asset, linkedDocs],
  );
  const identityRows = passportIdentityFields(asset);
  const protectionRows = passportProtectionFields(asset);
  const serviceRows = passportServiceFields(asset);

  const onShare = () => {
    Haptics.tap();
    setShareOpen(true);
  };

  const onDelete = async () => {
    const ok = await ui.confirm({
      title: DELETE_UX.confirmTitle,
      message: DELETE_UX.confirmMessage,
      confirmLabel: DELETE_UX.confirmLabel,
      cancelLabel: DELETE_UX.cancelLabel,
      destructive: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await removeAsset(asset.assetId || asset.id, asset.billStoragePath);
      if (res?.success) {
        ui.success(DELETE_UX.success);
        if (navigation.getParent()) {
          navigation.getParent().navigate('Assets');
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Assets');
        }
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[AssetPassport] delete failed', res?.technicalError || res?.error);
        }
        ui.error(DELETE_UX.failureTitle, userFacingDeleteError(res?.technicalError || res?.error));
      }
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[AssetPassport] delete failed', error);
      }
      ui.error(DELETE_UX.failureTitle, userFacingDeleteError(error));
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 28 },
        ]}
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
            <View style={styles.passportIdentity}>
              <Text style={[TYPE.h1, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                {asset.assetName}
              </Text>
              {asset.registration ? (
                <Text
                  style={[TYPE.bodySmall, styles.nowrapValue, { color: colors.textMuted, marginTop: 2 }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {asset.registration}
                </Text>
              ) : null}
              <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {asset.categoryLabel || asset.category || 'Asset'}
              </Text>
            </View>
            <HealthScore score={health} style={styles.passportBadge} />
          </View>
          <View style={{ marginTop: SPACING.sm }}>
            <AssetDoctorProtectedBadge state={protectionBadge} />
          </View>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 8 }]}>
            Asset Health: {typeof health === 'number' ? health : health?.score ?? '—'}
          </Text>

          {/* Quick Identity Tags */}
          <View style={styles.identityTagRow}>
            {asset.registration ? (
              <View style={[styles.idTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text
                  style={[TYPE.caption, styles.nowrapValue, { color: colors.text, fontWeight: '700' }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
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

        <ProtectionScoreCard protection={protection} style={{ marginTop: SPACING.sm }} />

        <SectionHeader title="Overview" style={{ marginTop: SPACING.md }} />
        <View style={styles.metricGrid}>
          <MetricCard
            title="Purchase"
            value={purchasePrice > 0 ? formatINRCompact(purchasePrice) : '—'}
            compactValue={purchasePrice > 0 ? formatINRCompact(purchasePrice) : '—'}
            subtitle={purchaseDate ? formatDateIN(purchaseDate) : 'Not recorded'}
          />
          <MetricCard
            title="Current Value"
            value={currentValue ? formatINRCompact(currentValue) : '—'}
            compactValue={currentValue ? formatINRCompact(currentValue) : '—'}
            subtitle="Estimated"
          />
          <MetricCard
            title="Ownership"
            value={ownershipYears}
            compactValue={ownershipYears}
            subtitle="Active"
          />
        </View>

        {identityRows.length ? (
          <>
            <SectionHeader title="Identity" style={{ marginTop: SPACING.md }} />
            <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {identityRows.map((row) => (
                <View key={row.label} style={{ marginBottom: 8 }}>
                  <Text style={[TYPE.micro, { color: colors.textMuted }]}>{row.label}</Text>
                  <Text style={[TYPE.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                    {String(row.value)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title="Protection" style={{ marginTop: SPACING.md }} />
        {protectionRows.length ? (
          <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {protectionRows.map((row) => (
              <View key={row.label} style={{ marginBottom: 8 }}>
                <Text style={[TYPE.micro, { color: colors.textMuted }]}>{row.label}</Text>
                <Text style={[TYPE.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                  {String(row.value)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title={emptyStateForKind(isVehicle ? 'insurance' : 'warranty').title}
            message={emptyStateForKind(isVehicle ? 'insurance' : 'warranty').body}
            ctaLabel={emptyStateForKind(isVehicle ? 'insurance' : 'warranty').cta}
            onCta={() => navigation.getParent()?.navigate?.('ScanBill')}
          />
        )}

        {serviceRows.length ? (
          <>
            <SectionHeader title="Service" style={{ marginTop: SPACING.md }} />
            <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {serviceRows.map((row) => (
                <View key={row.label} style={{ marginBottom: 8 }}>
                  <Text style={[TYPE.micro, { color: colors.textMuted }]}>{row.label}</Text>
                  <Text style={[TYPE.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                    {String(row.value)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : isVehicle ? (
          <>
            <SectionHeader title="Service" style={{ marginTop: SPACING.md }} />
            <EmptyState
              title={emptyStateForKind('service').title}
              message={emptyStateForKind('service').body}
              ctaLabel={emptyStateForKind('service').cta}
              onCta={() => navigation.getParent()?.navigate?.('ScanBill')}
            />
          </>
        ) : null}

        {/* FUEL & MILEAGE SECTION (vehicles only) */}
        {caps.supportsFuelTracking ? (
          <>
            <SectionHeader title="Fuel & Mileage" style={{ marginTop: SPACING.md }} />
            <View style={[styles.fuelWrap, { marginBottom: SPACING.sm }]}>
              <Text style={[TYPE.body, { color: colors.text, fontWeight: '600' }]}>
                Track full-tank refills to see real mileage (km/L), distance and ₹/km.
              </Text>
              <View style={styles.fuelActions}>
                <PrimaryButton
                  title="+ Log Fuel"
                  onPress={() => {
                    Haptics.tap();
                    setFuelOpen(true);
                  }}
                  size="md"
                  style={{ flex: 1, marginRight: SPACING.xs }}
                />
                <SecondaryButton
                  title="History"
                  onPress={() =>
                    navigation.navigate('FuelVault', { assetId: asset.assetId || asset.id })
                  }
                  size="md"
                  style={{ flex: 1, marginLeft: SPACING.xs }}
                />
              </View>
            </View>
          </>
        ) : null}

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
              verified={false}
              onPress={() =>
                navigation.navigate('DocumentsVault', { assetId: asset.assetId || asset.id })
              }
            />
          ))
        ) : (
          <EmptyState
            title={emptyStateForKind('document').title}
            message={emptyStateForKind('document').body}
            ctaLabel="Scan Document"
            onCta={() => navigation.getParent()?.navigate?.('ScanBill')}
          />
        )}

        {/* TIMELINE SECTION */}
        <SectionHeader title="Timeline" style={{ marginTop: SPACING.md }} />
        {timelineEvents.length ? (
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
        ) : (
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>
            No dated events on file yet.
          </Text>
        )}

        {/* ACTIONS */}
        <View style={styles.actionButtonsWrap}>
          <PrimaryButton
            title="Scan Document"
            onPress={() => navigation.getParent()?.navigate?.('ScanBill')}
            size="md"
            style={{ marginBottom: SPACING.xs }}
          />
          <SecondaryButton
            title="Add Service Record"
            onPress={() => navigation.getParent()?.navigate?.('ScanBill')}
            size="md"
            style={{ marginBottom: SPACING.xs }}
          />
          <SecondaryButton
            title="Add Document"
            onPress={() => navigation.navigate('DocumentsVault', { assetId: asset.assetId || asset.id })}
            size="md"
            style={{ marginBottom: SPACING.xs }}
          />
          <SecondaryButton
            title="Share Passport"
            onPress={onShare}
            size="md"
            style={{ marginBottom: SPACING.xs }}
          />
          <SecondaryButton
            title={deleting ? DELETE_UX.processing : DELETE_UX.confirmLabel}
            onPress={onDelete}
            disabled={deleting}
            size="md"
            textStyle={{ color: colors.danger }}
          />
          {deleting ? (
            <View style={styles.deletingRow}>
              <ActivityIndicator size="small" color={colors.danger} />
              <Text style={[TYPE.caption, { color: colors.textMuted, marginLeft: 8 }]}>
                {DELETE_UX.processing}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <SharePassportSheet visible={shareOpen} onClose={() => setShareOpen(false)} asset={asset} ui={ui} />
      <QuickFuelLogModal visible={fuelOpen} asset={asset} onClose={() => setFuelOpen(false)} />
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
  passportIdentity: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  passportBadge: {
    flexShrink: 0,
  },
  nowrapValue: {
    flexShrink: 0,
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
    flexWrap: 'nowrap',
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
  fuelWrap: {
    paddingHorizontal: SPACING.xs,
  },
  fuelActions: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  deletingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
});
