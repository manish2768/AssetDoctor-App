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
  replacedParts?: string;
  notes?: string;
  receiptUrl?: string;
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
