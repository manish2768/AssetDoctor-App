/**
 * Asset Doctor — Electronics & Gadgets Module
 * Supports Smartphones, Laptops, Tablets, Smartwatches, and Smart Gadgets.
 */

import { AssetModuleDefinition } from './types';

export const electronicsModule: AssetModuleDefinition = {
  moduleId: 'mod_electronics',
  category: 'ELECTRONICS',
  displayName: 'Smartphones & Electronics',
  description: 'Device intelligence for smartphones, laptops, tablets, and personal computing hardware.',
  iconName: 'Smartphone',
  version: '1.0.0',
  supportedSubcategories: ['Smartphone', 'Laptop', 'Tablet', 'Smartwatch', 'Audio / Headphones', 'Camera'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: false,
    hasInsurance: false,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasFilterCleaning: false,
    hasHeatingElement: false,
    hasBatteryHealth: true,
    hasScreenDisplay: true,
    hasStorageCapacity: true,
    hasOsSoftwareUpdates: true,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'IMEI / Serial Number',
    maintenanceScheduleLabel: 'Device Health & Diagnostics',
    serviceDueNotice: 'Next Service Due is not applicable for electronics. Device diagnostics and battery health active.'
  },
  maintenanceRules: [
    {
      ruleId: 'elec_battery_calibration',
      name: 'Battery Health Optimization',
      intervalDays: 90,
      actionText: 'Perform complete charging cycle & avoid deep discharge below 20%',
      component: 'battery',
      severity: 'LOW'
    },
    {
      ruleId: 'elec_os_security',
      name: 'OS & Security Patch Verification',
      intervalDays: 30,
      actionText: 'Check manufacturer firmware and install monthly security patches',
      component: 'software',
      severity: 'MEDIUM'
    }
  ],
  healthRules: [
    {
      ruleId: 'elec_battery_health_check',
      condition: (asset) => {
        const health = Number(asset.categoryData?.batteryHealthPercent || 100);
        if (health < 80) {
          return { impact: -20, reason: `Degraded battery health (${health}%)`, isRisk: true };
        }
        return { impact: 5, reason: 'Battery health optimal (> 80%)', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 25,
    minimumRetainedFloor: 0.10,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.25;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.10, Math.round(value));
    }
  },
  supportedDocumentTypes: ['PURCHASE_INVOICE', 'WARRANTY_DOC', 'EXTENDED_WARRANTY', 'REPAIR_BILL', 'TAX_INVOICE']
};
