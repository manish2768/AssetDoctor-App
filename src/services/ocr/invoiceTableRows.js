/**
 * Flipkart / GST invoice table-row detection — preserves qty ↔ amount relationships.
 */

import {
  isAbsurdPurchaseAmount,
  isCrumbProductLineAmount,
  isIdentifierMoneyDigits,
  parseInvoiceMoney,
} from './invoiceAmountGuard';

const MONEY_RE =
  /([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g;

/**
 * Scan document for classic marketplace table rows:
 *   qty  gross  discount  taxable  sgst  cgst  lineTotal
 * @param {string[]|string} linesOrText
 */
export function findInvoiceTableRows(linesOrText) {
  const lines = normalizeLines(linesOrText);
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseTableMoneyLine(lines[i]);
    if (parsed) {
      rows.push({ index: i, ...parsed, raw: lines[i] });
    }
  }
  return rows;
}

function parseTableMoneyLine(line) {
  const s = String(line || '').trim();
  if (!s || /helpcentre|coupon|thank\s*you|authorized\s*signatory/i.test(s)) return null;
  const nums = extractMoneyNums(s);
  if (nums.length < 4) return null;
  const qty = nums[0];
  if (!(qty >= 1 && qty <= 99)) return null;
  const gross = nums[1];
  if (isCrumbProductLineAmount(gross)) return null;
  const discount = nums.length >= 3 ? nums[2] : 0;
  const last = nums[nums.length - 1];
  let lineTotal = null;
  if (nums.length >= 6 && last > 0 && !isCrumbProductLineAmount(last)) {
    lineTotal = last;
  } else if (gross > 0 && discount >= 0) {
    lineTotal = Math.round((gross - discount) * 100) / 100;
  } else {
    lineTotal = gross;
  }
  if (isCrumbProductLineAmount(lineTotal) || isAbsurdPurchaseAmount(lineTotal)) return null;
  return {
    qty,
    gross,
    discount,
    taxableValue: nums.length >= 4 ? nums[3] : null,
    lineTotal,
    tax: nums.length >= 6 ? Math.round(((nums[4] || 0) + (nums[5] || 0)) * 100) / 100 : null,
  };
}

function extractMoneyNums(line) {
  const matches = String(line || '').match(MONEY_RE) || [];
  const out = [];
  for (const raw of matches) {
    if (isIdentifierMoneyDigits(raw)) continue;
    const n = parseInvoiceMoney(raw);
    if (n == null || isAbsurdPurchaseAmount(n)) continue;
    out.push(n);
  }
  return out;
}

function normalizeLines(input) {
  if (Array.isArray(input)) {
    return input.map((l) => String(l || '').trim()).filter(Boolean);
  }
  return String(input || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Nearest GST/marketplace table row to a product title line index. */
export function pickNearestTableRow(rows, productLineIndex) {
  let best = null;
  let bestDist = Infinity;
  for (const row of rows || []) {
    const dist = Math.abs(Number(row.index) - Number(productLineIndex));
    if (dist <= 20 && dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return best;
}

export default { findInvoiceTableRows, pickNearestTableRow };
