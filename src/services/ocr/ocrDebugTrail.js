/**
 * OCR pipeline debug trail — stores last scan stages for developer diagnosis.
 * Never logs OTP / secrets. Keeps short text samples only.
 */

const MAX_TEXT = 2500;

let lastTrail = null;

function clip(text) {
  const s = String(text || '');
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
}

/**
 * @param {object} partial
 */
export function appendOcrTrail(partial = {}) {
  lastTrail = {
    ...(lastTrail || {}),
    ...partial,
    updatedAt: Date.now(),
  };
  if (__DEV__) {
    console.log('[OCR_TRAIL]', {
      stage: partial.stage,
      price: partial.finalPrice ?? partial.parserTotal ?? partial.geminiTotal,
      product: partial.productName,
      seller: partial.shopName,
      confidence: partial.confidence,
    });
  }
  return lastTrail;
}

export function resetOcrTrail() {
  lastTrail = {
    stage: 'CAMERA_CAPTURE',
    startedAt: Date.now(),
  };
  return lastTrail;
}

export function getOcrTrail() {
  return lastTrail;
}

export function recordRawOcr(rawText, engine) {
  return appendOcrTrail({
    stage: 'OCR_RAW',
    engine,
    rawTextSample: clip(rawText),
  });
}

export function recordExtraction(payload = {}) {
  return appendOcrTrail({
    stage: 'EXTRACTION',
    parserTotal: payload.parserTotal,
    geminiTotal: payload.geminiTotal,
    finalPrice: payload.finalPrice,
    productName: payload.productName,
    shopName: payload.shopName,
    confidence: payload.confidence,
  });
}

export function recordValidation(payload = {}) {
  return appendOcrTrail({
    stage: 'VALIDATION',
    ...payload,
  });
}

export function recordFinalMapping(payload = {}) {
  return appendOcrTrail({
    stage: 'FINAL_MAPPING',
    ...payload,
    rawTextSample: clip(payload.rawTextSample || lastTrail?.rawTextSample),
  });
}

export default {
  resetOcrTrail,
  appendOcrTrail,
  getOcrTrail,
  recordRawOcr,
  recordExtraction,
  recordValidation,
  recordFinalMapping,
};
