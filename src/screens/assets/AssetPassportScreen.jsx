/**
 * Asset Doctor — Master Asset Passport Screen
 *
 * Progressive Disclosure Asset Hub:
 * 1. Asset Hero / Certificate card (Identity, Health, Protection status)
 * 2. Segmented Tab Selector: OVERVIEW · DOCUMENTS · MAINTENANCE · FUEL / ANALYTICS
 * 3. Dedicated tab content rendered strictly per active tab
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
import { daysUntil, formatDateIN } from '../../utils/dates';
import { formatINRCompact } from '../../utils/format';
import { calculateCostToUse } from '../../utils/costToUse';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  MetricCard,
  EmptyState,
  SectionHeader,
} from '../../design-system';
import {
  HealthScore,
  DocumentRow,
  TimelineItem,
  IconButton,
  PrimaryButton,
  SecondaryButton,
} from '../../components/design-system';
import { PremiumIcon } from '../../design-system/icons';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';
import { AssetDoctorProtectedBadge } from '../../components/trust/AssetDoctorProtectedBadge';
import { ProtectionScoreCard } from '../../components/trust/ProtectionScoreCard';
import { SharePassportSheet } from '../../components/trust/SharePassportSheet';
import { QuickFuelLogModal } from '../../components/fuel/QuickFuelLogModal';
import {
  DELETE_UX,
  userFacingDeleteError,
} from '../../services/assets/assetDeleteFlow';
import {
  calculateProtectionScore,
  resolveProtectionBadgeState,
  passportIdentityFields,
  passportProtectionFields,
  passportServiceFields,
  emptyStateForKind,
  buildAssetTimeline,
} from '../../trust/protectionStatus';

function formatOwnershipDuration(purchaseDate) {
  if (!purchaseDate) return '—';
  const start = new Date(purchaseDate);
  const now = new Date();
  if (isNaN(start.getTime())) return '—';

  const diffMonths = Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
  );
  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  if (years === 0) return `${months}m`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

export function AssetPassportScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { getAsset, removeAsset } = useAssets();
  const { isAuthenticated } = useAuth();

  const assetId = route?.params?.assetId;
  const asset = getAsset(assetId);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'documents' | 'maintenance' | 'fuel_analytics'
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

  const onEdit = () => {
    Haptics.tap();
    navigation.navigate('AddAsset', {
      assetId: asset.assetId || asset.id,
      mode: 'edit',
      initialValues: asset,
    });
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
          {asset.assetName}
        </Text>
        <IconButton
          icon={<PremiumIcon name="edit" size={18} color={colors.text} />}
          label="Edit"
          onPress={onEdit}
          variant="surface"
          size={44}
        />
        <IconButton
          icon={<PremiumIcon name="share" size={18} color={colors.text} />}
          label="Share"
          onPress={onShare}
          variant="surface"
          size={44}
          style={{ marginLeft: 6 }}
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

        {/* SEGMENTED TAB BAR */}
        <View style={[styles.tabBarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'documents', label: 'Documents' },
            { id: 'maintenance', label: 'Maintenance' },
            { id: 'fuel_analytics', label: isVehicle ? 'Fuel / Analytics' : 'Analytics' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.select();
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  isActive && [styles.tabItemActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    { color: isActive ? '#FFFFFF' : colors.textMuted },
                    isActive && styles.tabItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <View style={styles.tabContentContainer}>
            <ProtectionScoreCard protection={protection} style={{ marginBottom: SPACING.md }} />

            <SectionHeader title="Financial Overview" />
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
                <SectionHeader title="Identity Details" style={{ marginTop: SPACING.md }} />
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

            {timelineEvents.length ? (
              <>
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
              </>
            ) : null}

            {/* ─── PARKING ASSISTANT (vehicle only) ─── */}
            {isVehicle ? (
              <Pressable
                onPress={() => {
                  Haptics.tap();
                  navigation.navigate('ParkingAssistant', { asset });
                }}
                style={[
                  styles.parkingBanner,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  elevation(1, colors.shadow),
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open Parking Assistant"
              >
                <View style={styles.parkingBannerLeft}>
                  <Text style={[styles.parkingBannerLabel, { color: colors.primary }]}>
                    🅿️ PARKING ASSISTANT
                  </Text>
                  <Text style={[TYPE.h3, { color: colors.text }]}>View Parking QR</Text>
                  <Text style={[TYPE.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                    Let anyone contact you about your vehicle — privacy protected.
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>→</Text>
              </Pressable>
            ) : null}

            {/* Quick Actions */}
            <View style={styles.actionButtonsWrap}>
              <PrimaryButton
                title="Scan Document"
                onPress={() => navigation.getParent()?.navigate?.('ScanBill')}
                size="md"
                style={{ marginBottom: SPACING.xs }}
              />
              <SecondaryButton
                title="Edit Asset Details"
                onPress={onEdit}
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
            </View>
          </View>
        )}

        {/* TAB 2: DOCUMENTS */}
        {activeTab === 'documents' && (
          <View style={styles.tabContentContainer}>
            <SectionHeader
              title="Linked Documents"
              subtitle={`${linkedDocs.length} ${linkedDocs.length === 1 ? 'document' : 'documents'} on file`}
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

            <PrimaryButton
              title="+ Add / Scan Document"
              onPress={() => navigation.getParent()?.navigate?.('ScanBill')}
              size="md"
              style={{ marginTop: SPACING.md }}
            />
          </View>
        )}

        {/* TAB 3: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <View style={styles.tabContentContainer}>
            <SectionHeader title="Service History & Maintenance" />
            {serviceRows.length ? (
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
            ) : (
              <EmptyState
                title={emptyStateForKind('service').title}
                message={emptyStateForKind('service').body}
                ctaLabel="Log Service Record"
                onCta={() => navigation.getParent()?.navigate?.('ScanBill')}
              />
            )}

            <PrimaryButton
              title="+ Log Service / Maintenance"
              onPress={() => navigation.navigate('Maintenance', { assetId: asset.assetId || asset.id })}
              size="md"
              style={{ marginTop: SPACING.md }}
            />
          </View>
        )}

        {/* TAB 4: FUEL & ANALYTICS */}
        {activeTab === 'fuel_analytics' && (
          <View style={styles.tabContentContainer}>
            {caps.supportsFuelTracking ? (
              <View style={{ marginBottom: SPACING.lg }}>
                <SectionHeader title="Fuel & Mileage" />
                <View style={[styles.fuelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[TYPE.body, { color: colors.text, fontWeight: '600' }]}>
                    Track full-tank refills to compute verified km/L mileage and running cost per km.
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
                      title="View Fuel Vault"
                      onPress={() =>
                        navigation.navigate('FuelVault', { assetId: asset.assetId || asset.id })
                      }
                      size="md"
                      style={{ flex: 1, marginLeft: SPACING.xs }}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            <SectionHeader title="Financial Intelligence" />
            <Pressable
              onPress={() => {
                Haptics.tap();
                navigation.navigate('AssetAnalytics', { assetId: asset.assetId || asset.id });
              }}
              style={[styles.analyticsLinkCard, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.h3, { color: colors.text, fontWeight: '700' }]}>Financial Analytics & TCO</Text>
                <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
                  Depreciation trajectory, monthly ownership cost, and 12-month expense trends.
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>→</Text>
            </Pressable>

            {isVehicle ? (
              <Pressable
                onPress={() => {
                  Haptics.tap();
                  navigation.navigate('VehiclePassport', { assetId: asset.assetId || asset.id });
                }}
                style={[styles.analyticsLinkCard, { backgroundColor: '#07111F', borderColor: 'rgba(15,143,135,0.3)', marginTop: 12 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.h3, { color: '#00B8A9', fontWeight: '700' }]}>Digital Ride Passport Certificate</Text>
                  <Text style={[TYPE.caption, { color: '#94A3B8', marginTop: 4 }]}>
                    Verified digital vehicle identity with Standard, Gold & Black visual tiers.
                  </Text>
                </View>
                <Text style={{ color: '#00B8A9', fontSize: 20, fontWeight: '700' }}>→</Text>
              </Pressable>
            ) : null}
          </View>
        )}
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
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  passportTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passportIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportIdentity: {
    flex: 1,
    marginLeft: 12,
  },
  passportBadge: {
    marginLeft: 8,
  },
  identityTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  idTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  nowrapValue: {
    fontVariant: ['tabular-nums'],
  },
  tabBarWrap: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  tabItemActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabItemTextActive: {
    fontWeight: '700',
  },
  tabContentContainer: {
    paddingTop: SPACING.xs,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  timelineCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  fuelCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  fuelActions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  analyticsLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  actionButtonsWrap: {
    marginTop: SPACING.md,
  },
  parkingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  parkingBannerLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  parkingBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
});

export default AssetPassportScreen;
