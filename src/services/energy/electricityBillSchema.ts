/**
 * Asset Doctor — Energy Doctor Electricity Bill Schema
 *
 * Canonical schema for household electricity bills.
 * Adheres strictly to the minimal-data principle:
 * - Mandatory useful fields only
 * - Optional fields only when reliably detected
 * - Never permanently stores bill image/PDF
 * - No ERP/accounting clutter
 */

export interface ElectricityFieldIntelligence {
  value: any;
  confidence: number; // 0.0 - 1.0
  source: string;
  status: 'VERIFIED' | 'HIGH_CONFIDENCE' | 'REVIEW' | 'NEEDS_REVIEW' | 'NOT_FOUND';
  evidence?: string;
  notes?: string;
}

export interface ElectricityAccount {
  id: string;
  userId: string;
  accountName: string; // e.g. "Home", "Office", "Shop", "Parents' Home"
  consumerId: string; // Account Number / CA Number / K-Number
  provider: string; // e.g. "Tata Power", "BSES Rajdhani", "UPPCL"
  meterNumber?: string | null;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ElectricityBillRecord {
  id: string;
  userId: string;
  accountId: string; // Scoped to ElectricityAccount
  accountName?: string;

  // Mandatory Core Fields
  electricityProvider: string; // e.g. "Tata Power", "UPPCL", "BSES", "MSEDCL"
  consumerId: string; // Account No / CA No / Consumer ID
  billingMonth: string; // YYYY-MM (e.g. "2026-08")
  billDate: string; // ISO YYYY-MM-DD
  dueDate: string; // ISO YYYY-MM-DD
  previousMeterReading: number; // e.g. 12450
  currentMeterReading: number; // e.g. 12736
  unitsConsumedKwh: number; // e.g. 286
  billingDays: number; // e.g. 31
  currentBillAmount: number; // e.g. 2180 (rupees)

  // Optional Fields (only populated when reliably detected)
  energyCharge?: number | null;
  fixedCharge?: number | null;
  arrears?: number | null;
  subsidy?: number | null;
  totalPayable?: number | null;
  tariffRate?: number | null; // ₹/unit
  meterNumber?: string | null;

  // Metadata & Validation
  multiplier?: number; // e.g. 1, 10, 40 (CT ratio if applicable)
  isMeterReset?: boolean;
  isEstimatedReading?: boolean;
  isSolarNetMetering?: boolean;
  needsReview?: boolean;
  reviewReasons?: string[];
  extractionConfidence?: number;
  fieldIntelligence?: Record<string, ElectricityFieldIntelligence>;

  createdAt: string;
  updatedAt?: string;
}

export interface EnergyAnalytics {
  currentBill: number;
  previousBill: number | null;
  billChangePercent: number | null; // e.g. -8.02%
  
  currentUnits: number;
  previousUnits: number | null;
  consumptionChangePercent: number | null; // e.g. -6.15%

  billingDays: number;
  previousBillingDays: number | null;
  dailyConsumption: number; // unitsConsumed / billingDays (e.g. 9.2 kWh/day)
  previousDailyConsumption: number | null;
  dailyConsumptionChangePercent: number | null;

  costPerUnit: number; // currentBill / currentUnits (e.g. ₹7.62 / unit)
  
  statusColor: 'GREEN' | 'YELLOW' | 'RED';
  statusLabel: string; // "Good", "Stable", "Energy Alert"
  statusSummary: string; // e.g. "Energy usage is improving"

  explanation: {
    billChangeText: string;
    consumptionChangeText: string;
    billingDaysText: string;
    conclusionText: string;
  };

  insights: string[];
  healthScore: number | null; // 0 - 100, or null if insufficient history
  healthScoreLabel: string; // "Good", "Fair", "Building your Energy Health score"

  forecast: {
    available: boolean;
    minAmount: number | null;
    maxAmount: number | null;
    disclaimer: string;
  };

  dueStatus: {
    isDueSoon: boolean;
    isOverdue: boolean;
    daysRemaining: number | null;
    message: string | null;
  };

  historyTrend: Array<{
    month: string; // YYYY-MM
    displayMonth: string; // "Aug 26"
    billAmount: number;
    unitsConsumed: number;
    dailyKwh: number;
  }>;
}
