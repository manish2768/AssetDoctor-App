/**
 * Generic product-title continuation / variant merging.
 * "(Black, 256 GB)" is a variant line — never a separate merchandise row.
 */

const VARIANT_IN_PARENS =
  /^\(\s*(?:black|white|blue|grey|gray|silver|gold|ultra|pro|plus|lite|max|\d+\s*GB)[^)]*\)$/i;

const PRODUCT_BRAND =
  /\b(?:phone|mobile|handset|laptop|tv|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|boat|sony|lg|voltas|daikin|tvs|hero|honda|bajaj|ronin|fridge|ac|watch|tablet)\b/i;

const NON_PRODUCT_ROW =
  /^(?:handling\s*fee|delivery\s*(?:fee|charge)|shipping|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)|discount|coupon|coupons|sub\s*total|subtotal|grand\s*total|amount\s*payable|taxable(?:\s*value)?|tax(?:\s*amount)?|cgst|sgst|igst|gst|total|amount|net\s*total|round\s*off)$/i;

const SERVICE_INSTRUCTION =
  /(?:download\s*(?:the\s*)?(?:tvs\s*)?connect\s*app|book\s*a\s*service|check\s*service|tvs\s*connect|get\s*your\s*(?:vehicle\s*)?serviced|service\s*reminder|scan\s*(?:the\s*)?qr\s*to\s*book)/i;

const VEHICLE_MODEL =
  /\b(?:tvs|hero|honda|bajaj|yamaha|royal\s*enfield|ktm|pulsar|ronin|apache|jupiter|activa|splendor|shine|passion|avenger)\b/i;

const VEHICLE_TRIM =
  /\b(?:base|lightning|black|white|red|blue|lng|obd(?:i{1,2})?b?|obdhp|dual|disc|drum|edition|variant|ng|1ch|225|td)\b/i;

const CHASSIS_ENGINE_FRAGMENT = /\b(?:MD|ME|BN)[A-HJ-NPR-Z0-9]{8,}\b/gi;

/** App-download / service-instruction footer — never merchandise. */
export function isServiceInstructionLine(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (SERVICE_INSTRUCTION.test(s)) return true;
  if (/download/i.test(s) && /\b(?:app|service|connect|tvs)\b/i.test(s)) return true;
  if (/\bcheck\s*service\b/i.test(s) && !VEHICLE_MODEL.test(s)) return true;
  if (/\bbook\s*a\s*service\b/i.test(s)) return true;
  return false;
}

/** Vehicle color/trim continuation of the same model row. */
export function isVehicleVariantContinuation(name, prevName) {
  const s = String(name || '').trim();
  const prev = String(prevName || '').trim();
  if (!s || !prev) return false;
  if (isServiceInstructionLine(s)) return false;
  if (isNonProductRowName(s)) return false;

  const prevRonin = /\bRONIN\b/i.test(prev);
  const curRonin = /\bRONIN\b/i.test(s);
  if (prevRonin && curRonin && (VEHICLE_TRIM.test(s) || /\b(?:black|white|lightning)\b/i.test(s))) {
    return true;
  }

  if (prevRonin && /^(?:black|white|red|blue|lightning)\b/i.test(s) && s.split(/\s+/).length <= 3) {
    return true;
  }

  if (/^RONIN$/i.test(prev) && /\bRONIN\b/i.test(s)) return true;

  if (
    (VEHICLE_MODEL.test(prev) || prevRonin) &&
    (VEHICLE_MODEL.test(s) || curRonin) &&
    s.length <= 140 &&
    (VEHICLE_TRIM.test(s) || /\b(?:black|white|lightning|obd)/i.test(s))
  ) {
    return true;
  }

  return false;
}

export function cleanVehicleModelName(name) {
  let s = String(name || '')
    .replace(/^[\s\[\(\{\"'\<\|\.\,\:\;\-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  if ((s.match(/\bRONIN\b/gi) || []).length > 1) {
    const segments = s
      .split(/\s+(?=RONIN[-\s]|TVS\s+RONIN\b)/i)
      .map((part) => cleanVehicleModelName(part))
      .filter(Boolean);
    if (segments.length) {
      segments.sort((a, b) => vehicleNameScore(b) - vehicleNameScore(a));
      return segments[0];
    }
  }

  s = s.replace(/^'?S\s+RONIN\b/i, 'TVS RONIN');
  s = s.replace(/^RONIN\b/i, 'TVS RONIN');
  s = s.replace(/\b(?:Reck|Tbtmt|0BDHP|OBDHP)\b/gi, ' ');
  s = s.replace(/\bHP\s*Company\b/gi, ' ');
  s = s.replace(CHASSIS_ENGINE_FRAGMENT, ' ');
  s = s.replace(/\bRs\.?\s*[\d,.]+\b/gi, ' ');
  s = s.replace(/\b(?:frame|engine)\s*no\.?\b/gi, ' ');
  s = s.replace(/\s*-\s*-\s*/g, ' - ');
  s = s.replace(/\s+/g, ' ').trim();

  const m = s.match(/\b((?:TVS\s+)?RONIN(?:\s+[A-Z0-9][A-Za-z0-9\-]*){0,8})/i);
  if (m?.[1]) {
    const core = m[1].replace(/\s+/g, ' ').trim();
    const tail = s.slice(m.index + m[1].length).replace(/^[\s\-–—]+/, '');
    const trim = tail
      .replace(CHASSIS_ENGINE_FRAGMENT, ' ')
      .replace(/\b(?:Reck|Tbtmt|0BDHP|OBDHP)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (trim && VEHICLE_TRIM.test(trim) && trim.length <= 80) {
      return `${core} ${trim}`.replace(/\s+/g, ' ').trim();
    }
    return core;
  }
  return s.slice(0, 100);
}

function vehicleNameScore(s) {
  return (
    (/\bTVS\b/i.test(s) ? 5 : 0) +
    (/\bLIGHTNING\b/i.test(s) ? 3 : 0) +
    (/\bBLACK\b/i.test(s) ? 2 : 0) +
    (/\bBASE\b/i.test(s) ? 2 : 0) +
    (/\bOBDIIB?\b/i.test(s) ? 1 : 0) -
    ((s.match(/\bRONIN\b/gi) || []).length > 1 ? 4 : 0) -
    (/\b(?:Reck|Tbtmt|0BDHP)\b/i.test(s) ? 5 : 0) +
    Math.min(s.length / 25, 3)
  );
}

/** Standalone variant/spec line — not a merchandise title on its own. */
export function isVariantOnlyLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length > 80) return false;
  if (PRODUCT_BRAND.test(s) && !VARIANT_IN_PARENS.test(s)) return false;
  if (VARIANT_IN_PARENS.test(s)) return true;
  if (/^\(\s*[^)]+\d+\s*GB[^)]*\)$/i.test(s)) return true;
  if (
    /^(?:black|white|blue|grey|gray|silver|gold|ultra|pro|plus|lite|max)\b/i.test(s) &&
    s.split(/\s+/).length <= 4 &&
    !PRODUCT_BRAND.test(s)
  ) {
    return true;
  }
  return false;
}

export function isNonProductRowName(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (isServiceInstructionLine(s)) return true;
  if (NON_PRODUCT_ROW.test(s)) return true;
  if (/^(?:cgst|sgst|igst)\s*[:@]/i.test(s)) return true;
  if (/^amount\s*\/?\s*coupon/i.test(s)) return true;
  if (/^includes?\s+hsrp/i.test(s)) return true;
  if (/^(?:\d+\.\s*)?(?:tools|manual(?:\s*book)?(?:-e-)?(?:\s*manual)?|duplicate\s*keys|welcome\s*kit|hp\s*company|hypothecation)\b/i.test(s)) {
    return true;
  }
  if (/\b(?:puc|pollution\s*under\s*control|hsrp\s+and\s+fittings)\b/i.test(s) && !VEHICLE_MODEL.test(s)) {
    return true;
  }
  return false;
}

export function combineProductVariantName(productName, variantLine) {
  const product = String(productName || '').trim();
  const variant = String(variantLine || '').trim();
  if (!product) return variant;
  if (!variant) return product;
  const normProduct = product.toLowerCase();
  const normVariant = variant.replace(/^\(|\)$/g, '').trim().toLowerCase();
  if (normProduct.includes(normVariant)) return product;
  if (variant.startsWith('(')) return `${product} ${variant}`.replace(/\s+/g, ' ').trim();
  return `${product} (${variant})`.replace(/\s+/g, ' ').trim();
}

/**
 * Merge variant-only rows into the preceding real product row.
 * @param {object[]} items pipeline/UI items with name/productName, startIndex
 */
export function mergeVariantContinuations(items = []) {
  const list = (Array.isArray(items) ? items : []).map((it) => ({ ...it }));
  if (list.length < 2) return { items: list, corrections: [] };

  const corrections = [];
  const out = [];

  for (const it of list) {
    const name = String(it.name || it.productName || '').trim();
    const prev = out[out.length - 1];

    if (
      prev &&
      !/\b(?:motor\s*company|motors?\s*(?:company|limited)|company\s*limited|moto\s*legends)\b/i.test(
        String(prev.name || prev.productName || ''),
      ) &&
      (isVariantOnlyLine(name) || isVehicleVariantContinuation(name, prev.name || prev.productName)) &&
      !isNonProductRowName(prev.name || prev.productName) &&
      Math.abs(Number(it.startIndex ?? it.index ?? 0) - Number(prev.startIndex ?? prev.index ?? 0)) <= 6
    ) {
      const merged = combineProductVariantName(prev.name || prev.productName, name);
      const cleaned = cleanVehicleModelName(merged) || merged;
      prev.name = cleaned;
      prev.productName = cleaned;
      prev.imei = prev.imei || it.imei || '';
      prev.serialNumber = prev.serialNumber || it.serialNumber || '';
      if (!(lineAmount(prev) > 0) && lineAmount(it) > 0) {
        prev.amount = it.amount;
        prev.lineTotal = it.lineTotal;
        prev.rate = it.rate;
        prev.unitPrice = it.unitPrice;
      }
      prev.source = `${prev.source || 'heuristic'}+variant_merge`;
      corrections.push({ action: 'merged_variant_continuation', variant: name, into: merged });
      continue;
    }

    if (isVariantOnlyLine(name) && !prev) {
      corrections.push({ action: 'dropped_orphan_variant_line', variant: name });
      continue;
    }

    out.push(it);
  }

  return { items: out, corrections };
}

function lineAmount(it) {
  return Number(it?.amount ?? it?.lineTotal ?? it?.rate ?? it?.unitPrice);
}

export default {
  isVariantOnlyLine,
  isNonProductRowName,
  isServiceInstructionLine,
  isVehicleVariantContinuation,
  cleanVehicleModelName,
  combineProductVariantName,
  mergeVariantContinuations,
};
