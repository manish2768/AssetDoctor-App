/**
 * Asset Doctor — Canonical Domain Types
 * Single authoritative type system for all Asset Doctor categories and assets.
 */

export type AssetCategory =
  | 'VEHICLE'
  | 'ELECTRONICS'
  | 'HOME_APPLIANCES'
  | 'BUSINESS'
  | 'PERSONAL_DOCUMENT';

export type LegacyCategoryAlias =
  | 'Electronics'
  | 'Vehicles'
  | 'Appliances'
  | 'Gadgets'
  | 'Home'
  | 'Other'
  | 'vehicle'
  | 'gadget'
  | 'home'
  | 'equipment'
  | 'business'
  | 'other'
  | 'APPLIANCE'
  | 'GENERAL'
  | 'CUSTOM';

export interface BaseAsset {
  id?: string;
  assetId?: string;
  name?: string;
  assetName?: string;
  category: AssetCategory | string;
  categoryId?: string;
  categoryLabel?: string;
  brand?: string;
  model?: string;
  price?: number;
  purchasePrice?: number;
  purchaseDate?: string;
  warrantyMonths?: number;
  warrantyExpiry?: string;
  expiryDate?: string;
  serialNumber?: string;
  notes?: string;
  imageUrl?: string;
  receiptImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean;
  deletedAt?: string;
  isDeleted?: boolean;
}

export interface VehicleAsset extends BaseAsset {
  category: 'VEHICLE';
  registration?: string;
  registrationNumber?: string;
  odometerKm?: number;
  nextServiceOdometerKm?: number;
  nextServiceDate?: string;
  lastServiceDate?: string;
  insuranceExpiry?: string;
  insurancePolicyNumber?: string;
  insurerName?: string;
  pucExpiry?: string;
  chassisNumber?: string;
  engineNumber?: string;
  fuelType?: 'petrol' | 'diesel' | 'cng' | 'ev' | string;
  vehicleType?: 'car' | 'bike' | 'scooter' | 'ev' | 'commercial' | string;
}

export interface ElectronicAsset extends BaseAsset {
  category: 'ELECTRONICS';
  imei?: string;
  batteryHealthPercent?: number;
  storageCapacity?: string;
  batteryProfile?: {
    healthPercent?: number;
    isEstimated?: boolean;
    cycleCount?: number;
  };
}

export interface HomeApplianceAsset extends BaseAsset {
  category: 'HOME_APPLIANCES';
  nextServiceDate?: string;
  lastServiceDate?: string;
  serviceIntervalDays?: number;
  powerWatts?: number;
  dailyHours?: number;
}

export interface BusinessAsset extends BaseAsset {
  category: 'BUSINESS';
  gstin?: string;
  vendor?: string;
  invoiceNumber?: string;
}

export interface PersonalDocumentAsset extends BaseAsset {
  category: 'PERSONAL_DOCUMENT';
  documentType?: string;
  validUntil?: string;
}

export type CanonicalAsset =
  | VehicleAsset
  | ElectronicAsset
  | HomeApplianceAsset
  | BusinessAsset
  | PersonalDocumentAsset;
