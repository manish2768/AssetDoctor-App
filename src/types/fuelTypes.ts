/**
 * Fuel & Mileage Tracker — shared TypeScript types for Asset Doctor.
 *
 * Storage path:
 *   Users/{userId}/Assets/{assetId}/fuelLogs/{logId}
 *
 * All logs always belong to the authenticated userId + assetId. Never trust a
 * client-provided userId for security decisions (see Firestore rules).
 */

/** Vehicle family used to pick mileage-health verdict thresholds. */
export type FuelVehicleType = 'CAR' | 'BIKE' | 'SCOOTER' | 'COMMERCIAL' | 'OTHER';

/** Which fuel field the user filled in while logging. */
export type FuelEntryMode = 'amount' | 'liters';

/**
 * A single fuel log document persisted under
 * Users/{userId}/Assets/{assetId}/fuelLogs/{logId}.
 */
export interface FuelLog {
  id: string;
  assetId: string;
  /** Current odometer reading in KM. */
  odometerKM: number;
  /** Fuel amount paid in INR ₹ (0 if only liters provided). */
  amountPaid: number;
  /** Fuel quantity in Liters (0 if only amount provided). */
  liters: number;
  /** Optional derived per-liter price (₹/L) when configurable / derivable. */
  fuelPricePerLiter: number | null;
  /** Whether this was a full-tank refill. */
  isFullTank: boolean;
  /** Firestore serverTimestamp(). */
  timestamp: unknown;
  /**
   * Real mileage (km/L) only computed when current AND previous valid entry
   * are both full tank. Otherwise null — never fabricate.
   */
  calculatedMileage: number | null;
  /** Cost per KM (₹/km) where mathematically valid, else null. */
  costPerKm: number | null;
  /** Distance travelled since the previous fuel log (KM). */
  distanceSincePreviousKM: number | null;
  /** Id of the previous valid fuel log used for mileage calc (if any). */
  previousLogId: string | null;
  /** ISO string when the log was captured client-side (for offline display). */
  createdAt?: string;
  updatedAt?: unknown;
}

/** Input shape before serverTimestamp / id are applied. */
export interface CreateFuelLogInput {
  assetId: string;
  odometerKM: number;
  amountPaid: number;
  liters: number;
  fuelPricePerLiter: number | null;
  isFullTank: boolean;
  entryMode: FuelEntryMode;
}

/** Verdict for a mileage value — used by the instant result card. */
export interface MileageVerdict {
  /** 'excellent' | 'average' | 'low' | null */
  rank: 'excellent' | 'average' | 'low' | null;
  label: string;
  emoji: '🟢' | '🟡' | '🔴' | '🚫';
  thresholds: { excellentFrom: number; averageFrom: number };
}

/** Result returned after computing & saving a fuel entry. */
export interface FuelCalculationResult {
  mileage: number | null;
  costPerKm: number | null;
  distanceSincePrevious: number | null;
  needsNextFullTank: boolean;
  isFirstEntry: boolean;
  fuelConsumed: number | null;
  previousLogId: string | null;
  verdict: MileageVerdict | null;
}

/** Aggregated monthly fuel summary for the Monthly Asset Wrap. */
export interface FuelSummary {
  /** Year-Month key e.g. '2026-05'. */
  period: string;
  assetId: string;
  totalDistanceKm: number;
  totalFuelSpendInr: number;
  totalFuelConsumedLitres: number;
  /** Real mileage only when >=2 full-tank segment(s) contributed. */
  averageMileage: number | null;
  averageCostPerKm: number | null;
  entryCount: number;
  fullTankCount: number;
}

/** Results of validating user input before save. */
export interface FuelValidationResult {
  valid: boolean;
  error?: string;
  /** Odometer lower than the previous reading. */
  odometerRegression?: boolean;
  /** Zero odometer / zero fuel would corrupt data. */
  zeroOdometer?: boolean;
}
