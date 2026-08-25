/**
 * Document Classification Engine — deterministic + confidence-weighted.
 * Header / structure / fields / issuer fingerprints → primary documentType.
 *
 * Soft insurance keywords NEVER override strong SERVICE_BILL structure.
 */

import { DOC_TYPE_V2, DOC_TYPE_LABELS } from './documentIntelligenceTypes';
import { scoreServiceBillSignals, hasExclusiveInsuranceSignals } from './documentTypeArbitration';

/** Primary types exposed to product / Review */
export const PRIMARY_DOC_TYPES = Object.freeze({
  SERVICE_BILL: 'SERVICE_BILL',
  SALES_INVOICE: 'SALES_INVOICE',
  INSURANCE: 'INSURANCE',
  RC: 'RC',
  PUC: 'PUC',
  WARRANTY: 'WARRANTY',
  ELECTRICITY_BILL: 'ELECTRICITY_BILL',
  OTHER_DOCUMENT: 'OTHER_DOCUMENT',
});

const WEIGHTS = Object.freeze({
  header: 0.4,
  structural: 0.3,
  fields: 0.2,
  issuer: 0.1,
});

/** Common OCR glyph confusion → normalize before matching */
export function normalizeOcrGlyphs(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[|!¡]/g, 'i')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\n]+/g, ' ');
}

/**
 * Fuzzy header match: "Servlce lnvoice" ≈ service invoice.
 * Allows 1–2 character edits inside key tokens.
 */
export function fuzzyContains(haystack, needle) {
  const h = normalizeOcrGlyphs(haystack).replace(/0/g, 'o');
  const n = normalizeOcrGlyphs(needle).replace(/0/g, 'o');
  if (!n) return false;
  if (h.includes(n)) return true;
  // Token-wise: allow l/i/1 swaps already normalized; also regex with optional chars
  const pattern = n
    .split(/\s+/)
    .map((tok) =>
      tok
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/i/g, '[il1]')
        .replace(/o/g, '[o0]')
        .replace(/s/g, '[s5]')
        .replace(/c/g, '[c()]'),
    )
    .join('\\s*');
  try {
    return new RegExp(pattern, 'i').test(h);
  } catch {
    return false;
  }
}

function headerRegion(text = '') {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const top = lines.slice(0, Math.max(12, Math.ceil(lines.length * 0.28))).join('\n');
  return top || raw.slice(0, Math.min(800, raw.length));
}

const HEADER_SIGNALS = Object.freeze({
  SERVICE_BILL: [
    'service invoice',
    'service bill',
    'job card',
    'repair order',
    'work order',
    'service order',
    'job sheet',
    'repair invoice',
    'workshop invoice',
  ],
  SALES_INVOICE: [
    'sales invoice',
    'sale invoice',
    'tax invoice',
    'retail invoice',
    'cash memo',
    'bill of supply',
    'purchase invoice',
  ],
  INSURANCE: [
    'insurance policy',
    'motor insurance',
    'policy schedule',
    'certificate of insurance',
    'policy document',
    'own damage',
    'third party insurance',
  ],
  RC: [
    'registration certificate',
    'certificate of registration',
    'registering authority',
  ],
  PUC: [
    'pollution under control',
    'emission test',
    'p.u.c.',
  ],
  WARRANTY: ['warranty card', 'warranty certificate', 'guarantee card'],
  ELECTRICITY_BILL: [
    'electricity bill',
    'power bill',
    'energy bill',
    'electricity account',
    'consumer copy',
  ],
});

function scoreHeader(text) {
  const header = headerRegion(text);
  const scores = {};
  const signals = {};
  for (const [type, phrases] of Object.entries(HEADER_SIGNALS)) {
    let s = 0;
    const hits = [];
    for (const p of phrases) {
      if (fuzzyContains(header, p)) {
        s += p.split(/\s+/).length >= 2 ? 1.0 : 0.6;
        hits.push(p);
      }
    }
    // Lone "RC" / "PUC" only in short header lines
    if (type === 'RC' && /\bR\.?\s*C\.?\b/.test(header) && header.length < 400) {
      s += 0.5;
      hits.push('RC');
    }
    if (type === 'PUC' && /\bP\.?\s*U\.?\s*C\.?\b/i.test(header)) {
      s += 0.8;
      hits.push('PUC');
    }
    scores[type] = Math.min(1, s / 2);
    if (hits.length) signals[type] = hits;
  }
  return { scores, signals, region: header.slice(0, 200) };
}

function scoreStructural(text) {
  const t = String(text || '');
  const scores = {};
  const signals = {};

  const service = scoreServiceBillSignals(t);
  scores.SERVICE_BILL = Math.min(1, service.score / 6);
  if (service.reasons.length) signals.SERVICE_BILL = service.reasons;

  const salesHits = [];
  let sales = 0;
  const addSales = (re, label, w = 0.2) => {
    if (re.test(t)) {
      sales += w;
      salesHits.push(label);
    }
  };
  addSales(/\bproduct\b|\bdescription\s*of\s*goods\b/i, 'product', 0.15);
  addSales(/\bqty\b|\bquantity\b/i, 'quantity', 0.15);
  addSales(/\bunit\s*price\b|\brate\b/i, 'unit_price', 0.1);
  addSales(/\bhsn\b/i, 'hsn', 0.15);
  addSales(/\btaxable\s*value\b/i, 'taxable_value', 0.2);
  addSales(/\bgst\b|\bcgst\b|\bsgst\b|\bigst\b/i, 'gst', 0.15);
  addSales(/\bdiscount\b/i, 'discount', 0.1);
  addSales(/\btotal\s*invoice\s*value\b|\bgrand\s*total\b/i, 'total', 0.2);
  // Tax invoice alone is weak if service structure is strong
  if (service.score < 3) {
    addSales(/\btax\s*invoice\b/i, 'tax_invoice', 0.25);
  }
  scores.SALES_INVOICE = Math.min(1, sales);
  if (salesHits.length) signals.SALES_INVOICE = salesHits;

  const insHits = [];
  let ins = 0;
  if (hasExclusiveInsuranceSignals(t)) {
    ins += 0.7;
    insHits.push('exclusive_insurance');
  }
  if (/\bpolicy\s*(?:no|number)\b/i.test(t) && /\bpremium\b/i.test(t)) {
    ins += 0.25;
    insHits.push('policy+premium');
  }
  if (/\bidv\b/i.test(t) && /\bpolicy\b/i.test(t)) {
    ins += 0.25;
    insHits.push('idv+policy');
  }
  if (/\binsurer\b|\binsurance\s*company\b/i.test(t)) {
    ins += 0.15;
    insHits.push('insurer');
  }
  // Soft lone keywords: very weak structural weight
  if (/\bthird[\s\-]?party\b/i.test(t) && !hasExclusiveInsuranceSignals(t)) {
    ins += 0.05;
    insHits.push('soft:third_party');
  }
  if (/\bpremium\b/i.test(t) && service.score < 2) {
    ins += 0.08;
    insHits.push('soft:premium');
  }
  scores.INSURANCE = Math.min(1, ins);
  if (insHits.length) signals.INSURANCE = insHits;

  let rc = 0;
  const rcHits = [];
  if (/\bcertificate\s*of\s*registration\b|\bregistration\s*certificate\b/i.test(t)) {
    rc += 0.5;
    rcHits.push('rc_title');
  }
  if (/\bchassis\s*(?:no|number)\b/i.test(t) && /\bengine\s*(?:no|number)\b/i.test(t) && /\brto\b/i.test(t)) {
    rc += 0.4;
    rcHits.push('chassis+engine+rto');
  }
  scores.RC = Math.min(1, rc);
  if (rcHits.length) signals.RC = rcHits;

  let puc = 0;
  const pucHits = [];
  if (/\bpollution\s*under\s*control\b|\bemission\s*test\b/i.test(t)) {
    puc += 0.6;
    pucHits.push('puc_title');
  }
  if (/\bpuc\b/i.test(t) && /\bvalid\b|\bexpiry\b/i.test(t)) {
    puc += 0.3;
    pucHits.push('puc+validity');
  }
  scores.PUC = Math.min(1, puc);
  if (pucHits.length) signals.PUC = pucHits;

  let war = 0;
  if (/\bwarranty\s*(?:card|certificate|terms)\b/i.test(t)) war += 0.6;
  scores.WARRANTY = Math.min(1, war);

  let elec = 0;
  const elecHits = [];
  if (/\belectricity\s*bill\b|\bpower\s*bill\b/i.test(t)) {
    elec += 0.7;
    elecHits.push('bill_title');
  }
  if (/\bconsumer\s*(?:no|number|id)\b/i.test(t) && /\bmeter\s*(?:no|number)\b/i.test(t)) {
    elec += 0.5;
    elecHits.push('consumer+meter');
  }
  if (/\bunits\s*consumed\b|\bprevious\s*reading\b.*\bcurr/i.test(t)) {
    elec += 0.4;
    elecHits.push('units_or_readings');
  }
  if (
    /\b(?:bescom|tangedco|mseb|mahadiscom|bses|tata\s*power|adani\s*electricity|uppcl|kseb)\b/i.test(
      t,
    )
  ) {
    elec += 0.45;
    elecHits.push('discom');
  }
  // Do not score electricity when strong workshop signals present
  if (service.score >= 3) elec = Math.min(elec, 0.15);
  scores.ELECTRICITY_BILL = Math.min(1, elec);
  if (elecHits.length) signals.ELECTRICITY_BILL = elecHits;

  scores.OTHER_DOCUMENT = 0.05;
  return { scores, signals, serviceScore: service.score };
}

function scoreFields(text, hints = {}) {
  const t = String(text || '');
  const scores = {};
  const signals = {};

  const field = (type, cond, label, w = 0.25) => {
    if (!cond) return;
    scores[type] = Math.min(1, (scores[type] || 0) + w);
    if (!signals[type]) signals[type] = [];
    signals[type].push(label);
  };

  field('SERVICE_BILL', /\blabou?r\b/i.test(t), 'labour', 0.3);
  field('SERVICE_BILL', /\bodometer\b|\bodo\b|\bkms?\s*(?:reading|:)/i.test(t), 'odometer', 0.25);
  field('SERVICE_BILL', /\bjob\s*card\b/i.test(t), 'job_card', 0.35);
  field('SERVICE_BILL', /\bservice\s*advisor\b/i.test(t), 'advisor', 0.2);
  field('SERVICE_BILL', Boolean(hints.odometerKm || hints.labourCost), 'hint_service', 0.2);

  field('SALES_INVOICE', /\bhsn\b/i.test(t), 'hsn', 0.25);
  field('SALES_INVOICE', /\binvoice\s*(?:no|number)\b/i.test(t), 'invoice_no', 0.2);
  field('SALES_INVOICE', Boolean(hints.totalAmount && hints.items?.length), 'items+total', 0.25);

  field('INSURANCE', Boolean(hints.policyNumber && hints.premium), 'policy+premium_hint', 0.4);
  field('INSURANCE', Boolean(hints.idv), 'idv_hint', 0.3);
  field('INSURANCE', /\bsum\s*insured\b/i.test(t), 'sum_insured', 0.25);
  field('INSURANCE', /\bpolicy\s*period\b|\bperiod\s*of\s*insurance\b/i.test(t), 'policy_period', 0.35);

  field('RC', /\bform\s*23\b|\bfitness\b/i.test(t), 'rc_form', 0.3);
  field('PUC', /\bpuc\s*(?:expiry|valid)/i.test(t), 'puc_expiry', 0.35);
  field('WARRANTY', /\bwarranty\s*(?:upto|expiry|period)\b/i.test(t), 'warranty_date', 0.3);
  field(
    'ELECTRICITY_BILL',
    /\bconsumer\s*(?:no|number)\b/i.test(t) && /\bunits\b|\bkwh\b/i.test(t),
    'consumer+units',
    0.4,
  );
  field('ELECTRICITY_BILL', /\benergy\s*charges?\b/i.test(t), 'energy_charges', 0.3);
  field('ELECTRICITY_BILL', /\bdue\s*date\b/i.test(t) && /\bmeter\b/i.test(t), 'due+meter', 0.25);

  return { scores, signals };
}

/** Lightweight issuer fingerprints (non-sensitive structural aliases) */
const ISSUER_FINGERPRINTS = [
  {
    id: 'tvs_workshop',
    match: /\btvs\b/i,
    documentType: 'SERVICE_BILL',
    boost: 0.35,
    labels: ['job card', 'labour', 'odometer'],
  },
  {
    id: 'raftaar_motors',
    match: /raftaar/i,
    documentType: 'SERVICE_BILL',
    boost: 0.4,
    labels: ['service invoice'],
  },
  {
    id: 'generic_gic',
    match: /\b(?:bajaj\s*allianz|hdfc\s*ergo|icici\s*lombard|new\s*india|oriental\s*insurance|united\s*india|national\s*insurance|tata\s*aig|sbi\s*general)\b/i,
    documentType: 'INSURANCE',
    boost: 0.45,
    labels: ['insurer_brand'],
  },
  {
    id: 'indian_discom',
    match: /\b(?:bescom|mescom|hescom|gescom|tangedco|mseb|mahadiscom|bses|bypl|brpl|tata\s*power|adani\s*electricity|uppcl|pspcl|kseb|torrent\s*power)\b/i,
    documentType: 'ELECTRICITY_BILL',
    boost: 0.5,
    labels: ['discom'],
  },
];

function scoreIssuer(text) {
  const t = String(text || '');
  const scores = {};
  const signals = {};
  for (const fp of ISSUER_FINGERPRINTS) {
    if (fp.match.test(t)) {
      scores[fp.documentType] = Math.min(1, (scores[fp.documentType] || 0) + fp.boost);
      signals[fp.documentType] = [...(signals[fp.documentType] || []), fp.id];
    }
  }
  return { scores, signals };
}

function combineLayer(acc, layer, weight) {
  for (const [type, score] of Object.entries(layer.scores || {})) {
    acc[type] = (acc[type] || 0) + Number(score || 0) * weight;
  }
}

/**
 * @returns {{
 *  documentType: string,
 *  confidence: number,
 *  signals: object,
 *  conflictingSignals: string[],
 *  scores: Record<string, number>,
 *  legacyVaultType: string,
 *  legacyDocumentKind: string,
 *  treatAsService: boolean,
 *  treatAsInsurance: boolean,
 * }}
 */
export function classifyDocumentEngine(blob = '', hints = {}) {
  const text = String(blob || '');
  const header = scoreHeader(text);
  const structural = scoreStructural(text);
  const fields = scoreFields(text, hints);
  const issuer = scoreIssuer(text);

  const combined = {};
  combineLayer(combined, header, WEIGHTS.header);
  combineLayer(combined, structural, WEIGHTS.structural);
  combineLayer(combined, fields, WEIGHTS.fields);
  combineLayer(combined, issuer, WEIGHTS.issuer);

  // Soft insurance veto: workshop structure wins
  const serviceScore = structural.serviceScore || 0;
  const exclusiveIns = hasExclusiveInsuranceSignals(text);
  if (serviceScore >= 2 && !exclusiveIns) {
    combined.SERVICE_BILL = Math.max(combined.SERVICE_BILL || 0, 0.72);
    combined.INSURANCE = Math.min(combined.INSURANCE || 0, 0.25);
  }
  if (serviceScore >= 3 && !exclusiveIns) {
    combined.SERVICE_BILL = Math.max(combined.SERVICE_BILL || 0, 0.88);
    combined.INSURANCE = Math.min(combined.INSURANCE || 0, 0.15);
  }

  const ranked = Object.entries(combined)
    .map(([documentType, score]) => ({ documentType, score }))
    .sort((a, b) => b.score - a.score);

  let best = ranked[0] || { documentType: PRIMARY_DOC_TYPES.OTHER_DOCUMENT, score: 0.2 };
  const second = ranked[1];

  // Prefer SERVICE_BILL over SALES when both tax-invoice-like and workshop signals
  if (
    best.documentType === PRIMARY_DOC_TYPES.SALES_INVOICE &&
    serviceScore >= 3 &&
    !exclusiveIns &&
    (combined.SERVICE_BILL || 0) >= 0.35
  ) {
    best = { documentType: PRIMARY_DOC_TYPES.SERVICE_BILL, score: combined.SERVICE_BILL };
  }

  // Prefer ELECTRICITY_BILL when DISCOM structure beats generic sales (never over service/insurance)
  if (
    (combined.ELECTRICITY_BILL || 0) >= 0.55 &&
    serviceScore < 2 &&
    !exclusiveIns &&
    best.documentType !== PRIMARY_DOC_TYPES.SERVICE_BILL &&
    best.documentType !== PRIMARY_DOC_TYPES.INSURANCE &&
    (combined.ELECTRICITY_BILL || 0) >= (combined.SALES_INVOICE || 0)
  ) {
    best = {
      documentType: PRIMARY_DOC_TYPES.ELECTRICITY_BILL,
      score: combined.ELECTRICITY_BILL,
    };
  }

  const confidence = Math.round(Math.min(0.98, Math.max(0.2, best.score)) * 100) / 100;
  const conflictingSignals = [];
  if (second && second.score >= best.score * 0.75) {
    conflictingSignals.push(`${second.documentType}:${second.score.toFixed(2)}`);
  }
  if ((combined.INSURANCE || 0) > 0.2 && best.documentType === PRIMARY_DOC_TYPES.SERVICE_BILL) {
    conflictingSignals.push('soft_insurance_suppressed');
  }

  const signals = {
    header: header.signals,
    structural: structural.signals,
    fields: fields.signals,
    issuer: issuer.signals,
  };

  const legacy = toLegacyKinds(best.documentType);

  return {
    documentType: best.documentType,
    confidence,
    signals,
    conflictingSignals,
    scores: combined,
    ranked,
    serviceScore,
    exclusiveInsurance: exclusiveIns,
    legacyVaultType: legacy.vaultType,
    legacyDocumentKind: legacy.documentKind,
    label: DOC_TYPE_LABELS[best.documentType] || legacy.label,
    treatAsService: best.documentType === PRIMARY_DOC_TYPES.SERVICE_BILL,
    treatAsInsurance: best.documentType === PRIMARY_DOC_TYPES.INSURANCE,
    treatAsElectricityBill: best.documentType === PRIMARY_DOC_TYPES.ELECTRICITY_BILL,
    v2Type:
      best.documentType === PRIMARY_DOC_TYPES.OTHER_DOCUMENT
        ? DOC_TYPE_V2.OTHER
        : best.documentType,
  };
}

function toLegacyKinds(primary) {
  switch (primary) {
    case PRIMARY_DOC_TYPES.SERVICE_BILL:
      return {
        vaultType: 'service_invoice',
        documentKind: 'service_invoice',
        label: 'Service Bill',
      };
    case PRIMARY_DOC_TYPES.SALES_INVOICE:
      return { vaultType: 'bill', documentKind: 'sales_invoice', label: 'Sales Invoice' };
    case PRIMARY_DOC_TYPES.INSURANCE:
      return { vaultType: 'insurance', documentKind: 'insurance', label: 'Insurance' };
    case PRIMARY_DOC_TYPES.RC:
      return { vaultType: 'rc', documentKind: 'rc', label: 'RC' };
    case PRIMARY_DOC_TYPES.PUC:
      return { vaultType: 'puc', documentKind: 'puc', label: 'PUC' };
    case PRIMARY_DOC_TYPES.WARRANTY:
      return { vaultType: 'warranty', documentKind: 'warranty', label: 'Warranty' };
    case PRIMARY_DOC_TYPES.ELECTRICITY_BILL:
      return {
        vaultType: 'electricity_bill',
        documentKind: 'electricity_bill',
        label: 'Electricity Bill',
      };
    default:
      return { vaultType: 'other', documentKind: 'other', label: 'Other Document' };
  }
}

/** Strip insurance payload fields from a SERVICE_BILL invoice object (mutate). */
export function stripInsuranceFieldsFromInvoice(data = {}) {
  const keys = [
    'policyNumber',
    'policyNo',
    'policyHolder',
    'insurer',
    'insuranceCompany',
    'insuranceStart',
    'insuranceEnd',
    'insuranceExpiry',
    'policyStart',
    'policyEnd',
    'idv',
    'premium',
    'odPremium',
    'tpPremium',
    'ncb',
    'ncbPercent',
    'sumInsured',
    'coverNote',
    'thirdParty',
    'ownDamage',
    'insuranceCanonical',
  ];
  for (const k of keys) {
    if (k in data) data[k] = k === 'insuranceCanonical' ? null : '';
  }
  if (data.premium === '' || data.premium == null) data.premium = null;
  if (data.idv === '' || data.idv == null) data.idv = null;
  return data;
}

export default classifyDocumentEngine;
