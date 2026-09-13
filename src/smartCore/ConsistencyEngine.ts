/**
 * Smart Core — Consistency Engine
 *
 * Pillar 3: Cross-Validation, Anomaly Detection & Truth Verification.
 *
 * Rules:
 * 1. Validates incoming document facts against existing trusted asset facts.
 * 2. Catches registration, chassis, and engine mismatches before attaching documents.
 * 3. Detects odometer rollbacks (new reading < last recorded reading) and suspicious jumps.
 * 4. Enforces chronological integrity: start dates must precede expiry/validity dates.
 * 5. Provides respectful, clear customer warning payloads for user confirmation.
 */

import { normalizeRegistration, normalizeChassis } from '../utils/vehicleFolder';

export type ConsistencyMatchStatus =
  | 'MATCH'
  | 'PARTIAL_MATCH'
  | 'MISMATCH'
  | 'UNKNOWN';

export interface VehicleIdentityValidationResult {
  status: ConsistencyMatchStatus;
  isConsistent: boolean;
  hasMismatch: boolean;
  mismatchFields: string[];
  warningTitle?: string;
  warningMessage?: string;
}

export interface OdometerValidationResult {
  isConsistent: boolean;
  isRollback: boolean;
  isSuspiciousJump: boolean;
  previousKm: number | null;
  newKm: number;
  deltaKm: number | null;
  warningTitle?: string;
  warningMessage?: string;
}

export interface DateChronologyResult {
  isValid: boolean;
  startDate: string | null;
  endDate: string | null;
  error?: string;
}

export class ConsistencyEngine {
  /**
   * Validate vehicle identity fields between document and target vehicle.
   */
  public static validateVehicleIdentity(
    doc: { registration?: string; chassisNumber?: string; engineNumber?: string },
    vehicle: { registration?: string; chassisNumber?: string; engineNumber?: string; assetName?: string; name?: string },
  ): VehicleIdentityValidationResult {
    if (!vehicle || typeof vehicle !== 'object') {
      return {
        status: 'UNKNOWN',
        isConsistent: true,
        hasMismatch: false,
        mismatchFields: [],
      };
    }

    const mismatchFields: string[] = [];

    // 1. Check Registration
    const docReg = normalizeRegistration(doc.registration);
    const vehReg = normalizeRegistration(vehicle.registration);
    let regMismatch = false;

    if (docReg && vehReg && docReg !== vehReg) {
      regMismatch = true;
      mismatchFields.push(`Registration (Document: ${doc.registration} vs Vehicle: ${vehicle.registration})`);
    }

    // 2. Check Chassis
    const docChassis = normalizeChassis(doc.chassisNumber);
    const vehChassis = normalizeChassis(vehicle.chassisNumber);
    let chassisMismatch = false;

    if (docChassis && vehChassis && docChassis.length >= 8 && vehChassis.length >= 8 && docChassis !== vehChassis) {
      chassisMismatch = true;
      mismatchFields.push(`Chassis (Document: ${doc.chassisNumber} vs Vehicle: ${vehicle.chassisNumber})`);
    }

    // 3. Check Engine
    const docEngine = normalizeChassis(doc.engineNumber);
    const vehEngine = normalizeChassis(vehicle.engineNumber);
    let engineMismatch = false;

    if (docEngine && vehEngine && docEngine.length >= 6 && vehEngine.length >= 6 && docEngine !== vehEngine) {
      engineMismatch = true;
      mismatchFields.push(`Engine (Document: ${doc.engineNumber} vs Vehicle: ${vehicle.engineNumber})`);
    }

    const hasMismatch = mismatchFields.length > 0;
    const vehicleName = vehicle.assetName || vehicle.name || 'selected vehicle';

    if (hasMismatch) {
      return {
        status: 'MISMATCH',
        isConsistent: false,
        hasMismatch: true,
        mismatchFields,
        warningTitle: 'Vehicle Details Mismatch',
        warningMessage: `The details on this document do not match ${vehicleName}:\n\n• ${mismatchFields.join('\n• ')}\n\nAre you sure you want to attach this document?`,
      };
    }

    const isMatch = Boolean((docReg && vehReg && docReg === vehReg) || (docChassis && vehChassis && docChassis === vehChassis));

    return {
      status: isMatch ? 'MATCH' : 'UNKNOWN',
      isConsistent: true,
      hasMismatch: false,
      mismatchFields: [],
    };
  }

  /**
   * Validate odometer reading progression.
   * Catches rollbacks where new reading is strictly less than prior reading.
   */
  public static validateOdometer(
    newReading: number | string | null | undefined,
    previousReading: number | string | null | undefined,
  ): OdometerValidationResult {
    const newKm = Number(newReading);
    const prevKm = previousReading != null && previousReading !== '' ? Number(previousReading) : null;

    if (!Number.isFinite(newKm) || newKm <= 0) {
      return {
        isConsistent: true,
        isRollback: false,
        isSuspiciousJump: false,
        previousKm: prevKm,
        newKm: 0,
        deltaKm: null,
      };
    }

    if (prevKm == null || !Number.isFinite(prevKm) || prevKm <= 0) {
      return {
        isConsistent: true,
        isRollback: false,
        isSuspiciousJump: false,
        previousKm: null,
        newKm,
        deltaKm: null,
      };
    }

    const deltaKm = newKm - prevKm;

    // Rollback Check
    if (newKm < prevKm) {
      return {
        isConsistent: false,
        isRollback: true,
        isSuspiciousJump: false,
        previousKm: prevKm,
        newKm,
        deltaKm,
        warningTitle: 'Odometer Reading Check',
        warningMessage: `Entered odometer (${newKm.toLocaleString('en-IN')} KM) is lower than your vehicle's last recorded reading (${prevKm.toLocaleString('en-IN')} KM).\n\nPlease verify if this is an entry error.`,
      };
    }

    // Suspicious jump check (> 100,000 KM difference)
    if (deltaKm > 100000) {
      return {
        isConsistent: true,
        isRollback: false,
        isSuspiciousJump: true,
        previousKm: prevKm,
        newKm,
        deltaKm,
        warningTitle: 'Large Mileage Increase',
        warningMessage: `Odometer reading increased by ${deltaKm.toLocaleString('en-IN')} KM compared to last record. Please verify.`,
      };
    }

    return {
      isConsistent: true,
      isRollback: false,
      isSuspiciousJump: false,
      previousKm: prevKm,
      newKm,
      deltaKm,
    };
  }

  /**
   * Validate chronological order of dates (e.g., policy start <= policy expiry).
   */
  public static validateDates(
    startDateStr: string | null | undefined,
    endDateStr: string | null | undefined,
    labels: { startLabel?: string; endLabel?: string } = {},
  ): DateChronologyResult {
    const startLabel = labels.startLabel || 'Start date';
    const endLabel = labels.endLabel || 'End / Expiry date';

    if (!startDateStr || !endDateStr) {
      return {
        isValid: true,
        startDate: startDateStr || null,
        endDate: endDateStr || null,
      };
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        isValid: true,
        startDate: startDateStr,
        endDate: endDateStr,
      };
    }

    if (end.getTime() < start.getTime()) {
      return {
        isValid: false,
        startDate: startDateStr,
        endDate: endDateStr,
        error: `${endLabel} (${endDateStr}) cannot be earlier than ${startLabel} (${startDateStr}).`,
      };
    }

    return {
      isValid: true,
      startDate: startDateStr,
      endDate: endDateStr,
    };
  }
}
