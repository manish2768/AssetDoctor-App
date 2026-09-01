/**
 * Asset Doctor — Android v1.0.62 (117) ReferenceError Crash Regression Test Suite
 * Validates all 10 scenarios specified in Phase 5:
 *
 * TEST 1: Vehicle with id: asset_123 -> assetIdOf(asset) === "asset_123"
 * TEST 2: Vehicle with assetId: asset_456 -> canonical resolver returns "asset_456"
 * TEST 3: Asset with missing ID -> returns null, NO CRASH
 * TEST 4: Phone asset -> odometerServiceCandidates does not create vehicle odometer notification
 * TEST 5: AC asset -> odometerServiceCandidates does not create vehicle service notification
 * TEST 6: Vehicle with service history -> Next Service Due calculates correctly
 * TEST 7: Dashboard with mixed portfolio (TVS Ronin, Royal Enfield, Nothing Phone, AC, Refrigerator) -> evaluates successfully without crash
 * TEST 8: evaluatePortfolioNotifications() with malformed/incomplete asset -> No ReferenceError, no fatal exception
 * TEST 9: Offline cached asset -> evaluates safely and offline service prediction remains functional
 * TEST 10: Online Firestore asset update -> evaluates without crash
 */

import { resolveCanonicalAssetId, assetIdOf } from '../../src/services/assets/assetIdentity.js';
import {
  evaluateAssetNotifications,
  evaluatePortfolioNotifications,
  buildUpcomingSummary,
} from '../../src/services/notifications/notificationRules.js';
import { NOTIFICATION_TYPE } from '../../src/services/notifications/notificationTypes.js';
import { predictNextServiceDue } from '../servicePrediction/predictionEngine.ts';

export interface CrashTestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: any;
}

export function STARTUP_CRASH_REGRESSION_TEST(): {
  passed: number;
  failed: number;
  results: CrashTestResult[];
} {
  const results: CrashTestResult[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      results.push({ name, passed: true, details });
    } else {
      results.push({ name, passed: false, details: details || 'Assertion failed' });
    }
  }

  // TEST 1: Vehicle with id: asset_123 -> resolveCanonicalAssetId(asset) === "asset_123"
  try {
    const asset1 = {
      id: 'asset_123',
      assetName: 'TVS Ronin 225',
      categoryId: 'bike',
      odometerKm: 8500,
    };
    const resolvedId1 = resolveCanonicalAssetId(asset1);
    const resolvedId2 = assetIdOf(asset1);
    assert(
      'TEST 1: Vehicle with id -> resolveCanonicalAssetId(asset) === "asset_123"',
      resolvedId1 === 'asset_123' && resolvedId2 === 'asset_123',
      `Resolved: canonical=${resolvedId1}, alias=${resolvedId2}`
    );
  } catch (e: any) {
    assert('TEST 1: Vehicle with id', false, e.message);
  }

  // TEST 2: Vehicle with assetId: asset_456 -> canonical resolver returns "asset_456"
  try {
    const asset2 = {
      assetId: 'asset_456',
      assetName: 'Royal Enfield Hunter 350',
      categoryId: 'motorcycle',
      odometerKm: 4200,
    };
    const resolvedId1 = resolveCanonicalAssetId(asset2);
    const resolvedId2 = assetIdOf(asset2);
    assert(
      'TEST 2: Vehicle with assetId -> canonical resolver returns "asset_456"',
      resolvedId1 === 'asset_456' && resolvedId2 === 'asset_456',
      `Resolved: canonical=${resolvedId1}, alias=${resolvedId2}`
    );
  } catch (e: any) {
    assert('TEST 2: Vehicle with assetId', false, e.message);
  }

  // TEST 3: Asset with missing ID -> returns null, NO CRASH
  try {
    const assetNull1 = null;
    const assetNull2 = undefined;
    const assetEmpty = { assetName: 'Unsaved Device' };
    const assetNumeric = 12345;
    const assetString = 'plain_string';

    const r1 = assetIdOf(assetNull1 as any);
    const r2 = assetIdOf(assetNull2 as any);
    const r3 = assetIdOf(assetEmpty as any);
    const r4 = assetIdOf(assetNumeric as any);
    const r5 = assetIdOf(assetString as any);

    assert(
      'TEST 3: Asset with missing ID -> returns null without throwing',
      r1 === null && r2 === null && r3 === null && r4 === null && r5 === null,
      'All non-ID inputs safely resolved to null'
    );
  } catch (e: any) {
    assert('TEST 3: Asset with missing ID', false, e.message);
  }

  // TEST 4: Phone asset -> odometerServiceCandidates does not create vehicle odometer notification
  try {
    const phoneAsset = {
      assetId: 'ast_phone_001',
      assetName: 'Nothing Phone (2)',
      categoryId: 'phone',
      batteryHealthPercent: 88,
      warrantyExpiry: '2027-01-01',
      // stray / corrupted fields from legacy data should NOT trigger vehicle odometer logic
      odometerKm: 5000,
      nextServiceOdometerKm: 4000,
    };
    const rows = evaluateAssetNotifications(phoneAsset);
    const hasOdometerAlert = rows.some(
      (r) =>
        r.notificationType === NOTIFICATION_TYPE.SERVICE_DUE &&
        String(r.title || '').includes('odometer')
    );
    assert(
      'TEST 4: Phone asset -> odometerServiceCandidates does not create vehicle odometer notification',
      !hasOdometerAlert,
      `Generated notifications count: ${rows.length}, hasOdometerAlert: ${hasOdometerAlert}`
    );
  } catch (e: any) {
    assert('TEST 4: Phone asset', false, e.message);
  }

  // TEST 5: AC asset -> odometerServiceCandidates does not create vehicle service notification
  try {
    const acAsset = {
      assetId: 'ast_ac_001',
      assetName: 'Daikin 1.5 Ton 5 Star Inverter AC',
      categoryId: 'ac',
      warrantyExpiry: '2028-06-01',
      odometerKm: 12000,
      nextServiceOdometerKm: 10000,
    };
    const rows = evaluateAssetNotifications(acAsset);
    const hasOdometerAlert = rows.some(
      (r) =>
        r.notificationType === NOTIFICATION_TYPE.SERVICE_DUE &&
        String(r.title || '').includes('odometer')
    );
    assert(
      'TEST 5: AC asset -> odometerServiceCandidates does not create vehicle service notification',
      !hasOdometerAlert,
      `Generated notifications count: ${rows.length}, hasOdometerAlert: ${hasOdometerAlert}`
    );
  } catch (e: any) {
    assert('TEST 5: AC asset', false, e.message);
  }

  // TEST 6: Vehicle with service history -> Next Service Due still calculates correctly
  try {
    const vehicleAsset = {
      id: 'ast_ronin_1',
      assetId: 'ast_ronin_1',
      name: 'TVS Ronin 225',
      brand: 'TVS',
      category: 'Vehicles',
      categoryId: 'bike',
      odometerKm: 6200,
      purchaseDate: '2024-01-10',
      lastServiceDate: '2024-06-10',
      lastServiceOdometerKm: 5000,
      serviceLogs: [
        {
          id: 'srv_1',
          assetId: 'ast_ronin_1',
          serviceDate: '2024-06-10',
          serviceType: '1st Free Service',
          cost: 450,
          odometerKm: 1000,
          verificationStatus: 'VERIFIED',
        },
        {
          id: 'srv_2',
          assetId: 'ast_ronin_1',
          serviceDate: '2024-11-15',
          serviceType: '2nd Periodic Service',
          cost: 1200,
          odometerKm: 5000,
          verificationStatus: 'VERIFIED',
        },
      ],
    };

    const prediction = predictNextServiceDue(
      vehicleAsset,
      (vehicleAsset.serviceLogs as any) || [],
      { referenceDateIST: new Date('2025-01-15T12:00:00+05:30') }
    );

    assert(
      'TEST 6: Vehicle with service history -> Next Service Due still calculates correctly',
      Boolean(prediction) &&
        prediction.statusLabel !== undefined &&
        prediction.oemTargetKm > 0 &&
        prediction.oemIntervalKm > 0,
      `Target: ${prediction.oemTargetKm} KM, Status: ${prediction.statusLabel}, Due: ${prediction.finalEstimatedDueDate}`
    );
  } catch (e: any) {
    assert('TEST 6: Vehicle with service history', false, e.message);
  }

  // TEST 7: Dashboard with mixed portfolio -> renders / evaluates successfully without crash
  try {
    const mixedPortfolio = [
      {
        assetId: 'ast_ronin_01',
        assetName: 'TVS Ronin 225 TD',
        categoryId: 'bike',
        odometerKm: 12500,
        nextServiceOdometerKm: 12000,
        pucExpiry: '2026-09-15',
        insuranceExpiry: '2026-08-30',
      },
      {
        id: 'ast_re_02',
        assetName: 'Royal Enfield Classic 350',
        categoryId: 'bike',
        odometerKm: 8000,
        nextServiceOdometerKm: 10000,
        warrantyExpiry: '2027-04-10',
      },
      {
        assetId: 'ast_phone_03',
        assetName: 'Nothing Phone (2)',
        categoryId: 'phone',
        batteryHealthPercent: 78,
        warrantyExpiry: '2026-10-15',
      },
      {
        documentId: 'ast_ac_04',
        assetName: 'LG Dual Inverter 1.5T AC',
        categoryId: 'ac',
        energyProfile: { anomaly: true },
        warrantyExpiry: '2028-05-20',
      },
      {
        asset_id: 'ast_fridge_05',
        assetName: 'Samsung Double Door Refrigerator',
        categoryId: 'fridge',
        warrantyExpiry: '2029-01-01',
      },
    ];

    const notifications = evaluatePortfolioNotifications(mixedPortfolio, {
      userId: 'user_portfolio_test',
    });
    const summary = buildUpcomingSummary(notifications);

    assert(
      'TEST 7: Dashboard mixed portfolio -> evaluates without crash',
      Array.isArray(notifications) && summary !== null && typeof summary === 'object',
      `Evaluated ${notifications.length} notifications, summary: ${JSON.stringify(summary)}`
    );
  } catch (e: any) {
    assert('TEST 7: Dashboard mixed portfolio', false, e.message);
  }

  // TEST 8: evaluatePortfolioNotifications() with malformed/incomplete asset -> No ReferenceError, no fatal exception
  try {
    const malformedList = [
      null,
      undefined,
      {},
      { broken: true },
      { id: null, assetId: undefined, name: 'Ghost Asset' },
      { categoryId: 12345, odometerKm: 'not_a_number' },
      { deletedAt: '2025-01-01' },
      { status: 'sold' },
    ];

    const notifications = evaluatePortfolioNotifications(malformedList as any, {
      userId: 'user_malformed_test',
    });

    assert(
      'TEST 8: Malformed/incomplete assets -> No ReferenceError or exception',
      Array.isArray(notifications),
      `Handled ${malformedList.length} malformed records safely. Rows: ${notifications.length}`
    );
  } catch (e: any) {
    assert('TEST 8: Malformed/incomplete assets', false, e.message);
  }

  // TEST 9: Offline cached asset -> evaluates safely and offline service prediction remains functional
  try {
    const cachedAsset = {
      assetId: 'ast_offline_cached_01',
      id: 'ast_offline_cached_01',
      assetName: 'Tata Nexon EV Max',
      categoryId: 'ev',
      odometerKm: 24500,
      nextServiceOdometerKm: 25000,
      batteryProfile: { healthPercent: 94 },
      syncStatus: 'SYNCED',
      isOfflineCached: true,
      lastServiceDate: '2024-04-10',
      lastServiceOdometerKm: 15000,
    };

    const notifs = evaluateAssetNotifications(cachedAsset, { userId: 'user_offline_01' });
    const prediction = predictNextServiceDue(cachedAsset, [], {
      referenceDateIST: new Date('2025-02-01'),
    });

    assert(
      'TEST 9: Offline cached asset -> evaluates and service prediction functional',
      Array.isArray(notifs) && prediction !== null && prediction.statusLabel !== undefined,
      `Offline evaluation passed. Service prediction status: ${prediction?.statusLabel}`
    );
  } catch (e: any) {
    assert('TEST 9: Offline cached asset', false, e.message);
  }

  // TEST 10: Online Firestore asset update -> evaluates without crash
  try {
    // Initial state
    const originalAsset = {
      assetId: 'ast_live_sync_01',
      assetName: 'Hyundai Creta SX',
      categoryId: 'car',
      odometerKm: 18000,
      nextServiceOdometerKm: 20000,
      insuranceExpiry: '2026-11-20',
      pucExpiry: '2026-10-15',
    };
    const beforeNotifs = evaluateAssetNotifications(originalAsset, { userId: 'user_live_01' });

    // Simulated Firestore real-time snapshot update (new service record + updated odometer)
    const updatedAsset = {
      ...originalAsset,
      odometerKm: 20500, // crossed target 20000
      lastServiceDate: '2025-08-25',
      lastServiceOdometerKm: 20000,
      nextServiceOdometerKm: 30000,
    };
    const afterNotifs = evaluateAssetNotifications(updatedAsset, { userId: 'user_live_01' });

    assert(
      'TEST 10: Online Firestore update -> receives update and evaluates without crash',
      Array.isArray(beforeNotifs) && Array.isArray(afterNotifs),
      `Before count: ${beforeNotifs.length}, After count: ${afterNotifs.length}`
    );
  } catch (e: any) {
    assert('TEST 10: Online Firestore update', false, e.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return { passed, failed, results };
}

export const runCrashRegressionTestSuite = STARTUP_CRASH_REGRESSION_TEST;
export default STARTUP_CRASH_REGRESSION_TEST;
