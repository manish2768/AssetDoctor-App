/**
 * Classify scanned document type from OCR text / invoice fields.
 * Keeps insurance / PUC / warranty / purchase bill semantics separate.
 */

export const DOC_TYPES = Object.freeze({
  BILL: 'bill',
  SALES_INVOICE: 'sales_invoice',
  SERVICE_INVOICE: 'service_invoice',
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

  const serviceInvoiceScore = score(text, [
    /\bservice\s*invoice\b/,
    /\bjob\s*card\b/,
    /\bworkshop\b/,
    /\blabou?r\s*(?:charges|cost)?\b/,
    /\bodometer\b/,
    /\bkm\s*(?:reading|run|covered)?\b/,
    /\bperiodic\s*service\b/,
    /\bparts\s*(?:replaced|used)\b/,
    /\bservice\s*(?:centre|center|advisor)\b/,
  ]);

  const salesInvoiceScore = score(text, [
    /\btax\s*invoice\b/,
    /\bsales\s*invoice\b/,
    /\bbill\s*of\s*supply\b/,
    /\bpurchase\s*invoice\b/,
    /\bcash\s*memo\b/,
    /\bretail\s*invoice\b/,
  ]);

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
    {
      type: DOC_TYPES.SERVICE_INVOICE,
      score: serviceInvoiceScore,
      label: 'Service Invoice',
    },
    {
      type: DOC_TYPES.SALES_INVOICE,
      score: salesInvoiceScore,
      label: 'Sales Invoice',
    },
  ].sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best && best.score >= 2) {
    const isVehicleInvoice =
      best.type === DOC_TYPES.VEHICLE_INVOICE || vehicleInvoiceScore >= 2;
    const documentKind = best.type;
    const requiresVehicleLink = [
      DOC_TYPES.INSURANCE,
      DOC_TYPES.PUC,
      DOC_TYPES.RC,
      DOC_TYPES.WARRANTY,
      DOC_TYPES.SERVICE_INVOICE,
    ].includes(documentKind);

    let vaultType = best.type;
    let type = best.type;
    if (
      best.type === DOC_TYPES.VEHICLE_INVOICE ||
      best.type === DOC_TYPES.SALES_INVOICE ||
      best.type === DOC_TYPES.SERVICE_INVOICE
    ) {
      vaultType = DOC_TYPES.BILL;
      type = DOC_TYPES.BILL;
    } else if (best.type === DOC_TYPES.WARRANTY) {
      vaultType = 'warranty';
    }

    return {
      type,
      vaultType,
      label: best.label,
      isVehicleInvoice,
      categoryHint:
        isVehicleInvoice || best.type === DOC_TYPES.RC || requiresVehicleLink
          ? 'Vehicles'
          : null,
      documentKind,
      requiresVehicleLink,
      isServiceInvoice: best.type === DOC_TYPES.SERVICE_INVOICE,
      isSalesInvoice:
        best.type === DOC_TYPES.SALES_INVOICE || best.type === DOC_TYPES.VEHICLE_INVOICE,
    };
  }

  return {
    type: DOC_TYPES.BILL,
    vaultType: DOC_TYPES.BILL,
    label: 'Sales Invoice',
    isVehicleInvoice: false,
    categoryHint: null,
    documentKind: DOC_TYPES.SALES_INVOICE,
    requiresVehicleLink: false,
    isServiceInvoice: false,
    isSalesInvoice: true,
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
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (t === 'VEHICLE_RC' || t === 'REGISTRATION_CERTIFICATE') return DOC_TYPES.RC;
  if (t === 'VEHICLE_INSURANCE' || t === 'INSURANCE_POLICY') return DOC_TYPES.INSURANCE;
  if (t === 'VEHICLE_PUC' || t === 'PUC_CERTIFICATE') return DOC_TYPES.PUC;
  if (t === 'SERVICE_INVOICE' || t === 'JOB_CARD') return DOC_TYPES.SERVICE_INVOICE;
  if (t === 'SALES_INVOICE') return DOC_TYPES.SALES_INVOICE;
  if (t === 'PURCHASE_INVOICE' || t === 'TAX_INVOICE') return DOC_TYPES.SALES_INVOICE;
  if (t === 'OTHER' || t === 'OTHER_RECEIPT') return DOC_TYPES.OTHER;
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
      [DOC_TYPES.BILL]: 'Sales Invoice',
      [DOC_TYPES.SALES_INVOICE]: 'Sales Invoice',
      [DOC_TYPES.SERVICE_INVOICE]: 'Service Invoice',
      [DOC_TYPES.OTHER]: 'Other Document',
    };
    const requiresVehicleLink = [
      DOC_TYPES.RC,
      DOC_TYPES.INSURANCE,
      DOC_TYPES.PUC,
      DOC_TYPES.SERVICE_INVOICE,
    ].includes(geminiVault);
    const vaultAsBill = [
      DOC_TYPES.SALES_INVOICE,
      DOC_TYPES.SERVICE_INVOICE,
      DOC_TYPES.OTHER,
    ].includes(geminiVault);
    return {
      type: vaultAsBill ? DOC_TYPES.BILL : geminiVault,
      vaultType: vaultAsBill
        ? geminiVault === DOC_TYPES.OTHER
          ? DOC_TYPES.OTHER
          : DOC_TYPES.BILL
        : geminiVault,
      label: labelMap[geminiVault] || 'Document',
      isVehicleInvoice: false,
      categoryHint: requiresVehicleLink || geminiVault === DOC_TYPES.RC ? 'Vehicles' : null,
      documentKind: geminiVault,
      requiresVehicleLink,
      isServiceInvoice: geminiVault === DOC_TYPES.SERVICE_INVOICE,
      isSalesInvoice: geminiVault === DOC_TYPES.SALES_INVOICE || geminiVault === DOC_TYPES.BILL,
      source: 'gemini',
    };
  }
  return { ...classifyDocumentType(blob, hints), source: 'heuristic' };
}

export default classifyDocumentType;
