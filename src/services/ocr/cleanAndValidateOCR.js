/**
 * Clean + validate Gemini / OCR JSON before Review fill.
 * Rejects serial/IMEI/address product titles and absurd totals.
 * Never invents missing dates or vendors (leave blank for user edit).
 */

import {
  isAddressLikeText,
  isImeiOrSerialTitle,
  looksLikeProductName,
  resolveProductName,
} from '../../utils/productNameSanitizer';
import { isTaxIdentifierText, resolveBestPurchaseTotal, MAX_PLAUSIBLE_INR } from './invoiceAmountGuard';

function asObject(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    console.error('[cleanAndValidateOCR] JSON Parse Failed');
    return null;
  }
}

function num(value) {
  if (value == null || value === '') return 0;
  try {
    const { parseInvoiceMoney } = require('./invoiceAmountGuard');
    const n = parseInvoiceMoney(value);
    return n != null ? n : 0;
  } catch {
    const n = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
}

function str(value) {
  return String(value || '').trim();
}

function isBadProductTitle(name) {
  const p = str(name);
  if (!p || p.length < 2) return true;
  if (isTaxIdentifierText(p)) return true;
  const lower = p.toLowerCase();
  if (lower.includes('serial') || lower.includes('imei') || lower.includes('chassis')) {
    return true;
  }
  if (lower.includes('uttar pradesh') || isAddressLikeText(p)) return true;
  if (isImeiOrSerialTitle(p)) return true;
  if (!looksLikeProductName(p)) return true;
  return false;
}

/**
 * @param {object|string} rawGeminiResponse
 * @returns {object|null} cleaned core fields + full source merge
 */
export function cleanAndValidateOCR(rawGeminiResponse) {
  const parsedData = asObject(rawGeminiResponse);
  if (!parsedData) return null;

  // 1) Product name — never serial / IMEI / address / SAC / CIN
  let productName = str(
    parsedData.product_name ||
      parsedData.productName ||
      parsedData.asset_name ||
      parsedData.item_name ||
      parsedData.assetName,
  );

  if (isBadProductTitle(productName)) {
    productName = resolveProductName({
      product_name: parsedData.line_item_description || parsedData.lineItemDescription,
      item_name: parsedData.line_item_description,
      items: parsedData.items,
      asset_name: parsedData.asset_name,
      productName: '',
    });
  }
  if (isBadProductTitle(productName)) {
    productName = '';
  }

  // 2) Amount — never prefer glued tax (183043) over Grand Total (23999)
  const totalAmountRaw = num(parsedData.total_amount ?? parsedData.totalAmount);
  const grandTotal = num(
    parsedData.grand_total ?? parsedData.grandTotal ?? parsedData.net_total ?? parsedData.netPayable,
  );
  const lineTotal = num(parsedData.line_total ?? parsedData.lineTotal);
  let totalAmount =
    resolveBestPurchaseTotal(totalAmountRaw, grandTotal, lineTotal) || 0;
  if (totalAmount > MAX_PLAUSIBLE_INR || totalAmount <= 0) {
    totalAmount = 0;
  }

  let sellerName = str(
    parsedData.seller_name ||
      parsedData.vendor_dealer_name ||
      parsedData.vendor_name ||
      parsedData.shopName ||
      parsedData.vendor,
  );
  if (isTaxIdentifierText(sellerName)) sellerName = '';
  // Never keep invoice/bill labels as seller (common OCR mis-map)
  if (/^(?:invoice|inv|nvoice|bill|tax)\b/i.test(sellerName) || /invoice\s*no|bill\s*no/i.test(sellerName)) {
    sellerName = '';
  }

  const invoiceNumber = str(
    parsedData.invoice_number ||
      parsedData.invoice_or_policy_no ||
      parsedData.invoiceNumber,
  );

  // Never invent today's date — blank lets user confirm
  const purchaseDate = str(
    parsedData.purchase_date ||
      parsedData.purchase_or_issue_date ||
      parsedData.invoiceDate,
  );

  return {
    ...parsedData,
    product_name: productName,
    productName,
    asset_name: productName,
    item_name: productName,
    assetName: productName,
    total_amount: totalAmount > 0 ? totalAmount : null,
    totalAmount: totalAmount > 0 ? totalAmount : null,
    seller_name: sellerName,
    vendor_dealer_name: sellerName,
    shopName: sellerName,
    invoice_number: invoiceNumber,
    invoiceNumber,
    purchase_date: purchaseDate,
    invoiceDate: purchaseDate,
    purchase_or_issue_date: purchaseDate,
  };
}

export default cleanAndValidateOCR;
