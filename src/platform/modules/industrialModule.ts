/**
 * Asset Doctor — Industrial & Machinery Module
 * Supports Diesel Generators, CNC Machines, Compressors, Forklifts, and Heavy Equipment.
 */

import { AssetModuleDefinition } from './types';

export const industrialModule: AssetModuleDefinition = {
  moduleId: 'mod_industrial',
  category: 'INDUSTRIAL',
  displayName: 'Industrial Machinery & Equipment',
  description: 'Heavy machinery lifecycle, runtime hours telemetry, calibration, and preventive maintenance.',
  iconName: 'Factory',
  version: '1.0.0',
  supportedSubcategories: ['Diesel Generator', 'CNC Machine', 'Air Compressor', 'Forklift', 'HVAC Plant', 'Hydraulic Press'],
  capabilities: {
    hasOdometer: false,
    hasServiceSchedule: true,
    hasInsurance: true,
    hasPuc: false,
    hasEngineMaintenance: true,
    hasFilterCleaning: true,
    hasHeatingElement: false,
    hasBatteryHealth: true,
    hasScreenDisplay: false,
    hasStorageCapacity: false,
    hasOsSoftwareUpdates: false,
    hasRuntimeHours: true,
    hasCalibration: true,
    hasWarranty: true,
    hasResaleEstimate: true,
    primaryIdentifierLabel: 'Machine Tag / Serial No.',
    maintenanceScheduleLabel: 'Preventive Runtime Hours Inspection (Every 250 Hours)',
    serviceDueNotice: 'Industrial runtime hour milestones and mandatory safety calibration active.'
  },
  maintenanceRules: [
    {
      ruleId: 'ind_runtime_oil',
      name: 'Generator & Engine Oil Change (250 Operating Hours)',
      intervalHours: 250,
      intervalDays: 90,
      actionText: 'Replace lube oil, fuel filters, and test coolant specific gravity',
      component: 'industrial_engine',
      severity: 'CRITICAL'
    },
    {
      ruleId: 'ind_annual_calibration',
      name: 'Statutory Safety & Pressure Calibration',
      intervalDays: 365,
      actionText: 'Recalibrate digital pressure transducers and emergency shut-off valves',
      component: 'safety_valves',
      severity: 'CRITICAL'
    }
  ],
  healthRules: [
    {
      ruleId: 'ind_runtime_limit_check',
      condition: (asset) => {
        const hours = Number(asset.categoryData?.operatingHours || 0);
        if (hours > 5000) {
          return { impact: -20, reason: 'High cumulative operating hours (> 5,000 hrs)', isRisk: true };
        }
        return { impact: 10, reason: 'Operating runtime within nominal duty cycle', isRisk: false };
      }
    }
  ],
  valuationRule: {
    annualDepreciationRate: 10,
    minimumRetainedFloor: 0.25,
    calculateValue: (purchasePrice, ageInYears) => {
      const rate = 0.10;
      const value = purchasePrice * Math.pow(1 - rate, ageInYears);
      return Math.max(purchasePrice * 0.25, Math.round(value));
    }
  },
  supportedDocumentTypes: ['TAX_INVOICE', 'PURCHASE_INVOICE', 'AMC_CONTRACT', 'CALIBRATION_CERTIFICATE', 'INSURANCE_POLICY']
};
