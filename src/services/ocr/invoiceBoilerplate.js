/**
 * Semantic + positional rejection of invoice footer / support / legal noise.
 * Footer OCR must never become a product line item.
 */

const PRODUCT_HINT =
  /\b(?:phone|mobile|handset|laptop|tv|led|ac|fridge|refrigerator|washing|geyser|watch|earbud|headphone|tablet|console|camera|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|boat|sony|lg|voltas|daikin|blue\s*star|tvs|hero|honda|bajaj|ronin)\b|\(\s*[^)]*\d+\s*GB\s*[^)]*\)/i;

const FOOTER_SEMANTIC =
  /(?:helpcentre|help\s*center|customer\s*care|toll[\s\-]?free|contact\s+us|support|grievance|ombudsman|authorized\s*signatory|e\s*&\s*o\.?\s*e|original\s*for\s*recipient|subject\s*to\s*jurisdiction|terms\s*(?:and|&)\s*conditions|return\s*policy|refund|replace(?:ment)?\s*policy|download\s*(?:the\s*)?(?:tvs\s*)?connect\s*app|book\s*a\s*service|check\s*service|tvs\s*connect|scan\s*(?:the\s*)?qr|upi\s*id|paytm|phonepe|google\s*pay|neft|rtgs|ifsc|registered\s*office|cin\s*:|www\.|\.com\/|https?:\/\/|facebook|instagram|twitter|youtube|play\.google|app\s*store|invoice\s*is\s*system\s*generated|this\s*is\s*a\s*computer|includes?\s+hsrp)/i;

const COUPON_PAYMENT =
  /\b(?:coupon|coupons|promo(?:tion)?|voucher|cashback|supercoins?|plus\s*membership|amount\s*\/?\s*coupon)\b/i;

const CONTACT_PHONE_HEAVY =
  /\b(?:contact|helpline|call|phone|tel|mobile)\b/i;

function lineIndexRatio(index, total) {
  if (!(total > 0)) return 0;
  return index / total;
}

/**
 * @param {string} text
 * @param {{ index?: number, totalLines?: number, afterGrandTotal?: boolean }} [ctx]
 */
export function isBoilerplateFooter(text, ctx = {}) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return true;
  if (FOOTER_SEMANTIC.test(s)) return true;
  if (PRODUCT_HINT.test(s) && !/download|book\s*a\s*service|check\s*service|tvs\s*connect/i.test(s)) {
    return false;
  }
  if (/\bRONIN\b/i.test(s) && !/download|connect\s*app|check\s*service/i.test(s)) return false;

  const idx = Number(ctx.index);
  const total = Number(ctx.totalLines);
  const late = Number.isFinite(idx) && Number.isFinite(total) && total > 4 && lineIndexRatio(idx, total) >= 0.62;
  const afterTotal = Boolean(ctx.afterGrandTotal);

  if (FOOTER_SEMANTIC.test(s)) return true;
  if (COUPON_PAYMENT.test(s)) return true;
  if (CONTACT_PHONE_HEAVY.test(s) && (/\d{8,}/.test(s) || /www\.|\.com/i.test(s))) return true;
  if (/\d{10,}/.test(s.replace(/\s/g, '')) && /www\.|\.com|help/i.test(s)) return true;
  if (/^(?:thank\s*you!?|page\s*\d+(?:\s*of\s*\d+)?)$/i.test(s)) return true;
  if (afterTotal && !PRODUCT_HINT.test(s) && s.length < 80) return true;
  if (late && !PRODUCT_HINT.test(s) && (FOOTER_SEMANTIC.test(s) || COUPON_PAYMENT.test(s) || CONTACT_PHONE_HEAVY.test(s))) {
    return true;
  }
  // Garbled footer (Flipkart "fwoles Number" / "Ameunt /Ceupons")
  if (late && /(?:amount|ameunt|coupon|ceupon|number|nmber)/i.test(s) && !PRODUCT_HINT.test(s)) {
    return true;
  }
  return false;
}

export function markGrandTotalBoundary(lines) {
  const list = Array.isArray(lines) ? lines : [];
  let boundary = list.length;
  for (let i = 0; i < list.length; i += 1) {
    if (/grand\s*tot[ae]l|amount\s*payable|net\s*payable|net\s*total/i.test(String(list[i] || ''))) {
      boundary = i;
      break;
    }
  }
  return boundary;
}

export default { isBoilerplateFooter, markGrandTotalBoundary };
