/**
 * OCR provider chain — tiered for speed.
 *
 * Default (auto):
 *  1) ML Kit on-device (fast)
 *  2) If text quality / classification confidence is low → Cloud Vision
 *  3) Document AI only when FEATURE.DOCUMENT_AI_ENABLED (never on happy path)
 */

import { FEATURE, OCR_PROVIDER } from '../../config/featureFlags';
import { CloudVisionProvider } from './CloudVisionProvider';
import { GoogleDocumentAiProvider } from './GoogleDocumentAiProvider';
import { MlKitProvider } from './MlKitProvider';

const documentAi = new GoogleDocumentAiProvider();
const cloudVision = new CloudVisionProvider();
const mlKit = new MlKitProvider();

function textQuality(text = '') {
  const t = String(text || '').trim();
  const chars = t.length;
  const words = t.split(/\s+/).filter(Boolean).length;
  const lines = t.split(/\n/).filter((l) => l.trim().length > 2).length;
  const ok = chars >= 80 && words >= 12 && lines >= 3;
  const strong = chars >= 220 && words >= 35 && lines >= 6;
  return { ok, strong, chars, words, lines };
}

function classificationConfidence(text = '') {
  try {
    const { classifyDocumentEngine } = require('../../services/ocr/documentClassificationEngine');
    const r = classifyDocumentEngine(text);
    return Number(r?.confidence) || 0;
  } catch {
    return 0;
  }
}

export function evaluateCriticalFieldsConfidence(text = '') {
  const t = String(text || '').trim();
  if (!t) {
    return { shouldUpgrade: true, reasons: ['empty_text'], criticalFields: {} };
  }

  let semantic = {};
  let fieldConf = {};
  try {
    const { runSemanticOcrPipeline } = require('../../services/ocr/runSemanticOcrPipeline');
    const { scoreFieldConfidences } = require('../../services/ocr/fieldConfidence');
    semantic = runSemanticOcrPipeline(t, {}, { engine: 'local_eval' }) || {};
    fieldConf = scoreFieldConfidences(semantic)?.fields || {};
  } catch {
    semantic = {};
    fieldConf = {};
  }

  const reasons = [];
  const criticalFields = {};

  const docKind = String(semantic.documentKind || semantic.documentType || '').toLowerCase();
  const isVehicleOrService =
    docKind.includes('service') ||
    docKind.includes('insurance') ||
    docKind.includes('vehicle') ||
    /\b(?:job\s*card|service\s*bill|odometer|chassis|engine\s*no|reg\.?\s*no)\b/i.test(t);

  // 1. Total Amount / Price (Critical Field)
  const hasPriceLabel = /\b(?:total|grand\s*total|net\s*payable|amount\s*payable|rs\.?|inr|₹)\b/i.test(t);
  const totalVal = semantic.totalAmount ?? semantic.total_amount ?? semantic.price;
  const priceConf = fieldConf.price ?? (totalVal != null ? 0.92 : 0.2);
  criticalFields.totalAmount = priceConf;
  if (hasPriceLabel && priceConf < 0.85) {
    reasons.push('low_confidence_total_amount');
  }

  // 2. Registration (Critical Field for vehicle/service/insurance)
  if (isVehicleOrService) {
    const hasRegLabel = /\b(?:reg(?:istration)?\s*(?:no|number|#)?|vehicle\s*no)\b/i.test(t);
    const regConf = semantic.registration ? 0.95 : hasRegLabel ? 0.3 : 0.9;
    criticalFields.registration = regConf;
    if (hasRegLabel && regConf < 0.85) {
      reasons.push('low_confidence_registration');
    }
  }

  // 3. Odometer (Critical Field for service bills)
  if (docKind.includes('service') || /\b(?:job\s*card|current\s*odo|odometer|running\s*km|km\s*reading)\b/i.test(t)) {
    const hasOdoLabel = /\b(?:odometer|current\s*(?:odo|km)|km\s*reading|closing\s*km)\b/i.test(t);
    const odoConf = semantic.odometerKm != null ? 0.95 : hasOdoLabel ? 0.25 : 0.9;
    criticalFields.odometer = odoConf;
    if (hasOdoLabel && odoConf < 0.85) {
      reasons.push('low_confidence_odometer');
    }
  }

  // 4. Invoice Number (Critical Field)
  const hasInvLabel = /\b(?:invoice\s*(?:no|number|#)|bill\s*no|policy\s*no)\b/i.test(t);
  const invVal = semantic.invoiceNumber || semantic.invoice_number || semantic.policyNumber;
  let invConf = 0.9;
  if (hasInvLabel) {
    if (invVal) {
      invConf = 0.9;
    } else {
      const m = t.match(/\b(?:invoice\s*(?:no|number|#)|bill\s*no|policy\s*no)\s*[:\-#]?\s*([A-Za-z0-9\/-]+)/i);
      invConf = m?.[1] && m[1].length >= 2 ? 0.9 : 0.35;
    }
  }
  criticalFields.invoiceNumber = invConf;
  if (hasInvLabel && invConf < 0.85) {
    reasons.push('low_confidence_invoice_number');
  }

  // 5. Date (Critical Field)
  const hasDateLabel = /\b(?:date|dated|invoice\s*date|service\s*date|purchase\s*date)\b/i.test(t);
  const dateVal = semantic.purchaseDate || semantic.invoiceDate || semantic.serviceDate;
  const dateConf = fieldConf.purchaseDate ?? (dateVal ? 0.9 : hasDateLabel ? 0.3 : 0.9);
  criticalFields.date = dateConf;
  if (hasDateLabel && dateConf < 0.85) {
    reasons.push('low_confidence_date');
  }

  const shouldUpgrade = reasons.length > 0;
  return { shouldUpgrade, reasons, criticalFields };
}

function chainFor(mode) {
  if (mode === 'document_ai') return [documentAi];
  if (mode === 'cloud_vision') return [cloudVision];
  if (mode === 'mlkit') return [mlKit];
  // auto: local-first for speed
  const auto = [mlKit, cloudVision];
  if (FEATURE.DOCUMENT_AI_ENABLED) auto.push(documentAi);
  return auto;
}

/**
 * @param {{ imageUri?: string, base64?: string, forceCloud?: boolean }} input
 */
export async function extractOcrText(input = {}) {
  const mode = OCR_PROVIDER;
  const errors = [];

  if (mode !== 'auto') {
    const providers = chainFor(mode);
    for (const provider of providers) {
      try {
        const result = await provider.extract(input);
        if (result?.success && result.text) {
          return { ...result, attempted: providers.map((p) => p.id), errors, tier: mode };
        }
        errors.push({ engine: provider.id, error: result?.error || 'empty' });
      } catch (error) {
        errors.push({ engine: provider.id, error: error?.message || 'threw' });
      }
    }
    return {
      success: false,
      text: '',
      engine: 'none',
      error: errors.map((e) => `${e.engine}: ${e.error}`).join(' | ') || 'All OCR providers failed',
      attempted: providers.map((p) => p.id),
      errors,
    };
  }

  // --- Tiered auto path ---
  let local = null;
  try {
    local = await mlKit.extract(input);
  } catch (error) {
    errors.push({ engine: 'mlkit', error: error?.message || 'threw' });
  }

  if (local?.success && local.text) {
    const quality = textQuality(local.text);
    const conf = classificationConfidence(local.text);
    const criticalEval = evaluateCriticalFieldsConfidence(local.text);

    // Accept local ML Kit ONLY when text quality is ok, document classification is strong,
    // AND all critical fields have confidence >= 0.85 (no missing/low-confidence critical fields)
    const acceptLocal =
      !input.forceCloud &&
      quality.ok &&
      !criticalEval.shouldUpgrade &&
      (quality.strong || conf >= 0.75);

    if (acceptLocal) {
      return {
        ...local,
        attempted: ['mlkit'],
        errors,
        tier: 'local_accept',
        textQuality: quality,
        classificationConfidence: conf,
        criticalFields: criticalEval.criticalFields,
      };
    }

    // Secondary: Cloud Vision upgrade when local critical fields are weak or unconfident
    try {
      const cloud = await cloudVision.extract(input);
      if (cloud?.success && cloud.text) {
        const preferCloud =
          cloud.text.length >= local.text.length * 0.85 ||
          textQuality(cloud.text).words > quality.words;
        if (preferCloud) {
          return {
            ...cloud,
            attempted: ['mlkit', 'cloud_vision'],
            errors,
            tier: 'cloud_upgrade',
            textQuality: textQuality(cloud.text),
            classificationConfidence: classificationConfidence(cloud.text),
            upgradeReasons: criticalEval.reasons,
          };
        }
      } else {
        errors.push({ engine: 'cloud_vision', error: cloud?.error || 'empty' });
      }
    } catch (error) {
      errors.push({ engine: 'cloud_vision', error: error?.message || 'threw' });
    }

    return {
      ...local,
      attempted: ['mlkit', 'cloud_vision'],
      errors,
      tier: 'local_fallback',
      textQuality: quality,
      classificationConfidence: conf,
      upgradeReasons: criticalEval.reasons,
    };
  }

  // Local failed — Cloud Vision, then optional Document AI
  try {
    const cloud = await cloudVision.extract(input);
    if (cloud?.success && cloud.text) {
      return {
        ...cloud,
        attempted: ['mlkit', 'cloud_vision'],
        errors,
        tier: 'cloud_only',
        textQuality: textQuality(cloud.text),
      };
    }
    errors.push({ engine: 'cloud_vision', error: cloud?.error || 'empty' });
  } catch (error) {
    errors.push({ engine: 'cloud_vision', error: error?.message || 'threw' });
  }

  if (FEATURE.DOCUMENT_AI_ENABLED) {
    try {
      const dai = await documentAi.extract(input);
      if (dai?.success && dai.text) {
        return { ...dai, attempted: ['mlkit', 'cloud_vision', 'document_ai'], errors, tier: 'document_ai' };
      }
      errors.push({ engine: 'document_ai', error: dai?.error || 'empty' });
    } catch (error) {
      errors.push({ engine: 'document_ai', error: error?.message || 'threw' });
    }
  }

  return {
    success: false,
    text: '',
    engine: 'none',
    error: errors.map((e) => `${e.engine}: ${e.error}`).join(' | ') || 'All OCR providers failed',
    attempted: ['mlkit', 'cloud_vision'],
    errors,
  };
}

export { CloudVisionProvider, GoogleDocumentAiProvider, MlKitProvider, textQuality };
export default { extractOcrText, evaluateCriticalFieldsConfidence };
