/**
 * Asset Passport Card — premium shareable ID card.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';

import { BRAND, COLORS } from '../theme/branding';
import { formatDateIN } from '../utils/dates';
import { calculateHealthScore } from '../utils/healthScore';
import { ShareService } from '../services/share/ShareService';
import { Haptics } from '../services/haptics';
import { ValuationBlock } from './ValuationBlock';
import { WarrantyBadge } from './WarrantyBadge';
import { resolveSupportContact } from '../constants/brandDirectory';
import { CategoryIcon } from './icons/CategoryIcon';
import { IndiaNumberPlate } from './vehicle/IndiaNumberPlate';
import { VehicleStatusBadges } from './vehicle/VehicleStatusBadges';
import { getAssetFolderType } from '../utils/assetFolders';
import { getExpiryTone } from '../utils/warrantyStatus';
import { isDateExpired } from '../utils/assetExpiry';
let ViewShot = null;
try {
  // eslint-disable-next-line global-require
  ViewShot = require('react-native-view-shot').default;
} catch {
  ViewShot = null;
}

function healthTone(score) {
  if (score >= 80) return COLORS.emerald;
  if (score >= 60) return COLORS.amber;
  return COLORS.rose;
}

export function AssetPassportCard({ asset, onShared }) {
  const shotRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const health = calculateHealthScore(asset || {});
  const support = resolveSupportContact(asset || {});

  const captureCard = async () => {
    try {
      if (shotRef.current?.capture) {
        return await shotRef.current.capture();
      }
    } catch {
      /* fall through */
    }
    return asset?.billImageUrl || null;
  };

  const onSharePassport = async (channel = 'system') => {
    Haptics.tap();
    setSharing(true);
    try {
      const imageUri = await captureCard();
      let result;
      if (channel === 'whatsapp') {
        result = await ShareService.sharePassportCard({ imageUri, asset, prefer: 'whatsapp' });
      } else {
        result = await ShareService.sharePassportCard({ imageUri, asset, prefer: 'system' });
      }
      onShared?.(result);
      if (!result?.success && result?.error && result.error !== 'Share cancelled') {
        Alert.alert('Share', result.error);
      } else if (result?.success) {
        Haptics.success();
      }
    } finally {
      setSharing(false);
    }
  };

  if (!asset) return null;

  const tone = healthTone(health.score);
  const reg = asset.registration || asset.serialNumber || asset.chassisNumber || '—';
  const category = asset.categoryLabel || asset.category || 'Asset';
  const isVehicle = getAssetFolderType(asset) === 'vehicle';

  const cardBody = (
    <View style={styles.card}>
      {/* Top brand strip */}
      <View style={styles.brandStrip}>
        <View>
          <Text style={styles.brandName}>🩺 {BRAND.name}</Text>
          <Text style={styles.passportChip}>OFFICIAL ASSET PASSPORT</Text>
        </View>
        <View style={[styles.healthBadge, { borderColor: tone, backgroundColor: `${tone}22` }]}>
          <Text style={[styles.healthScore, { color: tone }]}>{health.score}</Text>
          <Text style={styles.healthLabel}>HEALTH</Text>
        </View>
      </View>

      {/* Hero identity */}
      <View style={styles.heroBlock}>
        <CategoryIcon
          name={asset.categoryId || asset.icon || 'other'}
          size={44}
          color={COLORS.emerald}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {asset.assetName}
          </Text>
          <Text style={styles.meta}>
            {category}
            {asset.isDemo ? ' · DEMO' : ''}
          </Text>
          {isVehicle && asset.registration ? (
            <IndiaNumberPlate registration={asset.registration} style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.regPill}>
              <Text style={styles.regText} numberOfLines={1}>
                ID · {reg}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isVehicle ? (
        <VehicleStatusBadges
          pucExpiry={asset.pucExpiry}
          insuranceExpiry={asset.insuranceExpiry}
          warrantyExpiry={asset.warrantyExpiry}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      {asset.billImageUrl ? (
        <Image source={{ uri: asset.billImageUrl }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Text style={styles.thumbPlaceholderText}>Protected in your smart vault</Text>
        </View>
      )}

      {/* Stats row — clean passport fields */}
      <View style={styles.statsPad}>
        <WarrantyBadge warrantyExpiry={asset.warrantyExpiry} style={{ marginBottom: 10 }} />
        <ValuationBlock asset={asset} compact />
      </View>
      <View style={styles.statsRow}>
        <Field label="WARRANTY" value={formatDateIN(asset.warrantyExpiry)} danger={isDateExpired(asset.warrantyExpiry)} />
        {isVehicle ? (
          <Field
            label="INSURANCE"
            value={
              asset.insuranceExpiry
                ? `${formatDateIN(asset.insuranceExpiry)}${
                    getExpiryTone(asset.insuranceExpiry, { urgentDays: 30 }).id === 'expired'
                      ? ' · Expired'
                      : ''
                  }`
                : '—'
            }
            danger={isDateExpired(asset.insuranceExpiry)}
          />
        ) : (
          <Field label="NEXT SERVICE" value={formatDateIN(asset.nextServiceDue)} danger={isDateExpired(asset.nextServiceDue)} />
        )}
      </View>
      {isVehicle ? (
        <View style={styles.statsRow}>
          <Field
            label="PUC"
            value={
              asset.pucExpiry
                ? `${formatDateIN(asset.pucExpiry)}${
                    getExpiryTone(asset.pucExpiry, { urgentDays: 15 }).id === 'expired'
                      ? ' · Expired'
                      : ''
                  }`
                : '—'
            }
            danger={isDateExpired(asset.pucExpiry)}
          />
          <Field label="NEXT SERVICE" value={formatDateIN(asset.nextServiceDue)} danger={isDateExpired(asset.nextServiceDue)} />
        </View>
      ) : null}
      <View style={styles.statsRow}>
        <Field label="GRADE" value={health.grade} accent />
        <Field
          label="IMEI / SERIAL"
          value={asset.imei || asset.serialNumber || (isVehicle ? asset.registration : null) || '—'}
        />
      </View>

      {asset.storeName ? (
        <Text style={styles.storeLine}>Purchased at {asset.storeName}</Text>
      ) : null}

      {support?.phone ? (
        <Pressable
          style={styles.callSupport}
          onPress={async () => {
            Haptics.tap();
            try {
              await Linking.openURL(`tel:${support.phone}`);
            } catch {
              Alert.alert('Call failed', 'Could not open dialer');
            }
          }}
        >
          <Text style={styles.callSupportText}>📞 Call Support · {support.phone}</Text>
        </Pressable>
      ) : null}

      {/* Footer seal */}
      <View style={styles.seal}>
        <View style={styles.sealDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
          <Text style={styles.credit}>{BRAND.footer}</Text>
        </View>
        <View style={styles.verified}>
          <Text style={styles.verifiedText}>VERIFIED</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View>
      {ViewShot ? (
        <ViewShot
          ref={shotRef}
          options={{ format: 'jpg', quality: 0.95, result: 'tmpfile' }}
        >
          {cardBody}
        </ViewShot>
      ) : (
        cardBody
      )}

      <Text style={styles.shareHint}>Share this passport — looks great on WhatsApp & Stories</Text>

      <Pressable
        onPress={() => onSharePassport('system')}
        style={styles.sharePrimary}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color={COLORS.onPrimary} />
        ) : (
          <Text style={styles.sharePrimaryText}>✨ Share Asset Passport</Text>
        )}
      </Pressable>

      <View style={styles.shareRow}>
        <Pressable
          onPress={() => onSharePassport('whatsapp')}
          style={[styles.shareSecondary, styles.wa]}
          disabled={sharing}
        >
          <Text style={styles.shareSecondaryText}>💬 WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, value, accent, danger }) {
  return (
    <View
      style={[
        styles.field,
        danger && {
          borderColor: 'rgba(255,59,48,0.55)',
          backgroundColor: 'rgba(255,59,48,0.12)',
        },
      ]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text
        style={[
          styles.fieldValue,
          accent && { color: COLORS.emerald },
          danger && { color: '#FF3B30' },
        ]}
        numberOfLines={1}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    backgroundColor: COLORS.card,
  },
  brandStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.successSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandName: { color: COLORS.emerald, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
  passportChip: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 3,
  },
  healthBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthScore: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  healthLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  iconOrb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 32 },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '900', lineHeight: 24 },
  meta: { color: COLORS.muted, fontSize: 12, marginTop: 3, fontWeight: '600' },
  regPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  regText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  thumb: { width: '100%', height: 140, marginBottom: 4 },
  thumbPlaceholder: {
    marginHorizontal: 16,
    marginBottom: 8,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgDeep,
  },
  thumbPlaceholderText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  statsPad: { paddingHorizontal: 16, marginBottom: 10 },
  callSupport: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    alignItems: 'center',
  },
  callSupportText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  field: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  fieldValue: { color: COLORS.text, fontSize: 13, fontWeight: '800', marginTop: 4 },
  storeLine: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.successSoft,
  },
  sealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.emerald,
  },
  tagline: { color: COLORS.text, fontSize: 11, fontWeight: '700', lineHeight: 15 },
  credit: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  verified: {
    backgroundColor: COLORS.emerald,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  verifiedText: { color: COLORS.onPrimary, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  shareHint: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  sharePrimary: {
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sharePrimaryText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 15 },
  shareRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  shareSecondary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  wa: { backgroundColor: '#128C7E' },
  shareSecondaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});

export default AssetPassportCard;
