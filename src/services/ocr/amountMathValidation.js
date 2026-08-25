/**
 * Monetary validation — flag mismatches; never silently pick a random amount.
 */

import { parseInvoiceMoney } from './invoiceAmountGuard';

/**
 * @returns {{
 *   ok: boolean,
 *   grandTotal: number|null,
 *   computedTotal: number|null,
 *   delta: number|null,
 *   flag: string|null,
 *   message: string|null,
 *   needsUserVerify: boolean
 * }}
 */
export function validateInvoiceAmounts(data = {}) {
  const grand =
    parseInvoiceMoney(data.grandTotal ?? data.totalAmount ?? data.total_amount ?? data.price) ??
    null;
  const sub =
    parseInvoiceMoney(data.subtotal ?? data.taxableAmount ?? data.taxable_value) ?? null;
  const tax =
    parseInvoiceMoney(
      data.tax ??
        data.taxAmount ??
        ((Number(data.cgst) || 0) + (Number(data.sgst) || 0) + (Number(data.igst) || 0) || null),
    ) ?? null;
  const discount = parseInvoiceMoney(data.discount ?? data.discountAmount) ?? 0;

  if (grand == null && sub == null) {
    return {
      ok: false,
      grandTotal: null,
      computedTotal: null,
      delta: null,
      flag: 'missing_amount',
      message: 'Amount not detected. Please enter the total manually.',
      needsUserVerify: true,
    };
  }

  if (sub != null && tax != null && grand != null) {
    const computed = Math.round((sub + tax - (discount || 0)) * 100) / 100;
    const delta = Math.round(Math.abs(computed - grand) * 100) / 100;
    // Allow ₹2 rounding / paisa noise; flag larger gaps
    if (delta > 2 && delta / Math.max(grand, 1) > 0.02) {
      return {
        ok: false,
        grandTotal: grand,
        computedTotal: computed,
        delta,
        flag: 'amount_mismatch',
        message: `Amount mismatch detected. Total ₹${formatInr(grand)} vs calculated ₹${formatInr(computed)}. Please verify.`,
        needsUserVerify: true,
      };
    }
  }

  // Line items sum vs grand
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length >= 2 && grand != null) {
    const sum = items.reduce((acc, row) => {
      const a = parseInvoiceMoney(row.amount ?? row.total ?? row.lineTotal);
      return acc + (a || 0);
    }, 0);
    if (sum > 0) {
      const delta = Math.abs(sum - grand);
      if (delta > 5 && delta / Math.max(grand, 1) > 0.08) {
        return {
          ok: false,
          grandTotal: grand,
          computedTotal: Math.round(sum * 100) / 100,
          delta: Math.round(delta * 100) / 100,
          flag: 'line_items_mismatch',
          message: `Amount mismatch detected. Line items ≈ ₹${formatInr(sum)} but total ₹${formatInr(grand)}. Please verify.`,
          needsUserVerify: true,
        };
      }
    }
  }

  return {
    ok: true,
    grandTotal: grand,
    computedTotal: null,
    delta: 0,
    flag: null,
    message: null,
    needsUserVerify: false,
  };
}

function formatInr(n) {
  return Number(n).toLocaleString('en-IN');
}

export default { validateInvoiceAmounts };
