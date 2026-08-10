/**
 * Safe money parsing for vault saves — never NaN → ₹0 from "₹23,999".
 */

export function parseMoneyValue(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  }
  const cleaned = String(raw)
    .replace(/₹/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  // Reject IMEI / phone-like identifiers
  const digits = cleaned.replace(/\./g, '');
  if (digits.length === 15 || (digits.length === 10 && !cleaned.includes('.'))) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function toVaultValue(raw, fallback = 0) {
  const n = parseMoneyValue(raw);
  return n != null ? n : fallback;
}

export default parseMoneyValue;
