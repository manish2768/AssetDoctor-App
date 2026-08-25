/**
 * Semantic reconciliation — document totals vs line-item amounts.
 * Never copy grandTotal onto lineItem.unitPrice without table/layout evidence.
 * Never use taxable value as the customer-facing asset price.
 */

import { pickNearestTableRow } from './invoiceTableRows';
import { isValidProductName } from './productNameValidation';
import {
  isAbsurdPurchaseAmount,
  isCrumbProductLineAmount,
  amountsReconcile,
} from './invoiceAmountGuard';
import {
  isNonProductRowName,
  isVariantOnlyLine,
  mergeVariantContinuations,
  isServiceInstructionLine,
  cleanVehicleModelName,
} from './lineItemVariantMerge';

const FEE_RE =
  /handling\s*fee|delivery\s*(?:fee|charge)|shipping|platform\s*fee|convenience\s*fee|packaging\s*fee|cod\s*(?:fee|charge)/i;

const PRODUCTISH =
  /\b(?:phone|mobile|handset|laptop|tv|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|boat|sony|lg|fridge|ac|watch|tablet|tvs|ronin|hero|honda|bajaj|pulsar|apache|bike|scooter|motorcycle)\b/i;

const VEHICLEISH = PRODUCTISH;

function isFeeName(name) {
  return FEE_RE.test(String(name || ''));
}

function itemAmount(it) {
  return Number(it?.amount ?? it?.lineTotal ?? it?.rate ?? it?.unitPrice);
}

function tableRowForAmount(amount, tableRows) {
  const v = Number(amount);
  if (!(v > 0)) return null;
  for (const row of tableRows || []) {
    if (row.taxableValue != null && Math.abs(Number(row.taxableValue) - v) <= Math.max(2, v * 0.001)) {
      return row;
    }
  }
  return null;
}

function applyTableRowPricing(it, row, corrections, reason) {
  if (!row || isCrumbProductLineAmount(row.lineTotal)) return false;
  it.amount = row.lineTotal;
  it.lineTotal = row.lineTotal;
  it.rate = row.gross ?? row.lineTotal;
  it.unitPrice = it.rate;
  it.taxableValue = row.taxableValue;
  it.qty = row.qty ?? it.qty ?? 1;
  it.quantity = it.qty;
  it.source = `${it.source || 'heuristic'}+${reason}`;
  it.tableRowIndex = row.index;
  it.priceConfidence = Math.max(Number(it.priceConfidence) || 0, 90);
  corrections.push({ action: reason, lineTotal: row.lineTotal, fromTaxable: row.taxableValue });
  return true;
}

/**
 * @param {object[]} items UI/pipeline items
 * @param {{ totalAmount?: number|null, subtotal?: number|null, taxAmount?: number|null, lines?: string[] }} doc
 * @param {object[]} [tableRows] from findInvoiceTableRows
 */
export function reconcileLineItemsWithDocument(items = [], doc = {}, tableRows = []) {
  const corrections = [];
  const merged = mergeVariantContinuations(items);
  corrections.push(...merged.corrections);

  let list = merged.items.filter(
    (it) =>
      !it?.isFee &&
      !isFeeName(it?.name || it?.productName) &&
      !isNonProductRowName(it?.name || it?.productName) &&
      !isServiceInstructionLine(it?.name || it?.productName) &&
      !isVariantOnlyLine(it?.name || it?.productName) &&
      isValidProductName(it?.name || it?.productName || ''),
  );
  const fees = merged.items.filter((it) => it.isFee || isFeeName(it?.name || it?.productName));

  const grand = Number(doc.totalAmount ?? doc.grandTotal);
  const hasGrand = Number.isFinite(grand) && grand > 0 && !isAbsurdPurchaseAmount(grand);

  for (const it of list) {
    let amount = itemAmount(it);
    const qty = Number(it.qty ?? it.quantity) || 1;

    if (isCrumbProductLineAmount(amount)) {
      corrections.push({ action: 'rejected_crumb_line_amount', value: amount, product: it.name || it.productName });
      amount = null;
      it.amount = null;
      it.lineTotal = null;
      it.rate = null;
      it.unitPrice = null;
      it.priceNeedsReview = true;
    }

    const taxableRow = tableRowForAmount(amount, tableRows);
    if (taxableRow) {
      applyTableRowPricing(it, taxableRow, corrections, 'taxable_upgraded_to_line_total');
      amount = itemAmount(it);
    }

    if ((amount == null || !(amount > 0)) && tableRows.length) {
      const start = Number(it.startIndex ?? it.index ?? 0);
      const near = pickNearestTableRow(tableRows, start);
      if (near && applyTableRowPricing(it, near, corrections, 'line_amount_from_table_row')) {
        amount = itemAmount(it);
      }
    }

    if (hasGrand && amount != null && amount > 0 && !amountsReconcile(amount, grand)) {
      const near = pickNearestTableRow(tableRows, Number(it.startIndex ?? it.index ?? 0));
      if (near && amountsReconcile(near.lineTotal, grand)) {
        applyTableRowPricing(it, near, corrections, 'amount_reconciled_to_grand_via_table');
        amount = itemAmount(it);
      }
    }

    if (hasGrand && qty === 1 && amount != null && !amountsReconcile(amount, grand) && tableRows.length === 1) {
      applyTableRowPricing(it, tableRows[0], corrections, 'single_table_row_price_fix');
    }
  }

  if (hasGrand && list.length === 1) {
    const it = list[0];
    let amount = itemAmount(it);
    const near = pickNearestTableRow(tableRows, Number(it.startIndex ?? it.index ?? 0));
    const row = near || (tableRows.length === 1 ? tableRows[0] : null);

    if (row && amountsReconcile(row.lineTotal, grand)) {
      applyTableRowPricing(it, row, corrections, 'single_product_table_reconcile');
      amount = itemAmount(it);
    }

    if (
      VEHICLEISH.test(it.name || it.productName) &&
      (!(amount > 0) || !amountsReconcile(amount, grand))
    ) {
      it.amount = grand;
      it.lineTotal = grand;
      it.rate = grand;
      it.unitPrice = grand;
      it.qty = it.qty ?? 1;
      it.quantity = it.qty;
      it.source = `${it.source || 'heuristic'}+vehicle_grand_total_reconcile`;
      it.priceConfidence = Math.max(Number(it.priceConfidence) || 0, 90);
      corrections.push({ action: 'vehicle_single_product_grand_total', lineTotal: grand });
      amount = grand;
    }

    if (isCrumbProductLineAmount(amount)) {
      it.priceNeedsReview = true;
      corrections.push({ action: 'single_product_crumb_needs_review', grandTotal: grand });
    } else if (amount != null && amountsReconcile(amount, grand)) {
      it.priceConfidence = Math.max(Number(it.priceConfidence) || 0, 92);
    }
  } else if (list.length > 1 && hasGrand && tableRows.length === 1) {
    list.sort((a, b) => itemAmount(b) - itemAmount(a));
    const primary =
      list.find((it) => VEHICLEISH.test(it.name || it.productName)) ||
      list.find((it) => PRODUCTISH.test(it.name || it.productName)) ||
      list[0];
    applyTableRowPricing(primary, tableRows[0], corrections, 'multi_noise_collapse_primary');
    if (!itemAmount(primary) || !amountsReconcile(itemAmount(primary), grand)) {
      primary.amount = grand;
      primary.lineTotal = grand;
      primary.rate = grand;
      primary.unitPrice = grand;
      corrections.push({ action: 'vehicle_multi_noise_grand_total', lineTotal: grand });
    }
    const cleanedName = cleanVehicleModelName(primary.name || primary.productName);
    if (cleanedName) {
      primary.name = cleanedName;
      primary.productName = cleanedName;
    }
    list = [primary];
    corrections.push({ action: 'collapsed_multi_product_noise_to_one' });
  }

  return { items: [...list, ...fees], corrections };
}

export default { reconcileLineItemsWithDocument };
