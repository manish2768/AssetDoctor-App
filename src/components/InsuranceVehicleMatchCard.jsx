import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { INSURANCE_MATCH } from '../services/vehicles/insuranceVehicleMatch';
import { Haptics } from '../services/haptics';

function checkLine(ok, label) {
  return `${ok ? '✓' : '✗'} ${label}`;
}

export function InsuranceVehicleMatchCard({ match, onSelectVehicle }) {
  if (!match) return null;
  const vehicle = match.matched;
  const name = vehicle?.assetName || match.userMessage || 'Vehicle';

  if (match.status === INSURANCE_MATCH.HIGH && vehicle) {
    return (
      <View style={[styles.card, styles.ok]}>
        <Text style={styles.eyebrow}>MATCHED VEHICLE</Text>
        <Text style={styles.title}>{name}</Text>
        {match.chassis.matched ? <Text style={styles.line}>Chassis ✓</Text> : null}
        {match.engine.matched ? <Text style={styles.line}>Engine ✓</Text> : null}
        <Text style={styles.confidence}>Match confidence: HIGH</Text>
        {match.chassis.kind === 'suffix' || match.engine.kind === 'suffix' ? (
          <Text style={styles.note}>
            Policy shows a partial identifier. Full chassis/engine on the vehicle is kept unchanged.
          </Text>
        ) : null}
      </View>
    );
  }

  if (match.status === INSURANCE_MATCH.REVIEW && vehicle) {
    return (
      <View style={[styles.card, styles.warn]}>
        <Text style={styles.eyebrow}>REVIEW VEHICLE MATCH</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.line}>{checkLine(match.chassis.matched, 'Chassis Number matched')}</Text>
        <Text style={styles.line}>{checkLine(match.engine.matched, 'Engine Number matched')}</Text>
        <Text style={styles.warning}>{match.warning || 'Confirm this vehicle before attaching.'}</Text>
        <Pressable
          onPress={() => {
            Haptics.select();
            onSelectVehicle?.(vehicle);
          }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Attach to this vehicle</Text>
        </Pressable>
      </View>
    );
  }

  if (match.status === INSURANCE_MATCH.CONFLICT) {
    return (
      <View style={[styles.card, styles.bad]}>
        <Text style={styles.eyebrow}>VEHICLE IDENTITY MISMATCH</Text>
        <Text style={styles.title}>{match.userMessage || 'Do not auto-attach'}</Text>
        <Text style={styles.line}>{checkLine(match.chassis.matched, 'Chassis Number matched')}</Text>
        <Text style={styles.line}>{checkLine(match.engine.matched, 'Engine Number matched')}</Text>
        <Text style={styles.warning}>{match.warning}</Text>
        {(match.candidates || []).slice(0, 4).map((v) => {
          const id = v.assetId || v.id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                Haptics.select();
                onSelectVehicle?.(v);
              }}
              style={styles.candidate}
            >
              <Text style={styles.candidateText}>{v.assetName || 'Vehicle'}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.muted]}>
      <Text style={styles.eyebrow}>VEHICLE MATCH</Text>
      <Text style={styles.title}>No matching vehicle found</Text>
      <Text style={styles.note}>
        Save this insurance separately without attaching it to the wrong vehicle.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  ok: { borderColor: COLORS.emerald, backgroundColor: 'rgba(16,185,129,0.08)' },
  warn: { borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.08)' },
  bad: { borderColor: '#DC2626', backgroundColor: 'rgba(220,38,38,0.08)' },
  muted: { borderColor: COLORS.border, backgroundColor: COLORS.card || '#FFFFFF' },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  line: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  confidence: { color: COLORS.emerald, fontSize: 13, fontWeight: '800', marginTop: 8 },
  warning: { color: '#B45309', fontSize: 12, fontWeight: '700', marginTop: 8, lineHeight: 16 },
  note: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8, lineHeight: 16 },
  cta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  candidate: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  candidateText: { color: COLORS.text, fontWeight: '700' },
});

export default InsuranceVehicleMatchCard;
