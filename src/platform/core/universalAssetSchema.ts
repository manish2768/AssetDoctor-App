/**
 * Asset Doctor — Universal Asset Model (v1.0)
 * Future-Ready Universal Asset Schema designed for 10-year evolutionary scalability.
 * Decouples core identity from category-specific payload structures.
 */

export const SCHEMA_VERSION = 1;

export type AssetCategoryType =
  | 'VEHICLE'
  | 'ELECTRONICS'
  | 'APPLIANCE'
  | 'HOME'
  | 'BUSINESS'
  | 'INDUSTRIAL'
  | 'CUSTOM';

export type AssetLifecycleStatus =
  | 'PURCHASED'
  | 'REGISTERED'
  | 'ACTIVE'
  | 'MAINTENANCE_DUE'
  | 'SERVICE'
  | 'REPAIR'
  | 'WARRANTY'
  | 'AGING'
  | 'RESALE'
  | 'SOLD'
  | 'REPLACED'
  | 'RETIRED';

export interface DataProvenance {
  sourceType: 'OEM_MANUAL' | 'USER_INPUT' | 'OCR_EXTRACTION' | 'AI_INFERENCE' | 'PARTNER_API';
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  sourceVersion?: string;
  confidence: number;
  lastVerifiedAt?: string;
}

export interface SpecificationValue {
  value: string | number | boolean;
  unit?: string;
  label?: string;
  provenance?: DataProvenance;
}

export interface UniversalAssetModel<TCategoryData = Record<string, any>> {
  // 1. Core Identity
  schemaVersion: number;
  assetId: string;
  publicAssetId: string; // AST-XX-HEX permanent identifier
  ownerId: string;
  tenantId: string;
  workspaceId: string;

  // 2. Universal Taxonomy
  name: string;
  category: AssetCategoryType;
  subcategory?: string;
  brand: string;
  model: string;
  variant?: string;
  nickname?: string;

  // 3. Identification
  primaryIdentifier: string; // Registration, IMEI, Serial, or Barcode
  secondaryIdentifier?: string; // Chassis, MAC, VIN, Part Number

  // 4. Financial & Acquisition
  purchaseDate?: string;
  purchasePrice?: number;
  currency: string;
  originalInvoiceNumber?: string;
  vendorName?: string;
  vendorSupportPhone?: string;

  // 5. Valuation Snapshot
  valuation: {
    currentValue: number;
    depreciationRateAnnual: number;
    totalDepreciation: number;
    estimatedResaleValue: number;
    repairVsReplaceScore: number; // 0 (Replace) to 100 (Repair)
    valuationModelVersion: string;
    lastValuationAt: string;
  };

  // 6. Warranty & Coverage
  warranty: {
    hasWarranty: boolean;
    provider?: string;
    policyNumber?: string;
    startDate?: string;
    expiryDate?: string;
    warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNAVAILABLE';
    extendedWarrantyAvailable?: boolean;
    extendedWarrantyExpiry?: string;
  };

  // 7. Health & Telemetry
  health: {
    healthScore: number; // 0 to 100
    healthStatus: 'OPTIMAL' | 'GOOD' | 'ATTENTION_REQUIRED' | 'CRITICAL';
    healthModelVersion: string;
    riskFactors: string[];
    positiveFactors: string[];
    lastEvaluatedAt: string;
  };

  // 8. Lifecycle
  lifecycle: {
    currentStatus: AssetLifecycleStatus;
    statusUpdatedAt: string;
    installedAt?: string;
    retiredAt?: string;
  };

  // 9. Physical Location
  location?: {
    locationId?: string;
    locationName?: string; // "Master Bedroom", "Garage", "Office Bay 4"
    city?: string;
    state?: string;
    country?: string;
  };

  // 10. Extensible Category Data (Plug-in architecture)
  categoryData: TCategoryData;

  // 11. Specifications Map
  specifications: Record<string, SpecificationValue>;

  // 12. Metadata & Audit
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  syncStatus: 'SYNCED' | 'PENDING_SYNC' | 'CONFLICT';
}

/**
 * Creates a valid Universal Asset document with safe defaults
 */
export function createUniversalAsset<T = Record<string, any>>(
  partial: Partial<UniversalAssetModel<T>> & { name: string; category: AssetCategoryType; brand: string }
): UniversalAssetModel<T> {
  const now = new Date().toISOString();
  const id = partial.assetId || `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const publicId = partial.publicAssetId || `AST-${Date.now().toString(16).toUpperCase()}-${Math.random().toString(16).substring(2, 6).toUpperCase()}`;

  return {
    schemaVersion: SCHEMA_VERSION,
    assetId: id,
    publicAssetId: publicId,
    ownerId: partial.ownerId || 'default_user',
    tenantId: partial.tenantId || 'tenant_personal',
    workspaceId: partial.workspaceId || 'ws_default',

    name: partial.name,
    category: partial.category,
    subcategory: partial.subcategory || '',
    brand: partial.brand,
    model: partial.model || '',
    variant: partial.variant || '',
    nickname: partial.nickname || partial.name,

    primaryIdentifier: partial.primaryIdentifier || '—',
    secondaryIdentifier: partial.secondaryIdentifier,

    purchaseDate: partial.purchaseDate,
    purchasePrice: partial.purchasePrice || 0,
    currency: partial.currency || 'INR',
    originalInvoiceNumber: partial.originalInvoiceNumber,
    vendorName: partial.vendorName,
    vendorSupportPhone: partial.vendorSupportPhone,

    valuation: {
      currentValue: partial.valuation?.currentValue ?? (partial.purchasePrice || 0),
      depreciationRateAnnual: partial.valuation?.depreciationRateAnnual ?? 15,
      totalDepreciation: partial.valuation?.totalDepreciation ?? 0,
      estimatedResaleValue: partial.valuation?.estimatedResaleValue ?? (partial.purchasePrice ? Math.round(partial.purchasePrice * 0.7) : 0),
      repairVsReplaceScore: partial.valuation?.repairVsReplaceScore ?? 85,
      valuationModelVersion: '1.0',
      lastValuationAt: now,
      ...partial.valuation,
    },

    warranty: {
      hasWarranty: Boolean(partial.warranty?.expiryDate),
      warrantyStatus: 'ACTIVE',
      ...partial.warranty,
    },

    health: {
      healthScore: partial.health?.healthScore ?? 90,
      healthStatus: partial.health?.healthStatus ?? 'OPTIMAL',
      healthModelVersion: '1.0',
      riskFactors: partial.health?.riskFactors ?? [],
      positiveFactors: partial.health?.positiveFactors ?? ['Asset record active & protected'],
      lastEvaluatedAt: now,
      ...partial.health,
    },

    lifecycle: {
      currentStatus: partial.lifecycle?.currentStatus ?? 'ACTIVE',
      statusUpdatedAt: now,
      ...partial.lifecycle,
    },

    location: partial.location,
    categoryData: (partial.categoryData || {}) as T,
    specifications: partial.specifications || {},

    createdAt: partial.createdAt || now,
    updatedAt: now,
    syncStatus: partial.syncStatus || 'SYNCED',
  };
}
