/**
 * PUC / Insurance compliance badges — Red Expired · Green Active/All Clear.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { getExpiryTone } from '../../utils/warrantyStatus';

function badgeFor(dateStr, kind) {
  const tone = getExpiryTone(dateStr, { urgentDays: kind === 'puc' ? 15 : 30 });
  if (tone.id === 'expired') {
    return { label: 'Expired', bg: '#FF3B30', text: '#fff' };
  }
  if (tone.id === 'ok') {
    return {
      label: kind === 'both' ? 'All Clear' : 'Active',
      bg: '#10B981',
      text: '#04110A',
    };
  }
  if (tone.id === 'warn') {
    return { label: 'Renew Soon', bg: '#FF9900', text: '#04110A' };
  }
  return { label: 'Not set', bg: 'rgba(255,255,255,0.08)', text: '#8B96A5' };
}

export function VehicleStatusBadges({
  pucExpiry,
  insuranceExpiry,
  warrantyExpiry,
  style,
}) {
  const puc = badgeFor(pucExpiry, 'puc');
  const insurance = badgeFor(insuranceExpiry, 'insurance');
  const warranty = warrantyExpiry ? badgeFor(warrantyExpiry, 'insurance') : null;
  const bothClear =
    getExpiryTone(pucExpiry, { urgentDays: 15 }).id === 'ok' &&
    getExpiryTone(insuranceExpiry, { urgentDays: 30 }).id === 'ok';

  return (
    <View style={[styles.row, style]}>
      {bothClear ? (
        <View style={[styles.badge, { backgroundColor: '#10B981' }]}>
          <Text style={[styles.badgeText, { color: '#04110A' }]}>All Clear</Text>
        </View>
      ) : null}
      <View style={[styles.badge, { backgroundColor: puc.bg }]}>
        <Text style={[styles.badgeText, { color: puc.text }]}>PUC · {puc.label}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: insurance.bg }]}>
        <Text style={[styles.badgeText, { color: insurance.text }]}>
          Insurance · {insurance.label}
        </Text>
      </View>
      {warranty ? (
        <View style={[styles.badge, { backgroundColor: warranty.bg }]}>
          <Text style={[styles.badgeText, { color: warranty.text }]}>
            Warranty · {warranty.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
});

export default VehicleStatusBadges;
