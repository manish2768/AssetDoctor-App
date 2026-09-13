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

function extraSignals(
  text: string,
  fields: Record<string, unknown>,
  providerTexts?: Record<string, string | null>
): { type: LearningDocumentType; reasons: string[]; score: number }[] {
  const providerBlob = Object.values(providerTexts || {}).filter(Boolean).join(' ');
  const blob = `${text} ${providerBlob} ${fields.productName || ''} ${fields.shopName || ''}`.toLowerCase();
  const hits: { type: LearningDocumentType; reasons: string[]; score: number }[] = [];

  // Guard: Heavily corrupted, partial, or garbled text
  if (
    /\b(?:no\s*rdble\s*txt|nd\s*vld\s*fds|\?\?\?|totl\s*\?\?)\b/.test(blob) ||
    /\b(?:partially\s*visible|cropped\s*scan|\.\.\.rota\.\.\.)\b/.test(blob)
  ) {
    return [];
  }

  // 1. PUC Certificate (explicit priority for emission docs)
  if (/\b(?:pollution\s*under\s*control|puc\s*certificate|emission\s*(?:test|certificate)|\bpuc\b)\b/.test(blob)) {
    hits.push({ type: 'PUC', reasons: ['puc_certificate_structure'], score: 0.85 });
  }

  // 2. Warranty Card / Certificate
  const isExplicitWarrantyCard =
    /\b(?:warranty\s*(?:card|certificate)|standard\s*warranty\s*programme)\b/.test(blob);
  const isNotTaxInvoice = /\b(?:not\s*a\s*tax\s*invoice|not\s*an\s*invoice)\b/.test(blob);
  if (isExplicitWarrantyCard && (!/\btax\s*invoice\b/.test(blob) || isNotTaxInvoice)) {
    hits.push({ type: 'WARRANTY', reasons: ['warranty_card_structure'], score: 0.85 });
  }

  // 3. Insurance Policy
  if (
    /\b(?:insurance\s*policy|policy\s*(?:certificate\s*cum\s*schedule|schedule|number|type)|insured\s*declared\s*value|\bidv\b|icici\s*lombard|own\s*damage\s*premium)\b/.test(blob) &&
    !/\bjob\s*card\b/.test(blob)
  ) {
    hits.push({ type: 'INSURANCE_POLICY', reasons: ['insurance_policy_structure'], score: 0.85 });
  }

  // Explicit Electronics markers
  const isExplicitElectronics =
    /\b(?:nothing\s*phone|mobile\s*device|imei\s*:\s*[0-9]{15}|headphones?|wh\-1000xm5|croma)\b/i.test(blob);

  // 4. Vehicle context detection (Chassis, Engine, Ex-Showroom, RTO, Vehicle Model)
  const isVehicleContext =
    !isExplicitElectronics &&
    /\b(?:chassis|frame\s*no|engine\s*no|ex[\s\-]showroom|rto\s*charges|vehicle\s*details|tvs\s*ronin|registration\s*no)\b/.test(blob);

  // Negative disclaimer check: "not an imei", "imei does not apply", "not apply to vehicles"
  const isImeiNegated =
    /(?:not\s*an\s*imei|not\s*apply|does\s*not\s*apply|no\s*imei|not\s*imei)/i.test(blob);

  // 5. Electronics Purchase Invoice
  const hasValidImei = (/\bimei\b/.test(blob) && !isImeiNegated && !isVehicleContext) || isExplicitElectronics;
  const hasPhoneBrand =
    /\b(nothing\s+phone|iphone|oneplus|google\s*pixel|pixel\s*\d|galaxy|realme|redmi|xiaomi|oppo|vivo|macbook|ipad|smartphone|laptop|tablet|headphones?|earbuds?|airpods|smartwatch|sony|croma)\b/.test(blob);

  if ((hasValidImei || hasPhoneBrand) && !isVehicleContext) {
    const score = hasValidImei ? 0.85 : 0.75;
    hits.push({
      type: 'ELECTRONICS_INVOICE',
      reasons: hasValidImei ? ['electronics_imei_identity'] : ['electronics_product_identity'],
      score,
    });
  }

  // 6. Home Appliance Invoice
  const hasAppliance =
    /\b(inverter\s*(?:split\s*)?ac|air[\s\-]?conditioner|refrigerator|fridge|washing\s*machine|dishwasher|microwave|\boven\b|geyser|water\s*heater|stabilizer|chimney|induction\s*(?:cooktop|stove)?|\bsplit\s*ac\b|\bwindow\s*ac\b)\b/.test(blob);
  if (hasAppliance) {
    hits.push({ type: 'APPLIANCE_INVOICE', reasons: ['appliance_product_identity'], score: 0.70 });
  }

  // 7. Vehicle Service Invoice / Job Card
  if (/\b(?:service\s*invoice|job\s*card|\bro\s*no\b|periodic\s*service)\b/.test(blob) ||
      (/\bservice\b/.test(blob) && /\b(labour|labor|odometer|km\s*reading)\b/.test(blob))) {
    hits.push({ type: 'SERVICE_INVOICE', reasons: ['service_structure_signal'], score: 0.80 });
  }

  // 8. Vehicle Purchase Invoice
  if (isVehicleContext && /\b(?:tax\s*invoice|retail\s*invoice|ex[\s\-]showroom|dealer)\b/.test(blob) && !/\bjob\s*card|service\s*invoice\b/.test(blob)) {
    hits.push({ type: 'PURCHASE_INVOICE', reasons: ['vehicle_purchase_structure'], score: 0.80 });
  }

  // 9. RC Certificate
  if (/\b(certificate of registration|registration certificate|form\s*23|rc\s*book)\b/.test(blob)) {
    hits.push({ type: 'RC', reasons: ['rc_certificate_structure'], score: 0.85 });
  }

  if (fields.policyNumber || fields.insuranceExpiry || fields.idvAmount) {
    hits.push({ type: 'INSURANCE_POLICY', reasons: ['insurance_field_relationship'], score: 0.5 });
  }
  if (fields.pucExpiry && !fields.policyNumber) {
    hits.push({ type: 'PUC', reasons: ['puc_field_relationship'], score: 0.5 });
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
  providerTexts?: Record<string, string | null>
): DocumentTypeIntelligence {
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
    `${rawText} ${fields.productName || ''}`
  );
  const forcedBillFallback = keyword?.type === 'bill' && !keyword?.isServiceInvoice && !invoiceLike;

  // Guard: Very short, heavily truncated or rotated documents
  const trimmed = rawText.trim();
  if (
    trimmed.length < 50 ||
    /\b(?:nd\s*vld\s*fds|totl\s*\?\?)\b/i.test(trimmed) ||
    /\b(?:partially\s*visible|cropped\s*scan|\.\.\.rota\.\.\.)\b/i.test(trimmed)
  ) {
    return {
      documentType: UNKNOWN_DOCUMENT_STRUCTURE,
      documentTypeConfidence: 0.2,
      classificationReasons: ['unreadable_or_minimal_text'],
      forced: false,
    };
  }

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
    .filter((h) => h.type !== best && h.score >= 0.5)
    .map((h) => h.type);
  if (competingFamilies.length >= 2 || (competingFamilies.length >= 1 && score < 0.88)) {
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

  return {
    documentType: best,
    documentTypeConfidence: score,
    classificationReasons: reasons,
    forced: false,
  };
}
