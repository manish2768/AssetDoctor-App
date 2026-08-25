/**
 * Field normalization — keep raw OCR value; store normalized for matching.
 * Never invent missing values.
 */

/**
 * Parse common date formats → ISO YYYY-MM-DD or null if invalid / impossible.
 */
export function normalizeDateToIso(raw) {
  if (raw == null || raw === '') return { rawValue: raw ?? null, normalizedValue: null, valid: false };
  const original = String(raw).trim();
  if (!original) return { rawValue: original, normalizedValue: null, valid: false };

  // Already ISO
  let m = original.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const iso = buildValidIso(+m[1], +m[2], +m[3]);
    return { rawValue: original, normalizedValue: iso, valid: Boolean(iso) };
  }

  // DD/MM/YYYY or DD-MM-YYYY (India-first)
  m = original.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let d = +m[1];
    let mo = +m[2];
    let y = +m[3];
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    // Ambiguous MM/DD vs DD/MM: if first > 12 → must be DD/MM; if second > 12 → MM/DD
    if (d > 12 && mo <= 12) {
      /* DD/MM */
    } else if (mo > 12 && d <= 12) {
      const tmp = d;
      d = mo;
      mo = tmp;
    } else {
      // Prefer DD/MM for Indian docs when both <= 12
    }
    const iso = buildValidIso(y, mo, d);
    return { rawValue: original, normalizedValue: iso, valid: Boolean(iso) };
  }

  const mon = original.match(/^(\d{1,2})[\/\-\s]+([A-Za-z]{3,9})\.?[\/\-\s]+(\d{2,4})$/);
  if (mon) {
    const months = {
      JAN: 1, JANUARY: 1, FEB: 2, FEBRUARY: 2, MAR: 3, MARCH: 3, APR: 4, APRIL: 4,
      MAY: 5, JUN: 6, JUNE: 6, JUL: 7, JULY: 7, AUG: 8, AUGUST: 8, SEP: 9, SEPT: 9,
      SEPTEMBER: 9, OCT: 10, OCTOBER: 10, NOV: 11, NOVEMBER: 11, DEC: 12, DECEMBER: 12,
    };
    const mo = months[mon[2].toUpperCase()];
    let y = +mon[3];
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (mo) {
      const iso = buildValidIso(y, mo, +mon[1]);
      return { rawValue: original, normalizedValue: iso, valid: Boolean(iso) };
    }
  }

  return { rawValue: original, normalizedValue: null, valid: false };
}

function buildValidIso(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null; // e.g. 31/02/2026
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeVehicleRegistration(raw) {
  const original = raw == null ? '' : String(raw).trim();
  if (!original) return { rawValue: original || null, normalizedValue: null, valid: false };
  const normalized = original
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
  const valid = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(normalized);
  return { rawValue: original, normalizedValue: valid ? normalized : null, valid };
}

export function normalizeImei(raw) {
  const original = raw == null ? '' : String(raw).trim();
  const digits = original.replace(/\D/g, '');
  const ok = digits.length >= 14 && digits.length <= 17;
  return {
    rawValue: original || null,
    normalizedValue: ok ? digits : digits || null,
    validLength: ok,
  };
}

export function normalizeSerialOrVin(raw) {
  const original = raw == null ? '' : String(raw).trim();
  if (!original) return { rawValue: null, normalizedValue: null };
  const normalized = original.toUpperCase().replace(/[\s\-_]/g, '');
  return { rawValue: original, normalizedValue: normalized || null };
}

export function normalizeInvoiceNumber(raw) {
  const original = raw == null ? '' : String(raw).trim();
  if (!original) return { rawValue: null, normalizedValue: null };
  const normalized = original.toUpperCase().replace(/\s+/g, '');
  return { rawValue: original, normalizedValue: normalized || null };
}

/**
 * Wrap a field with DI metadata. Never invent value.
 */
export function fieldMeta(value, { confidence = null, source = 'ocr', verified = false } = {}) {
  if (value == null || value === '') {
    return {
      value: null,
      confidence: 0,
      source,
      verified: false,
      detected: false,
    };
  }
  return {
    value,
    confidence: confidence == null ? null : Number(confidence),
    source,
    verified: Boolean(verified),
    detected: true,
  };
}

/**
 * Normalize key identifiers on an extracted invoice payload (non-destructive).
 */
export function normalizeExtractedIdentifiers(data = {}) {
  const registration = normalizeVehicleRegistration(
    data.registration || data.registrationNumber || data.vehicleNumber,
  );
  const imei = normalizeImei(data.imei || data.imei1);
  const serial = normalizeSerialOrVin(data.serialNumber || data.serial);
  const chassis = normalizeSerialOrVin(data.chassisNumber || data.vin || data.frameNumber);
  const engine = normalizeSerialOrVin(data.engineNumber);
  const invoiceNumber = normalizeInvoiceNumber(data.invoiceNumber || data.documentNumber);
  const purchaseDate = normalizeDateToIso(
    data.invoiceDate || data.purchaseDate || data.serviceDate,
  );

  return {
    ...data,
    identifiers: {
      registration,
      imei,
      serial,
      chassis,
      engine,
      invoiceNumber,
      purchaseDate,
    },
    // Convenience normalized copies for matching (raw fields preserved)
    registrationNormalized: registration.normalizedValue,
    imeiNormalized: imei.normalizedValue,
    serialNormalized: serial.normalizedValue,
    chassisNormalized: chassis.normalizedValue,
    invoiceNumberNormalized: invoiceNumber.normalizedValue,
    purchaseDateIso: purchaseDate.normalizedValue,
  };
}

export default {
  normalizeDateToIso,
  normalizeVehicleRegistration,
  normalizeImei,
  normalizeSerialOrVin,
  normalizeInvoiceNumber,
  fieldMeta,
  normalizeExtractedIdentifiers,
};
