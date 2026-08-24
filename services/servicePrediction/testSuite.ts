/**
 * Asset Doctor — Next Service Due & Service Prediction Engine Comprehensive Test Suite
 * Validates 16 Core Engine Capabilities & OEM Calculations
 */

import { matchOemSchedule, OEM_SERVICE_SCHEDULES } from './oemDatabase.ts';
import { calculateDrivingVelocity, predictNextServiceDue } from './predictionEngine.ts';
import { OcrServiceInvoiceParser } from './ocrServiceInvoiceParser.ts';
import { determineServiceReminderWindow, evaluateAssetServiceReminder } from './serviceDueWatcher.ts';
import type { ServiceRecord } from './types.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: any;
}

export function runServicePredictionTestSuite(): { passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      results.push({ name, passed: true, details });
    } else {
      results.push({ name, passed: false, details: details || 'Assertion failed' });
    }
  }

  // Ref Date for Deterministic Testing: 2026-08-25
  const refDate = new Date('2026-08-25T12:00:00+05:30');

  // 1. OEM Schedule Matching (TVS Ronin)
  try {
    const asset = { assetName: 'TVS Ronin 225 Base', brandName: 'TVS', category: 'Vehicles' };
    const sched = matchOemSchedule(asset);
    assert('1. OEM Schedule Match (TVS Ronin 225)', sched.id === 'tvs_ronin_225' && sched.firstServiceRule.intervalKm === 750, `Matched: ${sched.id}`);
  } catch (e: any) {
    assert('1. OEM Schedule Match (TVS Ronin 225)', false, e.message);
  }

  // 2. OEM Schedule Matching (Hyundai Creta)
  try {
    const asset = { assetName: 'Hyundai Creta 1.5 SX', brandName: 'Hyundai', category: 'Vehicles' };
    const sched = matchOemSchedule(asset);
    assert('2. OEM Schedule Match (Hyundai Creta Car)', sched.id === 'hyundai_creta_15' && sched.subsequentServiceRule.intervalKm === 10000, `Matched: ${sched.id}`);
  } catch (e: any) {
    assert('2. OEM Schedule Match (Hyundai Creta Car)', false, e.message);
  }

  // 3. OEM Schedule Matching (Tata Nexon EV)
  try {
    const asset = { assetName: 'Tata Nexon EV Empowered', brandName: 'Tata', category: 'EV' };
    const sched = matchOemSchedule(asset);
    assert('3. OEM Schedule Match (Tata Nexon EV)', sched.id === 'tata_nexon_ev' && sched.fuelType === 'EV', `Matched: ${sched.id}`);
  } catch (e: any) {
    assert('3. OEM Schedule Match (Tata Nexon EV)', false, e.message);
  }

  // 4. First Service Rule Calculation (Break-in 750 KM / 60 days)
  try {
    const newRonin = {
      id: 'ronin_new',
      assetName: 'TVS Ronin 225',
      purchaseDate: '2026-08-01',
      odometerKm: 250
    };
    const pred = predictNextServiceDue(newRonin, [], { referenceDateIST: refDate });
    assert(
      '4. First Service Rule Calculation',
      pred.isFirstService === true && pred.targetKm === 750 && pred.remainingKm === 500,
      `Target: ${pred.targetKm} KM, Remaining: ${pred.remainingKm} KM`
    );
  } catch (e: any) {
    assert('4. First Service Rule Calculation', false, e.message);
  }

  // 5. Subsequent Periodic Service Calculation
  try {
    const ronin = {
      id: 'ronin_serviced',
      assetName: 'TVS Ronin 225',
      purchaseDate: '2026-01-10',
      odometerKm: 27800
    };
    const history: ServiceRecord[] = [
      {
        assetId: 'ronin_serviced',
        serviceDate: '2026-06-10',
        odometerKm: 20000,
        serviceType: 'periodic_maintenance',
        serviceNumber: 4,
        verificationStatus: 'VERIFIED'
      }
    ];
    const pred = predictNextServiceDue(ronin, history, { referenceDateIST: refDate });
    assert(
      '5. Subsequent Periodic Service Calculation (+6,000 KM)',
      pred.isFirstService === false && pred.targetKm === 26000 && pred.serviceNumber === 5,
      `Target: ${pred.targetKm} KM, Number: ${pred.serviceNumber}`
    );
  } catch (e: any) {
    assert('5. Subsequent Periodic Service Calculation (+6,000 KM)', false, e.message);
  }

  // 6. Whichever Comes First Principle: KM Reached First (High Velocity)
  try {
    const car = {
      id: 'creta_highway',
      assetName: 'Hyundai Creta',
      purchaseDate: '2026-01-01',
      odometerKm: 28000
    };
    const history: ServiceRecord[] = [
      {
        assetId: 'creta_highway',
        serviceDate: '2026-06-01',
        odometerKm: 20000,
        serviceType: 'periodic_maintenance',
        verificationStatus: 'VERIFIED'
      }
    ];
    // Custom daily km = 80 KM/day (Target 30,000 KM reached in 25 days, well before 12 months)
    const pred = predictNextServiceDue(car, history, { referenceDateIST: refDate, customDailyKm: 80 });
    assert(
      '6. Whichever Comes First: KM Threshold Wins (High Velocity)',
      pred.whicheverComesFirstReason === 'KM_THRESHOLD',
      `Reason: ${pred.whicheverComesFirstReason}, Estimated Due: ${pred.estimatedDueDate}`
    );
  } catch (e: any) {
    assert('6. Whichever Comes First: KM Threshold Wins (High Velocity)', false, e.message);
  }

  // 7. Whichever Comes First Principle: Time Reached First (Low Velocity)
  try {
    const car = {
      id: 'creta_city',
      assetName: 'Hyundai Creta',
      purchaseDate: '2025-09-01',
      odometerKm: 21000
    };
    const history: ServiceRecord[] = [
      {
        assetId: 'creta_city',
        serviceDate: '2025-09-01',
        odometerKm: 20000,
        serviceType: 'periodic_maintenance',
        verificationStatus: 'VERIFIED'
      }
    ];
    // Custom daily km = 2 KM/day (Target date in Sept 2026 reached before 30,000 KM)
    const pred = predictNextServiceDue(car, history, { referenceDateIST: refDate, customDailyKm: 2 });
    assert(
      '7. Whichever Comes First: Time Threshold Wins (Low Velocity)',
      pred.whicheverComesFirstReason === 'TIME_THRESHOLD',
      `Reason: ${pred.whicheverComesFirstReason}, Estimated Due: ${pred.estimatedDueDate}`
    );
  } catch (e: any) {
    assert('7. Whichever Comes First: Time Threshold Wins (Low Velocity)', false, e.message);
  }

  // 8. Usage Velocity Calculation Across Multiple Service Logs
  try {
    const asset = { id: 'ast_vel', purchaseDate: '2025-01-01' };
    const history: ServiceRecord[] = [
      { assetId: 'ast_vel', serviceDate: '2026-01-01', odometerKm: 10000, serviceType: 'periodic_maintenance', verificationStatus: 'VERIFIED' },
      { assetId: 'ast_vel', serviceDate: '2026-04-11', odometerKm: 15000, serviceType: 'periodic_maintenance', verificationStatus: 'VERIFIED' } // 100 days, 5000 km = 50 km/day
    ];
    const { avgDailyKm, confidence } = calculateDrivingVelocity(asset, history, '2026-08-25');
    assert('8. Historical Velocity Calculation (50 KM/day)', avgDailyKm === 50 && confidence === 'HIGH', `Calculated: ${avgDailyKm} KM/day, Conf: ${confidence}`);
  } catch (e: any) {
    assert('8. Historical Velocity Calculation (50 KM/day)', false, e.message);
  }

  // 9. Severe Usage Multiplier Scaling
  try {
    const assetNormal = { assetName: 'TVS Ronin 225', purchaseDate: '2026-08-01', odometerKm: 100 };
    const assetSevere = { assetName: 'TVS Ronin 225', purchaseDate: '2026-08-01', odometerKm: 100, usageProfile: 'SEVERE' as const };
    const predNormal = predictNextServiceDue(assetNormal, [], { referenceDateIST: refDate });
    const predSevere = predictNextServiceDue(assetSevere, [], { referenceDateIST: refDate });

    // Normal = 750 KM; Severe (0.75x) = 563 KM
    assert(
      '9. Severe Usage Profile Scaling (0.75x)',
      predSevere.targetKm < predNormal.targetKm && predSevere.targetKm === 563,
      `Normal: ${predNormal.targetKm} KM, Severe: ${predSevere.targetKm} KM`
    );
  } catch (e: any) {
    assert('9. Severe Usage Profile Scaling (0.75x)', false, e.message);
  }

  // 10. Component Maintenance Checklist Evaluation
  try {
    const ronin = { assetName: 'TVS Ronin 225', purchaseDate: '2026-01-01', odometerKm: 6200 };
    const pred = predictNextServiceDue(ronin, [], { referenceDateIST: refDate });
    const oilRule = pred.componentChecklist.find(c => c.component === 'engine_oil');
    assert('10. Component Maintenance Checklist (Engine Oil)', oilRule !== undefined && oilRule.status === 'DUE', `Oil Status: ${oilRule?.status}`);
  } catch (e: any) {
    assert('10. Component Maintenance Checklist (Engine Oil)', false, e.message);
  }

  // 11. OCR Service Invoice Parsing (Clean Full Invoice)
  try {
    const ocrSample = `
      TVS AUTHORIZED SERVICE CENTER
      Tax Invoice / Job Card JC-99214
      Vehicle Reg: UP32QU2187
      Service Date: 2026-08-15
      Current Odometer: 27,800 KM
      Type: Periodic Maintenance Service
      Replaced Parts:
      - TVS TRU4 Synthetic Engine Oil 1.2L (₹ 750)
      - Oil Filter Element (₹ 120)
      Total Amount: ₹ 1,450.00
    `;
    const parsed = OcrServiceInvoiceParser.parseServiceInvoiceText(ocrSample);
    assert(
      '11. OCR Service Invoice Extraction',
      parsed.vehicleRegistration === 'UP32QU2187' && parsed.odometerKm === 27800 && parsed.verificationStatus === 'VERIFIED',
      `Reg: ${parsed.vehicleRegistration}, Odo: ${parsed.odometerKm}, Status: ${parsed.verificationStatus}`
    );
  } catch (e: any) {
    assert('11. OCR Service Invoice Extraction', false, e.message);
  }

  // 12. OCR Service Invoice Low Confidence Handling ("Needs verification")
  try {
    const blurryOcr = `
      SERVICE BILL
      Vehicle: UP32QU2187
      Date: 2026-08-15
      ODO READING: odo 2oOl2  (blurry scan)
      Total: 500
    `;
    const parsed = OcrServiceInvoiceParser.parseServiceInvoiceText(blurryOcr);
    assert(
      '12. Low-Confidence OCR Flags "NEEDS_VERIFICATION"',
      parsed.verificationStatus === 'NEEDS_VERIFICATION' && parsed.odometerConfidence < 0.70,
      `Status: ${parsed.verificationStatus}, Conf: ${parsed.odometerConfidence}`
    );
  } catch (e: any) {
    assert('12. Low-Confidence OCR Flags "NEEDS_VERIFICATION"', false, e.message);
  }

  // 13. Automatic Reset after Verified Service Record Added
  try {
    const asset = { id: 'reset_test', assetName: 'TVS Ronin', purchaseDate: '2026-01-01', odometerKm: 27800 };
    const beforePred = predictNextServiceDue(asset, [], { referenceDateIST: refDate });
    
    // User uploads service invoice verified at 27,800 KM
    const newServiceRecord: ServiceRecord = {
      assetId: 'reset_test',
      serviceDate: '2026-08-25',
      odometerKm: 27800,
      serviceType: 'periodic_maintenance',
      verificationStatus: 'VERIFIED'
    };
    const afterPred = predictNextServiceDue(asset, [newServiceRecord], { referenceDateIST: refDate });

    // Target resets from 27,800 to 27,800 + 6,000 = 33,800 KM
    assert(
      '13. Service Reset Recalculates Target KM (+6000 KM)',
      afterPred.targetKm === 33800 && afterPred.remainingKm === 6000,
      `New Target: ${afterPred.targetKm} KM, Remaining: ${afterPred.remainingKm} KM`
    );
  } catch (e: any) {
    assert('13. Service Reset Recalculates Target KM (+6000 KM)', false, e.message);
  }

  // 14. Dynamic Status Color Evaluation (GREEN vs AMBER vs RED)
  try {
    const healthyAsset = { assetName: 'Creta', purchaseDate: '2026-08-01', odometerKm: 100 };
    const overdueAsset = { assetName: 'Creta', purchaseDate: '2024-01-01', odometerKm: 35000 };
    const pGreen = predictNextServiceDue(healthyAsset, [], { referenceDateIST: refDate });
    const pRed = predictNextServiceDue(overdueAsset, [], { referenceDateIST: refDate });

    assert(
      '14. Dynamic Status Levels (GREEN vs RED)',
      pGreen.status === 'GREEN' && pRed.status === 'RED',
      `Healthy: ${pGreen.status}, Overdue: ${pRed.status}`
    );
  } catch (e: any) {
    assert('14. Dynamic Status Levels (GREEN vs RED)', false, e.message);
  }

  // 15. Notification Window Identification (30d / 1000km / 7d / Due Today / Overdue)
  try {
    const nearKmAsset = { assetName: 'Ronin', purchaseDate: '2026-01-01', odometerKm: 25500 };
    const history: ServiceRecord[] = [{ assetId: 'a1', serviceDate: '2026-06-01', odometerKm: 20000, serviceType: 'periodic_maintenance', verificationStatus: 'VERIFIED' }];
    // Target 26,000 -> Remaining 500 KM (with 10 KM/day velocity -> 50 days to KM, so 1000km window triggers)
    const pred = predictNextServiceDue(nearKmAsset, history, { referenceDateIST: refDate, customDailyKm: 10 });
    const window = determineServiceReminderWindow(pred);

    assert('15. Notification Trigger Window (1000 KM Before)', window === '1000km', `Window: ${window}`);
  } catch (e: any) {
    assert('15. Notification Trigger Window (1000 KM Before)', false, e.message);
  }

  // 16. Fallback vs OEM Schedule Transparency
  try {
    const unknownCar = { assetName: 'Custom Vintage Roadster 1968', category: 'Vehicles' };
    const sched = matchOemSchedule(unknownCar);
    assert(
      '16. Fallback Data Identified as GENERIC_FALLBACK',
      sched.sourceType === 'GENERIC_FALLBACK' && sched.confidence < 0.90,
      `Source Type: ${sched.sourceType}, Conf: ${sched.confidence}`
    );
  } catch (e: any) {
    assert('16. Fallback Data Identified as GENERIC_FALLBACK', false, e.message);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}
