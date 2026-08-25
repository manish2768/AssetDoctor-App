/**
 * Electricity bill OCR extraction — Indian DISCOM / provider-agnostic.
 * Label-based only; never invents missing fields.
 * Does not alter service / insurance extractors.
 */

import { toDocTypeV2, DOC_TYPE_V2 } from './documentIntelligenceTypes';

const UI_PLACEHOLDER_RE =
  /^(?:invoice\s*\/\s*policy\s*no\.?|leave\s*blank|enter\s*(?:manually|number)|not\s*(?:available|detected|found)|yyyy-mm-dd|unknown|n\/?a|nil|null|undefined|dummy|test|—|--|\.\.\.|placeholder)$/i;

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

function isJunk(value) {
  const v = cleanLine(value);
  if (!v || v.length < 2) return true;
  return UI_PLACEHOLDER_RE.test(v);
}

function fieldResult(value, confidence, source, evidence) {
  return {
    value: value == null || value === '' ? null : value,
    confidence: confidence == null ? 0 : confidence,
    source: source || null,
    evidence: evidence || null,
  };
}

function parseMoneyLoose(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  if (/^\d{10,}$/.test(cleaned.replace(/\./g, ''))) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 0 && n <= 0.009) return null;
  return n;
}

function parseNumberLoose(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const MONTH_INDEX = Object.freeze({
  JAN: '01',
  JANUARY: '01',
  FEB: '02',
  FEBRUARY: '02',
  MAR: '03',
  MARCH: '03',
  APR: '04',
  APRIL: '04',
  MAY: '05',
  JUN: '06',
  JUNE: '06',
  JUL: '07',
  JULY: '07',
  AUG: '08',
  AUGUST: '08',
  SEP: '09',
  SEPT: '09',
  SEPTEMBER: '09',
  OCT: '10',
  OCTOBER: '10',
  NOV: '11',
  NOVEMBER: '11',
  DEC: '12',
  DECEMBER: '12',
});

function isoIfValid(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateToken(raw) {
  const s = cleanLine(raw);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoIfValid(iso[1], iso[2], iso[3]);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    return isoIfValid(y, dmy[2], dmy[1]);
  }
  const mon = s.match(
    /^(\d{1,2})[\s\-\/.]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-\/.]+(\d{2,4})$/i,
  );
  if (mon) {
    let y = Number(mon[3]);
    if (y < 100) y += 2000;
    const m = MONTH_INDEX[mon[2].slice(0, 3).toUpperCase()] || MONTH_INDEX[mon[2].toUpperCase()];
    return m ? isoIfValid(y, m, mon[1]) : null;
  }
  return null;
}

function labeledValue(blob, labels, { maxLen = 80, numberOnly = false, money = false } = {}) {
  const text = String(blob || '');
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const labelRe = new RegExp(
    `^(?:${labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*[:\\-#]?\\s*(.*)$`,
    'i',
  );
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(labelRe);
    if (!m) continue;
    let val = cleanLine(m[1]);
    if (!val && lines[i + 1]) val = cleanLine(lines[i + 1]);
    if (isJunk(val)) continue;
    if (money) {
      const n = parseMoneyLoose(val);
      if (n == null) continue;
      return fieldResult(n, 0.82, 'label', lines[i]);
    }
    if (numberOnly) {
      const n = parseNumberLoose(val);
      if (n == null) continue;
      return fieldResult(n, 0.8, 'label', lines[i]);
    }
    if (val.length > maxLen) val = val.slice(0, maxLen).trim();
    return fieldResult(val, 0.78, 'label', lines[i]);
  }

  // Inline same-line patterns across full blob
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-#]?\\s*([^\\n]{2,${maxLen}})`,
      'i',
    );
    const m = text.match(re);
    if (!m?.[1]) continue;
    let val = cleanLine(m[1].split(/\s{2,}| {2,}/)[0]);
    if (isJunk(val)) continue;
    if (money) {
      const n = parseMoneyLoose(val);
      if (n == null) continue;
      return fieldResult(n, 0.75, 'inline', m[0].slice(0, 80));
    }
    if (numberOnly) {
      const n = parseNumberLoose(val);
      if (n == null) continue;
      return fieldResult(n, 0.72, 'inline', m[0].slice(0, 80));
    }
    return fieldResult(val.slice(0, maxLen), 0.7, 'inline', m[0].slice(0, 80));
  }
  return fieldResult(null, 0, null, null);
}

function labeledDate(blob, labels) {
  const text = String(blob || '');
  for (const label of labels) {
    const re = new RegExp(
      `${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-#]?\\s*([0-9]{1,2}[\\/\\-.][0-9]{1,2}[\\/\\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|\\d{1,2}\\s*[A-Za-z]{3,9}\\s*\\d{2,4})`,
      'i',
    );
    const m = text.match(re);
    if (!m?.[1]) continue;
    const iso = parseDateToken(m[1]);
    if (iso) return fieldResult(iso, 0.85, 'label_date', m[0].slice(0, 60));
  }
  return fieldResult(null, 0, null, null);
}

const DISCOM_HINTS =
  /\b(?:bescom|mescom|hescom|gescom|cesc|tneb|tangedco|tnseb|apedcl|tsspdcl|tgnpdcl|mseb|mahadiscom|adani\s*electricity|reliance\s*energy|tata\s*power|bses|bypl|brpl|npcl|uppcl|pvvnl|mvvnl|dvvnl|puvvnl|pspcl|uhbvn|dhbvn|kseb|ksebl|wbse|wbseb|jvvnl|avvnl|jdvvnl|torrent\s*power|mgvcl|ugvcl|pgvcl|dgvcl|apdcl|mspdcl|mspdcl|discom|electricity\s*board|power\s*distribution)\b/i;

/**
 * Strong electricity-bill signals (must not steal service/insurance docs).
 */
export function scoreElectricityBillSignals(blob = '') {
  const t = String(blob || '');
  let score = 0;
  const reasons = [];
  const add = (re, w, label) => {
    if (re.test(t)) {
      score += w;
      reasons.push(label);
    }
  };
  add(/\belectricity\s*bill\b/i, 2.5, 'electricity_bill');
  add(/\bpower\s*bill\b/i, 2, 'power_bill');
  add(/\benergy\s*bill\b/i, 1.5, 'energy_bill');
  add(/\bconsumer\s*(?:no|number|id)\b/i, 1.2, 'consumer_no');
  add(/\bmeter\s*(?:no|number|id)\b/i, 1, 'meter_no');
  add(/\bbilling\s*period\b|\bbill\s*period\b|\bperiod\s*from\b/i, 1.2, 'billing_period');
  add(/\bprevious\s*reading\b|\bcurr(?:ent)?\s*reading\b/i, 1.5, 'readings');
  add(/\bunits\s*consumed\b|\bkwh\s*consumed\b|\btotal\s*units\b/i, 1.5, 'units');
  add(/\benergy\s*charges?\b|\bfixed\s*charges?\b|\belectricity\s*duty\b/i, 1.2, 'charges');
  add(/\bconnected\s*load\b|\bsanctioned\s*load\b|\bcontract\s*demand\b/i, 1, 'load');
  add(DISCOM_HINTS, 1.5, 'discom');
  // Negative: workshop / insurance
  if (/\bjob\s*card\b|\blabou?r\s*charges?\b|\bodometer\b/i.test(t)) score -= 3;
  if (/\binsurance\s*polic|\bidv\b|\bpremium\b/i.test(t) && !/\belectricity\b/i.test(t)) {
    score -= 2.5;
  }
  return { score, reasons };
}

export function isElectricityBillOcrDocument(data = {}, blob = '') {
  const type = String(
    data.documentType || data.scanDocumentType || data.documentKind || data.primaryDocumentType || '',
  ).toLowerCase();
  if (
    type.includes('electricity') ||
    type === 'utility_bill' ||
    data.categoryId === 'electricity_bill'
  ) {
    return true;
  }
  const v2 = toDocTypeV2(type, { blob });
  if (v2 === DOC_TYPE_V2.ELECTRICITY_BILL) return true;
  return scoreElectricityBillSignals(blob).score >= 3.5;
}

/**
 * Extract electricity bill fields — null when not found.
 */
export function extractElectricityBillFields(blob = '') {
  const text = String(blob || '');
  if (!text.trim()) {
    return emptyElectricityBill();
  }

  const consumerName = labeledValue(text, [
    'consumer name',
    'customer name',
    'name of consumer',
    'account holder',
    'name',
  ], { maxLen: 60 });
  // Avoid grabbing "Name of Discom" into consumer name when weak
  if (
    consumerName.value &&
    /\b(?:discom|board|limited|ltd|electricity|power)\b/i.test(consumerName.value)
  ) {
    consumerName.value = null;
    consumerName.confidence = 0;
  }

  const consumerNumber = labeledValue(text, [
    'consumer number',
    'consumer no',
    'consumer id',
    'account number',
    'account no',
    'ca number',
    'ca no',
    'service connection number',
    'connection number',
    'k number',
    'k. no',
  ], { maxLen: 32 });

  const meterNumber = labeledValue(text, [
    'meter number',
    'meter no',
    'meter id',
    'meter serial',
  ], { maxLen: 32 });

  const billNumber = labeledValue(text, [
    'bill number',
    'bill no',
    'bill id',
    'invoice number',
    'invoice no',
  ], { maxLen: 32 });

  const billingPeriod =
    labeledValue(text, [
      'billing period',
      'bill period',
      'period of bill',
      'consumption period',
      'bill for the month',
      'billing month',
    ], { maxLen: 48 }) || fieldResult(null, 0, null, null);

  // Period from–to
  if (!billingPeriod.value) {
    const range = text.match(
      /(?:period|from)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*(?:to|-|–)\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    );
    if (range) {
      billingPeriod.value = `${cleanLine(range[1])} - ${cleanLine(range[2])}`;
      billingPeriod.confidence = 0.8;
      billingPeriod.source = 'period_range';
      billingPeriod.evidence = range[0].slice(0, 60);
    }
  }

  const previousReading = labeledValue(
    text,
    ['previous reading', 'prev reading', 'old reading', 'opening reading', 'last reading'],
    { numberOnly: true },
  );
  const currentReading = labeledValue(
    text,
    ['current reading', 'present reading', 'closing reading', 'new reading', 'curr reading'],
    { numberOnly: true },
  );

  const unitsConsumed = labeledValue(
    text,
    [
      'units consumed',
      'total units',
      'units',
      'kwh consumed',
      'consumption',
      'energy consumed',
      'billed units',
      'net units',
    ],
    { numberOnly: true },
  );

  const demand = labeledValue(
    text,
    [
      'contract demand',
      'sanctioned load',
      'connected load',
      'recorded demand',
      'maximum demand',
      'demand',
    ],
    { maxLen: 24 },
  );

  const tariff = labeledValue(
    text,
    ['tariff', 'rate per unit', 'unit rate', 'energy rate', '₹/kwh', 'rs/kwh', 'rs per unit'],
    { numberOnly: true },
  );

  const energyCharges = labeledValue(
    text,
    ['energy charges', 'energy charge', 'electricity charges', 'consumption charges'],
    { money: true },
  );
  const fixedCharges = labeledValue(
    text,
    ['fixed charges', 'fixed charge', 'monthly fixed', 'meter rent', 'service charge'],
    { money: true },
  );
  const taxes = labeledValue(
    text,
    [
      'electricity duty',
      'tax',
      'taxes',
      'gst',
      'duty',
      'municipal tax',
      'fuel surcharge',
      'fppas',
    ],
    { money: true },
  );
  const totalAmount = labeledValue(
    text,
    [
      'total amount',
      'amount payable',
      'net payable',
      'grand total',
      'bill amount',
      'total due',
      'current bill amount',
      'amount due',
    ],
    { money: true },
  );

  const dueDate = labeledDate(text, [
    'due date',
    'pay by',
    'payment due date',
    'last date of payment',
    'due by',
  ]);

  const provider = labeledValue(
    text,
    [
      'discom',
      'distribution company',
      'electricity board',
      'power company',
      'utility',
      'issued by',
    ],
    { maxLen: 48 },
  );
  let providerValue = provider.value;
  let providerConf = provider.confidence;
  if (!providerValue) {
    const discomMatch = text.match(DISCOM_HINTS);
    if (discomMatch) {
      providerValue = cleanLine(discomMatch[0]);
      providerConf = 0.7;
    }
  }

  const confidence = {
    consumerName: consumerName.confidence,
    consumerNumber: consumerNumber.confidence,
    meterNumber: meterNumber.confidence,
    billNumber: billNumber.confidence,
    billingPeriod: billingPeriod.confidence,
    previousReading: previousReading.confidence,
    currentReading: currentReading.confidence,
    unitsConsumed: unitsConsumed.confidence,
    demand: demand.confidence,
    tariff: tariff.confidence,
    energyCharges: energyCharges.confidence,
    fixedCharges: fixedCharges.confidence,
    taxes: taxes.confidence,
    totalAmount: totalAmount.confidence,
    dueDate: dueDate.confidence,
    provider: providerConf,
  };

  return {
    consumerName: consumerName.value,
    consumerNumber: consumerNumber.value,
    meterNumber: meterNumber.value,
    billNumber: billNumber.value,
    billingPeriod: billingPeriod.value,
    previousReading: previousReading.value,
    currentReading: currentReading.value,
    unitsConsumed: unitsConsumed.value,
    unitsKwh: unitsConsumed.value,
    demand: demand.value,
    tariff: tariff.value,
    energyCharges: energyCharges.value,
    fixedCharges: fixedCharges.value,
    taxes: taxes.value,
    totalAmount: totalAmount.value,
    dueDate: dueDate.value,
    provider: providerValue,
    discom: providerValue,
    confidence,
    evidence: {
      consumerNumber: consumerNumber.evidence,
      meterNumber: meterNumber.evidence,
      unitsConsumed: unitsConsumed.evidence,
      totalAmount: totalAmount.evidence,
      dueDate: dueDate.evidence,
    },
  };
}

function emptyElectricityBill() {
  return {
    consumerName: null,
    consumerNumber: null,
    meterNumber: null,
    billNumber: null,
    billingPeriod: null,
    previousReading: null,
    currentReading: null,
    unitsConsumed: null,
    unitsKwh: null,
    demand: null,
    tariff: null,
    energyCharges: null,
    fixedCharges: null,
    taxes: null,
    totalAmount: null,
    dueDate: null,
    provider: null,
    discom: null,
    confidence: {},
    evidence: {},
  };
}

/**
 * Merge extracted electricity bill into invoice/review payload.
 * Never overwrites with invented values; only sets when OCR found a value.
 */
export function applyElectricityBillOcrToInvoice(data = {}, blob = '') {
  const extracted = extractElectricityBillFields(blob);
  data.canonicalElectricityBill = {
    consumer: {
      name: extracted.consumerName,
      number: extracted.consumerNumber,
    },
    meterNumber: extracted.meterNumber,
    billNumber: extracted.billNumber,
    billingPeriod: extracted.billingPeriod,
    previousReading: extracted.previousReading,
    currentReading: extracted.currentReading,
    unitsConsumed: extracted.unitsConsumed,
    unitsKwh: extracted.unitsKwh,
    demand: extracted.demand,
    tariff: extracted.tariff,
    energyCharges: extracted.energyCharges,
    fixedCharges: extracted.fixedCharges,
    taxes: extracted.taxes,
    totalAmount: extracted.totalAmount,
    dueDate: extracted.dueDate,
    provider: extracted.provider,
    discom: extracted.discom,
    confidence: extracted.confidence,
  };

  data.documentType = data.documentType || 'electricity_bill';
  data.documentKind = 'electricity_bill';
  data.scanDocumentType = 'electricity_bill';
  data.documentLabel = data.documentLabel || 'Electricity Bill';
  data.categoryId = data.categoryId || 'electricity_bill';
  data.isElectricityBill = true;

  if (extracted.consumerName) {
    data.customerName = data.customerName || extracted.consumerName;
    data.buyerName = data.buyerName || extracted.consumerName;
    data.assetName = data.assetName || `Electricity · ${extracted.consumerName}`;
  } else if (!data.assetName) {
    data.assetName = extracted.provider
      ? `Electricity · ${extracted.provider}`
      : 'Electricity Bill';
  }

  if (extracted.consumerNumber) data.consumerNumber = extracted.consumerNumber;
  if (extracted.meterNumber) data.meterNumber = extracted.meterNumber;
  if (extracted.billNumber) {
    data.billNumber = extracted.billNumber;
    data.invoiceNumber = data.invoiceNumber || extracted.billNumber;
  }
  if (extracted.billingPeriod) data.billingPeriod = extracted.billingPeriod;
  if (extracted.previousReading != null) data.previousReading = extracted.previousReading;
  if (extracted.currentReading != null) data.currentReading = extracted.currentReading;
  if (extracted.unitsConsumed != null) {
    data.unitsConsumed = extracted.unitsConsumed;
    data.unitsKwh = extracted.unitsConsumed;
  }
  if (extracted.demand) data.demand = extracted.demand;
  if (extracted.tariff != null) {
    data.tariff = extracted.tariff;
    data.electricityTariff = extracted.tariff;
  }
  if (extracted.energyCharges != null) data.energyCharges = extracted.energyCharges;
  if (extracted.fixedCharges != null) data.fixedCharges = extracted.fixedCharges;
  if (extracted.taxes != null) data.taxes = extracted.taxes;
  if (extracted.totalAmount != null) {
    data.totalAmount = extracted.totalAmount;
    data.value = extracted.totalAmount;
  }
  if (extracted.dueDate) data.dueDate = extracted.dueDate;
  if (extracted.provider) {
    data.provider = extracted.provider;
    data.discom = extracted.provider;
    data.shopName = data.shopName || extracted.provider;
  }

  data.electricityBillNeedsVerify = Object.values(extracted.confidence || {}).some(
    (c) => c > 0 && c < 0.75,
  );

  return data;
}

export default {
  extractElectricityBillFields,
  applyElectricityBillOcrToInvoice,
  isElectricityBillOcrDocument,
  scoreElectricityBillSignals,
};
