/**
 * Asset Doctor — Electricity Bill Cross-Validator & Confidence Engine
 *
 * Implements rigorous mathematical cross-validation:
 * 1. currentMeterReading >= previousMeterReading (with rollover detection)
 * 2. currentMeterReading - previousMeterReading ≈ unitsConsumedKwh (with multiplier detection)
 * 3. energyCharge + fixedCharge + arrears - subsidy ≈ currentBillAmount
 * 4. Honest field-level confidence calibration (HIGH, MEDIUM, LOW)
 */

import { ExtractedElectricityBill } from '../extractors/RealElectricityBillExtractor';
import { ElectricityFieldIntelligence } from '../../energy/electricityBillSchema';

export interface ElectricityValidationResult {
  isValid: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  extractionConfidence: number;
  calculatedUnits: number | null;
  multiplierDetected: number;
  isMeterReset: boolean;
  fieldIntelligence: Record<string, ElectricityFieldIntelligence>;
}

export class ElectricityBillValidator {
  /**
   * Authoritative mathematical cross-check of readings, consumption, and financials.
   */
  public static validate(extracted: ExtractedElectricityBill): ElectricityValidationResult {
    const reviewReasons: string[] = [];
    const fieldIntelligence: Record<string, ElectricityFieldIntelligence> = {};

    let multiplierDetected = 1;
    let isMeterReset = false;
    let calculatedUnits: number | null = null;
    let readingMathValid = true;

    const prev = extracted.previousMeterReading;
    const curr = extracted.currentMeterReading;
    const units = extracted.unitsConsumedKwh;

    // 1. Reading & Consumption Cross-Validation
    if (prev != null && curr != null) {
      if (curr >= prev) {
        calculatedUnits = curr - prev;
      } else {
        // Potential Meter Rollover / Reset (e.g. 99800 -> 00120 on 5-digit meter)
        const rolloverThresholds = [10000, 100000, 1000000];
        let matchedRollover = false;
        for (const limit of rolloverThresholds) {
          if (prev > limit * 0.9) {
            const rollDelta = limit - prev + curr;
            if (units != null && Math.abs(rollDelta - units) <= 2) {
              calculatedUnits = rollDelta;
              isMeterReset = true;
              matchedRollover = true;
              break;
            }
          }
        }

        if (!matchedRollover) {
          readingMathValid = false;
          reviewReasons.push(
            `Current meter reading (${curr}) is less than previous meter reading (${prev}) without detected rollover.`
          );
        }
      }

      if (calculatedUnits != null && units != null) {
        const diff = Math.abs(calculatedUnits - units);
        if (diff <= 1) {
          // Direct 1:1 match
          multiplierDetected = 1;
        } else if (Math.abs(calculatedUnits * 10 - units) <= 2) {
          multiplierDetected = 10;
        } else if (Math.abs(calculatedUnits * 40 - units) <= 5) {
          multiplierDetected = 40;
        } else if (Math.abs(calculatedUnits - units * 10) <= 2) {
          multiplierDetected = 0.1;
        } else {
          // Contradiction detected
          readingMathValid = false;
          reviewReasons.push(
            `Readings difference (${calculatedUnits} kWh) does not match reported consumption (${units} kWh).`
          );
        }
      }
    }

    // 2. Financial Arithmetic Cross-Check
    if (extracted.currentBillAmount != null) {
      const bill = extracted.currentBillAmount;
      const ec = extracted.energyCharge ?? 0;
      const fc = extracted.fixedCharge ?? 0;
      const arr = extracted.arrears ?? 0;
      const sub = extracted.subsidy ?? 0;

      if (ec > 0 && fc > 0) {
        const computedTotal = ec + fc + arr - sub;
        if (Math.abs(computedTotal - bill) > 5 && Math.abs(computedTotal - bill) / bill > 0.05) {
          reviewReasons.push(
            `Bill breakdown (₹${computedTotal}) does not match current bill amount (₹${bill}).`
          );
        }
      }
    }

    // 3. Field Intelligence Calibration
    // Provider
    fieldIntelligence.electricityProvider = {
      value: extracted.electricityProvider,
      confidence: extracted.electricityProvider !== 'Electricity Provider' ? 0.94 : 0.45,
      source: 'regex_provider_cascade',
      status: extracted.electricityProvider !== 'Electricity Provider' ? 'HIGH_CONFIDENCE' : 'REVIEW',
    };

    // Consumer ID
    fieldIntelligence.consumerId = {
      value: extracted.consumerId,
      confidence: extracted.consumerId.length >= 6 ? 0.92 : 0.55,
      source: 'consumer_anchor_match',
      status: extracted.consumerId.length >= 6 ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW',
    };

    // Readings & Units
    fieldIntelligence.previousMeterReading = {
      value: prev,
      confidence: prev != null ? (readingMathValid ? 0.95 : 0.65) : 0.2,
      source: 'meter_reading_anchor',
      status: prev != null ? (readingMathValid ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW') : 'NOT_FOUND',
    };

    fieldIntelligence.currentMeterReading = {
      value: curr,
      confidence: curr != null ? (readingMathValid ? 0.95 : 0.65) : 0.2,
      source: 'meter_reading_anchor',
      status: curr != null ? (readingMathValid ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW') : 'NOT_FOUND',
    };

    fieldIntelligence.unitsConsumedKwh = {
      value: units,
      confidence: units != null ? (readingMathValid ? 0.96 : 0.65) : 0.2,
      source: 'kwh_consumption_anchor',
      status: units != null ? (readingMathValid ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW') : 'NOT_FOUND',
    };

    // Current Bill Amount
    fieldIntelligence.currentBillAmount = {
      value: extracted.currentBillAmount,
      confidence: extracted.currentBillAmount != null && extracted.currentBillAmount > 0 ? 0.95 : 0.3,
      source: 'bill_amount_anchor',
      status: extracted.currentBillAmount != null && extracted.currentBillAmount > 0 ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW',
    };

    // Dates
    fieldIntelligence.billDate = {
      value: extracted.billDate,
      confidence: extracted.billDate ? 0.90 : 0.4,
      source: 'date_normalizer',
      status: extracted.billDate ? 'HIGH_CONFIDENCE' : 'REVIEW',
    };

    fieldIntelligence.dueDate = {
      value: extracted.dueDate,
      confidence: extracted.dueDate ? 0.90 : 0.4,
      source: 'date_normalizer',
      status: extracted.dueDate ? 'HIGH_CONFIDENCE' : 'REVIEW',
    };

    // Overall Confidence Calculation
    let score = 0.2;
    if (extracted.electricityProvider && extracted.electricityProvider !== 'Electricity Provider') score += 0.20;
    if (extracted.consumerId && extracted.consumerId.length >= 6) score += 0.20;
    if (extracted.currentBillAmount != null && extracted.currentBillAmount > 0) score += 0.20;
    if (extracted.unitsConsumedKwh != null && extracted.unitsConsumedKwh > 0) score += 0.20;
    if (readingMathValid && calculatedUnits != null) score += 0.10;
    if (extracted.billDate) score += 0.05;
    if (extracted.dueDate) score += 0.05;

    const extractionConfidence = Math.min(0.99, Math.round(score * 100) / 100);
    const needsReview = reviewReasons.length > 0 || extractionConfidence < 0.85;

    return {
      isValid: reviewReasons.length === 0,
      needsReview,
      reviewReasons,
      extractionConfidence,
      calculatedUnits,
      multiplierDetected,
      isMeterReset,
      fieldIntelligence,
    };
  }
}
