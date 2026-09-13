/**
 * Smart Core — Unified Intelligence & Reliability Façade
 *
 * Consolidates the 5 foundational engines:
 * 1. TrustEngine: Strict data provenance, zero synthetic defaults, truthful health evaluation.
 * 2. MemoryEngine: Contextual memory and corroborated candidate matching.
 * 3. ConsistencyEngine: Cross-document validation, anomaly & rollback detection.
 * 4. ContextEngine: 6-dimension context synthesis (WHO, WHAT, DOCUMENT, HISTORY, STATE, NEXT ACTION).
 * 5. ReliabilityEngine: Truthful outcome states, guarded persistence, and zero silent failures.
 */

import { TrustEngine } from './TrustEngine';
import { MemoryEngine } from './MemoryEngine';
import { ConsistencyEngine } from './ConsistencyEngine';
import { ContextEngine } from './ContextEngine';
import { ReliabilityEngine } from './ReliabilityEngine';

export {
  TrustEngine,
  MemoryEngine,
  ConsistencyEngine,
  ContextEngine,
  ReliabilityEngine,
};

export class SmartCore {
  public static readonly Trust = TrustEngine;
  public static readonly Memory = MemoryEngine;
  public static readonly Consistency = ConsistencyEngine;
  public static readonly Context = ContextEngine;
  public static readonly Reliability = ReliabilityEngine;

  // Convenience Shorthands
  public static tagField = TrustEngine.tagField;
  public static sanitizeValue = TrustEngine.sanitizeValue;
  public static formatDisplayValue = TrustEngine.formatDisplayValue;
  public static evaluateAssetHealth = TrustEngine.evaluateAssetHealth;

  public static resolveExistingAsset = MemoryEngine.resolveExistingAsset;
  public static getLatestMeterReading = MemoryEngine.getLatestMeterReading;
  public static getLatestVehicleOdometer = MemoryEngine.getLatestVehicleOdometer;

  public static validateVehicleIdentity = ConsistencyEngine.validateVehicleIdentity;
  public static validateOdometer = ConsistencyEngine.validateOdometer;
  public static validateDates = ConsistencyEngine.validateDates;

  public static formatExpiryNotification = ContextEngine.formatExpiryNotification;
  public static resolveContext = ContextEngine.resolveContext;

  public static executeWithSafeguards = ReliabilityEngine.executeWithSafeguards;
  public static evaluateExtractionCompleteness = ReliabilityEngine.evaluateExtractionCompleteness;
}

export default SmartCore;
