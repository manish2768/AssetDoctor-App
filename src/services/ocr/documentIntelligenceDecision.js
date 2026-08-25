/**
 * Document Intelligence decision engine — confirm-first; never silent guess.
 */

import {
  DOC_TYPE_V2,
  DOC_TYPE_LABELS,
  toDocTypeV2,
  toLegacyScanDocumentType,
  isAttachDocumentType,
  isServiceLikeDocument,
  isPurchaseLikeDocument,
} from './documentIntelligenceTypes';
import { normalizeExtractedIdentifiers } from './fieldNormalization';
import { validateInvoiceAmounts } from './amountMathValidation';
import { scoreFieldConfidences } from './fieldConfidence';
import { matchAssetForService, MATCH_LEVEL } from '../assets/assetMatching';
import { classifyFromCategoryId } from '../assets/assetTaxonomy';

export const DI_ACTION = Object.freeze({
  CONFIRM_NEW_ASSET: 'CONFIRM_NEW_ASSET',
  CONFIRM_UPDATE_ASSET: 'CONFIRM_UPDATE_ASSET',
  CONFIRM_ATTACH_DOCUMENT: 'CONFIRM_ATTACH_DOCUMENT',
  CONFIRM_SERVICE_RECORD: 'CONFIRM_SERVICE_RECORD',
  SELECT_ASSET: 'SELECT_ASSET',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  RETAKE: 'RETAKE',
});

export const MATCH_BAND = Object.freeze({
  VERY_HIGH: 'VERY_HIGH', // >= 0.95
  HIGH: 'HIGH', // 0.90–0.94
  MEDIUM: 'MEDIUM', // 0.75–0.89
  LOW: 'LOW', // < 0.75
});

export function matchBand(confidence) {
  const c = Number(confidence) || 0;
  if (c >= 0.95) return MATCH_BAND.VERY_HIGH;
  if (c >= 0.9) return MATCH_BAND.HIGH;
  if (c >= 0.75) return MATCH_BAND.MEDIUM;
  return MATCH_BAND.LOW;
}

/**
 * Run post-OCR Document Intelligence (no network).
 * @param {object} extracted — OCR/Gemini merged invoice fields
 * @param {object[]} assets — user's assets
 * @param {object} [opts]
 */
export function runDocumentIntelligence(extracted = {}, assets = [], opts = {}) {
  const started = Date.now();
  const blob = String(opts.rawText || extracted.rawText || extracted.ocrText || '');

  const documentType = toDocTypeV2(
    extracted.document_type ||
      extracted.documentType ||
      extracted.classifiedDocumentType ||
      extracted.documentKind ||
      opts.documentType ||
      '',
    { blob },
  );

  const normalized = normalizeExtractedIdentifiers(extracted);
  const amountCheck = validateInvoiceAmounts(normalized);
  const fieldScores = scoreFieldConfidences(normalized);

  // Asset taxonomy hint from product text (EV = powertrain, not type)
  const productName = String(normalized.productName || normalized.asset_name || '').trim();
  const categoryIdHint = String(normalized.categoryId || normalized.geminiCategory || '').trim();
  const assetTaxonomy = classifyFromCategoryId(categoryIdHint, productName);

  const match = matchAssetForService(
    {
      ...normalized,
      brand: normalized.brand || normalized.brandName,
      brandName: normalized.brandName || normalized.brand,
      model: normalized.model || productName,
      serialNumber: normalized.serialNumber || normalized.identifiers?.serial?.normalizedValue,
      imei: normalized.imei || normalized.identifiers?.imei?.normalizedValue,
      registration:
        normalized.registration || normalized.identifiers?.registration?.normalizedValue,
      chassisNumber:
        normalized.chassisNumber || normalized.identifiers?.chassis?.normalizedValue,
    },
    assets,
  );

  const matchConf = Number(match.match?.confidence) || 0;
  const band = matchBand(matchConf);

  // Critical identifiers with low confidence must not auto-match
  const criticalIdLow =
    match.match?.kind &&
    ['imei', 'serial', 'vehicle_registration', 'chassis'].includes(match.match.kind) &&
    matchConf < 0.9;

  let action = DI_ACTION.MANUAL_REVIEW;
  let userMessage = 'Please review the extracted details before saving.';
  let autoSaveAllowed = false; // never true without explicit confirm UX

  if (opts.imageQualityOk === false) {
    action = DI_ACTION.RETAKE;
    userMessage =
      opts.imageQualityMessage ||
      'Image quality is too low to read this document clearly.';
  } else if (isServiceLikeDocument(documentType)) {
    if (match.autoLinkSafe && !criticalIdLow && !amountCheck.needsUserVerify) {
      action = DI_ACTION.CONFIRM_SERVICE_RECORD;
      userMessage = `Service bill matched to:\n${match.primary?.nickname || match.primary?.assetName || 'Asset'}\nPlease confirm before saving.`;
    } else if (match.candidates?.length > 1 || match.needsConfirmation) {
      action = DI_ACTION.SELECT_ASSET;
      userMessage =
        match.candidates?.length > 1
          ? `I found ${match.candidates.length} similar assets. Which asset does this document belong to?`
          : 'Which asset does this service bill belong to?';
    } else if (match.primary) {
      action = DI_ACTION.CONFIRM_SERVICE_RECORD;
      userMessage = 'Please confirm the matched asset and amount before saving.';
    } else {
      action = DI_ACTION.SELECT_ASSET;
      userMessage = 'No matching asset found. Select an existing asset or add a new one.';
    }
  } else if (isAttachDocumentType(documentType)) {
    if (match.autoLinkSafe && !criticalIdLow) {
      action = DI_ACTION.CONFIRM_ATTACH_DOCUMENT;
      userMessage = `${DOC_TYPE_LABELS[documentType]} matched to an existing asset. Please confirm.`;
    } else {
      action = DI_ACTION.SELECT_ASSET;
      userMessage = `Which asset does this ${DOC_TYPE_LABELS[documentType]} belong to?`;
    }
  } else if (isPurchaseLikeDocument(documentType) || documentType === DOC_TYPE_V2.OTHER) {
    if (match.autoLinkSafe && !criticalIdLow) {
      action = DI_ACTION.CONFIRM_UPDATE_ASSET;
      userMessage = 'Existing asset found. Update existing asset?';
    } else if (match.needsConfirmation && match.candidates?.length > 1) {
      action = DI_ACTION.SELECT_ASSET;
      userMessage = 'Similar assets found. Update an existing asset or create a new one?';
    } else {
      action = DI_ACTION.CONFIRM_NEW_ASSET;
      userMessage = 'New asset detected. Review details and confirm to add.';
    }
  }

  if (amountCheck.needsUserVerify && action !== DI_ACTION.RETAKE) {
    // Force review highlight — keep action but raise flag
    userMessage = `${amountCheck.message}\n\n${userMessage}`;
  }

  const lowFields = fieldScores.lowFields || [];
  const overallField =
    fieldScores.overall != null ? fieldScores.overall : Number(extracted.confidence) || 0;

  const diagnostics = {
    ocrProcessingTimeMs: opts.ocrProcessingTimeMs ?? null,
    documentTypeConfidence: opts.documentTypeConfidence ?? null,
    fieldConfidenceOverall: overallField,
    matchingConfidence: matchConf,
    matchTier: match.tier,
    matchBand: band,
    processingMethod: opts.processingMethod || 'vision+gemini',
    failureReason: opts.failureReason || null,
    amountFlag: amountCheck.flag,
    diMs: Date.now() - started,
  };

  return {
    documentType,
    documentTypeLabel: DOC_TYPE_LABELS[documentType] || 'Document',
    legacyScanDocumentType: toLegacyScanDocumentType(documentType),
    assetTaxonomy,
    normalized,
    fields: fieldScores,
    amountValidation: amountCheck,
    match: {
      ...match,
      band,
      criticalIdLow,
      // Never auto-save; UI must confirm
      autoSaveSafe: false,
      suggestPrefill: match.autoLinkSafe && !criticalIdLow && band !== MATCH_BAND.LOW,
    },
    decision: {
      action,
      autoSaveAllowed,
      requiresUserConfirmation: true,
      userMessage,
      highlightFields: [
        ...(amountCheck.needsUserVerify ? ['price', 'totalAmount'] : []),
        ...lowFields,
      ],
    },
    diagnostics,
  };
}

export default {
  DI_ACTION,
  MATCH_BAND,
  matchBand,
  runDocumentIntelligence,
};
