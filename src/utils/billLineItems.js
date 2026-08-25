/**
 * Indian retail / marketplace bill line items (Flipkart, Amazon, Croma, local GST).
 * Keeps ALL table rows including Handling Fee / Delivery even when net total is ₹0.
 */

const MONEY = String.raw`([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)`;

const SKIP_LINE =
  /^(?:gstin|gstin\/uin|pan|cin|invoice\s*number|order\s*id|order\s*date|invoice\s*date|bill\s*to|ship\s*to|phone|sold\s*by|tax\s*invoice|e\s*&\s*o\.?\s*e|authorized\s*signatory|original\s*for|page\s*\d)/i;

const HEADER_LINE =
  /^(?:product\s*title|description|particulars|qty|quantity|gross\s*amount|discount|taxable|sgst|cgst|igst|utgst|total\s*₹|hsn|sac)\b/i;

const FEE_NAME =
  /^(?:handling\s*fee|delivery\s*(?:fee|charge|charges)?|shipping\s*(?:fee|charge)?|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)?)$/i;

const PRODUCTISH =
  /\b(?:phone|mobile|handset|laptop|tv|led|ac|fridge|watch|earbud|headphone|tablet|console|camera|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|croma|boat)\b|\(\s*[^)]*\d+\s*GB\s*[^)]*\)/i;

/**
 * @param {string[]|string} linesOrText
 * @param {{ subtotal?: number|null, totalAmount?: number|null }} [hints]
 */
export function extractBillLineItems(linesOrText, hints = {}) {
  const lines = normalizeLines(linesOrText);
  if (!lines.length) {
    return { items: [], itemCount: 0, itemsSubtotal: null };
  }

  // Marketplace / Flipkart-style multi-column tables first
  const marketplace = extractMarketplaceItems(lines);
  if (marketplace.items.length) {
    return finalize(marketplace.items, hints);
  }

  const candidates = [];
  const seen = new Set();

  for (const line of lines) {
    if (SKIP_LINE.test(line) || HEADER_LINE.test(line)) continue;
    if (line.length < 3 || line.length > 160) continue;

    const fee = parseFeeLine(line);
    if (fee) {
      const key = `${fee.name.toLowerCase()}::${fee.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ ...fee, raw: line, score: scoreItem(fee) });
      }
      continue;
    }

    const parsed = parseItemLine(line);
    if (!parsed || !isAcceptableItem(parsed)) continue;

    const key = `${parsed.name.toLowerCase()}::${parsed.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ ...parsed, raw: line, score: scoreItem(parsed) });
  }

  const reconciled = reconcileRetailItems(candidates, hints);
  return finalize(reconciled, hints);
}

/**
 * Flipkart / Amazon style: product title on its own line(s), amounts on a later qty row.
 */
export function extractMarketplaceItems(lines) {
  const items = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (SKIP_LINE.test(line) || HEADER_LINE.test(line)) continue;
    if (/^(?:total|grand\s*total|taxable\s*value)\b/i.test(line)) continue;

    // Explicit fee rows
    if (FEE_NAME.test(cleanName(line)) || FEE_NAME.test(line.split(/\s{2,}/)[0] || '')) {
      const amounts = extractTrailingAmounts(line);
      const feeName = cleanName(line.replace(new RegExp(`${MONEY}.*$`), '').trim()) || 'Handling Fee';
      const lookAhead = amounts.length ? amounts : extractTrailingAmounts(lines[i + 1] || '');
      const total = computeLineItemPrice(lookAhead);
      if (total == null || total <= 0) continue; // discard ₹0 handling / fee nets
      const gross = lookAhead[1] != null ? lookAhead[1] : total;
      const key = `${feeName.toLowerCase()}::fee`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          name: feeName.match(FEE_NAME) ? feeName : detectFeeLabel(line) || 'Handling Fee',
          qty: lookAhead[0] && lookAhead[0] <= 99 ? lookAhead[0] : 1,
          rate: gross,
          amount: total,
          isFee: true,
          raw: line,
          imei: '',
          serialNumber: '',
        });
      }
      continue;
    }

    if (!PRODUCTISH.test(line) && !isStandaloneProductTitle(line)) continue;
    if (JUNK_TITLE.test(line)) continue;

    const title = cleanName(line).slice(0, 120);
    if (!isLikelyItemName(title) && !PRODUCTISH.test(title)) continue;

    // Gather description window + amount row
    const window = lines.slice(i, Math.min(lines.length, i + 8));
    const imei = findImeiInWindow(window);
    const serial = findSerialInWindow(window);
    let amountRow = null;
    let amountIdx = -1;
    for (let j = 1; j < window.length; j += 1) {
      const nums = extractTrailingAmounts(window[j]);
      // Flipkart row: qty gross discount taxable sgst cgst total (6–7 numbers)
      if (nums.length >= 3 && nums[0] >= 1 && nums[0] <= 99) {
        const last = nums[nums.length - 1];
        if (last >= 0 && (last >= 20 || nums.length >= 5)) {
          amountRow = nums;
          amountIdx = i + j;
          break;
        }
      }
    }

    // Amounts may be on same line as title (rare)
    if (!amountRow) {
      const same = extractTrailingAmounts(line);
      if (same.length >= 2) amountRow = same;
    }

    if (!amountRow) {
      // Still keep product with null amount if IMEI found (user can fill)
      if (!imei && !serial) continue;
      const key = `${title.toLowerCase()}::meta`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        name: title,
        qty: 1,
        rate: null,
        amount: null,
        isFee: false,
        raw: line,
        imei,
        serialNumber: serial,
      });
      continue;
    }

    const qty = amountRow[0] <= 99 ? amountRow[0] : 1;
    const gross = amountRow.length >= 2 ? amountRow[1] : null;
    const discount = amountRow.length >= 3 ? amountRow[2] : 0;
    const total = computeLineItemPrice(amountRow);
    // Skip zero / negligible nets (e.g. Handling Fee after full discount)
    if (total == null || total <= 0) continue;

    const key = `${title.toLowerCase()}::${total}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      name: title,
      qty,
      rate: gross != null ? gross : total,
      amount: total,
      grossAmount: gross,
      discount: discount,
      isFee: false,
      raw: lines.slice(i, amountIdx >= 0 ? amountIdx + 1 : i + 1).join(' | '),
      imei,
      serialNumber: serial,
    });
  }

  // Orphan fee lines — only keep if net price > 0
  for (let i = 0; i < lines.length; i += 1) {
    const label = cleanName(lines[i]);
    if (!FEE_NAME.test(label)) continue;
    if (items.some((it) => FEE_NAME.test(it.name))) continue;
    const nums = extractTrailingAmounts(lines[i + 1] || '') || extractTrailingAmounts(lines[i]);
    const total = computeLineItemPrice(nums) ?? 0;
    if (total <= 0) continue; // discard Handling Fee ₹0 etc.
    items.push({
      name: label,
      qty: nums[0] && nums[0] <= 99 ? nums[0] : 1,
      rate: nums[1] != null ? nums[1] : 0,
      amount: total,
      isFee: true,
      raw: lines[i],
      imei: '',
      serialNumber: '',
    });
  }

  return {
    items: items.map((item, index) => ({
      index: index + 1,
      name: item.name,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount == null ? 0 : item.amount,
      grossAmount: item.grossAmount,
      discount: item.discount,
      isFee: Boolean(item.isFee),
      imei: item.imei || '',
      serialNumber: item.serialNumber || '',
      raw: item.raw,
    })),
  };
}

export function pickPrimaryItem(items = []) {
  if (!Array.isArray(items) || !items.length) return null;
  const FEE =
    /handling\s*fee|delivery\s*(?:fee|charge|charges)?|shipping\s*(?:fee|charge)?|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)?/i;
  const VEHICLEISH =
    /\b(?:tvs|hero|honda|bajaj|yamaha|suzuki|ronin|pulsar|activa|splendor|bike|scooter|motorcycle)\b/i;
  const ACCESSORYISH = /includes?\s+hsrp|hsrp|fittings?|accessory|helmet|cover/i;

  const products = items.filter((i) => {
    if (i?.isFee) return false;
    if (FEE.test(String(i?.name || ''))) return false;
    if (ACCESSORYISH.test(String(i?.name || '')) && !VEHICLEISH.test(String(i?.name || ''))) {
      return false;
    }
    return Number(i?.amount) > 0;
  });

  const pool = products.length
    ? products
    : items.filter((i) => !i?.isFee && !FEE.test(String(i?.name || '')));

  if (!pool.length) return null;

  return [...pool].sort((a, b) => {
    const an = String(a.name || '');
    const bn = String(b.name || '');
    const aBoost = VEHICLEISH.test(an) ? 50000 : ACCESSORYISH.test(an) ? -50000 : 0;
    const bBoost = VEHICLEISH.test(bn) ? 50000 : ACCESSORYISH.test(bn) ? -50000 : 0;
    const av = Number(a.amount || a.rate || 0) + aBoost;
    const bv = Number(b.amount || b.rate || 0) + bBoost;
    return bv - av;
  })[0];
}

export function auditItemsVsTotal({ items = [], itemsSubtotal = null, totalAmount = null } = {}) {
  const count = Array.isArray(items) ? items.length : 0;
  const productCount = Array.isArray(items) ? items.filter((i) => !i.isFee).length : 0;
  const sub =
    itemsSubtotal != null
      ? Number(itemsSubtotal)
      : count
        ? Math.round(
            items
              .map((i) => Number(i.amount))
              .filter((n) => Number.isFinite(n))
              .reduce((a, b) => a + b, 0) * 100,
          ) / 100
        : null;
  const total = totalAmount != null && Number(totalAmount) > 0 ? Number(totalAmount) : null;

  if (total == null) {
    return {
      ok: false,
      itemCount: count,
      itemsSubtotal: sub,
      message: 'Bill total value missing — please confirm Grand Total before save.',
    };
  }

  if (!count) {
    return {
      ok: true,
      itemCount: 0,
      itemsSubtotal: sub,
      message: `Bill total ₹${total} found. Confirm product name manually if needed.`,
    };
  }

  return {
    ok: true,
    itemCount: count,
    itemsSubtotal: sub,
    message: `${count} row(s) · ${productCount} product(s) · items ₹${sub ?? '—'} · bill total ₹${total}.`,
  };
}

import { enrichItemWithCategory } from '../services/ocr/categoryClassifier';

function finalize(rawItems, hints) {
  const hintText = [
    hints?.productName,
    hints?.shopName,
    hints?.totalAmount != null ? 'invoice' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const grandHint =
    hints?.totalAmount != null && Number(hints.totalAmount) > 0 ? Number(hints.totalAmount) : null;

  let normalized = rawItems.map((item, i) => {
    const base = {
      index: i + 1,
      name: item.name,
      qty: item.qty ?? 1,
      rate: item.rate,
      amount: item.amount == null ? null : Number(item.amount),
      grossAmount: item.grossAmount,
      discount: item.discount,
      isFee: Boolean(item.isFee),
      imei: item.imei || '',
      serialNumber: item.serialNumber || '',
      raw: item.raw,
      smartCategory: item.smartCategory,
    };
    if (base.isFee) {
      return {
        ...base,
        smartCategory: 'other',
        categoryId: 'other',
        categoryLabel: 'Other',
        trackImei: false,
        trackSerial: false,
        trackPucService: false,
        seasonalServiceAlerts: false,
        isElectricAppliance: false,
      };
    }
    return enrichItemWithCategory(base, hintText);
  });

  // Discard zero / negligible nets (Handling Fee 24−24=0, etc.)
  normalized = normalized.filter((item) => {
    if (item.isFee) return Number(item.amount) > 0;
    if (item.amount == null) {
      // Keep IMEI/serial-only rows temporarily; fill from Grand Total below
      return Boolean(item.imei || item.serialNumber);
    }
    return Number(item.amount) > 0;
  });

  // Fallback: blank product amount → invoice Grand Total
  if (grandHint != null) {
    normalized = normalized.map((item) => {
      if (item.isFee) return item;
      if (item.amount == null || Number(item.amount) <= 0) {
        return { ...item, amount: grandHint, rate: item.rate || grandHint };
      }
      return item;
    });
  }

  // Drop anything still <= 0
  normalized = normalized
    .filter((item) => Number(item.amount) > 0)
    .map((item, i) => ({ ...item, index: i + 1 }));

  const amounts = normalized.map((i) => i.amount).filter((v) => v != null && Number.isFinite(v) && v > 0);
  const itemsSubtotal = amounts.length
    ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100
    : null;

  return {
    items: normalized,
    itemCount: normalized.length,
    itemsSubtotal,
    hintsUsed: hints || null,
  };
}

/**
 * Prefer keeping marketplace products + fees; don't drop ₹0 fees.
 */
function reconcileRetailItems(candidates, hints) {
  if (!candidates.length) return [];

  const fees = candidates.filter((c) => c.isFee || FEE_NAME.test(c.name));
  const products = candidates.filter((c) => !c.isFee && !FEE_NAME.test(c.name));

  const target =
    (hints.totalAmount != null && Number(hints.totalAmount) > 0 && Number(hints.totalAmount)) ||
    (hints.subtotal != null && Number(hints.subtotal) > 0 && Number(hints.subtotal)) ||
    null;

  let chosen = [];
  if (target) {
    const tol = Math.max(2, target * 0.04);
    const hit = products.find((c) => Math.abs(Number(c.amount) - target) <= tol);
    if (hit) chosen = [hit];
    else {
      const ranked = [...products].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      chosen = ranked.filter((c) => Number(c.amount) >= 50).slice(0, 4);
      if (!chosen.length) chosen = ranked.slice(0, 2);
    }
  } else {
    chosen = [...products].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 4);
  }

  // Always append fee rows ONLY when net > 0
  for (const fee of fees) {
    if (Number(fee.amount) <= 0) continue;
    if (!chosen.some((c) => c.name === fee.name)) chosen.push(fee);
  }

  return chosen.filter((c) => Number(c.amount) > 0);
}

function parseFeeLine(line) {
  const cleaned = line.replace(/[|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const feeMatch = cleaned.match(
    /^(handling\s*fee|delivery\s*(?:fee|charge|charges)?|shipping\s*(?:fee|charge)?|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)?)\b(.*)$/i,
  );
  if (!feeMatch) return null;
  const name = cleanName(feeMatch[1]);
  const nums = extractTrailingAmounts(feeMatch[2] || cleaned);
  const amount = computeLineItemPrice(nums);
  if (amount == null || amount <= 0) return null;
  return {
    name,
    qty: nums[0] && nums[0] <= 99 ? nums[0] : 1,
    rate: nums[1] != null ? nums[1] : amount,
    amount,
    numbered: false,
    kind: 'fee',
    isFee: true,
  };
}

function parseItemLine(line) {
  const cleaned = line.replace(/[|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const numbered = /^\d{1,3}[\.\)\-:]\s*/.test(cleaned);
  const body = cleaned.replace(/^\d{1,3}[\.\)\-:]\s*/, '');

  let m = body.match(
    /^(.+?)\s+(?:x|×|\*)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:@|rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)\s*(?:=|:)?\s*(?:rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)\s*$/i,
  );
  if (m) {
    const name = cleanName(m[1]);
    if (!isLikelyItemName(name)) return null;
    const qty = toNum(m[2]);
    const rate = toNum(m[3]);
    const amount = toNum(m[4]) ?? (qty != null && rate != null ? round2(qty * rate) : null);
    return { name, qty, rate, amount, numbered, kind: 'x', isFee: FEE_NAME.test(name) };
  }

  // Multi-column Flipkart amount row glued to name
  m = body.match(new RegExp(`^(.+?)\\s+${MONEY}(?:\\s+${MONEY}){2,6}\\s*$`));
  if (m) {
    const name = cleanName(m[1]);
    const nums = extractTrailingAmounts(body);
    if (isLikelyItemName(name) && nums.length >= 3) {
      return {
        name,
        qty: nums[0] <= 99 ? nums[0] : 1,
        rate: nums[1],
        amount: computeLineItemPrice(nums),
        numbered,
        kind: 'marketplace-row',
        isFee: FEE_NAME.test(name),
      };
    }
  }

  m = body.match(/^(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9,]+\.?[0-9]*)\s+([0-9,]+\.?[0-9]*)\s*$/);
  if (m) {
    const name = cleanName(m[1]);
    if (!isLikelyItemName(name)) return null;
    const qty = toNum(m[2]);
    if (qty == null || qty < 1 || qty > 99) return null;
    return {
      name,
      qty,
      rate: toNum(m[3]),
      amount: toNum(m[4]),
      numbered,
      kind: 'qty-rate-amt',
      isFee: FEE_NAME.test(name),
    };
  }

  m = body.match(/^(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s+(?:rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)\s*$/i);
  if (m && numbered) {
    const name = cleanName(m[1]);
    if (!isLikelyItemName(name)) return null;
    const qty = toNum(m[2]);
    const amount = toNum(m[3]);
    if (qty == null || qty < 1 || qty > 99) return null;
    if (amount == null) return null;
    if (amount < 50 && !FEE_NAME.test(name)) return null;
    return {
      name,
      qty,
      rate: amount > 0 ? round2(amount / qty) : 0,
      amount,
      numbered,
      kind: 'qty-amt',
      isFee: FEE_NAME.test(name),
    };
  }

  m = body.match(
    /^(.+?)\s+(?:rs\.?|inr|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]{3,}(?:\.[0-9]+)?)\s*$/i,
  );
  if (m && numbered) {
    const name = cleanName(m[1].replace(/[\.\-_]{2,}/g, ' '));
    const amount = toNum(m[2]);
    if (!isLikelyItemName(name) || amount == null) return null;
    if (amount < 50 && !FEE_NAME.test(name)) return null;
    return { name, qty: 1, rate: amount, amount, numbered, kind: 'named-amt', isFee: FEE_NAME.test(name) };
  }

  return null;
}

function isAcceptableItem(parsed) {
  if (!parsed?.name || parsed.amount == null) return false;
  if (FEE_NAME.test(parsed.name) || parsed.isFee) return true;
  if (parsed.amount < 50) return false;
  if (JUNK_TITLE.test(parsed.name)) return false;
  if ((parsed.name.match(/\d/g) || []).length > parsed.name.length * 0.5) return false;
  return true;
}

function scoreItem(parsed) {
  let s = 0;
  if (parsed.numbered) s += 6;
  if (parsed.kind === 'qty-rate-amt' || parsed.kind === 'x' || parsed.kind === 'marketplace-row') s += 4;
  if (parsed.amount >= 500) s += 2;
  if (parsed.amount >= 5000) s += 2;
  if (PRODUCTISH.test(parsed.name)) s += 5;
  if (parsed.isFee) s += 1;
  if (JUNK_TITLE.test(parsed.name)) s -= 12;
  return s;
}

const JUNK_TITLE =
  /(?:invoice|bill\s*(?:no|number|date)|gstin|taxable|grand\s*total|sub\s*total|amount\s*payable|customer|payment|cash|upi|^date$|^total$|number\s*#|cgst|sgst|igst|hsn|sac|\bstin\s*[a-z0-9]|order\s*id|flipkart|amazon|includes?\s+hsrp|hsrp\s+and\s+fittings|ex[\s\-]?showroom\s*price|helpline|toll[\s\-]?free)/i;

function isLikelyItemName(name) {
  if (!name || name.length < 3 || name.length > 120) return false;
  if (SKIP_LINE.test(name) || JUNK_TITLE.test(name)) return false;
  if (!/[A-Za-z]{3,}/.test(name)) return false;
  if (/^(?:total|tax|gst|cgst|sgst|discount|round|cash|upi|date|number|qty|rate|amount|stin|handsets)$/i.test(name)) {
    return false;
  }
  return true;
}

function isStandaloneProductTitle(line) {
  if (line.length < 8 || line.length > 120) return false;
  if (!/[A-Za-z]{4,}/.test(line)) return false;
  if (extractTrailingAmounts(line).length >= 3) return false;
  return /\([^)]+\)/.test(line) || /\b\d{2,4}\s*GB\b/i.test(line);
}

function findImeiInWindow(windowLines) {
  const blob = windowLines.join('\n');
  const m =
    blob.match(/IMEI\s*\/?\s*Serial\s*No\.?\s*[:\-]?\s*\[?\s*([0-9\s]{14,20})\s*\]?/i) ||
    blob.match(/\[?\s*IMEI(?:\s*\/\s*Serial\s*No\.?)?\s*[:\-]?\s*([0-9\s]{14,20})\s*\]?/i) ||
    blob.match(/\bIMEI\s*[:\-#]?\s*([0-9\s]{14,20})\b/i);
  const digits = m?.[1] ? String(m[1]).replace(/\D/g, '') : '';
  if (digits.length >= 14 && digits.length <= 17) return digits.slice(0, 15);
  // Standalone 15-digit in product window → IMEI only
  const bare = blob.replace(/(\d)\s+(?=\d)/g, '$1').match(/\b([0-9]{15})\b/);
  return bare?.[1] || '';
}

function findSerialInWindow(windowLines) {
  const blob = windowLines.join('\n');
  const imei = findImeiInWindow(windowLines);
  if (imei) return '';
  const m = blob.match(/(?:S(?:r|erial)?\.?\s*No\.?|Serial(?:\s*(?:Number|No\.?))?|S\/N)\s*[:\-#]?\s*([A-Z0-9\-\/]{5,})/i);
  const value = m?.[1] ? String(m[1]).trim() : '';
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 15) return '';
  return value.slice(0, 40);
}

function extractTrailingAmounts(line) {
  const matches = String(line || '').match(new RegExp(MONEY, 'g')) || [];
  return matches
    .map((raw) => toNum(raw))
    .filter((n) => n != null);
}

/**
 * Marketplace / Flipkart row price:
 * Prefer Gross Amount − Discount. NEVER use Taxable Value as purchase price.
 * Columns typically: qty | gross | discount | taxable | sgst | cgst | total
 */
export function computeLineItemPrice(nums = []) {
  const values = (nums || []).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  if (!values.length) return null;

  // qty + gross + discount (+ optional taxable/tax/total)
  if (values.length >= 3 && values[0] >= 1 && values[0] <= 99) {
    const gross = values[1];
    const discount = values[2];
    const taxable = values.length >= 4 ? values[3] : null;
    const last = values[values.length - 1];

    if (gross != null && gross >= 0 && discount != null && discount >= 0) {
      const fromGross = round2(gross - discount);
      // Gross − Discount is the purchase price when positive
      if (fromGross > 0) {
        // Prefer inclusive total column when it matches (within ₹1) or is slightly higher
        if (last > 0 && last !== taxable && Math.abs(last - fromGross) <= 1) return last;
        if (last > 0 && last !== taxable && last >= fromGross && last <= fromGross * 1.3) {
          // last is likely "Total (incl. tax)" — prefer when clearly the bill total column
          if (values.length >= 6) return last;
        }
        return fromGross;
      }
      // 100% discount / fee wiped to zero
      if (fromGross <= 0) return 0;
    }

    // Fallback: last positive column that is NOT taxable-only
    if (last > 0 && (taxable == null || last !== taxable || values.length < 4)) return last;
    if (last > 0) return last;
    return 0;
  }

  if (values.length === 2) {
    const a = values[1];
    return a > 0 ? a : 0;
  }

  const last = values[values.length - 1];
  return last > 0 ? last : 0;
}

/** @deprecated use computeLineItemPrice — kept as alias */
function pickRowTotal(nums = []) {
  return computeLineItemPrice(nums);
}

function detectFeeLabel(line) {
  const m = String(line).match(
    /(handling\s*fee|delivery\s*(?:fee|charge|charges)?|shipping\s*(?:fee|charge)?|platform\s*fee|convenience\s*fee)/i,
  );
  return m ? cleanName(m[1]) : '';
}

function cleanName(value) {
  return String(value || '')
    .replace(/[₹]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\-\:\.\d\)\(]+\s*/, '')
    .trim();
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

function toNum(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const digitsOnly = cleaned.replace(/\D/g, '');
  // Never treat IMEI (15), bare 10-digit IDs, or 1800 helplines as line prices
  if (digitsOnly.length === 15) return null;
  if (digitsOnly.length === 10 && !cleaned.includes('.')) return null;
  if (/^180[0-9]/.test(digitsOnly) && digitsOnly.length >= 4 && digitsOnly.length <= 12) {
    return null;
  }
  if (/^1860/.test(digitsOnly) && digitsOnly.length >= 4 && digitsOnly.length <= 12) {
    return null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export default {
  extractBillLineItems,
  extractMarketplaceItems,
  pickPrimaryItem,
  auditItemsVsTotal,
  computeLineItemPrice,
};
