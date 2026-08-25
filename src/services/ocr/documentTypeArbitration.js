/**
 * Service Bill vs Insurance arbitration.
 * Soft insurance keywords must NEVER beat workshop/service structure.
 */

/**
 * Insurance-only markers that almost never appear on a pure service invoice.
 */
export function hasExclusiveInsuranceSignals(text = '') {
  const t = String(text || '');
  if (!t.trim()) return false;
  const exclusive = [
    /\bperiod\s*of\s*insurance\b/i,
    /\bcertificate\s*of\s*insurance\b/i,
    /\binsured\s*declared\s*value\b/i,
    /\bcover\s*note\b/i,
    /\bmotor\s*insurance\s*policy\b/i,
    /\bproposal\s*(?:no|number|form)\b/i,
    /\bno\s*claim\s*bonus\b|\bncb\s*(?:%|percent|discount)?\b/i,
    /\bown\s*damage\s*(?:premium|cover|section)\b/i,
    /\bthird[\s\-]?party\s*(?:premium|liability|cover)\b/i,
  ];
  let hits = 0;
  for (const re of exclusive) {
    if (re.test(t)) hits += 1;
  }
  if (/\bidv\b/i.test(t) && /\bpolicy\s*(?:no|number)\b/i.test(t) && /\bpremium\b/i.test(t)) {
    hits += 2;
  }
  return hits >= 1;
}

/**
 * Workshop / service-invoice structural signals (multi-signal, not single keyword).
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreServiceBillSignals(text = '') {
  const t = String(text || '');
  const reasons = [];
  const add = (re, reason, weight = 1) => {
    if (re.test(t)) {
      reasons.push(reason);
      return weight;
    }
    return 0;
  };

  let score = 0;
  score += add(/\bservice\s*invoice\b/i, 'service invoice detected', 2);
  score += add(/\bserv[il1]ce\s*[il1]nvoice\b/i, 'service invoice (ocr fuzzy)', 2);
  score += add(/\bjob\s*card(?:\s*no)?\b/i, 'job card detected', 2);
  score += add(/\brepair\s*(?:order|invoice|bill|estimate)\b/i, 'repair order/bill detected', 2);
  score += add(/\bwork\s*order\b|\bservice\s*order\b|\bjob\s*sheet\b/i, 'work order / job sheet', 2);
  score += add(/\bworkshop\b/i, 'workshop detected', 1);
  score += add(/\b(?:authorised|authorized)\s*dealer\b/i, 'dealer detected', 1);
  score += add(/\bservice\s*(?:advisor|centre|center)\b/i, 'service advisor/centre detected', 1);
  score += add(/\blabou?r\s*(?:charges|cost|amount)?\b/i, 'labour charges detected', 2);
  score += add(/\bspare\s*parts?\b|\bparts?\s*(?:replaced|used|total|amount)\b/i, 'parts detected', 1);
  score += add(/\bconsumables?\b/i, 'consumables detected', 1);
  score += add(/\bservice\s*charges?\b/i, 'service charges detected', 1);
  score += add(/\btechnician\b/i, 'technician detected', 1);
  score += add(/\bodometer\b|\bodo\s*[:\-]|\bkms?\s*(?:reading|run|:)/i, 'odometer detected', 1);
  score += add(/\bperiodic\s*service\b|\bfree\s*service\b|\bpaid\s*service\b/i, 'service type detected', 1);
  const coreScore = score;
  if (coreScore >= 1) {
    score += add(/\btax\s*invoice\b/i, 'tax invoice detected', 1);
    score += add(/\bhsn\s*\/?\s*sac\b/i, 'HSN/SAC detected', 1);
    score += add(/\bgstin\b/i, 'GSTIN detected', 1);
    score += add(/\binvoice\s*(?:no|number|#)\b/i, 'invoice number label detected', 1);
  }
  if (/\breg\.?\s*no\.?\b|\bregno\b|\bregistration\s*(?:no|number)\b/i.test(t) && /\bkms?\b/i.test(t)) {
    score += 2;
    reasons.push('registration + km header detected');
  }

  return { score, reasons: [...new Set(reasons)] };
}

export function hasStrongServiceBillSignals(text = '', minScore = 2) {
  return scoreServiceBillSignals(text).score >= minScore;
}

/**
 * When both families fire, prefer SERVICE_BILL unless exclusive insurance markers exist.
 * Threshold lowered to score >= 2 so soft insurance cannot hijack weak-OCR service bills.
 */
export function preferServiceBillOverInsurance(text = '') {
  const service = scoreServiceBillSignals(text);
  if (service.score < 2) return false;
  if (hasExclusiveInsuranceSignals(text)) return false;
  return true;
}

/**
 * Soft insurance text — may false-positive on service bills.
 * Alone must NOT force INSURANCE when any workshop structure exists.
 */
export function hasSoftInsuranceSignals(text = '') {
  const t = String(text || '');
  return (
    /\binsurance\s*polic/i.test(t) ||
    /\bpolicy\s*(?:no|number|n[o°])/i.test(t) ||
    /\bpol[il1]cy\s*(?:no|number)/i.test(t) ||
    /\bperiod\s*of\s*insurance\b/i.test(t) ||
    /\bcertificate\s*of\s*insurance\b/i.test(t) ||
    /\bmotor\s*insurance\b/i.test(t) ||
    /\bidv\b/i.test(t) ||
    /\bown\s*damage\b/i.test(t) ||
    /\bthird[\s\-]?party\b/i.test(t) ||
    /\bpremium\b/i.test(t)
  );
}

/**
 * Final insurance-vs-service decision for pipeline / Review.
 * @returns {{ treatAsInsurance: boolean, treatAsService: boolean, reasons: string[], serviceScore: number }}
 */
export function resolveInsuranceVsService(text = '', hints = {}) {
  const blob = String(text || '');
  let engine = null;
  try {
    // Lazy require — avoid circular import with documentClassificationEngine
    const {
      classifyDocumentEngine,
      PRIMARY_DOC_TYPES,
    } = require('./documentClassificationEngine');
    engine = classifyDocumentEngine(blob, hints);
    if (engine?.documentType === PRIMARY_DOC_TYPES.SERVICE_BILL) {
      return {
        treatAsInsurance: false,
        treatAsService: true,
        reasons: ['engine_service_bill', ...(engine.conflictingSignals || [])],
        serviceScore: engine.serviceScore ?? scoreServiceBillSignals(blob).score,
        exclusiveInsurance: Boolean(engine.exclusiveInsurance),
        confidence: engine.confidence,
        primaryType: engine.documentType,
      };
    }
    if (engine?.documentType === PRIMARY_DOC_TYPES.INSURANCE) {
      return {
        treatAsInsurance: true,
        treatAsService: false,
        reasons: ['engine_insurance'],
        serviceScore: engine.serviceScore ?? 0,
        exclusiveInsurance: Boolean(engine.exclusiveInsurance),
        confidence: engine.confidence,
        primaryType: engine.documentType,
      };
    }
  } catch {
    engine = null;
  }

  const service = scoreServiceBillSignals(blob);
  const exclusiveIns = hasExclusiveInsuranceSignals(blob);
  const softIns = hasSoftInsuranceSignals(blob);
  const kindHint = String(
    hints.documentKind || hints.documentType || hints.vaultType || '',
  ).toLowerCase();
  const classifiedInsurance = kindHint.includes('insurance');
  const classifiedService =
    hints.isServiceInvoice === true ||
    /service|repair|job\s*card/.test(kindHint);

  const preferService =
    (service.score >= 2 && !exclusiveIns) ||
    (classifiedService && service.score >= 1 && !exclusiveIns);

  if (preferService) {
    return {
      treatAsInsurance: false,
      treatAsService: true,
      reasons: ['service_billing_structure', ...service.reasons],
      serviceScore: service.score,
      exclusiveInsurance: exclusiveIns,
      primaryType: 'SERVICE_BILL',
    };
  }

  if (exclusiveIns) {
    return {
      treatAsInsurance: true,
      treatAsService: false,
      reasons: ['exclusive_insurance_markers'],
      serviceScore: service.score,
      exclusiveInsurance: true,
      primaryType: 'INSURANCE',
    };
  }

  if (softIns && service.score < 1) {
    return {
      treatAsInsurance: true,
      treatAsService: false,
      reasons: classifiedInsurance ? ['classified_insurance'] : ['soft_insurance_without_service'],
      serviceScore: service.score,
      exclusiveInsurance: false,
      primaryType: 'INSURANCE',
    };
  }

  return {
    treatAsInsurance: false,
    treatAsService: service.score >= 2 || (classifiedService && service.score >= 1),
    reasons: service.reasons.length ? service.reasons : ['neutral'],
    serviceScore: service.score,
    exclusiveInsurance: exclusiveIns,
    primaryType: engine?.documentType || 'OTHER_DOCUMENT',
  };
}

export default {
  hasExclusiveInsuranceSignals,
  scoreServiceBillSignals,
  hasStrongServiceBillSignals,
  preferServiceBillOverInsurance,
  hasSoftInsuranceSignals,
  resolveInsuranceVsService,
};
