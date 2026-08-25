/**
 * OCR V2 — structured line-item extraction.
 *
 * Item is NOT a free-text OCR dump. Build:
 * { productName, brand, model, variant, quantity, unitPrice, discount,
 *   taxableValue, tax, lineTotal, sku, hsn, serialNumber, imei,
 *   confidence, source }
 *
 * Hard exclusions: IMEI / Serial / HSN / Invoice / GSTIN / Tax / Qty labels
 * never become productName. Use productNameValidation + invoiceAmountGuard.
 */

import {
  evaluateProductName,
  isValidProductName,
  sanitizeProductName,
} from './productNameValidation';
import { isBoilerplateFooter, markGrandTotalBoundary } from './invoiceBoilerplate';
import {
  isAbsurdPurchaseAmount,
  isCrumbProductLineAmount,
  isIdentifierMoneyDigits,
  parseInvoiceMoney,
  amountsReconcile,
} from './invoiceAmountGuard';
import { findInvoiceTableRows, pickNearestTableRow } from './invoiceTableRows';
import {
  isVariantOnlyLine,
  isNonProductRowName,
  isServiceInstructionLine,
  isVehicleVariantContinuation,
  cleanVehicleModelName,
} from './lineItemVariantMerge';

/** Column header synonyms (EN + HI) → semantic role */
const HEADER_ROLES = [
  {
    role: 'product',
    re: /^(?:item|description|product(?:\s*(?:title|description|name))?|particulars|article|goods|विवरण|वस्तु|सामग्री)$/i,
  },
  { role: 'qty', re: /^(?:qty|quantity|pcs|nos?\.?|मात्रा|संख्या)$/i },
  { role: 'rate', re: /^(?:rate|price|unit\s*price|mrp|दर|मूल्य)$/i },
  { role: 'amount', re: /^(?:amount|total|line\s*total|value|राशि|कुल)$/i },
  { role: 'discount', re: /^(?:disc(?:ount)?|छूट)$/i },
  { role: 'taxable', re: /^(?:taxable(?:\s*value)?|कर\s*योग्य)$/i },
  { role: 'tax', re: /^(?:tax|cgst|sgst|igst|gst|कर)$/i },
  { role: 'hsn', re: /^(?:hsn|sac|hsn\/sac)$/i },
  { role: 'sku', re: /^(?:sku|item\s*code|article\s*(?:no|code)?)$/i },
  { role: 'imei', re: /^(?:imei(?:\s*[12])?|imei\s*\/\s*serial)$/i },
  { role: 'serial', re: /^(?:serial(?:\s*(?:no|number))?|s\/n|sn|सीरियल)$/i },
];

const HARD_EXCLUDE =
  /^(?:imei|imei\s*[12]|imev|serial(?:\s*(?:no|number|#))?|s\/n|sn|sku(?:\s*no)?|hsn(?:\/sac)?|ean|upc|barcode|gstin|invoice(?:\s*(?:no|number|#))?|order(?:\s*(?:no|number))?|po(?:\s*number)?|tracking(?:\s*(?:no|id))?|phone(?:\s*number)?|tax|cgst|sgst|igst|amount|total|rate|qty|quantity|विवरण|मात्रा|दर|राशि|कुल|कर|बिल\s*संख्या)$/i;

const PRODUCT_HINT =
  /\b(?:phone|mobile|handset|laptop|tv|led|ac|fridge|refrigerator|washing|geyser|watch|earbud|headphone|tablet|console|camera|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|boat|sony|lg|voltas|daikin|blue\s*star|tvs|hero|honda|bajaj|ronin)\b|\(\s*[^)]*\d+\s*GB\s*[^)]*\)/i;

const MONEY_RE =
  /([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g;

/**
 * @param {string[]|string} linesOrText
 * @param {{ subtotal?: number|null, totalAmount?: number|null }} [hints]
 */
export function extractStructuredLineItems(linesOrText, hints = {}) {
  const lines = normalizeLines(linesOrText);
  if (!lines.length) {
    return emptyResult();
  }

  const tableRows = findInvoiceTableRows(lines);
  const grandBoundary = markGrandTotalBoundary(lines);
  const header = detectHeaderRow(lines);
  const candidates = [];

  // Pass 1: product title lines + nearby amount / IMEI window
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSkipLine(line)) continue;
    if (isVariantOnlyLine(line)) continue;
    if (header && i === header.index) continue;

    const merged = mergeMultiLineProduct(lines, i);
    if (!merged) continue;

    const nameEval = evaluateProductName(merged.text, {
      fromLineItem: true,
      labeledProduct: Boolean(header?.roles?.includes('product')),
    });
    if (!nameEval.ok || !nameEval.value) continue;
    if (HARD_EXCLUDE.test(nameEval.value)) continue;
    if (
      isBoilerplateFooter(nameEval.value, {
        index: i,
        totalLines: lines.length,
        afterGrandTotal: i > grandBoundary,
      })
    ) {
      continue;
    }

    const window = lines.slice(i, Math.min(lines.length, i + merged.span + 6));
    const imei = extractImeiFromWindow(window);
    const serial = extractSerialFromWindow(window, imei);
    const hsn = extractHsnFromWindow(window);
    const sku = extractSkuFromWindow(window);
    const money = extractMoneyFromWindow(window, hints);

    let qty = money.qty ?? 1;
    const unitPrice = money.unitPrice;
    const lineTotal = money.lineTotal;
    const discount = money.discount;
    const taxableValue = money.taxableValue;
    const tax = money.tax;

    // Need either money or identifiers to keep the row
    if (
      (lineTotal == null || lineTotal <= 0) &&
      (unitPrice == null || unitPrice <= 0) &&
      !imei &&
      !serial
    ) {
      if (!PRODUCT_HINT.test(nameEval.value)) continue;
      candidates.push(
        buildItem({
          productName: nameEval.value,
          quantity: 1,
          unitPrice: null,
          lineTotal: null,
          imei,
          serialNumber: serial,
          hsn,
          sku,
          productNameConfidence: nameEval.confidence,
          priceConfidence: 0,
          source: 'product_title_only',
          raw: merged.raw,
          startIndex: i,
        }),
      );
      i += merged.span - 1;
      continue;
    }

    let finalTotal = lineTotal;
    let finalRate = unitPrice;
    if (isCrumbProductLineAmount(finalTotal)) {
      finalTotal = null;
      finalRate = null;
    }
    if (isCrumbProductLineAmount(finalRate)) {
      finalRate = null;
    }

    if ((finalTotal == null || finalTotal <= 0) && tableRows.length) {
      const near = pickNearestTableRow(tableRows, i);
      if (near) {
        finalTotal = near.lineTotal;
        finalRate = near.gross ?? near.lineTotal;
        qty = near.qty ?? qty;
        money.priceConfidence = Math.max(money.priceConfidence || 0, 88);
      }
    }

    if ((finalTotal == null || finalTotal <= 0) && finalRate != null && finalRate > 0) {
      finalTotal = round2(finalRate * qty);
    }
    if ((finalRate == null || finalRate <= 0) && finalTotal != null && finalTotal > 0) {
      finalRate = round2(finalTotal / Math.max(1, qty));
    }

    // Grand-total hint only when still no valid product line amount
    if ((finalTotal == null || finalTotal <= 0) && hints?.totalAmount) {
      if (!PRODUCT_HINT.test(nameEval.value) && !imei) continue;
      const g = Number(hints.totalAmount);
      const near = pickNearestTableRow(tableRows, i);
      const tableOk = near && Math.abs(near.lineTotal - g) <= Math.max(2, g * 0.02);
      if (
        tableOk &&
        tableRows.filter((r) => !isCrumbProductLineAmount(r.lineTotal)).length === 1 &&
        !isAbsurdPurchaseAmount(g) &&
        !isIdentifierMoneyDigits(String(g))
      ) {
        finalTotal = near.lineTotal;
        finalRate = near.gross ?? near.lineTotal;
      }
    }

    if (finalTotal != null && isCrumbProductLineAmount(finalTotal)) {
      finalTotal = null;
      finalRate = null;
    }
    if (finalRate != null && isAbsurdPurchaseAmount(finalRate)) {
      finalRate = finalTotal;
    }

    candidates.push(
      buildItem({
        productName: nameEval.value,
        quantity: qty,
        unitPrice: finalRate,
        discount,
        taxableValue,
        tax,
        lineTotal: finalTotal,
        imei,
        serialNumber: serial,
        hsn,
        sku,
        productNameConfidence: nameEval.confidence,
        priceConfidence: money.priceConfidence,
        quantityConfidence: money.qtyConfidence,
        imeiConfidence: imei ? 95 : 0,
        serialConfidence: serial ? 85 : 0,
        source: header ? 'table_window' : 'heuristic_window',
        raw: merged.raw,
        startIndex: i,
      }),
    );
    i += merged.span - 1;
  }

  // Deduplicate by product name
  const seen = new Set();
  const unique = [];
  for (const item of candidates) {
    const key = String(item.productName || '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue;
    // Prefer rows with money / IMEI
    const rival = unique.find(
      (u) =>
        String(u.productName || '')
          .toLowerCase()
          .replace(/\s+/g, ' ') === key,
    );
    if (rival) continue;
    seen.add(key);
    unique.push(item);
  }

  const products = unique.filter(
    (i) =>
      !isFeeName(i.productName) &&
      !isNonProductRowName(i.productName) &&
      !isVariantOnlyLine(i.productName) &&
      !isBoilerplateFooter(i.productName, { afterGrandTotal: i.startIndex > grandBoundary }),
  );
  const hinted = products.filter((i) => PRODUCT_HINT.test(i.productName));
  const fees = unique.filter((i) => isFeeName(i.productName) && Number(i.lineTotal) > 0);
  // Never fall back to unfiltered unique rows (footer/support junk).
  let chosen = hinted.length ? hinted : products;

  const grand =
    hints?.totalAmount != null && Number(hints.totalAmount) > 0 ? Number(hints.totalAmount) : null;
  // Grand total → line amount ONLY with table/layout evidence and arithmetic reconciliation.
  if (hinted.length === 1 && grand != null && !isAbsurdPurchaseAmount(grand)) {
    const only = hinted[0];
    const rowAmt = Number(only.lineTotal) > 0 ? Number(only.lineTotal) : Number(only.unitPrice);
    const hasValidRowMoney = rowAmt > 0 && !isCrumbProductLineAmount(rowAmt);
    const hasId = Boolean(only.imei || only.serialNumber);
    const near = pickNearestTableRow(tableRows, only.startIndex ?? 0);
    const tableOk =
      near &&
      !isCrumbProductLineAmount(near.lineTotal) &&
      amountsReconcile(near.lineTotal, grand);

    if (isCrumbProductLineAmount(rowAmt)) {
      only.lineTotal = null;
      only.unitPrice = null;
    }

    if (!hasValidRowMoney && tableOk) {
      only.lineTotal = near.lineTotal;
      only.unitPrice = near.gross ?? near.lineTotal;
      only.quantity = near.qty ?? only.quantity ?? 1;
      only.source = `${only.source}+table_row_reconcile`;
      only.priceConfidence = Math.max(only.priceConfidence || 0, 90);
    } else if (
      !hasValidRowMoney &&
      !tableOk &&
      (hasId || only.source === 'product_title_only')
    ) {
      only.lineTotal = null;
      only.unitPrice = null;
      only.needsReview = true;
      only.priceNeedsReview = true;
    }
    chosen = [only];
  } else if (hinted.length > 1) {
    chosen = hinted.map((item) => {
      if (!(Number(item.lineTotal) > 0) && !(Number(item.unitPrice) > 0)) {
        return { ...item, lineTotal: null, unitPrice: item.unitPrice ?? null };
      }
      return item;
    });
  }

  chosen = [...chosen].sort(
    (a, b) => Number(b.lineTotal || b.unitPrice || 0) - Number(a.lineTotal || a.unitPrice || 0),
  );
  if (chosen.length > 12) chosen = chosen.slice(0, 12);
  if (hinted.length !== 1) {
    chosen = [...chosen, ...fees.filter((f) => !chosen.includes(f))];
  }

  // Arithmetic confidence bump
  chosen = chosen.map((item) => validateItemMath(item));

  const uiItems = chosen.map((item, index) => toUiItem(item, index));
  const amounts = uiItems
    .map((i) => Number(i.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
  const itemsSubtotal = amounts.length
    ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100
    : null;

  return {
    items: uiItems,
    itemCount: uiItems.length,
    itemsSubtotal,
    structured: chosen,
    method: 'ocr_v2_structured',
  };
}

function emptyResult() {
  return {
    items: [],
    itemCount: 0,
    itemsSubtotal: null,
    structured: [],
    method: 'ocr_v2_structured',
  };
}

function buildItem(partial) {
  const brandModel = splitBrandModel(partial.productName);
  return {
    productName: partial.productName || '',
    brand: brandModel.brand,
    model: brandModel.model,
    variant: brandModel.variant,
    quantity: partial.quantity ?? 1,
    unitPrice: partial.unitPrice ?? null,
    discount: partial.discount ?? null,
    taxableValue: partial.taxableValue ?? null,
    tax: partial.tax ?? null,
    lineTotal: partial.lineTotal ?? null,
    sku: partial.sku || '',
    hsn: partial.hsn || '',
    serialNumber: partial.serialNumber || '',
    imei: partial.imei || '',
    productNameConfidence: partial.productNameConfidence ?? 0,
    priceConfidence: partial.priceConfidence ?? 0,
    quantityConfidence: partial.quantityConfidence ?? 70,
    serialConfidence: partial.serialConfidence ?? 0,
    imeiConfidence: partial.imeiConfidence ?? 0,
    confidence: 0,
    source: partial.source || 'unknown',
    raw: partial.raw || '',
    startIndex: partial.startIndex ?? 0,
  };
}

function toUiItem(item, index) {
  const amount =
    item.lineTotal != null && Number(item.lineTotal) > 0
      ? Number(item.lineTotal)
      : item.unitPrice != null
        ? Number(item.unitPrice)
        : null;
  return {
    index: index + 1,
    name: item.productName,
    productName: item.productName,
    brand: item.brand,
    model: item.model,
    variant: item.variant,
    qty: item.quantity ?? 1,
    rate: item.unitPrice,
    amount,
    grossAmount: item.unitPrice,
    discount: item.discount,
    taxableValue: item.taxableValue,
    tax: item.tax,
    isFee: isFeeName(item.productName),
    imei: item.imei || '',
    serialNumber: item.serialNumber || '',
    sku: item.sku || '',
    hsn: item.hsn || '',
    raw: item.raw,
    productNameConfidence: item.productNameConfidence,
    priceConfidence: item.priceConfidence,
    quantityConfidence: item.quantityConfidence,
    imeiConfidence: item.imeiConfidence,
    serialConfidence: item.serialConfidence,
    confidence: item.confidence,
    source: item.source,
    startIndex: item.startIndex ?? 0,
  };
}

function validateItemMath(item) {
  const qty = Number(item.quantity) || 1;
  const rate = Number(item.unitPrice);
  const total = Number(item.lineTotal);
  let priceConfidence = item.priceConfidence || 0;
  let confidence = Math.round(
    ((item.productNameConfidence || 0) + priceConfidence + (item.quantityConfidence || 0)) / 3,
  );

  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(total) && total > 0) {
    const expected = round2(rate * qty);
    const delta = Math.abs(expected - total);
    if (delta <= Math.max(2, total * 0.02)) {
      priceConfidence = Math.max(priceConfidence, 90);
      confidence = Math.max(confidence, 85);
    } else if (delta > total * 0.15) {
      priceConfidence = Math.min(priceConfidence, 45);
      confidence = Math.min(confidence, 50);
    }
  }

  return {
    ...item,
    priceConfidence,
    confidence,
    needsReview: confidence < 55 || priceConfidence < 50,
  };
}

function mergeMultiLineProduct(lines, start) {
  const first = String(lines[start] || '').trim();
  if (!first || isSkipLine(first)) return null;
  if (HARD_EXCLUDE.test(first)) return null;
  if (/^\d+$/.test(first.replace(/\s/g, ''))) return null;

  // Strong single-line product
  if (isProductTitleLine(first)) {
    const parts = [first];
    let span = 1;
    // Optional continuation: "256GB Black" / "S25 Ultra"
    for (let j = 1; j <= 2; j += 1) {
      const next = String(lines[start + j] || '').trim();
      if (!next || isSkipLine(next)) break;
      if (HARD_EXCLUDE.test(next)) break;
      if (extractImeiFromWindow([next])) break;
      if (countMoneyTokens(next) >= 3) break;
      if (
        next.length <= 80 &&
        (isVariantOnlyLine(next) ||
          isVehicleVariantContinuation(next, first) ||
          /^(?:\([^)]+\)|[A-Za-z0-9][A-Za-z0-9\s\-\/\+\(\)]{0,78})$/.test(next)) &&
        !/^(?:qty|rate|total|tax|gst|cgst|sgst)/i.test(next) &&
        (isVariantOnlyLine(next) ||
          isVehicleVariantContinuation(next, first) ||
          PRODUCT_HINT.test(next) ||
          /\b\d+\s*GB\b/i.test(next) ||
          /^(?:black|white|blue|grey|gray|silver|gold|ultra|pro|plus|lite|max|lightning|obd)/i.test(next) ||
          /^[A-Z0-9][\w\s\-]{0,20}$/.test(next))
      ) {
        // Only merge if first already productish OR next continues model
        if (PRODUCT_HINT.test(first) || isProductTitleLine(first)) {
          parts.push(next);
          span += 1;
          continue;
        }
      }
      break;
    }
    const text = cleanVehicleModelName(
      sanitizeProductName(parts.join(' '), { fromLineItem: true, fromVehicleModel: true }) ||
        parts.join(' '),
    ) || sanitizeProductName(parts.join(' '), { fromLineItem: true, fromVehicleModel: true });
    if (!text) return null;
    return { text, span, raw: parts.join(' | ') };
  }

  return null;
}

function isProductTitleLine(line) {
  const s = String(line || '').trim();
  if (isVariantOnlyLine(s)) return false;
  if (isNonProductRowName(s)) return false;
  if (s.length < 6 || s.length > 140) return false;
  if (!isValidProductName(s) && !PRODUCT_HINT.test(s)) {
    // Allow titles that pass after light cleanup
    const cleaned = sanitizeProductName(s, { fromLineItem: true });
    if (!cleaned) return false;
  }
  if (countMoneyTokens(s) >= 3) return false;
  if (HARD_EXCLUDE.test(s)) return false;
  if (/helpcentre|www\.|\.com\/|\bcoupon\b|\bcontact\b/i.test(s)) return false;
  if (isSellerCompanyName(s)) return false;
  if (isServiceInstructionLine(s)) return false;
  if (/^RONIN$/i.test(s)) return true;
  return (
    PRODUCT_HINT.test(s) ||
    (/\([^)]+\)/.test(s) && PRODUCT_HINT.test(s))
  );
}

function detectHeaderRow(lines) {
  for (let i = 0; i < Math.min(lines.length, 25); i += 1) {
    const parts = String(lines[i])
      .split(/\s{2,}|\t|\|/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 2) {
      // Single line with many header words
      const tokens = String(lines[i]).split(/\s+/);
      const roles = [];
      for (const t of tokens) {
        for (const h of HEADER_ROLES) {
          if (h.re.test(t)) roles.push(h.role);
        }
      }
      if (roles.includes('product') && (roles.includes('qty') || roles.includes('rate') || roles.includes('amount'))) {
        return { index: i, roles };
      }
      continue;
    }
    const roles = [];
    for (const p of parts) {
      for (const h of HEADER_ROLES) {
        if (h.re.test(p)) roles.push(h.role);
      }
    }
    if (roles.includes('product') && roles.length >= 2) {
      return { index: i, roles };
    }
  }
  return null;
}

function extractMoneyFromWindow(windowLines, hints) {
  let best = {
    qty: null,
    unitPrice: null,
    discount: null,
    taxableValue: null,
    tax: null,
    lineTotal: null,
    priceConfidence: 0,
    qtyConfidence: 50,
  };

  for (const line of windowLines) {
    if (/imei|serial\s*no|gstin|invoice/i.test(line) && countMoneyTokens(line) <= 1) {
      continue;
    }
    const nums = extractMoneyNums(line);
    if (nums.length < 2) continue;

    // Classic Flipkart: qty gross discount taxable sgst cgst total
    if (nums.length >= 3 && nums[0] >= 1 && nums[0] <= 99) {
      const qty = nums[0];
      const gross = nums[1];
      if (isCrumbProductLineAmount(gross)) continue;
      const discount = nums[2] ?? 0;
      const taxable = nums.length >= 4 ? nums[3] : null;
      const last = nums[nums.length - 1];
      let lineTotal = null;
      if (gross != null && discount != null) {
        const net = round2(gross - discount);
        if (net > 0 && !isCrumbProductLineAmount(net)) {
          if (
            nums.length >= 6 &&
            last > 0 &&
            !isAbsurdPurchaseAmount(last) &&
            !isCrumbProductLineAmount(last)
          ) {
            lineTotal = last;
          } else if (!isCrumbProductLineAmount(net)) {
            lineTotal = net;
          }
        }
      } else if (
        last > 0 &&
        !isAbsurdPurchaseAmount(last) &&
        !isCrumbProductLineAmount(last)
      ) {
        lineTotal = last;
      }
      if (
        lineTotal != null &&
        !isAbsurdPurchaseAmount(lineTotal) &&
        !isCrumbProductLineAmount(lineTotal)
      ) {
        best = {
          qty,
          unitPrice: gross > 0 && !isCrumbProductLineAmount(gross) ? gross : lineTotal,
          discount,
          taxableValue: taxable,
          tax: nums.length >= 6 ? round2((nums[4] || 0) + (nums[5] || 0)) : null,
          lineTotal,
          priceConfidence: 88,
          qtyConfidence: 90,
        };
        break;
      }
    }

    // Reject qty-only crumbs like "1 1" or "1 1 0" (page/qty fragments, not prices).
    if (nums.length >= 2 && nums.length < 4 && nums[0] >= 1 && nums[0] <= 99) {
      const gross = nums[1];
      if (isCrumbProductLineAmount(gross)) continue;
    }
  }

  // Fallback: grand total hint when window empty of money
  if (
    (best.lineTotal == null || best.lineTotal <= 0) &&
    hints?.totalAmount != null &&
    !isAbsurdPurchaseAmount(hints.totalAmount)
  ) {
    // only used by caller when product is strong
  }

  return best;
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

function countMoneyTokens(line) {
  return (String(line || '').match(MONEY_RE) || []).length;
}

const GARBLED_IMEI_SERIAL_RE =
  /(?:ime[ilvy0]{0,2}|meu)[\s\/\-_]*serial\s*(?:no\.?)?\s*[:\-]?\s*\[?\s*([0-9\s]{14,20})\s*\]?/i;
const GARBLED_IMEI_PAREN_RE =
  /(?:\(|\[)\s*(?:ime[ilvy0]{0,2}|meu)[\s\/\-_]*serial\s*no\.?\s+([0-9\s]{14,20})/i;

function extractImeiFromWindow(windowLines) {
  const blob = windowLines.join('\n');
  const patterns = [
    /IMEI\s*\/?\s*Serial\s*No\.?\s*[:\-]?\s*\[?\s*([0-9\s]{14,20})\s*\]?/i,
    /\[?\s*IMEI(?:\s*\/\s*Serial\s*No\.?)?\s*[:\-]?\s*([0-9\s]{14,20})\s*\]?/i,
    /\bIMEI\s*[12]?\s*[:\-#]?\s*([0-9\s]{14,20})\b/i,
    GARBLED_IMEI_SERIAL_RE,
    GARBLED_IMEI_PAREN_RE,
  ];
  for (const re of patterns) {
    const m = blob.match(re);
    if (!m?.[1]) continue;
    const digits = String(m[1]).replace(/\D/g, '');
    if (digits.length >= 14 && digits.length <= 17) return digits.slice(0, 17);
  }
  const phoneCtx = /\b(?:phone|handset|mobile|smartphone|nothing\s*phone|imei|serial\s*no)\b/i.test(blob);
  if (phoneCtx) {
    const bare = blob.replace(/(\d)\s+(?=\d)/g, '$1').match(/\b([0-9]{15})\b/);
    if (bare?.[1]) return bare[1];
  }
  return '';
}

function extractSerialFromWindow(windowLines, imei) {
  if (imei) return '';
  const blob = windowLines.join('\n');
  const m = blob.match(
    /(?:S(?:r|erial)?\.?\s*No\.?|Serial(?:\s*(?:Number|No\.?))?|S\/N|सीरियल(?:\s*नंबर)?)\s*[:\-#]?\s*([A-Z0-9\-\/]{5,})/i,
  );
  const value = m?.[1] ? String(m[1]).trim() : '';
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 15) return '';
  return value.slice(0, 40);
}

function extractHsnFromWindow(windowLines) {
  const blob = windowLines.join('\n');
  const m = blob.match(/\bHSN(?:\/SAC)?\s*[:\-]?\s*(\d{4,8})\b/i);
  return m?.[1] || '';
}

function extractSkuFromWindow(windowLines) {
  const blob = windowLines.join('\n');
  const m = blob.match(/\bSKU\s*[:\-]?\s*([A-Z0-9\-\/]{4,})\b/i);
  return m?.[1] || '';
}

function splitBrandModel(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/);
  if (parts.length < 2) return { brand: parts[0] || '', model: '', variant: '' };
  return {
    brand: parts[0],
    model: parts.slice(1, 3).join(' '),
    variant: parts.slice(3).join(' '),
  };
}

function isFeeName(name) {
  return /handling\s*fee|delivery\s*(?:fee|charge)|shipping|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)/i.test(
    String(name || ''),
  );
}

function isSkipLine(line) {
  const s = String(line || '').trim();
  if (isBoilerplateFooter(s)) return true;
  if (isServiceInstructionLine(s)) return true;
  if (isNonProductRowName(s)) return true;
  if (/^includes?\s+hsrp/i.test(s)) return true;
  if (/helpcentre|help\s*center|www\.|\.com\/|https?:\/\//i.test(s)) return true;
  if (/\bcoupon/i.test(s) || /amount\s*\/?\s*coupon/i.test(s)) return true;
  return /^(?:gstin|gstin\/uin|pan|cin|invoice\s*number|order\s*id|order\s*date|invoice\s*date|bill\s*to|ship\s*to|phone|sold\s*by|tax\s*invoice|thank\s*you!?|e\s*&\s*o\.?\s*e|authorized\s*signatory|original\s*for|page\s*\d|grand\s*total|amount\s*payable|बिल\s*संख्या)/i.test(
    s,
  );
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

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export default {
  extractStructuredLineItems,
};
