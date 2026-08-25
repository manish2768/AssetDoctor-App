/**
 * Asset Doctor — Home & Property Assets Module
 * Supports Furniture, Inverters, Solar Panels, Power Backups, and Home Automation.
 */

import { AssetModuleDefinition } from './types';

export const homeModule: AssetModuleDefinition = {
  moduleId: 'mod_home',
  category: 'HOME',
  displayName: 'Home, Solar & Living Assets',
  description: 'Asset tracking and warranty surveillance for furniture, solar systems, and home infrastructure.',
  iconName: 'Home',
  version: '1.0.0',
  supportedSubcategories: ['Solar Power System', 'Inverter & Battery', 'Furniture', 'Home Theater', 'Smart Lock / Security', 'Modular Kitchen'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: false,
    hasInsurance: false,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasFilterCleaning: false,
    hasHeatingElement: false,
    hasBatteryHealth: true,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Serial / Model Code',
    maintenanceScheduleLabel: 'Seasonal Home Infrastructure Inspection',
    serviceDueNotice: 'Standard warranty and solar efficiency monitoring active.'
  },
  maintenanceRules: [
    {
      ruleId: 'home_solar_cleaning',
      name: 'Solar Panel Dust & Debris Wash',
      intervalDays: 45,
      actionText: 'Wash photovoltaic panel surface to restore 98%+ solar generation efficiency',
      component: 'solar_pv',
      severity: 'MEDIUM'
    },
    {
      ruleId: 'home_inverter_distilled',
      name: 'Inverter Lead-Acid Distilled Water Top-Up',
      intervalDays: 90,
      actionText: 'Check tubular battery electrolyte levels and top up with distilled water',
      component: 'inverter_battery',
      severity: 'HIGH'
    }
  ],
  healthRules: [
    {
      ruleId: 'home_warranty_status_check',
      condition: (asset) => {
        if (!asset.warranty?.hasWarranty) {
          return { impact: -10, reason: 'No active warranty recorded', isRisk: true };
        }
        return { impact: 5, reason: 'Warranty protection active', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 12,
    minimumRetainedFloor: 0.20,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.12;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.20, Math.round(value));
    }
  },
  supportedDocumentTypes: ['PURCHASE_INVOICE', 'WARRANTY_DOC', 'AMC_CONTRACT', 'TAX_INVOICE']
};
