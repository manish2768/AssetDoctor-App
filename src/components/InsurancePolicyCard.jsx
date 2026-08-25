import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { getInsuranceReviewFields } from '../services/vehicles/insuranceReviewMapping';
import { coverageDisplay } from '../services/ocr/insuranceCanonicalBuilder';

function money(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `₹${n.toLocaleString('en-IN')}`;
}

function line(label, value) {
  const v = value == null || value === '' ? '—' : String(value);
  return `${label}: ${v}`;
}

export function InsurancePolicyCard({ invoice }) {
  if (!invoice) return null;
  const fields = getInsuranceReviewFields(invoice);
  const coverages = Array.isArray(invoice.coverages)
    ? invoice.coverages
    : invoice.insuranceFields?.coverages || [];
  const insurerRaw = fields.insurer;
  const insurer = /^insurance\s*policy$/i.test(insurerRaw) ? '' : insurerRaw;
  const coverageLabel = fields.coverageTypeLabel || coverageDisplay(fields.coverageType);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>INSURANCE POLICY</Text>
      <Text style={styles.title}>{insurer || 'Insurer not read from policy'}</Text>
      <Text style={styles.line}>{line('Policy holder', fields.policyHolder)}</Text>
      <Text style={styles.line}>{line('Policy number', fields.policyNumber)}</Text>
      <Text style={styles.line}>{line('Policy start', fields.policyStartDate)}</Text>
      <Text style={styles.line}>{line('Policy expiry', fields.policyExpiryDate)}</Text>
      {fields.odStartDate ? <Text style={styles.line}>{line('OD start', fields.odStartDate)}</Text> : null}
      {fields.odExpiryDate ? <Text style={styles.line}>{line('OD expiry', fields.odExpiryDate)}</Text> : null}
      {fields.tpStartDate ? <Text style={styles.line}>{line('TP start', fields.tpStartDate)}</Text> : null}
      {fields.tpExpiryDate ? <Text style={styles.line}>{line('TP expiry', fields.tpExpiryDate)}</Text> : null}
      <Text style={styles.line}>{line('Chassis', fields.chassisNumber)}</Text>
      <Text style={styles.line}>{line('Engine', fields.engineNumber)}</Text>
      <Text style={styles.line}>{line('Registration', fields.registration)}</Text>
      <Text style={styles.line}>{line('IDV', money(fields.idv) || fields.idv)}</Text>
      <Text style={styles.line}>{line('Premium', money(fields.premium) || fields.premium)}</Text>
      <Text style={styles.line}>{line('Coverage type', coverageLabel)}</Text>
      {fields.pucExpiry ? <Text style={styles.line}>{line('PUC expiry', fields.pucExpiry)}</Text> : null}
      <Text style={styles.coverTitle}>Coverages / add-ons</Text>
      {coverages.length ? (
        coverages.map((c) => {
          const name = typeof c === 'string' ? c : c?.name;
          if (!name) return null;
          const amt = typeof c === 'object' ? money(c.amount) : '';
          return (
            <Text key={name} style={styles.coverLine}>
              • {name}
              {amt ? ` · ${amt}` : ''}
            </Text>
          );
        })
      ) : (
        <Text style={styles.muted}>No separate add-ons listed on this policy.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card || '#FFFFFF',
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  line: { color: COLORS.text, fontSize: 13, fontWeight: '600', marginBottom: 2 },
  coverTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  coverLine: { color: COLORS.text, fontSize: 13, marginBottom: 2 },
  muted: { color: COLORS.textSecondary, fontSize: 12 },
});

export default InsurancePolicyCard;
