/**
 * Asset Doctor — Custom & Specialty Assets Module
 * Universal fallback module for arbitrary asset types (e.g. Solar, Medical, Musical Instruments, Collectibles).
 */

import { AssetModuleDefinition } from './types';

export const customModule: AssetModuleDefinition = {
  moduleId: 'mod_custom',
  category: 'CUSTOM',
  displayName: 'Specialty & Custom Assets',
  description: 'Custom asset tracking with user-defined maintenance rules and document storage.',
  iconName: 'Package',
  version: '1.0.0',
  supportedSubcategories: ['Medical Device', 'Musical Instrument', 'Bicycle', 'Sports Gear', 'Custom Hardware', 'Other'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: false,
    hasInsurance: false,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasFilterCleaning: false,
    hasHeatingElement: false,
    hasBatteryHealth: false,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Serial / Unique ID',
    maintenanceScheduleLabel: 'Standard Warranty & Protection Surveillance',
    serviceDueNotice: 'Standard warranty surveillance active.'
  },
  maintenanceRules: [
    {
      ruleId: 'cust_annual_inspection',
      name: 'Annual Inspection & Vault Check',
      intervalDays: 365,
      actionText: 'Inspect physical condition, clean, and verify warranty documents in vault',
      component: 'general',
      severity: 'LOW'
    }
  ],
  healthRules: [
    {
      ruleId: 'cust_doc_vaulted',
      condition: (asset) => {
        if (!asset.originalInvoiceNumber && !asset.warranty?.policyNumber) {
          return { impact: -5, reason: 'No invoice or warranty document uploaded', isRisk: true };
        }
        return { impact: 5, reason: 'Asset documentation vaulted', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 15,
    minimumRetainedFloor: 0.15,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.15;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.15, Math.round(value));
    }
  },
  supportedDocumentTypes: ['PURCHASE_INVOICE', 'WARRANTY_DOC', 'TAX_INVOICE', 'REPAIR_BILL']
};
