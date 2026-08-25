/**
 * Asset Doctor — Home Appliances Module
 * Supports Air Conditioners, Water Heaters/Geysers, Refrigerators, RO Purifiers, and Washing Machines.
 */

import { AssetModuleDefinition } from './types';

export const appliancesModule: AssetModuleDefinition = {
  moduleId: 'mod_appliances',
  category: 'APPLIANCE',
  displayName: 'Home Appliances',
  description: 'Preventive maintenance, filter cleaning, and descaling surveillance for household appliances.',
  iconName: 'Wrench',
  version: '1.0.0',
  supportedSubcategories: ['Air Conditioner', 'Water Heater / Geyser', 'Refrigerator', 'RO Purifier', 'Washing Machine', 'Microwave'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: false,
    hasInsurance: false,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasFilterCleaning: true,
    hasHeatingElement: true,
    hasBatteryHealth: false,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Appliance Serial Number',
    maintenanceScheduleLabel: 'Periodic Filter Clean (Every 90 Days)',
    serviceDueNotice: 'Next Service Due is not applicable for appliances. 90-day periodic filter & descaling maintenance active.'
  },
  maintenanceRules: [
    {
      ruleId: 'app_filter_clean',
      name: 'Air / Water Filter Cleaning',
      intervalDays: 90,
      actionText: 'Rinse mesh filters and clear dust accumulated on heat exchanger coils',
      component: 'filter',
      severity: 'HIGH'
    },
    {
      ruleId: 'app_anode_geyser',
      name: 'Geyser Anode Rod Inspection & Descaling',
      intervalDays: 365,
      actionText: 'Inspect magnesium anode rod for corrosion to prevent heating tank rupture',
      component: 'anode_rod',
      severity: 'HIGH'
    },
    {
      ruleId: 'app_ro_sediment',
      name: 'RO Sediment & Carbon Filter Replacement',
      intervalDays: 180,
      actionText: 'Replace pre-filter candle to prevent TDS membrane fouling',
      component: 'ro_cartridge',
      severity: 'HIGH'
    }
  ],
  healthRules: [
    {
      ruleId: 'app_filter_maintenance_check',
      condition: (asset) => {
        const lastCleanDays = Number(asset.categoryData?.daysSinceLastFilterClean || 30);
        if (lastCleanDays > 120) {
          return { impact: -25, reason: `Filter cleaning overdue (${lastCleanDays} days)`, isRisk: true };
        }
        return { impact: 5, reason: 'Preventive filter maintenance on schedule', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 18,
    minimumRetainedFloor: 0.15,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.18;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.15, Math.round(value));
    }
  },
  supportedDocumentTypes: ['PURCHASE_INVOICE', 'WARRANTY_DOC', 'AMC_CONTRACT', 'EXTENDED_WARRANTY', 'REPAIR_BILL']
};
