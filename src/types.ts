export type AssetCategory = 'Electronics' | 'Vehicles' | 'Appliances' | 'Gadgets' | 'Home' | 'Other';

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired';

export interface ScamGuardAnalysis {
  authenticityScore: number; // 0 to 100
  status: 'VERIFIED' | 'WARNING' | 'SUSPICIOUS_SCAM';
  gstin?: string;
  gstinStatus: 'VERIFIED_VALID' | 'INVALID_FORMAT' | 'MISSING' | 'SUSPICIOUS_STATE';
  vendorAuthenticity: 'VERIFIED_RETAILER' | 'UNVERIFIED_GENERIC' | 'MISMATCHED_FORMAT';
  taxIntegrity: 'FULL_TAX_INVOICE' | 'MISSING_CGST_SGST' | 'INVALID_TOTAL';
  priceAnomalies: string[];
  scamFlags: string[];
  verifiedChecks: string[];
}

export interface ServiceLogEntry {
  id: string;
  date: string;
  serviceType: string;
  cost: number;
  provider?: string;
  workshop?: string;
  odometerKm?: number;
  replacedParts?: string;
  notes?: string;
  receiptUrl?: string;
  verificationStatus?: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION';
  ocrConfidence?: number;
}

export interface ServiceRecord {
  id?: string;
  assetId: string;
  userId?: string;
  serviceDate: string;
  odometerKm: number;
  serviceType: string;
  serviceNumber?: number;
  documentId?: string;
  invoiceNumber?: string;
  serviceCenter?: string;
  cost?: number;
  replacedComponents?: string[];
  ocrConfidence?: number;
  verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION';
  notes?: string;
  createdAt?: string;
}

export interface NextServicePredictionResult {
  assetId: string;
  assetName: string;
  registration?: string;
  category: string;
  scheduleType: string;
  scheduleLabel: string;
  scheduleSourceType: 'OFFICIAL_OEM' | 'GENERIC_FALLBACK';
  sourceVerificationStatus?: string;
  sourceReference?: string;
  sourceUrl?: string;
  serviceNumber: number;
  serviceLabel: string;
  currentOdometerKm: number;
  lastServiceDate?: string;
  lastServiceOdometerKm?: number;
  oemIntervalKm: number;
  oemIntervalDays: number;
  oemTargetKm: number;
  oemTargetCalendarDate: string;
  projectedKmThresholdDate: string | null;
  finalEstimatedDueDate: string;
  whicheverComesFirstCriterion: string;
  whicheverReasonType: 'KM_THRESHOLD' | 'TIME_THRESHOLD' | 'INSUFFICIENT_HISTORY';
  avgDailyKm: number | null;
  avgMonthlyKm: number | null;
  velocityConfidence: string;
  hasOdometerAnomaly?: boolean;
  odometerAnomalyReason?: string;
  remainingKm: number;
  remainingDays: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  statusLabel: 'UP TO DATE' | 'DUE SOON' | 'OVERDUE';
  checklist: string[];
  estimatedCostRange?: { min: number; max: number };
  severeUsageActive?: boolean;
  severeUsageNote?: string;
}

export interface Asset {
  id: string;
  name: string;
  brand?: string;
  category: AssetCategory;
  price: number; // In INR ₹
  purchaseDate: string; // YYYY-MM-DD
  warrantyMonths: number;
  expiryDate: string; // YYYY-MM-DD
  insuranceExpiryDate?: string; // YYYY-MM-DD for Vehicle Insurance
  pucExpiryDate?: string; // YYYY-MM-DD for Vehicle PUC
  serviceDate?: string; // Last service or installation date
  maintenanceDueDate?: string; // YYYY-MM-DD for next maintenance / renewal
  maintenanceType?: string; // e.g., 'Insurance Renewal', 'RO Filter Replacement', 'Bike Service'
  serialNumber?: string;
  vendor?: string;
  notes?: string;
  receiptImageUrl?: string;
  imageUrl?: string;
  daysRemaining: number;
  status: WarrantyStatus;
  gstin?: string;
  scamGuardStatus?: 'VERIFIED' | 'WARNING' | 'SUSPICIOUS_SCAM';
  serviceLogs?: ServiceLogEntry[];
  // Extended Mobile & Prediction Fields
  odometerKm?: number;
  registration?: string;
  modelYear?: number;
  fuelType?: string;
  syncStatus?: 'PENDING_SYNC' | 'SYNCED' | 'FAILED_CONFLICT';
  nextServicePrediction?: NextServicePredictionResult;
  isDeleted?: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  category: string;
  phone: string;
  availability: string;
  iconName: string;
}

export interface ParsedInvoiceItem {
  id?: string;
  itemName: string;
  brand?: string;
  price: number;
  warrantyMonths: number;
  category: AssetCategory;
  serialNumber?: string;
  notes?: string;
  selected?: boolean;
}

export interface ReceiptScanResult {
  vendor?: string;
  purchaseDate: string;
  totalAmount: number;
  gstin?: string;
  scamGuard?: ScamGuardAnalysis;
  items: ParsedInvoiceItem[];
  // Service Invoice Specifics
  documentType?: string;
  odometerKm?: number;
  odometerConfidence?: number;
  vehicleRegistration?: string;
  serviceDate?: string;
  invoiceNumber?: string;
  workshopName?: string;
  verificationStatus?: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION';
  // Backward compatibility fields
  itemName?: string;
  brand?: string;
  price?: number;
  warrantyMonths?: number;
  category?: AssetCategory;
  serialNumber?: string;
  notes?: string;
}

export interface MetricSummary {
  totalAssets: number;
  totalValuation: number;
  expiringSoonCount: number;
  expiredCount: number;
  activeCount: number;
  upcomingMaintenanceCount: number;
}
