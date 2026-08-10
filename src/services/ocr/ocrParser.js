/**
 * Compatibility export — Indian retail OCR parser.
 * Prefer importing from `./InvoiceOcrParser` in new code.
 */

export {
  parseInvoiceText,
  matchGstin,
  isValidGstinFormat,
  GSTIN_RE,
} from './InvoiceOcrParser';

export {
  SMART_CATEGORIES,
  SMART_CATEGORY_OPTIONS,
  classifySmartCategory,
  enrichItemWithCategory,
  buildCategoryMetadata,
  smartCategoryToCategoryId,
  classifyInvoiceSmartCategory,
} from './categoryClassifier';

export { default } from './InvoiceOcrParser';
