/**
 * Field-level validators for OCR review — address ≠ name, placeholders → null.
 * Never invent missing values.
 */

import { buyerNameOrNull } from './entityRoleClassifier';

const PLACEHOLDER_RE =
  /^(?:invoice\s*\/\s*policy\s*no\.?|leave\s*blank\s*if\s*not\s*on\s*(?:bill|policy)|buyer\s*\/\s*bill\s*to\s*name\s*from\s*document|enter\s*(?:invoice\s*)?(?:number|manually)|not\s*(?:available|detected|found)(?:\s*on\s*document)?(?:\s*[—\-]\s*enter\s*manually)?|yyyy-mm-dd|unknown|n\/?a|nil|null|undefined|dummy|test|—|--|\.\.\.|placeholder|last\s*4\/?6\s*digits\s*are\s*enough.*)$/i;

const ADDRESS_RE =
  /\b(?:road|rd\.?|crossing|street|st\.?|nagar|colony|sector|avenue|ave\.?|lane|marg|chowk|bypass|highway|nh[\s\-]?\d|pin(?:code)?|postal|district|tehsi[l]|block|plot|house\s*no|flat\s*no|apartment|near\s+|opp\.?|opposite)\b/i;

const CITY_PIN_RE =
  /\b(?:lucknow|kanpur|delhi|noida|gurgaon|gurugram|mumbai|pune|bengaluru|bangalore|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|patrakarpuram|gomti|hazratganj)\b|\b[1-9][0-9]{5}\b/i;

/**
 * True when string looks like a street / locality address, not a person name.
 */
export function isAddressLikeName(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (v.length > 80) return true;
  if (ADDRESS_RE.test(v)) return true;
  if (CITY_PIN_RE.test(v) && (ADDRESS_RE.test(v) || /\d/.test(v))) return true;
  // "Patrakarpuram Crossing Road" style — multiple address tokens
  const tokens = v.split(/\s+/);
  if (tokens.length >= 3 && ADDRESS_RE.test(v)) return true;
  return false;
}

export function isPlaceholderValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  return PLACEHOLDER_RE.test(v);
}

/**
 * Convert UI placeholders / junk to null (or '').
 */
export function stripPlaceholder(value, { asNull = true } = {}) {
  if (value == null) return asNull ? null : '';
  const v = String(value).trim();
  if (!v || isPlaceholderValue(v)) return asNull ? null : '';
  return v;
}

/**
 * Owner / buyer name — blank if address-like or placeholder.
 */
export function sanitizeOwnerName(value) {
  const stripped = stripPlaceholder(value, { asNull: false });
  if (!stripped) return '';
  if (isAddressLikeName(stripped)) return '';
  const person = buyerNameOrNull(stripped);
  if (!person) return '';
  if (/^(?:cash|walk[\s\-]?in|customer|buyer|bill\s*to)$/i.test(stripped)) return '';
  return person.slice(0, 80);
}

/**
 * Apply placeholder + owner sanitization across common invoice keys.
 */
export function sanitizeExtractedFields(data = {}) {
  const next = { ...data };
  const stringKeys = [
    'invoiceNumber',
    'productName',
    'shopName',
    'serialNumber',
    'imei',
    'chassisNumber',
    'engineNumber',
    'registration',
    'paymentMode',
    'customerName',
    'buyerName',
    'customerPhone',
    'itemName',
    'vendor',
  ];
  for (const key of stringKeys) {
    if (next[key] == null) continue;
    const cleaned = stripPlaceholder(next[key], { asNull: false });
    next[key] = cleaned || '';
  }
  next.customerName = sanitizeOwnerName(next.customerName || next.buyerName || '');
  next.buyerName = next.customerName;
  next.buyer_name = next.customerName;
  next.owner_buyer_name = next.customerName;

  const insuranceIdentity =
    /insurance/i.test(String(next.documentKind || next.documentType || '')) ||
    Boolean(next.policyNumber || next.policyHolder || next.normalizedInsurance);
  if (insuranceIdentity) {
    const canonVal = (field) => {
      const hit = next.normalizedInsurance?.[field];
      if (hit && typeof hit === 'object' && hit !== null && 'value' in hit) return hit.value;
      return hit;
    };
    const holder = String(next.policyHolder || canonVal('policyHolder') || '').trim();
    const policyNo = String(next.policyNumber || canonVal('policyNumber') || '').trim();
    if (holder) {
      next.policyHolder = holder;
      next.customerName = holder;
      next.buyerName = holder;
      next.buyer_name = holder;
      next.owner_buyer_name = holder;
    }
    if (policyNo) {
      next.policyNumber = policyNo;
      next.invoiceNumber = policyNo;
    }
  }

  if (isPlaceholderValue(next.invoiceNumber)) next.invoiceNumber = '';
  if (isAddressLikeName(next.productName)) {
    // Product can occasionally include location in marketplace titles — only clear pure addresses
    if (!/\b(?:phone|mobile|laptop|tv|fridge|bike|car|nothing|samsung)\b/i.test(next.productName)) {
      next.productName = '';
    }
  }
  return next;
}

export default {
  isAddressLikeName,
  isPlaceholderValue,
  stripPlaceholder,
  sanitizeOwnerName,
  sanitizeExtractedFields,
};
