/**
 * Semantic labeled-value finder for variable Indian document layouts.
 * Not position/template based: label → same line / next lines / nearby tokens.
 * Never invents a value. Prefer null over a weak guess.
 */

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

export function splitOcrLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean);
}

/**
 * Find a value near any of the given label regexes.
 * @param {string} text
 * @param {{ labels: RegExp[], accept?: (v: string, ctx: object) => boolean, reject?: (v: string) => boolean, maxLinesAfter?: number, span?: number }} opts
 * @returns {{ value: string, sourceText: string, sourceLabel: string, confidence: number } | null}
 */
export function findLabeledValue(text = '', opts = {}) {
  const labels = Array.isArray(opts.labels) ? opts.labels : [];
  const maxLinesAfter = opts.maxLinesAfter == null ? 5 : opts.maxLinesAfter;
  const span = opts.span == null ? 420 : opts.span;
  const accept = typeof opts.accept === 'function' ? opts.accept : (v) => Boolean(cleanLine(v));
  const reject = typeof opts.reject === 'function' ? opts.reject : () => false;
  const src = String(text || '');
  if (!src.trim() || !labels.length) return null;

  const lines = splitOcrLines(src);
  let best = null;

  const consider = (raw, sourceText, sourceLabel, confidence) => {
    const value = cleanLine(raw);
    if (!value || reject(value)) return;
    if (!accept(value, { sourceText, sourceLabel })) return;
    if (!best || confidence > best.confidence) {
      best = { value, sourceText: sourceText || value, sourceLabel: sourceLabel || '', confidence };
    }
  };

  for (const labelRe of labels) {
    const flags = labelRe.flags.includes('g') ? labelRe.flags : `${labelRe.flags}g`;
    const re = new RegExp(labelRe.source, flags);
    let m = re.exec(src);
    while (m) {
      const labelText = cleanLine(m[0]);
      const after = src.slice(m.index + m[0].length, m.index + m[0].length + span);
      const afterLines = after.split(/\n/).map((l) => cleanLine(l)).filter(Boolean);
      const same = afterLines[0] || '';
      if (same) consider(same.split(/\s{2,}/)[0], `${labelText} ${same}`.trim(), labelText, 0.94);
      for (let i = 0; i < Math.min(maxLinesAfter, afterLines.length); i += 1) {
        const line = afterLines[i];
        const conf = i === 0 ? 0.9 : Math.max(0.62, 0.88 - i * 0.08);
        consider(line, `${labelText} ${line}`.trim(), labelText, conf);
        const token = line.split(/\s{2,}|\s+(?=\b(?:chassis|engine|insured|period|from|to|gstin|invoice)\b)/i)[0];
        if (token && token !== line) consider(token, `${labelText} ${token}`.trim(), labelText, conf - 0.04);
      }
      m = re.exec(src);
    }
  }

  // Line-wise: label on its own line, value on following lines (table / box layouts)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const labelRe of labels) {
      const bare = new RegExp(
        `${labelRe.source.replace(/^\^/, '').replace(/\$$/, '')}\\s*[:\\-#.]*$`,
        'i',
      );
      const inline = line.match(
        new RegExp(`${labelRe.source.replace(/^\^/, '').replace(/\$$/, '')}\\s*[:\\-#]?\\s*(.+)$`, 'i'),
      );
      if (inline?.[1]) {
        consider(inline[1], line, cleanLine(inline[0]), 0.95);
      }
      if (bare.test(line)) {
        for (let j = 1; j <= maxLinesAfter && i + j < lines.length; j += 1) {
          consider(lines[i + j], `${line} ${lines[i + j]}`, line, Math.max(0.6, 0.9 - j * 0.08));
        }
      }
    }
  }

  return best;
}

const INDIAN_PLATE_RE =
  /\b(?:([A-Z]{2}\s*-?\s*[0-9]{1,2}\s*-?\s*[A-Z]{1,3}\s*-?\s*[0-9]{4})|([0-9]{2}\s*-?\s*BH\s*-?\s*[0-9]{4}\s*-?\s*[A-Z]{1,2}))\b/gi;

export function compactPlate(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isIndianPlateToken(value) {
  const p = compactPlate(value);
  if (!p || p.length < 8 || p.length > 11) return false;
  if (/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(p)) return true;
  if (/^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(p)) return true;
  return false;
}

export function findIndianPlates(text = '') {
  const out = [];
  const seen = new Set();
  const re = new RegExp(INDIAN_PLATE_RE.source, 'gi');
  let m = re.exec(String(text || ''));
  while (m) {
    const raw = m[0];
    const plate = compactPlate(raw);
    if (isIndianPlateToken(plate) && !seen.has(plate)) {
      seen.add(plate);
      out.push({ plate, index: m.index, raw });
    }
    m = re.exec(String(text || ''));
  }
  return out;
}

const ODO_LABEL_RE =
  /\b(?:odometer(?:\s*reading)?|odo(?:meter)?(?:\s*reading)?|odo\.|k\.?m\.?(?:\s*reading)?|km\s*reading|kms?(?:\s*reading)?|mileage|meter\s*reading|kilometer(?:s|\s*reading)?|kilometre(?:s|\s*reading)?|kilometres?|running(?:\s*km)?|current\s*(?:km|odo|odometer)|vehicle\s*km|opening\s*km|closing\s*km|out\s*km|in\s*km)\b/gi;

function parseOdometerDigits(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw)
    .replace(/\b(?:kms?|kilometers?|kilometres?|miles?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const grouped = s.match(/\b(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})\b/);
  if (!grouped) return null;
  const digits = grouped[1].replace(/[,.\s]/g, '');
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 1 || n > 9_999_999) return null;
  if (n >= 1900 && n <= 2100 && String(n).length === 4) return null;
  return n;
}

function odometerRejectedNear(near = '') {
  const t = String(near || '');
  if (
    /\b(?:gstin|gst|hsn|sac|hsn\/sac|invoice\s*(?:no|number|#)|bill\s*no|policy\s*no|policy\s*number|phone|mobile|tel|whatsapp|part\s*no|item\s*code|qty|quantity|rate|unit\s*price|chassis\s*(?:no|number)?|engine\s*(?:no|number)?|vin\b|frame\s*no|serial\s*no|bank\s*a\/?c|account|ifsc|upi\b|pin\s*code|postal|labour|labor|grand\s*total|net\s*total|subtotal|amount\s*payable|taxable|cgst|sgst|igst|tax\s*amount)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Explicitly reject next-service / recommended-service due mileage from becoming current odometer
  if (
    /\b(?:next\s*(?:service(?:\s*due)?|due|interval|visit)|service\s*due|next\s*due|recommended\s*(?:service|interval|due)|service\s*interval|due\s*at|upcoming\s*service|suggested\s*service)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/[₹]|rs\.?\s*\d|inr\s*\d/i.test(t) && /\b(?:total|amount|tax|gst|cgst|sgst|rate|price)\b/i.test(t)) {
    return true;
  }
  const compact = t.replace(/\s/g, '');
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/i.test(compact)) return true;
  if (isIndianPlateToken(compact)) return true;
  const phone = t.replace(/\D/g, '');
  if (phone.length === 10 && /^[6-9]/.test(phone) && /\b(?:ph|tel|mob|phone|contact)\b/i.test(t)) return true;
  return false;
}

export const NEXT_SERVICE_ODO_LABEL_RE =
  /\b(?:next\s*(?:service(?:\s*due)?|due|interval|visit)|service\s*due|next\s*due|recommended\s*(?:service|interval|due)|service\s*interval|due\s*at|upcoming\s*service|suggested\s*service)\b/i;

/**
 * Extract next service due mileage (e.g. "Next Service: 15,000 KM" -> 15000)
 */
export function findNextServiceOdometer(text = '') {
  const src = String(text || '');
  if (!src.trim()) return null;
  const lines = splitOcrLines(src);
  for (const line of lines) {
    if (NEXT_SERVICE_ODO_LABEL_RE.test(line)) {
      const digits = parseOdometerDigits(line);
      if (digits != null) return digits;
    }
  }
  const m = src.match(
    new RegExp(
      `${NEXT_SERVICE_ODO_LABEL_RE.source}\\s*[:\\-#]?\\s*(?:km\\s*)?(\\d{1,3}(?:[,.\\s]\\d{3})+|\\d{3,7})(?:\\s*kms?)?`,
      'i',
    ),
  );
  if (m?.[1]) {
    return parseOdometerDigits(m[1]);
  }
  return null;
}

/**
 * Rank odometer candidates by label proximity — never "largest number on page".
 * @returns {{ value: number, unit: 'km', confidence: number, sourceText: string, sourceLabel: string } | null}
 */
export function findOdometerCandidates(text = '') {
  const src = String(text || '');
  if (!src.trim()) return null;
  const lines = splitOcrLines(src);
  const scored = [];

  const push = (n, conf, sourceText, sourceLabel) => {
    if (n == null) return;
    if (odometerRejectedNear(sourceText)) return;
    scored.push({
      value: n,
      unit: 'km',
      confidence: conf,
      sourceText,
      sourceLabel,
    });
  };

  const re = new RegExp(ODO_LABEL_RE.source, 'gi');
  let m = re.exec(src);
  while (m) {
    const label = m[0];
    if (NEXT_SERVICE_ODO_LABEL_RE.test(label)) {
      m = re.exec(src);
      continue;
    }
    const afterFull = src.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const after = afterFull.split(/\n/)[0];
    const before = src.slice(Math.max(0, m.index - 48), m.index).split(/\n/).pop() || '';
    const window = `${before} ${label} ${after}`;
    if (!odometerRejectedNear(window)) {
      const afterN = parseOdometerDigits(after);
      if (afterN != null) push(afterN, 0.96, cleanLine(`${label} ${after.slice(0, 40)}`), label);
      const beforeN = parseOdometerDigits(before);
      if (beforeN != null && afterN == null) {
        push(beforeN, 0.93, cleanLine(`${before.slice(-40)} ${label}`), label);
      }
    }
    m = re.exec(src);
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (NEXT_SERVICE_ODO_LABEL_RE.test(line)) {
      continue;
    }
    const labeled = line.match(
      /^(?:odometer(?:\s*reading)?|odo(?:meter)?|odo\.?|k\.?m\.?(?:\s*reading)?|km\s*reading|kms?(?:\s*reading)?|mileage|meter\s*reading|running(?:\s*km)?|current\s*(?:km|odo)|vehicle\s*km)\s*[:\-#]?\s*(.+)$/i,
    );
    if (labeled?.[1]) {
      const n = parseOdometerDigits(labeled[1]);
      push(n, 0.97, line, labeled[0]);
      continue;
    }
    if (
      /^(?:odometer|odo\.?|kms?|km\s*reading|mileage|meter\s*reading|running|current\s*km)\s*[:\-#.]*$/i.test(
        line,
      ) &&
      i + 1 < lines.length &&
      !NEXT_SERVICE_ODO_LABEL_RE.test(lines[i + 1])
    ) {
      const n = parseOdometerDigits(lines[i + 1]);
      push(n, 0.9, `${line} ${lines[i + 1]}`, line);
    }
    const trailingUnit = line.match(
      /\b(\d{1,3}(?:[,.\s]\d{3})+|\d{3,7})\s*(?:kms?|kilometers?|kilometres?)\b/i,
    );
    if (trailingUnit && !NEXT_SERVICE_ODO_LABEL_RE.test(line)) {
      const n = parseOdometerDigits(trailingUnit[1]);
      push(n, 0.92, line, 'KM');
    }
  }

  if (!scored.length) return null;
  scored.sort((a, b) => b.confidence - a.confidence || a.value - b.value);
  const top = scored[0];
  const rival = scored.find((c) => c.value !== top.value && top.confidence - c.confidence < 0.08);
  if (rival) {
    return null;
  }
  return top;
}

export default {
  splitOcrLines,
  findLabeledValue,
  findIndianPlates,
  compactPlate,
  isIndianPlateToken,
  findOdometerCandidates,
  findNextServiceOdometer,
  NEXT_SERVICE_ODO_LABEL_RE,
};
