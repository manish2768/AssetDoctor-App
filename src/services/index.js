/**
 * Asset Doctor — canonical React Native service exports.
 */

export { AuthService } from './auth';
export { UserService } from './user';
export { AssetService } from './assets';
export {
  OcrService,
  extractReceiptData,
  sanitizeOcrFields,
  emptyOcrResult,
  parseInvoiceText,
  CloudVisionOcrService,
  InvoiceOfflineCache,
  invoiceToAssetForm,
  emptyInvoiceData,
} from './ocr';
export { SweetBillChecker, runSweetBillChecker } from './SweetBillChecker';
export { EmailService } from './email/EmailService';
export { DocumentVaultService } from './documents/DocumentVaultService';
export { ShareService } from './share/ShareService';
export { PdfExporter } from './pdfExporter';
export { ExpiryAlertService } from './notifications/ExpiryAlertService';
export { PowerLogService } from './power/PowerLogService';
export { EnergyService, assignEnergyFieldsOnCreate, aggregateEnergyPortfolio } from './energy/EnergyService';
export {
  SMART_CATEGORIES,
  SMART_CATEGORY_OPTIONS,
  classifySmartCategory,
  enrichItemWithCategory,
} from './ocr/categoryClassifier';
export {
  ServiceScheduleService,
  RepairLogService,
  MaintenanceService,
  summarizeMaintenanceCost,
  pickNextServiceDue,
} from './maintenance/MaintenanceService';
export { VendorService } from './vendors/VendorService';
export { OfflineQueue } from './offline/OfflineQueue';
export { OfflineVaultCache } from './offline/OfflineVaultCache';
export { SyncEngine, OfflineSyncService } from './offline/SyncEngine';
export { ConnectivityService, CONNECTIVITY } from './offline/ConnectivityService';
export { SYNC_STATUS, SYNC_ENTITY, makeOperationId } from './offline/syncConstants';
export { triggerHaptic, Haptics } from './haptics';
export {
  COLLECTIONS,
  STORAGE_PATHS,
  DEFAULT_DISPLAY_NAME,
  ASSET_CATEGORIES,
  OCR_FIELDS,
} from './constants';
