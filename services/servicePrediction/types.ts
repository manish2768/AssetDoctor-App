/**
 * Asset Doctor — Next Service Due & Service Prediction Engine Types
 */

export type VehicleType = 'Car' | 'Motorcycle' | 'Scooter' | 'EV' | 'Commercial' | 'Other';

export type FuelType = 'Petrol' | 'Diesel' | 'EV' | 'CNG' | 'Hybrid';

export type UsageProfile = 'NORMAL' | 'SEVERE';

export type ServiceType =
  | 'first_service'
  | 'second_service'
  | 'third_service'
  | 'periodic_maintenance'
  | 'oil_service'
  | 'minor_repair'
  | 'major_overhaul'
  | 'inspection';

export type ComponentType =
  | 'engine_oil'
  | 'oil_filter'
  | 'air_filter'
  | 'ac_filter'
  | 'brake_fluid'
  | 'coolant'
  | 'spark_plug'
  | 'transmission_fluid'
  | 'brake_pads'
  | 'tyres'
  | 'battery'
  | 'drive_chain'
  | 'chain_lubrication'
  | 'ev_battery_coolant'
  | 'fuel_filter'
  | 'cvt_fluid';

export interface ComponentMaintenanceRule {
  component: ComponentType;
  componentLabel: string;
  intervalKm: number;
  intervalMonths: number;
  action: 'inspect' | 'replace' | 'clean' | 'lubricate';
}

export interface ServiceStepDefinition {
  serviceNumber: number;
  label: string;
  targetKm: number;
  targetMonths: number;
  components: ComponentMaintenanceRule[];
}

export interface OemServiceSchedule {
  id: string;
  manufacturer: string;
  model: string;
  variant?: string;
  modelYear?: number | string;
  vehicleType: VehicleType;
  fuelType: FuelType;
  engineCc?: number;
  firstServiceRule: {
    intervalKm: number;
    intervalDays: number;
    toleranceKm?: number;
    toleranceDays?: number;
  };
  subsequentServiceRule: {
    intervalKm: number;
    intervalDays: number;
    toleranceKm?: number;
    toleranceDays?: number;
  };
  serviceSteps: ServiceStepDefinition[];
  componentRules: ComponentMaintenanceRule[];
  severeUsageMultiplier: number; // e.g. 0.75 for KM, 0.75 for time
  source: string;
  sourceType: 'OFFICIAL_MANUAL' | 'OFFICIAL_PORTAL' | 'AUTHORIZED_SERVICE_DOC' | 'GENERIC_FALLBACK';
  sourceVersion: string;
  confidence: number;
}

export interface ServiceRecord {
  id?: string;
  assetId: string;
  serviceDate: string; // YYYY-MM-DD
  odometerKm: number;
  serviceType: ServiceType;
  serviceNumber?: number;
  documentId?: string;
  invoiceNumber?: string;
  serviceCenter?: string;
  cost?: number;
  replacedComponents?: ComponentType[];
  ocrConfidence?: number;
  verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'REJECTED';
  notes?: string;
  createdAt?: string;
}

export interface ComponentChecklistItem {
  component: ComponentType;
  label: string;
  action: 'inspect' | 'replace' | 'clean' | 'lubricate';
  dueKm: number;
  dueDate: string;
  status: 'DUE' | 'UPCOMING' | 'OK';
  notes?: string;
}

export interface NextServicePredictionResult {
  assetId: string;
  assetName: string;
  category: string;
  identifier: string;
  serviceNumber: number;
  serviceLabel: string;
  currentOdometerKm: number;
  lastServiceDate?: string;
  lastServiceOdometerKm?: number;
  targetKm: number;
  targetDate: string; // YYYY-MM-DD based on calendar rule
  remainingKm: number;
  remainingDays: number;
  estimatedDueDate: string; // YYYY-MM-DD whichever comes first
  whicheverComesFirstReason: 'KM_THRESHOLD' | 'TIME_THRESHOLD';
  estimatedDaysToReachKm: number;
  estimatedWeeks: number;
  avgDailyKm: number;
  avgMonthlyKm: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  statusLabel: 'HEALTHY' | 'DUE_SOON' | 'OVERDUE';
  predictionConfidence: 'HIGH' | 'MEDIUM' | 'ESTIMATED';
  scheduleSource: string;
  scheduleSourceType: 'OFFICIAL_MANUAL' | 'OFFICIAL_PORTAL' | 'AUTHORIZED_SERVICE_DOC' | 'GENERIC_FALLBACK';
  scheduleVersion: string;
  isFirstService: boolean;
  severeUsageActive: boolean;
  componentChecklist: ComponentChecklistItem[];
  calculatedAt: string;
}
