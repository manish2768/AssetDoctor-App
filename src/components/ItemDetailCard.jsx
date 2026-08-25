/**
 * Expiry / warranty / PUC / insurance status chips + detail cards.
 * Includes smart category picker for Review screen line items.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { daysUntil } from '../utils/dates';
import { SMART_CATEGORY_OPTIONS, SMART_CATEGORIES } from '../services/ocr/categoryClassifier';
import { Haptics } from '../services/haptics';
import { CategoryIcon } from './icons/CategoryIcon';

/**
 * @param {string|null|undefined} isoDate
 * @param {{ warnDays?: number }} [opts]
 * @returns {{ tone: 'ok'|'warn'|'danger'|'none', label: string, days: number|null }}
 */
export function getExpiryTone(isoDate, opts = {}) {
  const warnDays = opts.warnDays ?? 30;
  if (!isoDate) return { tone: 'none', label: 'Not set', days: null };
  const days = daysUntil(isoDate);
  if (days == null || Number.isNaN(days)) return { tone: 'none', label: String(isoDate), days: null };
  if (days < 0) return { tone: 'danger', label: `Expired ${Math.abs(days)}d ago`, days };
  if (days === 0) return { tone: 'danger', label: 'Expires today', days };
  if (days <= warnDays) return { tone: 'warn', label: `${days}d left · renew soon`, days };
  return { tone: 'ok', label: `${days}d left · active`, days };
}

export function StatusChip({ label, tone = 'none' }) {
  return (
    <View style={[styles.chip, toneStyle(tone)]}>
      <Text style={[styles.chipText, toneText(tone)]}>{label}</Text>
    </View>
  );
}

/**
 * Nice card for a bill line item or asset summary with expiry colors + category picker.
 */
export function ItemDetailCard({
  title,
  subtitle,
  amount,
  qty,
  rate,
  warrantyExpiry,
  pucExpiry,
  insuranceExpiry,
  nextServiceDue,
  registration,
  selected,
  onPress,
  smartCategory,
  onCategoryChange,
  trackImei,
  trackPucService,
  seasonalServiceAlerts,
  showCategoryPicker = false,
}) {
  const warranty = getExpiryTone(warrantyExpiry, { warnDays: 30 });
  const puc = getExpiryTone(pucExpiry, { warnDays: 15 });
  const insurance = getExpiryTone(insuranceExpiry, { warnDays: 30 });
  const service = getExpiryTone(nextServiceDue, { warnDays: 15 });
  const activeCategory = smartCategory || SMART_CATEGORIES.OTHER;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {title || 'Untitled item'}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {registration ? (
            <Text style={styles.reg}>Reg · {registration}</Text>
          ) : null}
        </View>
        {amount != null && amount !== '' ? (
          <Text style={styles.amount}>₹{Number(amount).toLocaleString('en-IN')}</Text>
        ) : null}
      </View>

      {(qty != null || rate != null) && (
        <Text style={styles.meta}>
          {qty != null ? `Qty ${qty}` : ''}
          {qty != null && rate != null ? ' · ' : ''}
          {rate != null ? `Rate ₹${Number(rate).toLocaleString('en-IN')}` : ''}
        </Text>
      )}

      {showCategoryPicker ? (
        <View style={styles.categoryBlock}>
          <Text style={styles.categoryLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {SMART_CATEGORY_OPTIONS.map((opt) => {
              const on = opt.id === activeCategory;
              return (
                <Pressable
                  key={opt.id}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    Haptics.select();
                    onCategoryChange?.(opt.id);
                  }}
                  style={[styles.catChip, on && styles.catChipOn]}
                >
                  <View style={styles.catChipInner}>
                    <CategoryIcon
                      name={opt.icon || opt.id}
                      size={16}
                      color={on ? COLORS.emerald : COLORS.muted}
                    />
                    <Text style={[styles.catChipText, on && styles.catChipTextOn]}>
                      {opt.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.flagRow}>
            {trackImei ? <Text style={styles.flag}>IMEI / Serial</Text> : null}
            {trackPucService ? <Text style={styles.flag}>PUC · Service</Text> : null}
            {seasonalServiceAlerts ? <Text style={styles.flag}>Seasonal Service</Text> : null}
          </View>
        </View>
      ) : null}

      <View style={styles.chipRow}>
        {warrantyExpiry ? <StatusChip label={`Warranty · ${warranty.label}`} tone={warranty.tone} /> : null}
        {pucExpiry ? <StatusChip label={`PUC · ${puc.label}`} tone={puc.tone} /> : null}
        {insuranceExpiry ? (
          <StatusChip label={`Insurance · ${insurance.label}`} tone={insurance.tone} />
        ) : null}
        {nextServiceDue ? <StatusChip label={`Service · ${service.label}`} tone={service.tone} /> : null}
      </View>
    </Pressable>
  );
}

function toneStyle(tone) {
  if (tone === 'ok') return { backgroundColor: COLORS.successSoft, borderColor: 'rgba(0,242,254,0.45)' };
  if (tone === 'warn') return { backgroundColor: COLORS.warnSoft, borderColor: 'rgba(255,153,0,0.45)' };
  if (tone === 'danger') return { backgroundColor: COLORS.dangerSoft, borderColor: 'rgba(255,59,48,0.45)' };
  return { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border };
}

function toneText(tone) {
  if (tone === 'ok') return { color: COLORS.emerald };
  if (tone === 'warn') return { color: COLORS.amber };
  if (tone === 'danger') return { color: COLORS.rose };
  return { color: COLORS.muted };
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.successSoft,
  },
  topRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  reg: { color: COLORS.neonBlue, fontSize: 12, fontWeight: '700', marginTop: 4 },
  amount: { color: COLORS.emerald, fontWeight: '800', fontSize: 15 },
  meta: { color: COLORS.muted, fontSize: 12, marginTop: 8 },
  categoryBlock: { marginTop: 12 },
  categoryLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  catRow: { gap: 8, paddingRight: 8 },
  catChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  catChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catChipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(0,242,254,0.14)',
  },
  catChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  catChipTextOn: { color: COLORS.emerald },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  flag: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(0,242,254,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 11, fontWeight: '700' },
});

export default ItemDetailCard;
