/**
 * Insurer-agnostic canonical motor-insurance object + field evidence.
 * Review UI, summary card, and vault must share this schema.
 */

export const COVERAGE_TYPE = Object.freeze({
  THIRD_PARTY: 'THIRD_PARTY',
  OWN_DAMAGE: 'OWN_DAMAGE',
  COMPREHENSIVE: 'COMPREHENSIVE',
  BUNDLED: 'BUNDLED',
  STANDALONE_OD: 'STANDALONE_OD',
  UNKNOWN: 'UNKNOWN',
});

export const COVERAGE_DISPLAY = Object.freeze({
  [COVERAGE_TYPE.THIRD_PARTY]: 'Third Party',
  [COVERAGE_TYPE.OWN_DAMAGE]: 'Own Damage',
  [COVERAGE_TYPE.COMPREHENSIVE]: 'Comprehensive',
  [COVERAGE_TYPE.BUNDLED]: 'Own Damage + Third Party',
  [COVERAGE_TYPE.STANDALONE_OD]: 'Standalone OD',
  [COVERAGE_TYPE.UNKNOWN]: '',
});

export const EVIDENCE_TYPE = Object.freeze({
  LABELED: 'labeled',
  SECTION_PAIR: 'section_pair',
  CLASSIFIED_DATE: 'classified_date',
  BRAND_LINE: 'brand_line',
  MANUAL: 'manual',
  UNKNOWN: 'unknown',
});

const PLACEHOLDER_RE =
  /^(?:invoice\s*\/\s*policy\s*no\.?|yyyy-mm-dd|leave\s*blank|not\s*found|enter\s*manually|n\/?a|—|--)$/i;

export function isInsurancePlaceholder(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  return PLACEHOLDER_RE.test(v);
}

export function fieldEvidence(value, meta = {}) {
  const v = value == null || isInsurancePlaceholder(value) ? null : value;
  return {
    value: v,
    sourceLabel: meta.sourceLabel || '',
    sourceText: meta.sourceText || (v != null ? String(v) : ''),
    confidence: meta.confidence ?? (v != null ? 0.85 : 0),
    evidenceType: meta.evidenceType || EVIDENCE_TYPE.UNKNOWN,
    sectionContext: meta.sectionContext || '',
    needsReview: Boolean(meta.needsReview),
  };
}

export function emptyCanonicalInsurance() {
  const blank = () => fieldEvidence(null);
  return {
    insurer: blank(),
    policyHolder: blank(),
    policyNumber: blank(),
    policyStartDate: blank(),
    policyExpiryDate: blank(),
    odStartDate: blank(),
    odExpiryDate: blank(),
    tpStartDate: blank(),
    tpExpiryDate: blank(),
    coverageType: fieldEvidence(COVERAGE_TYPE.UNKNOWN, { evidenceType: EVIDENCE_TYPE.UNKNOWN }),
    vehicleRegistration: blank(),
    chassisNumber: blank(),
    engineNumber: blank(),
    insuredDeclaredValue: blank(),
    premium: blank(),
    pucExpiryDate: blank(),
    vehicleLink: fieldEvidence(null),
    documentType: fieldEvidence('insurance'),
    needsReview: false,
    fieldProvenance: {},
  };
}

function strOrNull(v) {
  if (v == null) return null;
  const s = typeof v === 'number' ? String(v) : String(v).trim();
  if (!s || isInsurancePlaceholder(s)) return null;
  return s;
}

export function validateEngineNumber(value, ctx = {}) {
  const raw = String(value || '').trim();
  if (!raw || isInsurancePlaceholder(raw)) return { value: null, needsReview: false };
  if (/@|\.(?:com|in|net|org)\b|https?:|www\./i.test(raw)) {
    return { value: null, needsReview: true, reason: 'email_or_url' };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 12 && /^[6-9]/.test(digits)) {
    return { value: null, needsReview: true, reason: 'phone_number' };
  }
  const chassis = String(ctx.chassisNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (chassis && compact.length >= 6 && (chassis.includes(compact) || compact.includes(chassis))) {
    return { value: null, needsReview: true, reason: 'chassis_contamination' };
  }
  if (/^(?:MD[A-HJ-NPR-Z0-9]{10,})/i.test(compact)) {
    return { value: null, needsReview: true, reason: 'chassis_like' };
  }
  const policyNo = String(ctx.policyNumber || '').replace(/\s/g, '');
  if (policyNo && compact === policyNo.replace(/[^A-Z0-9]/gi, '').toUpperCase()) {
    return { value: null, needsReview: true, reason: 'policy_number' };
  }
  const insurer = String(ctx.insurer || '').toLowerCase();
  if (insurer && raw.toLowerCase().includes(insurer.slice(0, 12))) {
    return { value: null, needsReview: true, reason: 'insurer_name' };
  }
  if (!/[A-Z0-9]/i.test(raw) || compact.length < 4) {
    return { value: null, needsReview: true, reason: 'too_short' };
  }
  return { value: raw, needsReview: false };
}

export function validateChassisNumber(value, ctx = {}) {
  const raw = String(value || '').trim();
  if (!raw || isInsurancePlaceholder(raw)) return { value: null, needsReview: false };
  if (/@|\.(?:com|in|net|org)\b/i.test(raw)) {
    return { value: null, needsReview: true, reason: 'email_or_url' };
  }
  const engine = String(ctx.engineNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (engine && compact.length >= 6 && (engine.includes(compact) || compact.includes(engine))) {
    return { value: null, needsReview: true, reason: 'engine_contamination' };
  }
  const policyNo = String(ctx.policyNumber || '').replace(/\s/g, '');
  if (policyNo && compact === policyNo.replace(/[^A-Z0-9]/gi, '').toUpperCase()) {
    return { value: null, needsReview: true, reason: 'policy_number' };
  }
  if (!/[A-Z0-9]/i.test(raw) || compact.length < 4) {
    return { value: null, needsReview: true, reason: 'too_short' };
  }
  return { value: raw, needsReview: false };
}

export function coverageEnumFromLegacy(value) {
  const t = String(value || '').trim();
  if (!t) return COVERAGE_TYPE.UNKNOWN;
  const u = t.toUpperCase().replace(/\s+/g, '_');
  if (Object.values(COVERAGE_TYPE).includes(u)) return u;
  if (/^THIRD|^LIABILITY|^ACT_ONLY|^TP/.test(u) || /third\s*party|liability\s*only|act\s*only/i.test(t)) {
    return COVERAGE_TYPE.THIRD_PARTY;
  }
  if (/^COMPREHENSIVE|^PACKAGE|^MOTOR_PACKAGE/.test(u) || /comprehensive|package\s*policy|motor\s*package/i.test(t)) {
    return COVERAGE_TYPE.COMPREHENSIVE;
  }
  if (/^BUNDLED|^OD_\+_TP|^TP_\+_OD/.test(u) || /bundled|od\s*\+\s*tp|tp\s*\+\s*od/i.test(t)) {
    return COVERAGE_TYPE.BUNDLED;
  }
  if (/^STANDALONE|^SAOD|^SOD/.test(u) || /standalone|stand[\s-]?alone|own\s*damage\s*only/i.test(t)) {
    return COVERAGE_TYPE.STANDALONE_OD;
  }
  if (/^OWN_DAMAGE|^OD$/.test(u) || /^own\s*damage$/i.test(t)) {
    return COVERAGE_TYPE.OWN_DAMAGE;
  }
  return COVERAGE_TYPE.UNKNOWN;
}

export function coverageDisplay(enumVal) {
  return COVERAGE_DISPLAY[enumVal] || COVERAGE_DISPLAY[COVERAGE_TYPE.UNKNOWN];
}

/**
 * Flat canonical values for Review / vault (non-evidence fields on invoice root).
 */
export function flattenCanonical(canon = emptyCanonicalInsurance()) {
  const cov = canon.coverageType?.value || COVERAGE_TYPE.UNKNOWN;
  return {
    insurer: canon.insurer?.value || '',
    policyHolder: canon.policyHolder?.value || '',
    policyNumber: canon.policyNumber?.value || '',
    policyStartDate: canon.policyStartDate?.value || null,
    policyExpiryDate: canon.policyExpiryDate?.value || null,
    odStartDate: canon.odStartDate?.value || null,
    odExpiryDate: canon.odExpiryDate?.value || null,
    odStart: canon.odStartDate?.value || null,
    odExpiry: canon.odExpiryDate?.value || null,
    tpStartDate: canon.tpStartDate?.value || null,
    tpExpiryDate: canon.tpExpiryDate?.value || null,
    tpStart: canon.tpStartDate?.value || null,
    tpExpiry: canon.tpExpiryDate?.value || null,
    coverageType: cov,
    coverageTypeLabel: coverageDisplay(cov),
    vehicleRegistration: canon.vehicleRegistration?.value || '',
    chassisNumber: canon.chassisNumber?.value || '',
    engineNumber: canon.engineNumber?.value || '',
    insuredDeclaredValue: canon.insuredDeclaredValue?.value ?? null,
    premium: canon.premium?.value ?? null,
    pucExpiryDate: canon.pucExpiryDate?.value || null,
    vehicleLink: canon.vehicleLink?.value || null,
    documentType: canon.documentType?.value || 'insurance',
    needsReview: Boolean(canon.needsReview),
    fieldProvenance: canon.fieldProvenance || {},
  };
}

export function getCanonicalField(invoice, field) {
  const canon = invoice?.normalizedInsurance;
  if (canon && canon[field] != null) {
    const hit = canon[field];
    if (typeof hit === 'object' && hit !== null && 'value' in hit) {
      return hit.value ?? '';
    }
    return hit ?? '';
  }
  const flat = invoice?.[field];
  if (flat != null && flat !== '') return flat;
  return '';
}

export default {
  COVERAGE_TYPE,
  COVERAGE_DISPLAY,
  EVIDENCE_TYPE,
  isInsurancePlaceholder,
  fieldEvidence,
  emptyCanonicalInsurance,
  validateEngineNumber,
  validateChassisNumber,
  coverageEnumFromLegacy,
  coverageDisplay,
  flattenCanonical,
  getCanonicalField,
};
