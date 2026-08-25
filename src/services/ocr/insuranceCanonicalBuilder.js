/**
 * Build insurer-agnostic canonical insurance object from OCR / Review source.
 */
import {
  COVERAGE_TYPE,
  EVIDENCE_TYPE,
  coverageEnumFromLegacy,
  coverageDisplay,
  emptyCanonicalInsurance,
  fieldEvidence,
  flattenCanonical,
  validateChassisNumber,
  validateEngineNumber,
} from './canonicalInsuranceSchema';

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

function cleanInsurerName(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/\bISO\s*\d{3,5}(?:\s*:\s*\d{4})?\b[\s\S]*$/i, '');
  s = s.replace(/\b(?:an?\s+)?ISO[\s\-]*certified[\s\S]*$/i, '');
  s = s.replace(/\bcertified\s+company\b[\s\S]*$/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(?:pvt\.?|private)\s+(?:ltd\.?|limited)\b\.?\s*$/i, '');
  s = s.replace(/\bcompany\s+limited\b\.?\s*$/i, '');
  s = s.replace(/\bco\.?\s*ltd\.?\b\.?\s*$/i, '');
  s = s.replace(/\blimited\b\.?\s*$/i, '');
  s = s.replace(/\bIRDAI[\s\S]*$/i, '');
  s = s.replace(/\bCIN\s*[:.\-]?\s*[A-Z0-9][\s\S]*$/i, '');
  s = s.replace(/\bUIN\s*[:.\-]?\s*[A-Z0-9][\s\S]*$/i, '');
  s = s.replace(/\b(?:regd\.?|registered|corporate|branch)\s*office[\s\S]*$/i, '');
  s = s.replace(/\b(?:www\.|https?:\/\/)[\s\S]*$/i, '');
  s = s.replace(/\b(?:toll[\s\-]?free|customer\s*care|helpline|care@)[\s\S]*$/i, '');
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i, '');
  s = s.replace(/\b(?:pin\s*code|pincode|gstin)\b[\s\S]*$/i, '');
  return cleanLine(s).replace(/[,\-;|]+$/g, '').trim();
}

function stripHonorific(name) {
  return String(name || '')
    .replace(/^\s*(?:mr|mrs|ms|smt|shri|m\/?s)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstNonEmpty(src, nested, keys) {
  for (const key of keys) {
    const v = src?.[key] ?? nested?.[key];
    if (v == null) continue;
    const s = typeof v === 'string' ? v.trim() : v;
    if (s !== '' && s != null) return s;
  }
  return '';
}

function keepPair(start, end) {
  if (start && end && end < start) return { start: null, end: null };
  return { start: start || null, end: end || null };
}

function provToEvidence(value, prov, fallbackLabel = '') {
  if (value == null || value === '') return fieldEvidence(null);
  const p = prov && typeof prov === 'object' ? prov : {};
  return fieldEvidence(value, {
    sourceLabel: p.sourceLabel || p.sourceContext || fallbackLabel,
    sourceText: p.sourceText || String(value),
    confidence: p.confidence ?? 0.85,
    evidenceType:
      p.semanticType != null ? EVIDENCE_TYPE.CLASSIFIED_DATE : p.evidenceType || EVIDENCE_TYPE.LABELED,
    sectionContext: p.sourceContext || p.sourceLabel || fallbackLabel,
  });
}

export function buildCanonicalInsuranceObject(src = {}) {
  const nested = src.insuranceFields && typeof src.insuranceFields === 'object' ? src.insuranceFields : {};
  const provenance = src.fieldProvenance || nested.fieldProvenance || {};
  const canon = emptyCanonicalInsurance();

  const insurerRaw = cleanInsurerName(
    firstNonEmpty(src, nested, ['insurer', 'insuranceCompany', 'companyName', 'provider']),
  );
  let policyHolderRaw = stripHonorific(
    firstNonEmpty(src, nested, ['policyHolder', 'insuredName', 'insured', 'holderName']),
  );
  if (!policyHolderRaw) {
    const fallback = stripHonorific(firstNonEmpty(src, nested, ['customerName']));
    if (fallback && fallback.toLowerCase() !== insurerRaw.toLowerCase()) policyHolderRaw = fallback;
  }
  const policyNumberRaw = String(
    firstNonEmpty(src, nested, ['policyNumber', 'policyNo', 'policyID', 'certificateNumber']) || '',
  ).trim();

  const policyStartRaw =
    firstNonEmpty(src, nested, ['policyStartDate', 'overallStartDate', 'insuranceStart']) || null;
  const policyExpiryRaw =
    firstNonEmpty(src, nested, ['policyExpiryDate', 'overallExpiryDate', 'insuranceExpiry']) || null;
  const odStartRaw = firstNonEmpty(src, nested, ['odStart', 'odStartDate']) || null;
  const odExpiryRaw = firstNonEmpty(src, nested, ['odExpiry', 'odExpiryDate', 'odInsuranceExpiry']) || null;
  const tpStartRaw = firstNonEmpty(src, nested, ['tpStart', 'tpStartDate']) || null;
  const tpExpiryRaw = firstNonEmpty(src, nested, ['tpExpiry', 'tpExpiryDate', 'tpInsuranceExpiry']) || null;

  const datesOk = keepPair(policyStartRaw || null, policyExpiryRaw || null);
  const odOk = keepPair(odStartRaw || null, odExpiryRaw || null);
  const tpOk = keepPair(tpStartRaw || null, tpExpiryRaw || null);

  const coverageRaw = firstNonEmpty(src, nested, ['coverageType']);
  const coverageEnum = coverageEnumFromLegacy(coverageRaw);

  const chassisRaw = String(firstNonEmpty(src, nested, ['chassisNumber']) || '').trim();
  const engineRaw = String(firstNonEmpty(src, nested, ['engineNumber']) || '').trim();
  const registrationRaw = String(firstNonEmpty(src, nested, ['registration']) || src.registration || '').trim();
  const idvRaw = firstNonEmpty(src, nested, ['idv', 'insuredDeclaredValue']);
  const premiumRaw = firstNonEmpty(src, nested, ['premium']);
  const pucRaw = firstNonEmpty(src, nested, ['pucExpiry']) || src.pucExpiry || null;
  const vehicleLinkRaw = firstNonEmpty(src, nested, ['vehicleLink', 'linkAssetId']) || src.linkAssetId || null;

  const chassisVal = validateChassisNumber(chassisRaw, { engineNumber: engineRaw, policyNumber: policyNumberRaw });
  const engineVal = validateEngineNumber(engineRaw, {
    chassisNumber: chassisRaw,
    policyNumber: policyNumberRaw,
    insurer: insurerRaw,
  });

  let needsReview = Boolean(chassisVal.needsReview || engineVal.needsReview);

  canon.insurer = provToEvidence(insurerRaw, provenance.insurer, 'Insurer');
  canon.policyHolder = provToEvidence(policyHolderRaw, provenance.policyHolder, 'Policy holder');
  canon.policyNumber = provToEvidence(policyNumberRaw, provenance.policyNumber, 'Policy number');
  canon.policyStartDate = provToEvidence(datesOk.start, provenance.overallStartDate || provenance.policyStartDate, 'Policy period');
  canon.policyExpiryDate = provToEvidence(datesOk.end, provenance.overallExpiryDate || provenance.policyExpiryDate, 'Policy period');
  canon.odStartDate = provToEvidence(odOk.start, provenance.odStartDate, 'Own Damage period');
  canon.odExpiryDate = provToEvidence(odOk.end, provenance.odExpiryDate, 'Own Damage period');
  canon.tpStartDate = provToEvidence(tpOk.start, provenance.tpStartDate, 'Third Party period');
  canon.tpExpiryDate = provToEvidence(tpOk.end, provenance.tpExpiryDate, 'Third Party period');
  canon.coverageType = fieldEvidence(coverageEnum, {
    sourceLabel: coverageRaw || coverageDisplay(coverageEnum),
    sourceText: coverageRaw || coverageDisplay(coverageEnum),
    confidence: coverageEnum !== COVERAGE_TYPE.UNKNOWN ? 0.9 : 0,
    evidenceType: EVIDENCE_TYPE.LABELED,
    sectionContext: 'Coverage type',
  });
  canon.vehicleRegistration = provToEvidence(registrationRaw, provenance.registration, 'Registration');
  canon.chassisNumber = fieldEvidence(chassisVal.value, {
    sourceLabel: 'Chassis Number',
    sourceText: chassisRaw,
    confidence: chassisVal.value ? 0.9 : 0,
    evidenceType: EVIDENCE_TYPE.LABELED,
    sectionContext: 'Vehicle identity',
    needsReview: chassisVal.needsReview,
  });
  canon.engineNumber = fieldEvidence(engineVal.value, {
    sourceLabel: 'Engine Number',
    sourceText: engineRaw,
    confidence: engineVal.value ? 0.9 : 0,
    evidenceType: EVIDENCE_TYPE.LABELED,
    sectionContext: 'Vehicle identity',
    needsReview: engineVal.needsReview,
  });
  canon.insuredDeclaredValue = provToEvidence(idvRaw, provenance.idv, 'IDV');
  canon.premium = provToEvidence(premiumRaw, provenance.premium, 'Premium');
  canon.pucExpiryDate = provToEvidence(pucRaw, provenance.pucExpiry, 'PUC expiry');
  canon.vehicleLink = fieldEvidence(vehicleLinkRaw);
  canon.documentType = fieldEvidence(
    firstNonEmpty(src, nested, ['documentType', 'documentKind']) || 'insurance',
  );
  canon.needsReview = needsReview;
  canon.fieldProvenance = provenance;

  return canon;
}

export function patchCanonicalField(canon, field, value, meta = {}) {
  if (!canon || typeof canon !== 'object') return buildCanonicalInsuranceObject({});
  const next = { ...canon };
  const existing = next[field];
  const base =
    existing && typeof existing === 'object' && 'value' in existing
      ? { ...existing }
      : fieldEvidence(existing);
  base.value = value == null || String(value).trim() === '' ? null : value;
  base.evidenceType = meta.manual ? EVIDENCE_TYPE.MANUAL : base.evidenceType;
  if (meta.manual) base.confidence = 1;
  next[field] = base;
  return next;
}

export function applyFlatToCanonical(canon, flat = {}) {
  let next = canon && typeof canon === 'object' ? { ...canon } : buildCanonicalInsuranceObject({});
  const map = [
    ['insurer', 'insurer'],
    ['policyHolder', 'policyHolder'],
    ['policyNumber', 'policyNumber'],
    ['policyStartDate', 'policyStartDate'],
    ['policyExpiryDate', 'policyExpiryDate'],
    ['odStartDate', 'odStartDate'],
    ['odExpiryDate', 'odExpiryDate'],
    ['tpStartDate', 'tpStartDate'],
    ['tpExpiryDate', 'tpExpiryDate'],
    ['chassisNumber', 'chassisNumber'],
    ['engineNumber', 'engineNumber'],
    ['vehicleRegistration', 'registration'],
    ['insuredDeclaredValue', 'idv'],
    ['premium', 'premium'],
    ['pucExpiryDate', 'pucExpiry'],
  ];
  for (const [canonKey, flatKey] of map) {
    if (flat[flatKey] != null && String(flat[flatKey]).trim() !== '') {
      next = patchCanonicalField(next, canonKey, flat[flatKey], { manual: true });
    }
  }
  if (flat.coverageType) {
    next = patchCanonicalField(next, 'coverageType', coverageEnumFromLegacy(flat.coverageType), { manual: true });
  }
  return next;
}

export { flattenCanonical, coverageDisplay, COVERAGE_TYPE };

export default {
  buildCanonicalInsuranceObject,
  patchCanonicalField,
  applyFlatToCanonical,
  flattenCanonical,
  coverageDisplay,
  COVERAGE_TYPE,
};
