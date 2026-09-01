/**
 * ASSET DOCTOR — ODOMETER VALIDATOR (OCR PIPELINE V2)
 * High-priority odometer extraction validator with semantic label provenance,
 * plausibility bounds checking, negative token rejection, and historical vehicle check.
 */

export interface OdometerValidationResult {
  value: number | null;
  unit: 'KM' | 'MILES';
  confidence: number; // 0.0 to 1.0
  validationStatus: 'VALID' | 'NEEDS_REVIEW' | 'INVALID' | 'NOT_FOUND';
  provenanceLabel?: string;
  warning?: string;
}

const ODOMETER_ANCHOR_PATTERNS = [
  /\b(?:odometer|odo\s*reading|current\s*odo|current\s*km|km\s*reading|meter\s*reading|running\s*km|kms\s*run)\s*[:.-]?\s*([0-9]{1,7})/i,
  /\b(?:odo|km|kms)\s*[:.-]?\s*([0-9]{2,6})\b/i,
  /\b([0-9]{2,6})\s*(?:km|kms|k\.m\.)\b/i,
];

const NEGATIVE_TOKEN_CONTEXTS = [
  /\b(?:gstin|gst|tin|pan|cin)\b/i,
  /\b(?:phone|mobile|tel|contact|fax)\b/i,
  /\b(?:invoice|inv|bill|job\s*card|policy|puc|rc|chassis|engine)\s*(?:no|num|#)?\b/i,
  /\b(?:amount|total|rs|inr|₹|price|charge|subtotal|tax)\b/i,
  /\b(?:pin|pincode|zip)\b/i,
  /\b[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}\b/, // Indian Reg Number
];

export function validateAndExtractOdometer(
  rawText: string,
  options: {
    previousOdometer?: number | null;
    rawOdometerCandidate?: number | string | null;
  } = {}
): OdometerValidationResult {
  if (!rawText || typeof rawText !== 'string') {
    return {
      value: null,
      unit: 'KM',
      confidence: 0,
      validationStatus: 'NOT_FOUND',
    };
  }

  const lines = rawText.split('\n');
  let bestCandidate: { value: number; confidence: number; label: string } | null = null;

  // 1. Direct candidate evaluation if provided by structured provider
  if (options.rawOdometerCandidate != null) {
    const parsed = Number(String(options.rawOdometerCandidate).replace(/[^0-9]/g, ''));
    if (!isNaN(parsed) && parsed >= 50 && parsed <= 999999) {
      bestCandidate = { value: parsed, confidence: 0.85, label: 'structured_provider' };
    }
  }

  // 2. Line-by-line semantic anchor scanning
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of ODOMETER_ANCHOR_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (isNaN(val)) continue;

        // Plausibility Check: Vehicle odometer is realistically between 10 and 999,999 KM
        if (val < 10 || val > 999999) continue;

        // Negative Token Rejection: Check if line contains GSTIN, Phone, Price, Invoice #, etc.
        let isNegative = false;
        for (const negPattern of NEGATIVE_TOKEN_CONTEXTS) {
          if (negPattern.test(line)) {
            // Exceptions: allow "Job Card" if line explicitly has "KM" or "ODO"
            if (/job\s*card/i.test(line) && /\b(?:odo|km)\b/i.test(line)) {
              continue;
            }
            isNegative = true;
            break;
          }
        }
        if (isNegative) continue;

        let conf = 0.9;
        if (/\b(?:odometer|current\s*km|meter\s*reading)\b/i.test(line)) {
          conf = 0.98; // Explicit high-confidence anchor label
        } else if (/\b(?:odo|km)\b/i.test(line)) {
          conf = 0.85;
        }

        if (!bestCandidate || conf > bestCandidate.confidence) {
          bestCandidate = { value: val, confidence: conf, label: line.slice(0, 40) };
        }
      }
    }
  }

  if (!bestCandidate) {
    return {
      value: null,
      unit: 'KM',
      confidence: 0,
      validationStatus: 'NOT_FOUND',
    };
  }

  // 3. Historical Vehicle Odometer Consistency Check
  let validationStatus: OdometerValidationResult['validationStatus'] = 'VALID';
  let warning: string | undefined;

  if (options.previousOdometer != null && options.previousOdometer > 0) {
    const prev = options.previousOdometer;
    const curr = bestCandidate.value;

    if (curr < prev) {
      // Current reading is less than previous verified reading -> Mismatch or roll-back
      validationStatus = 'NEEDS_REVIEW';
      bestCandidate.confidence = Math.min(bestCandidate.confidence, 0.5);
      warning = `Odometer reading (${curr} KM) is less than previous reading (${prev} KM).`;
    } else if (curr - prev > 150000) {
      // Jump is unrealistically large (> 150,000 km in one service)
      validationStatus = 'NEEDS_REVIEW';
      bestCandidate.confidence = Math.min(bestCandidate.confidence, 0.6);
      warning = `Large odometer increase (+${curr - prev} KM) requires confirmation.`;
    }
  }

  if (bestCandidate.confidence < 0.8) {
    validationStatus = 'NEEDS_REVIEW';
  }

  return {
    value: bestCandidate.value,
    unit: 'KM',
    confidence: bestCandidate.confidence,
    validationStatus,
    provenanceLabel: bestCandidate.label,
    warning,
  };
}
