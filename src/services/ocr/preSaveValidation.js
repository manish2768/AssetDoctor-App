/**
 * Pre-vault-save guards for OCR-derived asset fields.
 * Invalid product names fall back to Unnamed Asset (confirm); absurd prices block save.
 */

import {
  isValidProductName,
  FALLBACK_PRODUCT_NAME,
} from './productNameValidation';
import {
  isAbsurdPurchaseAmount,
  isIdentifierMoneyDigits,
} from './invoiceAmountGuard';

/**
 * @param {{
 *   productName?: string,
 *   totalAmount?: number|string|null,
 *   imei?: string,
 *   serialNumber?: string,
 *   items?: unknown[],
 * }} input
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   productName: string,
 *   totalAmount: number|null,
 *   blockSave: boolean,
 * }}
 */
export function validateBeforeVaultSave({
  productName,
  totalAmount,
  imei,
  serialNumber: _serialNumber,
  items: _items,
} = {}) {
  const errors = [];
  const warnings = [];
  let blockSave = false;

  let name = String(productName || '').trim();
  if (!isValidProductName(name)) {
    name = FALLBACK_PRODUCT_NAME;
    warnings.push('needsConfirm');
  }

  let total =
    totalAmount == null || totalAmount === ''
      ? null
      : Number(totalAmount);
  if (
    total == null ||
    !Number.isFinite(total) ||
    total <= 0 ||
    isAbsurdPurchaseAmount(total)
  ) {
    errors.push('absurd_or_missing_price');
    blockSave = true;
    total = null;
  }

  // IMEI: exact 15 digits or empty — malformed clears with warning
  let imeiDigits = String(imei || '').replace(/\D/g, '');
  if (imeiDigits && imeiDigits.length !== 15) {
    warnings.push('malformed_imei_cleared');
    imeiDigits = '';
  }

  if (total != null && imeiDigits && String(Math.round(total)) === imeiDigits) {
    errors.push('total_equals_imei');
    blockSave = true;
    total = null;
  }
  if (
    total != null &&
    (isIdentifierMoneyDigits(String(total)) ||
      isIdentifierMoneyDigits(String(Math.round(total))))
  ) {
    errors.push('total_is_identifier');
    blockSave = true;
    total = null;
  }

  const ok = !blockSave && errors.length === 0;
  return {
    ok,
    errors,
    warnings,
    productName: name,
    totalAmount: total,
    blockSave,
  };
}

export default validateBeforeVaultSave;
