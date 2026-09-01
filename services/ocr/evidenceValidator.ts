/**
 * Zero-hallucination evidence gate.
 * A field value is allowed ONLY if the current document supports it.
 */

const BANNED_UNLESS_PRINTED = [
  'UP32QU2187',
  'MD637AN11S2F03328',
  'BN1FS2302943',
  'TVS RONIN BASE 1 CH',
  'TVS RONIN BASE',
  'TAAR MOTO LEGENDS PVT LTD',
  'TAAR MOTO LEGENDS',
  '2026-12-31',
  '2026-09-15',
];

const FAKE_PLACEHOLDERS = new Set([
  '',
  'null',
  'undefined',
  'n/a',
  'na',
  'nil',
  'unknown',
  'none',
  'leave blank if not on bill',
  'not found',
  'dummy',
  'test',
]);

export function normalizeEvidenceHaystack(rawText: string): string {
  let s = String(rawText || '').toUpperCase();
  // Strip .00 trailing decimals so 260.00 -> 260
  s = s.replace(/(\d+)\.00\b/g, '$1');
  // 1,45,000.00 → 145000 so numeric evidence matches normalized amounts
  s = s.replace(/(\d{1,3}(?:,\d{2,3})+)(\.\d{2})?/g, (_, whole, dec) => {
    const digits = String(whole).replace(/,/g, '');
    if (dec && dec !== '.00') return digits + String(dec).replace('.', '');
    return digits;
  });
  return s.replace(/[^A-Z0-9]+/g, '');
}

export function normalizeEvidenceNeedle(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.abs(value) >= 1 && Number.isInteger(value) ? value : value).replace(
      /[^0-9A-Z]/gi,
      '',
    );
  }
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function withIndianGrouping(n: string): string {
  // 12450 → 12,450  (also accept 1,2450-style OCR)
  if (!/^\d+$/.test(n) || n.length < 4) return n;
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '');
}

export function isPlaceholderValue(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim().toLowerCase();
  return FAKE_PLACEHOLDERS.has(s);
}

export function isBannedHallucination(value: unknown, rawText: string): boolean {
  if (value == null) return false;
  const needle = normalizeEvidenceNeedle(value);
  if (!needle) return false;
  const hay = normalizeEvidenceHaystack(rawText);
  for (const banned of BANNED_UNLESS_PRINTED) {
    const b = normalizeEvidenceNeedle(banned);
    if (needle === b || (needle.length >= 6 && needle.includes(b))) {
      if (!hay.includes(b)) return true;
    }
  }
  return false;
}

/**
 * True when `value` is physically supported by current document text.
 * Numbers accept comma-grouped OCR forms. Multi-word names need token overlap.
 */
export function isSupportedByDocument(value: unknown, rawText: string): boolean {
  if (value == null || value === '') return false;
  if (isPlaceholderValue(value)) return false;
  if (typeof value === 'boolean') return true;

  const hay = normalizeEvidenceHaystack(rawText);
  if (!hay) return false;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = String(Math.round(value));
    if (hay.includes(n)) return true;
    const grouped = withIndianGrouping(n);
    if (grouped !== n && hay.includes(grouped)) return true;
    return false;
  }

  const needle = normalizeEvidenceNeedle(value);
  if (!needle) return false;
  if (needle.length >= 4 && hay.includes(needle)) return true;

  // Date YYYY-MM-DD → also accept DDMMYYYY / YYYYMMDD fragments
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = iso[1];
    const m = iso[2];
    const d = iso[3];
    if (hay.includes(`${d}${m}${y}`) || hay.includes(`${y}${m}${d}`) || hay.includes(`${d}${m}${y.slice(2)}`)) {
      return true;
    }
  }

  const tokens = String(value)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) {
    return needle.length >= 3 && hay.includes(needle);
  }
  const hits = tokens.filter((t) => hay.includes(t));
  if (tokens.length === 1) return hits.length === 1;
  return hits.length >= Math.min(2, tokens.length);
}

const VEHICLE_ONLY_FIELDS = new Set([
  'vehicleRegistration',
  'registrationNumber',
  'registration',
  'vinOrChassis',
  'chassisNumber',
  'engineNumber',
  'odometerKm',
  'nextServiceOdometerKm',
  'nextServiceDue',
  'nextServiceDate',
  'pucExpiry',
  'currentOdometerKm',
]);

const SERVICE_ONLY_FIELDS = new Set([
  'odometerKm',
  'nextServiceOdometerKm',
  'nextServiceDue',
  'nextServiceDate',
  'labourCharges',
  'labourAmount',
  'partsTotal',
  'partsAmount',
  'jobCardNumber',
]);

export function documentAllowsVehicleFields(documentType: string): boolean {
  const t = String(documentType || '').toUpperCase();
  return (
    t.includes('SERVICE') ||
    t.includes('REPAIR') ||
    t.includes('INSURANCE') ||
    t.includes('PUC') ||
    t.includes('RC_') ||
    t === 'RC_CERTIFICATE' ||
    t.includes('REGISTRATION') ||
    t.includes('VEHICLE_PURCHASE') ||
    t === 'PURCHASE_INVOICE'
  );
}

export function documentAllowsServiceFields(documentType: string): boolean {
  const t = String(documentType || '').toUpperCase();
  return t.includes('SERVICE') || t.includes('REPAIR');
}

function stripField(field: any): any {
  if (!field || typeof field !== 'object') return undefined;
  return {
    ...field,
    value: null,
    normalizedValue: null,
    confidence: 0,
    status: 'NOT_FOUND',
    tier: 'NOT_FOUND',
    rawText: 'Not found on document',
    evidence: undefined,
    flag: 'STRIPPED_NO_EVIDENCE',
  };
}

function sanitizeOne(field: any, rawText: string, key: string, documentType: string): any {
  if (!field || typeof field !== 'object') return field;
  if (field.value == null || field.value === '') {
    // A null CONFLICT is deliberate: competing candidates were observed, but
    // no value is safe to choose. Keep it review-blocking through sanitization.
    if (field.status === 'CONFLICT') {
      return {
        ...field,
        value: null,
        normalizedValue: null,
        status: 'CONFLICT',
        tier: 'NEEDS_REVIEW',
        validationResult: field.validationResult || 'FAIL',
      };
    }
    return { ...field, value: null, normalizedValue: null, status: 'NOT_FOUND', tier: 'NOT_FOUND' };
  }

  if (!documentAllowsVehicleFields(documentType) && VEHICLE_ONLY_FIELDS.has(key)) {
    return undefined;
  }
  if (!documentAllowsServiceFields(documentType) && SERVICE_ONLY_FIELDS.has(key)) {
    return undefined;
  }

  if (isBannedHallucination(field.value, rawText) || !isSupportedByDocument(field.value, rawText)) {
    return stripField(field);
  }
  return field;
}

function sanitizeGroup(group: Record<string, any> | undefined, rawText: string, documentType: string) {
  if (!group || typeof group !== 'object') return group;
  const out: Record<string, any> = {};
  for (const [key, field] of Object.entries(group)) {
    const next = sanitizeOne(field, rawText, key, documentType);
    if (next === undefined) continue;
    if (next && typeof next === 'object' && 'value' in next && next.value == null && next.status === 'NOT_FOUND' && next.flag === 'STRIPPED_NO_EVIDENCE') {
      continue; // keep extractedData sparse — NOT_FOUND lives on the review schema
    }
    out[key] = next;
  }
  return out;
}

/**
 * Walk extractedData and drop any value not evidenced in this document.
 * Does NOT invent replacements.
 */
export function sanitizeExtractedData(
  extractedData: Record<string, any> = {},
  rawText: string,
  documentType: string,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [groupKey, group] of Object.entries(extractedData)) {
    if (!group || typeof group !== 'object') continue;
    const cleaned = sanitizeGroup(group as Record<string, any>, rawText, documentType);
    if (cleaned && Object.keys(cleaned).length > 0) {
      out[groupKey] = cleaned;
    }
  }
  return out;
}

export { BANNED_UNLESS_PRINTED };
