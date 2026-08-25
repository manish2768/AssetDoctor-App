/**
 * Asset Doctor — Smart Asset Capability Engine
 * Centralized capability resolver for Vehicles, Smartphones, Electronics, and Home Appliances.
 * Determines exactly what data, cards, and prediction modules each asset type is entitled to.
 */

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
 * Resolves full capabilities for any asset object
 */
export function getAssetCapabilities(asset: any): AssetCapabilities {
  if (!asset) {
    return getFallbackCapabilities();
  }

  const category = String(asset.category || asset.categoryLabel || asset.categoryId || '').toLowerCase();
  const name = String(asset.name || asset.assetName || asset.model || '').toLowerCase();
  const brand = String(asset.brand || asset.brandName || asset.make || '').toLowerCase();
  const vehicleType = String(asset.vehicleType || '').toLowerCase();
  const fuelType = String(asset.fuelType || '').toLowerCase();

  // 1. VEHICLE DETECTION (Cars, Motorcycles, Scooters, EVs, Commercial Vehicles)
  const isVehicleExplicit =
    category === 'vehicles' ||
    category === 'vehicle' ||
    category === 'automotive' ||
    ['car', 'motorcycle', 'scooter', 'bike', 'ev', 'commercial'].includes(vehicleType);

  const isVehicleKeywords =
    name.includes('ronin') ||
    name.includes('creta') ||
    name.includes('activa') ||
    name.includes('jupiter') ||
    name.includes('classic 350') ||
    name.includes('hunter 350') ||
    name.includes('bullet') ||
    name.includes('nexon') ||
    name.includes('ather') ||
    name.includes('ola s1') ||
    name.includes('tvs') ||
    name.includes('royal enfield') ||
    name.includes('hyundai') ||
    name.includes('honda bike') ||
    name.includes('motorcycle') ||
    name.includes('scooter') ||
    name.includes('car ');

  const isVehicle = isVehicleExplicit || isVehicleKeywords;

  if (isVehicle) {
    const isEV = fuelType === 'ev' || name.includes('ev') || name.includes('electric') || brand.includes('ather') || brand.includes('ola');
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
      maintenanceScheduleLabel: 'Next Periodic Vehicle Service'
    };
  }

  // 2. SMARTPHONE / PHONE DETECTION
  const isPhone =
    category === 'gadgets' ||
    category === 'electronics' ||
    name.includes('phone') ||
    name.includes('iphone') ||
    name.includes('galaxy') ||
    name.includes('pixel') ||
    name.includes('oneplus') ||
    name.includes('redmi') ||
    name.includes('nothing phone') ||
    name.includes('realme') ||
    name.includes('vivo') ||
    name.includes('oppo') ||
    name.includes('mobile');

  if (isPhone && (name.includes('phone') || name.includes('iphone') || name.includes('pixel') || name.includes('galaxy') || name.includes('mobile') || name.includes('oneplus') || name.includes('redmi') || name.includes('realme') || name.includes('vivo') || name.includes('oppo') || name.includes('nothing'))) {
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

      isPhone: true,
      hasImei: true,
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
      primaryIdentifierLabel: 'IMEI / Serial Number',
      maintenanceScheduleLabel: 'Device Care & Warranty Surveillance',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for smartphones.'
    };
  }

  // 3. AIR CONDITIONER (AC)
  const isAC = name.includes('ac') || name.includes('air conditioner') || name.includes('split ac') || name.includes('inverter ac');
  if (isAC) {
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
      hasFilterCleaning: true,
      hasGasRefrigerant: true,
      hasHeatingElement: false,
      hasAnodeRod: false,
      hasDescaling: false,
      hasApplianceServiceSchedule: true,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'APPLIANCE_MAINTENANCE',
      primaryIdentifierLabel: 'Serial / Model Number',
      maintenanceScheduleLabel: 'Periodic Filter Clean (Every 90 Days)',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for Air Conditioners.'
    };
  }

  // 4. GEYSER / WATER HEATER
  const isGeyser = name.includes('geyser') || name.includes('water heater') || name.includes('immersion');
  if (isGeyser) {
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
      hasFilterCleaning: false,
      hasGasRefrigerant: false,
      hasHeatingElement: true,
      hasAnodeRod: true,
      hasDescaling: true,
      hasApplianceServiceSchedule: true,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'APPLIANCE_MAINTENANCE',
      primaryIdentifierLabel: 'Serial / Model Number',
      maintenanceScheduleLabel: 'Annual Anode Rod & Heating Inspection',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for Water Heaters.'
    };
  }

  // 5. WATER PURIFIER / RO
  const isRO = name.includes('ro') || name.includes('purifier') || name.includes('aquaguard') || name.includes('kent');
  if (isRO) {
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
      hasFilterCleaning: true,
      hasGasRefrigerant: false,
      hasHeatingElement: false,
      hasAnodeRod: false,
      hasDescaling: false,
      hasApplianceServiceSchedule: true,

      hasWarranty: true,
      hasInvoice: true,
      hasSerial: true,
      hasResaleEstimate: true,

      maintenanceCategory: 'APPLIANCE_MAINTENANCE',
      primaryIdentifierLabel: 'Serial Number',
      maintenanceScheduleLabel: 'Sediment & Carbon Filter Replacement',
      serviceDueUnavailableNotice: 'Vehicle service schedule not applicable for Water Purifiers.'
    };
  }

  // 6. DEFAULT APPLIANCE / ELECTRONIC FALLBACK
  return getFallbackCapabilities(category);
}

function getFallbackCapabilities(category: string = ''): AssetCapabilities {
  const isAppl = category === 'appliances' || category === 'home';
  const isElec = category === 'electronics' || category === 'gadgets';

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
    hasImei: isElec,
    hasBatteryHealth: isElec,
    hasScreenDisplay: isElec,
    hasStorageCapacity: isElec,
    hasOsSoftwareUpdates: isElec,

    isAppliance: isAppl,
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
    primaryIdentifierLabel: 'Serial Number',
    maintenanceScheduleLabel: 'Standard Warranty Care',
    serviceDueUnavailableNotice: 'Maintenance schedule not configured for this asset type.'
  };
}
