/**
 * Classify scanned document type from OCR text / invoice fields.
 * Keeps insurance / PUC / warranty / purchase bill semantics separate.
 */

export const DOC_TYPES = Object.freeze({
  BILL: 'bill',
  VEHICLE_INVOICE: 'vehicle_invoice',
  INSURANCE: 'insurance',
  PUC: 'puc',
  WARRANTY: 'warranty',
  RC: 'rc',
  OTHER: 'other',
});

/**
 * @param {string} blob
 * @param {object} [hints]
 * @returns {{ type: string, label: string, isVehicleInvoice: boolean, categoryHint: string|null }}
 */
export function classifyDocumentType(blob = '', hints = {}) {
  const text = `${blob} ${hints.productName || ''} ${hints.shopName || ''}`.toLowerCase();

  const insuranceScore =
    score(text, [
      /\binsurance\s*polic/i,
      /\bpolicy\s*(?:no|number|n[o°])/i,
      /\bidv\b/,
      /\bpremium\b/,
      /\binsurer\b/,
      /\bcomprehensive\s*(?:cover|policy)/i,
      /\bthird[\s\-]?party\b/,
      /\bcover\s*note\b/,
      /\bmotor\s*insurance\b/,
      /\bcertificate\s*of\s*insurance\b/,
      /\bperiod\s*of\s*insurance\b/,
      /\bown\s*damage\b/,
      /\bncb\b/,
    ]) + (hints.forceInsurance ? 5 : 0);

  const pucScore = score(text, [
    /\bpuc\b/,
    /\bpollution\s*(?:under\s*)?control/i,
    /\bemission\s*(?:test|certificate)/i,
    /\bvalidity\s*(?:of\s*)?puc/i,
  ]);

  const warrantyScore = score(text, [
    /\bwarranty\s*card/i,
    /\bwarranty\s*certificate/i,
    /\bguarantee\s*card/i,
    /\bwarranty\s*terms/i,
  ]);

  const rcScore = score(text, [
    /\bregistration\s*certificate\b/,
    /\bcertificate\s*of\s*registration\b/,
    /\brc\s*book\b/,
    /\bform\s*23\b/,
    /\bform\s*20\b/,
    /\bowner'?s?\s*name\b/,
    /\breg(?:istration|n)\.?\s*(?:no|n[o°]|number)\b/,
    /\bchassis\s*(?:no|number)\b/,
    /\bengine\s*(?:no|number)\b/,
    /\bfitness\s*(?:upto|valid|expiry)\b/,
    /\bvehicle\s*class\b/,
    /\brto\b/,
  ]);

  const vehicleInvoiceScore =
    score(text, [
      /\bframe\s*(?:no|number|n[o°])/i,
      /\bengine\s*(?:no|number|n[o°])/i,
      /\bchassis\s*(?:no|number|n[o°]|#)?/i,
      /\bex[\s\-]?showroom\b/,
      /\bhsrp\b/,
      /\bvin\b/,
      /\bvehicle\s*invoice\b/,
      /\btvs\s*(?:motor|ronin|apache|jupiter|ntorq)/i,
      /\bhero\s*(?:moto|splendor|passion)/i,
      /\bhonda\s*(?:activa|shine|unicorn)/i,
      /\bbajaj\s*(?:pulsar|avenger)/i,
      /\bdealer\s*invoice\b/,
      /\bmotor\s*vehicle\b/,
    ]) + (hints.registration ? 2 : 0) + (hints.chassisNumber ? 3 : 0);

  const scores = [
    { type: DOC_TYPES.INSURANCE, score: insuranceScore, label: 'Insurance Policy' },
    { type: DOC_TYPES.PUC, score: pucScore, label: 'PUC Certificate' },
    { type: DOC_TYPES.WARRANTY, score: warrantyScore, label: 'Warranty Certificate' },
    { type: DOC_TYPES.RC, score: rcScore, label: 'RC Book' },
    {
      type: DOC_TYPES.VEHICLE_INVOICE,
      score: vehicleInvoiceScore,
      label: 'Vehicle Invoice',
    },
  ].sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best && best.score >= 2) {
    const isVehicleInvoice = best.type === DOC_TYPES.VEHICLE_INVOICE || vehicleInvoiceScore >= 2;
    const documentKind = best.type;
    const requiresVehicleLink = [
      DOC_TYPES.INSURANCE,
      DOC_TYPES.PUC,
      DOC_TYPES.RC,
      DOC_TYPES.WARRANTY,
    ].includes(documentKind);
    return {
      type: best.type === DOC_TYPES.VEHICLE_INVOICE ? DOC_TYPES.BILL : best.type,
      vaultType:
        best.type === DOC_TYPES.VEHICLE_INVOICE
          ? DOC_TYPES.BILL
          : best.type === DOC_TYPES.WARRANTY
            ? 'warranty'
            : best.type,
      label: best.label,
      isVehicleInvoice,
      categoryHint:
        isVehicleInvoice || best.type === DOC_TYPES.RC || requiresVehicleLink
          ? 'Vehicles'
          : null,
      documentKind,
      requiresVehicleLink,
    };
  }

  return {
    type: DOC_TYPES.BILL,
    vaultType: DOC_TYPES.BILL,
    label: 'Purchase Bill / Invoice',
    isVehicleInvoice: false,
    categoryHint: null,
    documentKind: DOC_TYPES.BILL,
    requiresVehicleLink: false,
  };
}

/**
 * Map classifier vault type → DocumentVaultService type allowlist.
 */
export function toVaultDocumentType(classification) {
  const t = classification?.vaultType || classification?.type || DOC_TYPES.BILL;
  if (t === DOC_TYPES.VEHICLE_INVOICE) return DOC_TYPES.BILL;
  if (t === 'warranty' || t === DOC_TYPES.WARRANTY) return 'warranty';
  if ([DOC_TYPES.INSURANCE, DOC_TYPES.PUC, DOC_TYPES.RC, DOC_TYPES.BILL].includes(t)) return t;
  return DOC_TYPES.BILL;
}

/**
 * Resolve Storage/Firestore document folder type + label from a scan/save form.
 * Keeps Insurance / PUC / Warranty / Vehicle Invoice in distinct vault categories.
 */
export function resolveVaultDocumentMeta(form = {}) {
  const t = String(
    form.scanDocumentType || form.documentType || form.documentKind || DOC_TYPES.BILL,
  ).toLowerCase();
  const isVehicle = Boolean(form.isVehicleInvoice) || t === DOC_TYPES.VEHICLE_INVOICE;

  if (t === DOC_TYPES.RC) return { type: DOC_TYPES.RC, label: 'RC Book' };
  if (t === DOC_TYPES.PUC) return { type: DOC_TYPES.PUC, label: 'PUC Certificate' };
  if (t === DOC_TYPES.INSURANCE) {
    return { type: DOC_TYPES.INSURANCE, label: 'Insurance Policy' };
  }
  if (t === DOC_TYPES.WARRANTY || t === 'warranty') {
    return { type: 'warranty', label: 'Warranty Certificate' };
  }
  if (isVehicle) {
    return {
      type: DOC_TYPES.BILL,
      label: form.documentLabel || 'Vehicle Invoice',
    };
  }
  return {
    type: DOC_TYPES.BILL,
    label: form.documentLabel || 'Purchase Bill / Invoice',
  };
}

function score(text, patterns) {
  let n = 0;
  for (const re of patterns) {
    if (re.test(text)) n += 1;
  }
  return n;
}

/**
 * Prefer Gemini classification when available (authoritative for vault slot).
 * @param {string} geminiDocumentType e.g. VEHICLE_RC
 */
export function vaultTypeFromGeminiDocumentType(geminiDocumentType) {
  const t = String(geminiDocumentType || '')
    .trim()
    .toUpperCase();
  if (t === 'VEHICLE_RC') return DOC_TYPES.RC;
  if (t === 'VEHICLE_INSURANCE') return DOC_TYPES.INSURANCE;
  if (t === 'VEHICLE_PUC') return DOC_TYPES.PUC;
  if (t === 'PURCHASE_INVOICE') return DOC_TYPES.BILL;
  if (t === 'OTHER') return DOC_TYPES.OTHER;
  return null;
}

/**
 * Merge heuristic classifier with optional Gemini documentType.
 */
export function resolveDocumentClassification(blob = '', hints = {}) {
  const geminiVault = vaultTypeFromGeminiDocumentType(
    hints.geminiDocumentType || hints.documentTypeGemini,
  );
  if (geminiVault) {
    const labelMap = {
      [DOC_TYPES.RC]: 'RC Book',
      [DOC_TYPES.INSURANCE]: 'Insurance Policy',
      [DOC_TYPES.PUC]: 'PUC Certificate',
      [DOC_TYPES.BILL]: 'Purchase Bill / Invoice',
      [DOC_TYPES.OTHER]: 'Other Document',
    };
    const requiresVehicleLink = [DOC_TYPES.RC, DOC_TYPES.INSURANCE, DOC_TYPES.PUC].includes(
      geminiVault,
    );
    return {
      type: geminiVault === DOC_TYPES.OTHER ? DOC_TYPES.BILL : geminiVault,
      vaultType: geminiVault === DOC_TYPES.OTHER ? DOC_TYPES.OTHER : geminiVault,
      label: labelMap[geminiVault] || 'Document',
      isVehicleInvoice: false,
      categoryHint: requiresVehicleLink || geminiVault === DOC_TYPES.RC ? 'Vehicles' : null,
      documentKind: geminiVault,
      requiresVehicleLink,
      source: 'gemini',
    };
  }
  return { ...classifyDocumentType(blob, hints), source: 'heuristic' };
}

export default classifyDocumentType;
