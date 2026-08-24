/**
 * Asset Doctor — Next Service Due & Service Prediction Engine Types
 * Strictly implements OEM specifications, historical driving velocity, and safety bounds.
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

export interface ServiceIntervalDefinition {
  intervalKm: number;
  intervalDays: number;
  toleranceKm?: number;
  toleranceDays?: number;
}

export interface OemServiceSchedule {
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  modelYear: number | string;
  fuelType: FuelType;
  engineCc?: number;
  vehicleType: VehicleType;
  firstServiceRule: ServiceIntervalDefinition;
  subsequentServiceRule: ServiceIntervalDefinition;
  /**
   * Specific severe-usage interval if explicitly documented by the OEM.
   * Null if not documented (never synthesized or estimated).
   */
  severeSubsequentRule?: {
    intervalKm: number;
    intervalDays: number;
    source: string;
  } | null;
  serviceSteps: ServiceStepDefinition[];
  componentRules: ComponentMaintenanceRule[];
  source: string;
  sourceUrl?: string;
  sourceType: 'OFFICIAL_MANUAL' | 'OFFICIAL_PORTAL' | 'AUTHORIZED_SERVICE_DOC' | 'GENERIC_FALLBACK';
  sourceDate: string;
  sourceVersion: string;
  confidence: number;
  sourceVerificationStatus: 'VERIFIED' | 'NEEDS_SOURCE_VERIFICATION';
}

export interface ExtractedField<T> {
  value: T;
  confidence: number; // 0.0 to 1.0
  raw_text: string;
  source: string;
  bounding_box?: { x: number; y: number; width: number; height: number };
  verification_level: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION';
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
  verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION' | 'REJECTED';
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
  
  // Official OEM Parameters (Unmodified)
  oemTargetKm: number;
  oemTargetCalendarDate: string; // YYYY-MM-DD (Official manufacturer calendar limit)
  oemIntervalKm: number;
  oemIntervalDays: number;
  
  remainingKm: number;
  remainingDays: number;
  
  // Driving Velocity & Projection
  avgDailyKm: number | null; // null if insufficient history
  avgMonthlyKm: number | null; // null if insufficient history
  hasDrivingHistory: boolean;
  projectedKmThresholdDate: string | null; // YYYY-MM-DD date when target KM is reached (or null)
  
  // Final Decision (Whichever Comes First)
  finalEstimatedDueDate: string; // YYYY-MM-DD
  whicheverComesFirstCriterion: string; // e.g. "KM threshold reached first", "OEM calendar limit reached first", "OEM Calendar Limit (Insufficient history)"
  whicheverReasonType: 'KM_THRESHOLD' | 'TIME_THRESHOLD' | 'INSUFFICIENT_HISTORY';
  estimatedDaysToReachKm: number | null;
  estimatedWeeks: number | null;
  
  // Status & Anomaly Flags
  status: 'GREEN' | 'AMBER' | 'RED';
  statusLabel: 'HEALTHY' | 'DUE_SOON' | 'OVERDUE';
  predictionConfidence: 'HIGH' | 'MEDIUM' | 'INSUFFICIENT_HISTORY' | 'ESTIMATED';
  hasOdometerAnomaly: boolean;
  odometerAnomalyReason?: string;
  
  // Provenance & Schedule Meta
  scheduleSource: string;
  scheduleSourceUrl?: string;
  scheduleSourceType: 'OFFICIAL_MANUAL' | 'OFFICIAL_PORTAL' | 'AUTHORIZED_SERVICE_DOC' | 'GENERIC_FALLBACK';
  scheduleVersion: string;
  scheduleLabel: string; // "Manufacturer Recommended" vs "Generic estimate — manufacturer schedule unavailable"
  
  isFirstService: boolean;
  severeUsageActive: boolean;
  severeUsageNote?: string;
  
  componentChecklist: ComponentChecklistItem[];
  calculatedAt: string;
}
