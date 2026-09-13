/**
 * Asset Doctor — Smart Asset Capability Engine
 * Centralized capability resolver for Vehicles, Smartphones, Electronics, and Home Appliances.
 * Strictly driven by canonical domain guards — NEVER guesses vehicle status from asset names or registrations.
 */

import {
  isVehicleAsset,
  isElectronicsAsset,
  isHomeApplianceAsset,
  supportsOdometer,
  supportsMileage,
  supportsFuelTracking,
  supportsVehicleDocuments,
} from '../domain/asset/assetGuards';

export interface AssetCapabilities {
  // Vehicle Specific
  isVehicle: boolean;
  hasOdometer: boolean;
  hasVehicleServiceSchedule: boolean;
  hasInsurance: boolean;
  hasPuc: boolean;
  hasEngineMaintenance: boolean;
  hasDriveTrain: boolean;
  hasTyres: boolean;
  hasRegistrationNumber: boolean;
  hasChassisNumber: boolean;

  // Electronics & Smartphones Specific
  isPhone: boolean;
  hasImei: boolean;
  hasBatteryHealth: boolean;
  hasScreenDisplay: boolean;
  hasStorageCapacity: boolean;
  hasOsSoftwareUpdates: boolean;

  // Appliances Specific (AC, Geyser, RO, Washing Machine, etc.)
  isAppliance: boolean;
  hasFilterCleaning: boolean;
  hasGasRefrigerant: boolean;
  hasHeatingElement: boolean;
  hasAnodeRod: boolean;
  hasDescaling: boolean;
  hasApplianceServiceSchedule: boolean;

  // General Vault Attributes
  hasWarranty: boolean;
  hasInvoice: boolean;
  hasSerial: boolean;
  hasResaleEstimate: boolean;

  // Labels & Categorization
  maintenanceCategory: 'VEHICLE_SERVICE' | 'APPLIANCE_MAINTENANCE' | 'ELECTRONICS_CARE' | 'NONE';
  primaryIdentifierLabel: string;
  maintenanceScheduleLabel: string;
  serviceDueUnavailableNotice?: string;
}

/**
 * Resolves full capabilities for any asset object using authoritative domain rules.
 */
export function getAssetCapabilities(asset: any): AssetCapabilities {
  if (!asset) {
    return getFallbackCapabilities();
  }

  // 1. VEHICLE ASSETS (Authoritative: strictly isVehicleAsset)
  if (isVehicleAsset(asset)) {
    const fuelType = String(asset.fuelType || '').toLowerCase();
    const name = String(asset.name || asset.assetName || '').toLowerCase();
    const categoryId = String(asset.categoryId || '').toLowerCase();
    const isEV = fuelType === 'ev' || fuelType === 'electric' || categoryId === 'ev' || name.includes('ev ');

    return {
      isVehicle: true,
      hasOdometer: true,
      hasVehicleServiceSchedule: true,
      hasInsurance: true,
      hasPuc: !isEV,
      hasEngineMaintenance: !isEV,
      hasDriveTrain: true,
      hasTyres: true,
      hasRegistrationNumber: true,
      hasChassisNumber: true,

      isPhone: false,
      hasImei: false,
      hasBatteryHealth: isEV,
      hasScreenDisplay: false,
      hasStorageCapacity: false,
      hasOsSoftwareUpdates: isEV,

      isAppliance: false,
      hasFilterCleaning: false,
      hasGasRefrigerant: false,
      hasHeatingElement: false,
      hasAnodeRod: false,
      hasDescaling: false,
      hasApplianceServiceSchedule: false,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'VEHICLE_SERVICE',
      primaryIdentifierLabel: 'Vehicle Registration No.',
      maintenanceScheduleLabel: 'Next Periodic Vehicle Service',
    };
  }

  // 2. ELECTRONICS / SMARTPHONE ASSETS
  if (isElectronicsAsset(asset)) {
    const name = String(asset.name || asset.assetName || asset.model || '').toLowerCase();
    const categoryId = String(asset.categoryId || '').toLowerCase();
    const isPhoneLike =
      categoryId === 'mobile' ||
      categoryId === 'phone' ||
      categoryId === 'smartphone' ||
      name.includes('phone') ||
      name.includes('iphone') ||
      name.includes('pixel') ||
      name.includes('galaxy') ||
      name.includes('mobile');

    return {
      isVehicle: false,
      hasOdometer: false,
      hasVehicleServiceSchedule: false,
      hasInsurance: false,
      hasPuc: false,
      hasEngineMaintenance: false,
      hasDriveTrain: false,
      hasTyres: false,
      hasRegistrationNumber: false,
      hasChassisNumber: false,

      isPhone: isPhoneLike,
      hasImei: isPhoneLike,
      hasBatteryHealth: true,
      hasScreenDisplay: true,
      hasStorageCapacity: true,
      hasOsSoftwareUpdates: true,

      isAppliance: false,
      hasFilterCleaning: false,
      hasGasRefrigerant: false,
      hasHeatingElement: false,
      hasAnodeRod: false,
      hasDescaling: false,
      hasApplianceServiceSchedule: false,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'ELECTRONICS_CARE',
      primaryIdentifierLabel: isPhoneLike ? 'IMEI / Serial Number' : 'Serial Number',
      maintenanceScheduleLabel: 'Device Care & Warranty Surveillance',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for electronic devices.',
    };
  }

  // 3. HOME APPLIANCES (AC, Geyser, RO, Washing Machine, Refrigerator, etc.)
  if (isHomeApplianceAsset(asset)) {
    const name = String(asset.name || asset.assetName || asset.model || '').toLowerCase();
    const categoryId = String(asset.categoryId || '').toLowerCase();

    const isAC = categoryId === 'ac' || name.includes('ac') || name.includes('air conditioner');
    const isGeyser = categoryId === 'geyser' || name.includes('geyser') || name.includes('water heater');
    const isRO = categoryId === 'purifier' || categoryId === 'water_purifier' || name.includes('ro') || name.includes('purifier');

    return {
      isVehicle: false,
      hasOdometer: false,
      hasVehicleServiceSchedule: false,
      hasInsurance: false,
      hasPuc: false,
      hasEngineMaintenance: false,
      hasDriveTrain: false,
      hasTyres: false,
      hasRegistrationNumber: false,
      hasChassisNumber: false,

      isPhone: false,
      hasImei: false,
      hasBatteryHealth: false,
      hasScreenDisplay: false,
      hasStorageCapacity: false,
      hasOsSoftwareUpdates: false,

      isAppliance: true,
      hasFilterCleaning: isAC || isRO,
      hasGasRefrigerant: isAC,
      hasHeatingElement: isGeyser,
      hasAnodeRod: isGeyser,
      hasDescaling: isGeyser,
      hasApplianceServiceSchedule: true,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'APPLIANCE_MAINTENANCE',
      primaryIdentifierLabel: 'Serial / Model Number',
      maintenanceScheduleLabel: isAC
        ? 'Periodic Filter Clean (Every 90 Days)'
        : isGeyser
        ? 'Annual Anode Rod & Heating Inspection'
        : isRO
        ? 'Sediment & Carbon Filter Replacement'
        : 'Appliance Maintenance Schedule',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for home appliances.',
    };
  }

  // 4. BUSINESS & PERSONAL DOCUMENTS / OTHER FALLBACK
  return getFallbackCapabilities();
}

function getFallbackCapabilities(): AssetCapabilities {
  return {
    isVehicle: false,
    hasOdometer: false,
    hasVehicleServiceSchedule: false,
    hasInsurance: false,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasDriveTrain: false,
    hasTyres: false,
    hasRegistrationNumber: false,
    hasChassisNumber: false,

    isPhone: false,
    hasImei: false,
    hasBatteryHealth: false,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,

    isAppliance: false,
    hasFilterCleaning: false,
    hasGasRefrigerant: false,
    hasHeatingElement: false,
    hasAnodeRod: false,
    hasDescaling: false,
    hasApplianceServiceSchedule: false,

    hasWarranty: true,
    hasInvoice: true,
    hasSerial: true,
    hasResaleEstimate: true,

    maintenanceCategory: 'NONE',
    primaryIdentifierLabel: 'Identifier / Serial',
    maintenanceScheduleLabel: 'Standard Warranty & Document Care',
    serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for this asset.',
  };
}

export default {
  getAssetCapabilities,
};
