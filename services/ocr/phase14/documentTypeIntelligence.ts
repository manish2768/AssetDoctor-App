/**
 * Phase 14 — multi-signal document type intelligence.
 * Does not force a type when confidence is low.
 */

import { classifyDocumentType } from '../../../src/services/ocr/documentTypeClassifier.js';
import { normalizeLearningDocumentType } from '../../intelligence/documentLearning/valueShape.ts';
import type { LearningDocumentType } from '../../intelligence/documentLearning/types.ts';

export const UNKNOWN_DOCUMENT_STRUCTURE = 'UNKNOWN_DOCUMENT_STRUCTURE';
export const DOCUMENT_TYPE_UNCERTAIN = 'DOCUMENT_TYPE_UNCERTAIN';

export interface DocumentTypeIntelligence {
  documentType: LearningDocumentType | typeof UNKNOWN_DOCUMENT_STRUCTURE | typeof DOCUMENT_TYPE_UNCERTAIN;
  documentTypeConfidence: number;
  classificationReasons: string[];
  forced: boolean;
}

const FAMILY_MAP: Record<string, LearningDocumentType> = {
  insurance: 'INSURANCE_POLICY',
  puc: 'PUC',
  warranty: 'WARRANTY',
  rc: 'RC',
  service_invoice: 'SERVICE_INVOICE',
  vehicle_invoice: 'PURCHASE_INVOICE',
  sales_invoice: 'PURCHASE_INVOICE',
  bill: 'PURCHASE_INVOICE',
  other: 'GENERIC_DOCUMENT',
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function extraSignals(text: string, fields: Record<string, unknown>, providerTexts?: Record<string, string | null>): { type: LearningDocumentType; reasons: string[]; score: number }[] {
  const providerBlob = Object.values(providerTexts || {}).filter(Boolean).join(' ');
  const blob = `${text} ${providerBlob} ${fields.productName || ''} ${fields.shopName || ''}`.toLowerCase();
  const hits: { type: LearningDocumentType; reasons: string[]; score: number }[] = [];

  // A definitive electronics identity (IMEI present, or an explicit phone/model
  // brand on the document) must beat a generic "TAX INVOICE" that only maps to
  // PURCHASE_INVOICE via the keyword classifier. IMEI is the strongest signal.
  const hasImei = /\bimei\b/.test(blob);
  const hasPhoneBrand =
    /\b(nothing\s+phone|iphone|oneplus|google\s*pixel|pixel\s*\d|galaxy|realme|redmi|xiaomi|oppo|vivo|macbook|ipad|smartphone|laptop|tablet|earbud|airpods|smartwatch|camera)\b/.test(blob);
  if (hasImei || hasPhoneBrand) {
    const score = hasImei ? 0.66 : 0.55;
    hits.push({
      type: 'ELECTRONICS_INVOICE',
      reasons: hasImei ? ['electronics_imei_identity'] : ['electronics_product_identity'],
      score,
    });
  }
  // Explicit appliance product identity should beat a generic purchase-invoice tag too.
  const hasAppliance =
    /\b(inverter\s*(?:split\s*)?ac|air[\s\-]?conditioner|refrigerator|fridge|washing\s*machine|dishwasher|microwave|\boven\b|geyser|water\s*heater|stabilizer|chimney|induction\s*(?:cooktop|stove)?|\bsplit\s*ac\b|\bwindow\s*ac\b)\b/.test(blob);
  if (hasAppliance) {
    hits.push({ type: 'APPLIANCE_INVOICE', reasons: ['appliance_product_identity'], score: 0.62 });
  }
  if (/\bservice\b/.test(blob) && /\b(labour|labor|odometer|km\s*reading|job\s*card)\b/.test(blob)) {
    hits.push({ type: 'SERVICE_INVOICE', reasons: ['service_structure_signal'], score: 0.45 });
  }
  if (/\bwarranty\s*(card|certificate)\b/.test(blob) && !/\btax\s*invoice\b/.test(blob)) {
    hits.push({ type: 'WARRANTY', reasons: ['warranty_card_structure'], score: 0.5 });
  }
  if (/\bpuc\b/.test(blob) && /\b(pollution|emission|validity|certificate)\b/.test(blob)) {
    hits.push({ type: 'PUC', reasons: ['puc_certificate_structure'], score: 0.5 });
  }
  if (/\b(certificate of registration|registration certificate|form\s*23|rc\s*book)\b/.test(blob)) {
    hits.push({ type: 'RC', reasons: ['rc_certificate_structure'], score: 0.5 });
  }
  if (fields.policyNumber || fields.insuranceExpiry || fields.idvAmount) {
    hits.push({ type: 'INSURANCE_POLICY', reasons: ['insurance_field_relationship'], score: 0.4 });
  }
  if (fields.pucExpiry && !fields.policyNumber) {
    hits.push({ type: 'PUC', reasons: ['puc_field_relationship'], score: 0.4 });
  }
  return hits;
}

/**
 * Classify without forcing a type when signals are weak.
 */
export function classifyDocumentIntelligence(
  rawText = '',
  fields: Record<string, unknown> = {},
  hintedType?: string,
  providerTexts?: Record<string, string | null>,
): DocumentTypeIntelligence {
  const started = Date.now();
  void started;
  const hints = {
    productName: fields.productName,
    shopName: fields.shopName,
  };
  const keyword = classifyDocumentType(rawText, hints) as {
    type?: string;
    label?: string;
    isVehicleInvoice?: boolean;
    isServiceInvoice?: boolean;
    documentKind?: string;
    categoryHint?: string | null;
  };
  const kindKey = keyword?.isServiceInvoice
    ? 'service_invoice'
    : keyword?.documentKind || keyword?.type;
  const mapped = (kindKey && FAMILY_MAP[kindKey]) || (keyword?.type && FAMILY_MAP[keyword.type]) || null;
  const extras = extraSignals(rawText, fields, providerTexts);
  const reasons: string[] = [];

  const invoiceLike = /\b(invoice|gstin|tax\s*invoice|bill\s*no|grand\s*total|imei|policy|puc|warranty|job\s*card|service\s*invoice)\b/i.test(
    `${rawText} ${fields.productName || ''}`,
  );
  const forcedBillFallback = keyword?.type === 'bill' && !keyword?.isServiceInvoice && !invoiceLike;

  let best: LearningDocumentType | typeof UNKNOWN_DOCUMENT_STRUCTURE | typeof DOCUMENT_TYPE_UNCERTAIN =
    UNKNOWN_DOCUMENT_STRUCTURE;
  let score = 0;

  if (mapped && mapped !== 'GENERIC_DOCUMENT' && !forcedBillFallback) {
    best = mapped;
    score = 0.55;
    reasons.push(`keyword_classifier:${keyword.type}`);
    if (keyword.isVehicleInvoice) {
      score += 0.1;
      reasons.push('vehicle_invoice_layout');
    }
  }

  for (const hit of extras) {
    if (hit.type === best) {
      score += hit.score;
      reasons.push(...hit.reasons);
    } else if (hit.score > score) {
      best = hit.type;
      score = hit.score;
      reasons.push(...hit.reasons);
    } else if (hit.score >= 0.35) {
      reasons.push(`competing:${hit.type}`);
      score -= 0.08;
    }
  }

  if (hintedType) {
    const normalizedHint = normalizeLearningDocumentType(hintedType) as LearningDocumentType;
    if (best === UNKNOWN_DOCUMENT_STRUCTURE) {
      best = normalizedHint;
      score = Math.max(score, 0.4);
      reasons.push('hinted_document_type');
    } else if (normalizedHint === best) {
      score += 0.08;
      reasons.push('hint_agrees');
    } else {
      reasons.push(`hint_disagrees:${normalizedHint}`);
      score -= 0.12;
    }
  }

  score = clamp01(score);

  const competingFamilies = extras
    .filter((h) => h.type !== best && h.score >= 0.4)
    .map((h) => h.type);
  if (competingFamilies.length && score < 0.7) {
    return {
      documentType: DOCUMENT_TYPE_UNCERTAIN,
      documentTypeConfidence: score,
      classificationReasons: [...reasons, 'ambiguous_competing_families', ...competingFamilies.map((t) => `uncertain:${t}`)],
      forced: false,
    };
  }

  if (score < 0.42) {
    return {
      documentType: UNKNOWN_DOCUMENT_STRUCTURE,
      documentTypeConfidence: score,
      classificationReasons: [...reasons, 'low_confidence_unknown_structure'],
      forced: false,
    };
  }

  if (best === UNKNOWN_DOCUMENT_STRUCTURE) {
    return {
      documentType: UNKNOWN_DOCUMENT_STRUCTURE,
      documentTypeConfidence: score,
      classificationReasons: reasons.length ? reasons : ['no_reliable_document_family'],
      forced: false,
    };
  }

  return {
    documentType: best,
    documentTypeConfidence: score,
    classificationReasons: reasons,
    forced: false,
  };
}
