/**
 * Asset Doctor — Fuel & Mileage Service
 *
 * Persists fuel logs under:
 *   Users/{userId}/Assets/{assetId}/fuelLogs/{logId}
 *
 * Data ownership is always anchored to the authenticated userId + assetId. We
 * never trust a client-supplied userId for security decisions — Firestore rules
 * restrict reads/writes to the asset owner only.
 *
 * This service reuses the pure, deterministic calculation engine's
 * validateFuelInput / computeFuelCalculation / summarizeMonthlyFuel so the
 * client-side preview card and the persisted record always agree.
 */

import firestore from '@react-native-firebase/firestore';
import { COLLECTIONS } from '../constants';
import { Haptics } from '../haptics/triggerHaptic';
import {
  validateFuelInput,
  computeFuelCalculation,
  summarizeMonthlyFuel,
} from '../../utils/fuelCalculator';
import { toErrorMessage } from '../../utils/errors';

/** Build the Firestore reference for an asset's fuelLogs subcollection. */
function fuelLogsRef(userId, assetId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS)
    .doc(assetId)
    .collection('fuelLogs');
}

/** Normalize a raw Firestore snapshot into a FuelLog shape. */
function shapeLog(id, raw = {}) {
  return {
    id,
    assetId: raw.assetId || '',
    odometerKM: Number(raw.odometerKM) || 0,
    amountPaid: Number(raw.amountPaid) || 0,
    liters: Number(raw.liters) || 0,
    fuelPricePerLiter:
      raw.fuelPricePerLiter != null ? Number(raw.fuelPricePerLiter) : null,
    isFullTank: Boolean(raw.isFullTank),
    timestamp: raw.timestamp || null,
    calculatedMileage: raw.calculatedMileage != null ? Number(raw.calculatedMileage) : null,
    costPerKm: raw.costPerKm != null ? Number(raw.costPerKm) : null,
    distanceSincePreviousKM:
      raw.distanceSincePreviousKM != null ? Number(raw.distanceSincePreviousKM) : null,
    previousLogId: raw.previousLogId || null,
    createdAt: raw.createdAt || null,
    entryMode: raw.entryMode || (Number(raw.amountPaid) > 0 ? 'amount' : 'liters'),
  };
}

export class FuelService {
  /**
   * Fetch the most recent valid fuel log for an asset (odometer anchor).
   * @returns {Promise<object|null>} latest FuelLog or null
   */
  static async getPreviousLog(userId, assetId) {
    if (!userId || !assetId) return null;
    try {
      const snap = await fuelLogsRef(userId, assetId)
        .orderBy('odometerKM', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      return shapeLog(doc.id, doc.data());
    } catch {
      return null;
    }
  }

  /**
   * One-shot load of all fuel logs for an asset, newest first.
   * @returns {Promise<{success:boolean, logs:object[], error?:string}>}
   */
  static async listFuelLogs(userId, assetId) {
    if (!userId || !assetId) {
      return { success: false, logs: [], error: 'userId and assetId are required' };
    }
    try {
      const snap = await fuelLogsRef(userId, assetId)
        .orderBy('odometerKM', 'desc')
        .limit(500)
        .get();
      const logs = snap.docs.map((d) => shapeLog(d.id, d.data()));
      return { success: true, logs };
    } catch (error) {
      return { success: false, logs: [], error: toErrorMessage(error) };
    }
  }

  /**
   * Real-time listener for an asset's fuel logs.
   * @returns {() => void} unsubscribe
   */
  static subscribeFuelLogs(userId, assetId, onUpdate, onError) {
    if (!userId || !assetId) {
      onUpdate([]);
      return () => {};
    }
    return fuelLogsRef(userId, assetId)
      .orderBy('odometerKM', 'desc')
      .limit(500)
      .onSnapshot(
        (snapshot) => {
          const logs = snapshot.docs.map((d) => shapeLog(d.id, d.data()));
          onUpdate(logs);
        },
        (error) => {
          if (onError) onError(error);
          else onUpdate([]);
        },
      );
  }

  /**
   * Log a single fuel entry (offline-first via installed @react-native-firebase).
   *
   * Steps:
   *   1. Validate the raw input against the previous odometer reading.
   *   2. Load the previous valid fuel log for this asset.
   *   3. Compute mileage / cost-per-km with the shared calculation engine.
   *   4. Persist the server-timestamped document.
   *
   * @param {string} userId
   * @param {string} assetId
   * @param {object} input CreateFuelLogInput (odometerKM, amountPaid, liters,
   *                       fuelPricePerLiter, isFullTank, entryMode)
   * @param {object} asset asset doc (for vehicle-type / verdict resolution)
   * @returns {Promise<{success:boolean, result?:object, log?:object, error?:string, validation?:object}>}
   */
  static async logFuel(userId, assetId, input = {}, asset = {}) {
    Haptics.tap();
    try {
      if (!userId) throw new Error('Please sign in to save fuel logs.');
      if (!assetId) throw new Error('assetId is required');

      const previous = await this.getPreviousLog(userId, assetId);
      const previousOdometerKM = previous ? Number(previous.odometerKM) : null;

      const validation = validateFuelInput(input, previousOdometerKM);
      if (!validation.valid) {
        Haptics.error();
        return { success: false, validation, error: validation.error };
      }

      // Entry mode affects what is persisted / computed.
      const entryMode = input.entryMode || (Number(input.amountPaid) > 0 ? 'amount' : 'liters');
      const odometerKM = Number(input.odometerKM) || 0;
      const amountPaid = entryMode === 'liters' ? Number(input.amountPaid) || 0 : Number(input.amountPaid) || 0;
      const liters =
        entryMode === 'liters'
          ? Number(input.liters) || 0
          : Number(input.liters) || 0;
      const fuelPricePerLiter =
        input.fuelPricePerLiter != null && Number(input.fuelPricePerLiter) > 0
          ? Number(input.fuelPricePerLiter)
          : null;
      const isFullTank = Boolean(input.isFullTank);

      const result = computeFuelCalculation(
        { odometerKM, amountPaid, liters, fuelPricePerLiter, isFullTank, entryMode },
        previous,
        asset,
      );

      const logId = `fu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload = {
        assetId,
        odometerKM,
        amountPaid,
        liters,
        fuelPricePerLiter,
        isFullTank,
        entryMode,
        calculatedMileage: result.mileage,
        costPerKm: result.costPerKm,
        distanceSincePreviousKM: result.distanceSincePrevious,
        previousLogId: previous ? previous.id || null : null,
        needsNextFullTank: result.needsNextFullTank,
        isFirstEntry: result.isFirstEntry,
        createdAt: new Date().toISOString(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        timestamp: firestore.FieldValue.serverTimestamp(),
      };

      await fuelLogsRef(userId, assetId).doc(logId).set(payload);
      Haptics.success();

      return {
        success: true,
        result,
        validation,
        log: { id: logId, ...payload },
      };
    } catch (error) {
      Haptics.error();
      return {
        success: false,
        error: toErrorMessage(error, 'Could not save fuel entry'),
      };
    }
  }

  /**
   * Build the monthly fuel summary for an asset (Monthly Asset Wrap data).
   * @param {string} userId
   * @param {string} assetId
   * @param {string} period 'YYYY-MM'
   * @returns {Promise<object>} FuelSummary
   */
  static async monthlySummary(userId, assetId, period = currentPeriod()) {
    const { logs } = await this.listFuelLogs(userId, assetId);
    return summarizeMonthlyFuel(period, assetId, logs);
  }
}

/** Current 'YYYY-MM' period (local time, used for default wrap selection). */
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentPeriod() {
  return currentPeriod();
}

export default FuelService;
