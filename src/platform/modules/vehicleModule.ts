/**
 * Asset Doctor — Vehicle Intelligence Module
 * Supports Cars, Motorcycles, Scooters, Commercial Vehicles, and EVs.
 */

import { AssetModuleDefinition } from './types';

export const vehicleModule: AssetModuleDefinition = {
  moduleId: 'mod_vehicles',
  category: 'VEHICLE',
  displayName: 'Automotive & Vehicles',
  description: 'Automotive intelligence for 2-wheelers, 4-wheelers, EVs, and commercial fleets.',
  iconName: 'Car',
  version: '1.0.0',
  supportedSubcategories: ['Motorcycle', 'Car', 'Scooter', 'Electric Vehicle', 'Commercial Truck', 'Van'],
  capabilities: {
    hasOdometer: true,
    hasServiceSchedule: true,
    hasInsurance: true,
    hasPuc: true,
    hasEngineMaintenance: true,
    hasFilterCleaning: true,
    hasHeatingElement: false,
    hasBatteryHealth: true,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Registration Number',
    maintenanceScheduleLabel: 'Next Periodic Vehicle Service',
    serviceDueNotice: 'Periodic OEM service schedule active based on odometer progression'
  },
  maintenanceRules: [
    {
      ruleId: 'veh_engine_oil',
      name: 'Engine Oil & Filter Replacement',
      intervalKm: 6000,
      intervalDays: 180,
      actionText: 'Full drain & synthetic oil refill',
      component: 'engine_oil',
      severity: 'HIGH'
    },
    {
      ruleId: 'veh_drive_chain',
      name: 'Drive Chain Tension & Lubrication',
      intervalKm: 1000,
      intervalDays: 30,
      actionText: 'Clean slack & apply high-viscosity chain lube',
      component: 'drive_chain',
      severity: 'MEDIUM'
    },
    {
      ruleId: 'veh_brake_fluid',
      name: 'Brake Fluid & Pad Inspection',
      intervalKm: 10000,
      intervalDays: 365,
      actionText: 'Inspect brake caliper wear and top-up DOT-4 fluid',
      component: 'brakes',
      severity: 'CRITICAL'
    }
  ],
  healthRules: [
    {
      ruleId: 'veh_health_odo_check',
      condition: (asset) => {
        const odo = Number(asset.categoryData?.odometerKm || 0);
        if (odo > 50000) {
          return { impact: -15, reason: 'High odometer mileage (> 50,000 KM)', isRisk: true };
        }
        return { impact: 5, reason: 'Odometer mileage within optimal range', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 15,
    minimumRetainedFloor: 0.20,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.15;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.20, Math.round(value));
    }
  },
  supportedDocumentTypes: ['SERVICE_INVOICE', 'REPAIR_BILL', 'INSURANCE_POLICY', 'PUC_CERTIFICATE', 'RC_REGISTRATION', 'VEHICLE_PURCHASE_INVOICE']
};
