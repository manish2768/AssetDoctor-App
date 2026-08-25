/**
 * Grand-total selection — never pick the largest number on the page.
 * Priority: Grand Total → Amount Payable → Total Invoice Value → Invoice Total → consistent line total.
 * Glued tax (1830.43 → 183043) must lose to labeled 23999.
 */

import {
  parseInvoiceMoney,
  isAbsurdPurchaseAmount,
  isIdentifierMoneyDigits,
  isLikelyGluedTaxTotal,
  resolveBestPurchaseTotal,
  parseIndianAmountInWords,
} from './invoiceAmountGuard';

const LABEL_PRIORITY = [
  { id: 'grand_total', re: /grand\s*tot[ae]l/i },
  { id: 'amount_payable', re: /amount\s*payable|net\s*payable/i },
  { id: 'total_invoice_value', re: /total\s*invoice\s*value/i },
  { id: 'invoice_total', re: /invoice\s*total/i },
  { id: 'net_total', re: /net\s*total|net\s*amount/i },
  { id: 'total_amount', re: /total\s*amount(?:\s*payable)?/i },
  { id: 'ex_showroom', re: /ex[\s\-]?showroom\s*price|on[\s\-]?road\s*price/i },
];

/** Parser crumbs like qty=1 becoming ₹4 must not beat a real retail total. */
const MIN_PARSER_HINT_INR = 50;

/**
 * Collect labeled amount candidates from OCR lines.
 * @returns {{ candidates: Array<{amount:number, label:string, priority:number}>, selected: number|null, reason: string, uncertain: boolean }}
 */
export function selectGrandTotal(linesOrText, opts = {}) {
  const lines = Array.isArray(linesOrText)
    ? linesOrText
    : String(linesOrText || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

  const candidates = [];
  const corrections = [];

  const wordsTotal = parseIndianAmountInWords(lines.join('\n'));
  if (wordsTotal != null && !isAbsurdPurchaseAmount(wordsTotal)) {
    candidates.push({ amount: wordsTotal, label: 'amount_in_words', priority: 0, source: 'words' });
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || '';
    if (/(?:cgst|sgst|igst|taxable\s*value|handling\s*fee)\b/i.test(line) && !/grand\s*total|amount\s*payable/i.test(line)) {
      continue;
    }
    for (let p = 0; p < LABEL_PRIORITY.length; p += 1) {
      const rule = LABEL_PRIORITY[p];
      if (!rule.re.test(line)) continue;
      const same = parseInvoiceMoney(line.replace(rule.re, '').replace(/[:\-]/g, ' '));
      if (same != null && !isAbsurdPurchaseAmount(same) && !isIdentifierMoneyDigits(String(same))) {
        candidates.push({ amount: same, label: rule.id, priority: p, source: `line:${i}` });
      }
      for (let look = 1; look <= 2; look += 1) {
        const nextAmt = parseInvoiceMoney(lines[i + look] || '');
        if (nextAmt != null && !isAbsurdPurchaseAmount(nextAmt) && !isIdentifierMoneyDigits(String(nextAmt))) {
          candidates.push({
            amount: nextAmt,
            label: rule.id,
            priority: p,
            source: `line:${i}+${look}`,
          });
        }
      }
    }
  }

  // Also consider explicit parser / gemini / line-item hints (not raw page max)
  const hintSources = [
    { amount: opts.parserTotal, label: 'parser', priority: 1 },
    { amount: opts.geminiTotal, label: 'gemini', priority: 4 },
    { amount: opts.lineItemTotal, label: 'line_item', priority: 5 },
  ];
  for (const h of hintSources) {
    const n = parseInvoiceMoney(h.amount);
    if (n == null || isAbsurdPurchaseAmount(n) || isIdentifierMoneyDigits(String(n))) continue;
    if (n < MIN_PARSER_HINT_INR) {
      corrections.push({ dropped: n, reason: 'parser_crumb_too_small' });
      continue;
    }
    candidates.push({ amount: n, label: h.label, priority: h.priority, source: h.label });
  }

  // Unlabeled Indian retail amounts (23,999) — only if no labeled total yet.
  // Prefer values that repeat (line total == grand total). Never page-max.
  const retailHits = collectRepeatedRetailAmounts(lines);
  for (const hit of retailHits) {
    candidates.push({
      amount: hit.amount,
      label: hit.repeats >= 2 ? 'repeated_line_total' : 'indian_comma_amount',
      priority: hit.repeats >= 2 ? 3 : 6,
      repeats: hit.repeats,
      source: hit.source,
    });
  }

  // Drop glued-tax outliers vs smaller trusted candidates
  const amounts = [...new Set(candidates.map((c) => c.amount))];
  const filtered = candidates.filter((c) => {
    if (c.label === 'amount_in_words' || c.label === 'ex_showroom') return true;
    const glued = amounts.some((other) => other < c.amount && isLikelyGluedTaxTotal(c.amount, other));
    if (glued) {
      corrections.push({ dropped: c.amount, reason: 'glued_tax_vs_smaller_total' });
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    return {
      candidates,
      selected: null,
      reason: 'no_labeled_total',
      uncertain: true,
      corrections,
      priceCandidates: amounts,
    };
  }

  // Prefer labeled totals; among same band prefer repeats — never page-max
  filtered.sort(
    (a, b) => a.priority - b.priority || (b.repeats || 0) - (a.repeats || 0),
  );
  const bestPriority = filtered[0].priority;
  const topBand = filtered.filter((c) => c.priority === bestPriority);
  const selected = resolveBestPurchaseTotal(...topBand.map((c) => c.amount));

  // Arithmetic check when subtotal + tax available
  let uncertain = false;
  const sub = parseInvoiceMoney(opts.subtotal);
  const tax = parseInvoiceMoney(opts.taxAmount);
  if (selected != null && sub != null && tax != null) {
    const computed = Math.round((sub + tax) * 100) / 100;
    const delta = Math.abs(computed - selected);
    if (delta > 2 && delta / Math.max(selected, 1) > 0.05) {
      uncertain = true;
      corrections.push({ selected, computed, reason: 'arithmetic_mismatch' });
    }
  }

  return {
    candidates: filtered,
    selected,
    reason: topBand[0]?.label || 'priority_label',
    uncertain,
    corrections,
    priceCandidates: [...new Set(filtered.map((c) => c.amount))],
  };
}

function collectRepeatedRetailAmounts(lines) {
  const counts = new Map();
  const sources = new Map();
  const commaRe = /(?:₹|rs\.?)?\s*(\d{1,2},\d{3}(?:,\d{2,3})*(?:\.\d{1,2})?)/gi;
  const plainRe = /\b(\d{4,6}(?:\.\d{2})?)\b/g;

  const add = (raw, source, lineText = '') => {
    const n = parseInvoiceMoney(raw);
    if (n == null || n < 500 || isAbsurdPurchaseAmount(n) || isIdentifierMoneyDigits(String(n))) {
      return;
    }
    if (Number.isInteger(n) && n >= 1990 && n <= 2100) return;
    if (
      n >= 100000 &&
      n <= 999999 &&
      Number.isInteger(n) &&
      /(?:lucknow|pin|pincode|pradesh|husainganj)/i.test(lineText)
    ) {
      return;
    }
    counts.set(n, (counts.get(n) || 0) + 1);
    if (!sources.has(n)) sources.set(n, source);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || '';
    if (/(?:hsn|sac|gstin|cin|pan|fsn|imei|order\s*id|od\d|invoice\s*date|order\s*date|booking\s*no)/i.test(line)) continue;
    commaRe.lastIndex = 0;
    let m;
    while ((m = commaRe.exec(line))) add(m[1], `comma:${i}`, line);
    plainRe.lastIndex = 0;
    while ((m = plainRe.exec(line))) {
      if (String(m[1]).replace(/\D/g, '').length >= 8) continue;
      add(m[1], `plain:${i}`, line);
    }
  }

  return [...counts.entries()].map(([amount, repeats]) => ({
    amount,
    repeats,
    source: sources.get(amount),
  }));
}

export default { selectGrandTotal };
