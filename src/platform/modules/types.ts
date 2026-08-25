/**
 * Asset Doctor — Asset Module Plugin System
 * Standardized interface for category intelligence modules.
 */

import { AssetCategoryType, UniversalAssetModel } from '../core/universalAssetSchema';

export interface ModuleCapabilities {
  hasOdometer: boolean;
  hasServiceSchedule: boolean;
  hasInsurance: boolean;
  hasPuc: boolean;
  hasEngineMaintenance: boolean;
  hasFilterCleaning: boolean;
  hasHeatingElement: boolean;
  hasBatteryHealth: boolean;
  hasScreenDisplay: boolean;
  hasStorageCapacity: boolean;
  hasOsSoftwareUpdates: boolean;
  hasRuntimeHours: boolean;
  hasCalibration: boolean;
  hasWarranty: boolean;
  hasResaleEstimate: boolean;
  primaryIdentifierLabel: string;
  maintenanceScheduleLabel: string;
  serviceDueNotice?: string;
}

export interface MaintenanceRuleDefinition {
  ruleId: string;
  name: string;
  intervalDays?: number;
  intervalKm?: number;
  intervalHours?: number;
  actionText: string;
  component: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface HealthRuleDefinition {
  ruleId: string;
  condition: (asset: UniversalAssetModel) => { impact: number; reason: string; isRisk: boolean };
}

export interface ValuationRuleDefinition {
  annualDepreciationRate: number;
  minimumRetainedFloor: number; // e.g. 0.15 (15% of purchase value)
  calculateValue: (purchasePrice: number, ageInYears: number, condition?: string) => number;
}

export interface AssetModuleDefinition {
  moduleId: string;
  category: AssetCategoryType;
  displayName: string;
  description: string;
  iconName: string;
  version: string;
  supportedSubcategories: string[];
  capabilities: ModuleCapabilities;
  maintenanceRules: MaintenanceRuleDefinition[];
  healthRules: HealthRuleDefinition[];
  valuationRule: ValuationRuleDefinition;
  supportedDocumentTypes: string[];
}
