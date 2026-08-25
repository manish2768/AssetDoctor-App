/**
 * Map an insurance OCR extract onto an existing vehicle by chassis / engine identity.
 *
 * Conservative: false-positive attach is worse than asking the user to confirm.
 * Never reconstruct a full chassis/engine from a short insurance suffix.
 * Never match by vehicle model / name.
 */

import { listVehicleAssets } from '../../utils/vehicleFolder';

function storedChassis(asset) {
  return (
    asset?.chassisNumber ||
    asset?.chassis ||
    asset?.chassis_or_frame_no ||
    asset?.invoiceMeta?.chassisNumber ||
    asset?.ocrExtract?.chassis_or_frame_no ||
    ''
  );
}

function storedEngine(asset) {
  return (
    asset?.engineNumber ||
    asset?.engine ||
    asset?.engine_number ||
    asset?.invoiceMeta?.engineNumber ||
    asset?.ocrExtract?.engine_number ||
    ''
  );
}

function identityCandidates(assets = []) {
  return (assets || []).filter((a) => {
    if (!a || a.deletedAt) return false;
    if (storedChassis(a) || storedEngine(a) || a.registration) return true;
    const cat = String(a.category || a.categoryId || a.smartCategory || '').toLowerCase();
    return /vehicle|bike|car|scooter/.test(cat);
  });
}

function vehiclesFrom(assets = []) {
  const fallback = identityCandidates(assets);
  if (typeof listVehicleAssets === 'function') {
    try {
      const listed = listVehicleAssets(assets);
      if (Array.isArray(listed) && listed.length) {
        const seen = new Set(listed.map(vehicleKey).filter(Boolean));
        const extra = fallback.filter((a) => {
          const k = vehicleKey(a);
          return k ? !seen.has(k) : true;
        });
        return extra.length ? listed.concat(extra) : listed;
      }
    } catch {
      /* node regression without bundler */
    }
  }
  return fallback;
}

export const INSURANCE_MATCH = Object.freeze({
  HIGH: 'high',
  REVIEW: 'review',
  CONFLICT: 'conflict',
  NONE: 'none',
});

export const MIN_SUFFIX_LEN = 4;
export const MIN_CHASSIS_EXACT_LEN = 8;
export const MIN_ENGINE_EXACT_LEN = 6;

const EXTRACTED_IDENTITY_JUNK =
  /^(?:NO|NA|N\/A|NIL|NULL|YES|Y|N|NUMBER|CHASSIS|ENGINE|FRAME|VIN|REGISTRATION|POLICY|PREMIUM|IDV|MAKE|MODEL)$/i;

/** Drop OCR header words so they never participate in vehicle matching. */
export function usableInsuranceIdentity(raw) {
  const compact = normalizeVehicleIdentity(raw);
  if (!compact || compact.length < MIN_SUFFIX_LEN) return '';
  if (EXTRACTED_IDENTITY_JUNK.test(compact)) return '';
  if (/^[A-Z]+$/.test(compact) && compact.length <= 10) return '';
  return String(raw || '').trim();
}

/** Uppercase + strip spaces, hyphens, and other OCR punctuation. */
export function normalizeVehicleIdentity(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Comparison-only: O/0 and I/1. Never rewrite stored or displayed values. */
export function identityForCompare(value) {
  return normalizeVehicleIdentity(value).replace(/[OI]/g, (ch) => (ch === 'O' ? '0' : '1'));
}

/**
 * Review display for a matched identifier. Uses the stored full ID tail when
 * the insurance document only printed (or OCR'd) a suffix / garbled full value.
 */
export function formatIdentityMask(storedFull, extracted) {
  const full = normalizeVehicleIdentity(storedFull);
  const part = normalizeVehicleIdentity(extracted);
  const tail = (full || part).slice(-4);
  if (!tail) return extracted ? String(extracted) : '';
  return `xxxx...${tail}`;
}

function suffixOf(value, n) {
  const s = String(value || '');
  return s.length >= n ? s.slice(-n) : '';
}

function storedEndsWithPart(full, fullC, part, partC) {
  if (!part) return false;
  return full.endsWith(part) || fullC.endsWith(partC);
}

/**
 * Compare a stored full identifier with an insurance-extracted value.
 * Returns 'exact' | 'suffix' | null. Never expands the insurance value.
 *
 * Insurance policies often print only the last 4 or 6 characters, or OCR may
 * return a garbled full ID whose tail still matches the vault identifier.
 */
export function identityMatchKind(storedFull, extracted) {
  const full = normalizeVehicleIdentity(storedFull);
  const part = normalizeVehicleIdentity(extracted);
  if (!full || !part) return null;
  if (full === part) return 'exact';

  const fullC = identityForCompare(full);
  const partC = identityForCompare(part);
  if (fullC === partC) return 'exact';

  // Typical policy print: insurance value shorter than the stored full ID.
  if (part.length >= MIN_SUFFIX_LEN && part.length < full.length) {
    if (storedEndsWithPart(full, fullC, part, partC)) return 'suffix';
  }

  // Garbled / equal-length OCR: still match last 6 then last 4 of the extract.
  // Stored must be longer than the suffix so a short vault value never "matches"
  // a longer insurance string (no reverse reconstruction).
  if (part.length >= 6 && full.length > 6) {
    const s6 = suffixOf(part, 6);
    const s6c = suffixOf(partC, 6);
    if (storedEndsWithPart(full, fullC, s6, s6c)) return 'suffix';
  }
  if (part.length >= MIN_SUFFIX_LEN && full.length > MIN_SUFFIX_LEN) {
    const s4 = suffixOf(part, 4);
    const s4c = suffixOf(partC, 4);
    if (storedEndsWithPart(full, fullC, s4, s4c)) return 'suffix';
  }
  return null;
}

function vehicleKey(asset) {
  return asset?.assetId || asset?.id || null;
}

function emptySide(extractedRaw) {
  return {
    extracted: extractedRaw ? String(extractedRaw) : '',
    matched: false,
    kind: null,
    storedFull: '',
  };
}

function sideResult(vehicle, extractedRaw, storedValue, kind) {
  return {
    extracted: extractedRaw ? String(extractedRaw) : '',
    matched: Boolean(kind),
    kind: kind || null,
    storedFull: kind ? String(storedValue || '') : '',
  };
}

function baseResult() {
  return {
    status: INSURANCE_MATCH.NONE,
    autoAttach: false,
    confidence: null,
    matched: null,
    candidates: [],
    matchBy: null,
    chassis: emptySide(''),
    engine: emptySide(''),
    warning: '',
    userMessage: 'No matching vehicle found',
  };
}

/**
 * @param {object[]} assets
 * @param {object} extracted insurance OCR / review form
 */
export function matchInsuranceToVehicle(assets = [], extracted = {}) {
  const result = baseResult();
  const vehicles = vehiclesFrom(assets);
  const extract = extracted.ocrExtract && typeof extracted.ocrExtract === 'object' ? extracted.ocrExtract : {};
  const chassisRaw = usableInsuranceIdentity(
    extracted.chassisNumber ||
      extracted.chassis ||
      extracted.chassis_or_frame_no ||
      extract.chassis_or_frame_no ||
      extract.chassis_number ||
      '',
  );
  const engineRaw = usableInsuranceIdentity(
    extracted.engineNumber ||
      extracted.engine ||
      extracted.engine_number ||
      extract.engine_number ||
      extract.engineNumber ||
      '',
  );

  result.chassis = emptySide(chassisRaw);
  result.engine = emptySide(engineRaw);

  const chassisNorm = normalizeVehicleIdentity(chassisRaw);
  const engineNorm = normalizeVehicleIdentity(engineRaw);
  const hasChassis = chassisNorm.length >= MIN_SUFFIX_LEN;
  const hasEngine = engineNorm.length >= MIN_SUFFIX_LEN;

  if (!hasChassis && !hasEngine) {
    result.userMessage = 'No matching vehicle found';
    result.warning = 'Insurance document has no chassis or engine number to match.';
    return result;
  }

  const chassisHits = hasChassis
    ? vehicles.filter((v) => identityMatchKind(storedChassis(v), chassisRaw))
    : [];
  const engineHits = hasEngine
    ? vehicles.filter((v) => identityMatchKind(storedEngine(v), engineRaw))
    : [];

  const pairHits =
    hasChassis && hasEngine
      ? vehicles.filter(
          (v) =>
            identityMatchKind(storedChassis(v), chassisRaw) &&
            identityMatchKind(storedEngine(v), engineRaw),
        )
      : [];

  const fillSides = (vehicle) => {
    const cKind = hasChassis ? identityMatchKind(storedChassis(vehicle), chassisRaw) : null;
    const eKind = hasEngine ? identityMatchKind(storedEngine(vehicle), engineRaw) : null;
    result.chassis = sideResult(vehicle, chassisRaw, storedChassis(vehicle), cKind);
    result.engine = sideResult(vehicle, engineRaw, storedEngine(vehicle), eKind);
  };

  const markHigh = (vehicle, matchBy, candidates) => {
    fillSides(vehicle);
    result.status = INSURANCE_MATCH.HIGH;
    result.autoAttach = true;
    result.confidence = 'High';
    result.matched = vehicle;
    result.candidates = candidates || [vehicle];
    result.matchBy = matchBy;
    result.userMessage = vehicle.assetName || 'Vehicle';
    result.warning = '';
    return result;
  };

  const markConflict = (candidates, warning, userMessage) => {
    result.status = INSURANCE_MATCH.CONFLICT;
    result.autoAttach = false;
    result.candidates = candidates;
    result.warning = warning;
    result.userMessage = userMessage;
    return result;
  };

  // Both identifiers uniquely corroborate the same vehicle.
  if (hasChassis && hasEngine && pairHits.length === 1) {
    const bothExact =
      identityMatchKind(storedChassis(pairHits[0]), chassisRaw) === 'exact' &&
      identityMatchKind(storedEngine(pairHits[0]), engineRaw) === 'exact';
    return markHigh(pairHits[0], bothExact ? 'chassis_engine_exact' : 'chassis_engine_pair', pairHits);
  }

  if (hasChassis && hasEngine && pairHits.length > 1) {
    return markConflict(
      pairHits,
      'Multiple vehicles share this chassis and engine suffix. Confirm the vehicle before attaching.',
      'Multiple vehicles match — confirm before attaching',
    );
  }

  if (
    chassisHits.length === 1 &&
    engineHits.length === 1 &&
    vehicleKey(chassisHits[0]) !== vehicleKey(engineHits[0])
  ) {
    fillSides(chassisHits[0]);
    result.engine = sideResult(
      engineHits[0],
      engineRaw,
      storedEngine(engineHits[0]),
      identityMatchKind(storedEngine(engineHits[0]), engineRaw),
    );
    return markConflict(
      [chassisHits[0], engineHits[0]],
      'Chassis Number matched one vehicle but Engine Number matched another. Do not attach until you confirm.',
      'Vehicle identity mismatch',
    );
  }

  // Unique engine — chassis missing or unreadable garbage must not reject.
  if (engineHits.length === 1 && chassisHits.length === 0) {
    const kind = identityMatchKind(storedEngine(engineHits[0]), engineRaw);
    return markHigh(engineHits[0], kind === 'exact' ? 'engine_exact' : 'engine_suffix', engineHits);
  }

  // Unique chassis — engine missing or unreadable garbage must not reject.
  if (chassisHits.length === 1 && engineHits.length === 0) {
    const kind = identityMatchKind(storedChassis(chassisHits[0]), chassisRaw);
    return markHigh(chassisHits[0], kind === 'exact' ? 'chassis_exact' : 'chassis_suffix', chassisHits);
  }

  if (chassisHits.length > 1 || engineHits.length > 1) {
    const candidates = [...chassisHits, ...engineHits].filter(
      (v, i, arr) => arr.findIndex((x) => vehicleKey(x) === vehicleKey(v)) === i,
    );
    return markConflict(
      candidates,
      'This chassis or engine suffix matches more than one vehicle. Never auto-map.',
      'Multiple vehicles match — confirm before attaching',
    );
  }

  result.userMessage = 'No matching vehicle found';
  result.warning = 'Chassis and engine on this policy do not match a saved vehicle.';
  return result;
}

/**
 * Asset patch from an insurance scan — never writes chassisNumber / engineNumber.
 */
export function insuranceAttachUpdates(existingAsset, form = {}) {
  const policyNumber = String(form.policyNumber || form.invoiceNumber || '').trim();
  const insurer = String(form.insurer || form.storeName || form.shopName || '').trim();
  const policyHolder = String(
    form.policyHolder || form.customerName || form.ownerName || form.buyerName || '',
  ).trim();
  const idvRaw = form.idv ?? form.insuredDeclaredValue;
  const idv = idvRaw != null && idvRaw !== '' ? Number(String(idvRaw).replace(/,/g, '')) : null;
  const premiumRaw = form.premium ?? form.annualInsurancePremium;
  const premium =
    premiumRaw != null && premiumRaw !== '' ? Number(String(premiumRaw).replace(/,/g, '')) : null;
  const coverageType = String(form.coverageType || form.insuranceCoverageType || form.coverageTypeLabel || '').trim();
  const insuranceStart = form.insuranceStart || form.policyStartDate || null;
  const insuranceExpiry = form.insuranceExpiry || form.policyExpiryDate || null;
  const canonical =
    form.normalizedInsurance && typeof form.normalizedInsurance === 'object'
      ? form.normalizedInsurance
      : null;

  const prevMeta = existingAsset?.invoiceMeta && typeof existingAsset.invoiceMeta === 'object'
    ? existingAsset.invoiceMeta
    : {};

  const updates = {
    ...(insuranceExpiry ? { insuranceExpiry, insurance_expiry_date: insuranceExpiry } : {}),
    ...(insuranceStart ? { insuranceStart } : {}),
    ...(policyNumber ? { policyNumber } : {}),
    ...(insurer ? { insurer } : {}),
    ...(policyHolder ? { policyHolder } : {}),
    ...(coverageType ? { insuranceCoverageType: coverageType } : {}),
    ...(Number.isFinite(idv) && idv > 0 ? { idv } : {}),
    ...(Number.isFinite(premium) && premium > 0 ? { annualInsurancePremium: premium } : {}),
    invoiceMeta: {
      ...prevMeta,
      insurance: {
        policyNumber,
        insurer,
        policyHolder,
        insuranceStart,
        insuranceExpiry,
        idv: Number.isFinite(idv) && idv > 0 ? idv : null,
        premium: Number.isFinite(premium) && premium > 0 ? premium : null,
        coverageType,
        odStartDate: form.odStartDate || null,
        odExpiryDate: form.odExpiryDate || form.odInsuranceExpiry || null,
        tpStartDate: form.tpStartDate || null,
        tpExpiryDate: form.tpExpiryDate || form.tpInsuranceExpiry || null,
        chassisExtracted: String(form.chassisNumber || '').trim(),
        engineExtracted: String(form.engineNumber || '').trim(),
        registrationExtracted: String(form.registration || '').trim(),
        canonical,
      },
    },
  };

  if (!existingAsset?.registration && form.registration) {
    updates.registration = String(form.registration).trim();
  }

  return updates;
}

export default {
  INSURANCE_MATCH,
  normalizeVehicleIdentity,
  identityForCompare,
  identityMatchKind,
  formatIdentityMask,
  matchInsuranceToVehicle,
  insuranceAttachUpdates,
  usableInsuranceIdentity,
};
