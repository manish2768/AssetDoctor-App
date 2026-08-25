/**
 * Asset Doctor — Business & Commercial Assets Module
 * Supports Office IT Equipment, POS Hardware, Commercial Displays, and Office Infrastructure.
 */

import { AssetModuleDefinition } from './types';

export const businessModule: AssetModuleDefinition = {
  moduleId: 'mod_business',
  category: 'BUSINESS',
  displayName: 'Business & Office Equipment',
  description: 'Enterprise asset lifecycle, IT asset management (ITAM), and commercial equipment tracking.',
  iconName: 'Briefcase',
  version: '1.0.0',
  supportedSubcategories: ['Server / Workstation', 'Office Printer / Copier', 'POS System', 'Networking Equipment', 'Commercial Display', 'Office Furniture'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: false,
    hasInsurance: true,
    hasPuc: false,
    hasEngineMaintenance: false,
    hasFilterCleaning: false,
    hasHeatingElement: false,
    hasBatteryHealth: false,
    hasScreenDisplay: true,
    hasStorageCapacity: true,
    hasOsSoftwareUpdates: true,
    hasRuntimeHours: false,
    hasCalibration: false,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Asset Tag / Serial Number',
    maintenanceScheduleLabel: 'IT Asset Audit & AMC Maintenance',
    serviceDueNotice: 'Annual Maintenance Contract (AMC) & hardware audit active.'
  },
  maintenanceRules: [
    {
      ruleId: 'biz_amc_audit',
      name: 'Hardware AMC & Service Vendor Audit',
      intervalDays: 180,
      actionText: 'Verify vendor SLA and execute preventive thermal paste & fan service',
      component: 'it_hardware',
      severity: 'MEDIUM'
    }
  ],
  healthRules: [
    {
      ruleId: 'biz_amc_validity',
      condition: (asset) => {
        if (asset.warranty?.warrantyStatus === 'EXPIRED') {
          return { impact: -20, reason: 'Business hardware out of warranty/AMC coverage', isRisk: true };
        }
        return { impact: 5, reason: 'Commercial SLA active', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 20,
    minimumRetainedFloor: 0.10,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.20;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.10, Math.round(value));
    }
  },
  supportedDocumentTypes: ['TAX_INVOICE', 'PURCHASE_INVOICE', 'AMC_CONTRACT', 'WARRANTY_DOC', 'LEASE_AGREEMENT']
};
