/**
 * Asset Doctor — Service barrel
 */

export { AuthService } from './auth';
export { UserService } from './user';
export { AssetService } from './assets';
export {
  OcrService,
  extractReceiptData,
  sanitizeOcrFields,
  emptyOcrResult,
} from './ocr';
export { triggerHaptic, Haptics } from './haptics';
export {
  COLLECTIONS,
  STORAGE_PATHS,
  DEFAULT_DISPLAY_NAME,
  ASSET_CATEGORIES,
  OCR_FIELDS,
} from './constants';
