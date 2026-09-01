/**
 * Merge optional Gemini enrichment into a pipeline review invoice.
 * Never overwrites high-confidence OCR. Never adds values absent from the document.
 */

function haystack(rawText) {
  let s = String(rawText || '').toUpperCase();
  s = s.replace(/(\d{1,3}(?:,\d{2,3})+)(\.\d{2})?/g, (_, whole, dec) => {
    const digits = String(whole).replace(/,/g, '');
    if (dec && dec !== '.00') return digits + String(dec).replace('.', '');
    return digits;
  });
  return s.replace(/[^A-Z0-9]+/g, '');
}

function needle(value) {
  if (value == null) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

function inDocument(value, rawText) {
  if (value == null || value === '') return false;
  const hay = haystack(rawText);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = String(Math.round(value));
    return hay.includes(n);
  }
  const n = needle(value);
  if (n.length >= 4 && hay.includes(n)) return true;
  const tokens = String(value)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4);
  if (!tokens.length) return n.length >= 3 && hay.includes(n);
  const hits = tokens.filter((t) => hay.includes(t));
  return hits.length >= Math.min(2, tokens.length);
}

const BANNED = [
  'UP32QU2187',
  'MD637AN11S2F03328',
  'BN1FS2302943',
  'TVSRONINBASE1CH',
  'TAARMOTOLEGENDS',
  '20261231',
  '20260915',
];

function isBanned(value, rawText) {
  const n = needle(value);
  if (!n) return false;
  const hay = haystack(rawText);
  return BANNED.some((b) => (n === b || n.includes(b) || b.includes(n)) && !hay.includes(b));
}

const VEHICLE_KEYS = [
  'registration',
  'vehicle_registration_number',
  'registration_number',
  'chassisNumber',
  'chassis_or_frame_no',
  'engineNumber',
  'engine_number',
  'odometerKm',
  'odometer_reading',
  'odometerReading',
  'nextServiceOdometerKm',
  'pucExpiry',
];

function isElectronicsFamily(family) {
  return family === 'electronics' || family === 'appliance' || family === 'generic' || family === 'warranty';
}

/**
 * @param {object} invoice — pipeline review invoice
 * @param {object} gemini — normalizeGeminiPayload output
 * @param {string} rawText
 */
export function mergeGeminiSafely(invoice = {}, gemini = {}, rawText = '') {
  if (!gemini || typeof gemini !== 'object') return invoice;
  const next = { ...invoice };
  const family = String(next.reviewFamily || next.documentKind || '');
  const electronics = isElectronicsFamily(family);

  const fill = (invoiceKey, geminiKeys, { numeric = false } = {}) => {
    const current = next[invoiceKey];
    const empty =
      current == null ||
      current === '' ||
      (typeof current === 'number' && !Number.isFinite(current));
    if (!empty) return;
    let val = null;
    for (const k of geminiKeys) {
      if (gemini[k] != null && gemini[k] !== '') {
        val = gemini[k];
        break;
      }
    }
    if (val == null || val === '') return;
    if (numeric) {
      const n = Number(val);
      if (!Number.isFinite(n) || n <= 0) return;
      val = n;
    } else {
      val = String(val).trim();
    }
    if (isBanned(val, rawText) || !inDocument(val, rawText)) return;
    next[invoiceKey] = val;
  };

  fill('productName', ['asset_name', 'product_name', 'item_name', 'assetName']);
  fill('shopName', ['vendor_dealer_name', 'seller_name', 'vendor_name', 'workshop_name', 'shopName']);
  fill('customerName', ['owner_buyer_name', 'buyer_name', 'customerName']);
  fill('invoiceNumber', ['invoice_or_policy_no', 'invoice_number', 'policyNumber']);
  fill('invoiceDate', ['purchase_or_issue_date', 'purchase_date', 'invoiceDate']);
  fill('totalAmount', ['total_amount', 'totalAmount', 'premium'], { numeric: true });
  fill('serialNumber', ['serial_number', 'serialNumber']);
  fill('imei', ['imei']);
  fill('shopGstin', ['gstin', 'shopGstin']);

  if (!electronics && (family === 'service' || family === 'vehicle_purchase' || family === 'insurance' || family === 'puc' || family === 'rc')) {
    fill('registration', ['registration', 'vehicle_registration_number', 'registration_number']);
    fill('chassisNumber', ['chassis_or_frame_no', 'chassisNumber']);
    fill('engineNumber', ['engine_number', 'engineNumber']);
    if (family === 'service') {
      fill('odometerKm', ['odometer_reading', 'odometerKm'], { numeric: true });
    }
    if (family === 'insurance') {
      fill('insuranceExpiry', ['expiry_date', 'policy_end_date', 'insuranceExpiry']);
      fill('policyStartDate', ['policy_start_date', 'policyStartDate']);
      fill('idv', ['idv'], { numeric: true });
    }
  }

  if (electronics) {
    for (const k of VEHICLE_KEYS) {
      if (k in next && k !== 'serialNumber' && k !== 'imei') {
        if (k === 'odometerKm' || k === 'odometerReading' || k === 'nextServiceOdometerKm') next[k] = null;
        else if (typeof next[k] === 'string') next[k] = '';
      }
    }
    next.registration = '';
    next.chassisNumber = '';
    next.engineNumber = '';
    next.odometerKm = null;
    next.pucExpiry = null;
    next.nextServiceOdometerKm = null;
    next.nextServiceDue = null;
  }

  return next;
}

export default mergeGeminiSafely;
