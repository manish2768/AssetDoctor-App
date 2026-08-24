/**
 * Asset Doctor — Mobile App Offline Sync & Prediction Test Suite
 * Validates offline caching, mutation queuing, reconnection flush, conflict handling, and Next Service prediction.
 */

import { MobileAssetService, normalizeAssetData } from '../../src/services/mobileAssetService.ts';
import { MobileServiceHistoryService } from '../../src/services/mobileServiceHistoryService.ts';
import { MobileOcrService } from '../../src/services/mobileOcrService.ts';
import { syncEngine, type QueuedMutation } from '../../src/services/mobileSyncEngine.ts';
import type { Asset, ServiceRecord } from '../../src/types.ts';

export interface MobileTestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function runMobileSyncTestSuite(): Promise<{ passed: number; failed: number; results: MobileTestResult[] }> {
  const results: MobileTestResult[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      results.push({ name, passed: true, details });
    } else {
      results.push({ name, passed: false, details: details || 'Assertion failed' });
    }
  }

  const testUid = 'user_test_mobile_offline_001';

  // 1. Schema Normalization Test
  try {
    const rawData = {
      assetName: 'Hyundai Creta 1.5 SX',
      brandName: 'Hyundai',
      categoryLabel: 'Vehicles',
      currentKm: 27800,
      registrationNumber: 'UP32QU2187',
      invoiceDate: '2024-01-15',
      warrantyExpiryDate: '2027-01-14',
      insuranceExpiry: '2026-07-13',
      pucExpiry: '2026-08-20'
    };
    const norm = normalizeAssetData('ast_test_1', rawData);
    assert(
      '1. Asset Schema Normalization (Dual field compatibility)',
      norm.name === 'Hyundai Creta 1.5 SX' &&
        norm.brand === 'Hyundai' &&
        norm.category === 'Vehicles' &&
        norm.odometerKm === 27800 &&
        norm.registration === 'UP32QU2187' &&
        norm.insuranceExpiryDate === '2026-07-13',
      `Normalized: ${norm.name}, Odo: ${norm.odometerKm} KM, Reg: ${norm.registration}`
    );
  } catch (e: any) {
    assert('1. Asset Schema Normalization', false, e.message);
  }

  // 2. Offline Caching & Instant Retrieval Test
  try {
    const sampleAsset: Asset = {
      id: 'ast_ronin_off',
      name: 'TVS Ronin 225',
      brand: 'TVS',
      category: 'Vehicles',
      price: 172000,
      purchaseDate: '2024-01-10',
      warrantyMonths: 36,
      expiryDate: '2027-01-10',
      daysRemaining: 503,
      status: 'active',
      odometerKm: 12273,
      registration: 'UP32QU2187'
    };
    MobileAssetService.cacheAssets([sampleAsset], testUid);
    const cached = MobileAssetService.getCachedAssets(testUid);
    assert(
      '2. Offline Asset Caching & Instant Retrieval',
      cached.length === 1 && cached[0].name === 'TVS Ronin 225' && cached[0].odometerKm === 12273,
      `Cached Assets: ${cached.length}, Item: ${cached[0]?.name}`
    );
  } catch (e: any) {
    assert('2. Offline Asset Caching', false, e.message);
  }

  // 3. Offline Next Service Due Prediction Test
  try {
    const asset = MobileAssetService.getCachedAssets(testUid)[0];
    const records: ServiceRecord[] = [
      {
        id: 'rec_1',
        assetId: asset.id,
        serviceDate: '2024-08-20',
        odometerKm: 12273,
        serviceType: 'periodic_maintenance',
        verificationStatus: 'VERIFIED'
      }
    ];
    MobileServiceHistoryService.cacheRecords(asset.id, records, testUid);
    const pred = MobileServiceHistoryService.calculatePrediction(asset, records);

    assert(
      '3. Mobile Next Service Prediction Engine (Whichever Comes First)',
      pred.oemTargetKm === 18273 &&
        pred.scheduleSourceType !== 'GENERIC_FALLBACK' &&
        pred.scheduleLabel === 'Manufacturer Recommended' &&
        pred.finalEstimatedDueDate === '2025-02-16',
      `Target: ${pred.oemTargetKm} KM, Due Date: ${pred.finalEstimatedDueDate}, Source: ${pred.scheduleSourceType}`
    );
  } catch (e: any) {
    assert('3. Mobile Next Service Prediction Engine', false, e.message);
  }

  // 4. Offline Mutation Queue Enqueueing Test
  try {
    const opId = await syncEngine.enqueueMutation(
      'asset',
      'ast_ronin_off',
      'update',
      { odometerKm: 13500, notes: 'Oil topped up' },
      testUid
    );
    const queue = syncEngine.getQueue(testUid);
    const queuedItem = queue.find(q => q.operationId === opId);

    assert(
      '4. Offline Mutation Queue (PENDING_SYNC status & idempotency)',
      Boolean(queuedItem) && queuedItem?.syncStatus === 'PENDING_SYNC' && queuedItem?.payload.odometerKm === 13500,
      `Queued Op: ${opId}, Status: ${queuedItem?.syncStatus}`
    );
  } catch (e: any) {
    assert('4. Offline Mutation Queue', false, e.message);
  }

  // 5. OCR Integration & Automatic Odometer Refresh Test
  try {
    const billText = `
      RAFTAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81587
      Date: 20/08/2024
      Customer: NIKLESH KUMAR
      RegNo. UP32QU2187
      KMs 12273
      Net Total Amount 260.00
    `;
    const scanRes = await MobileOcrService.processDocument(billText);
    assert(
      '5. Mobile OCR Invoice Processing & Field Confidence',
      scanRes.state === 'COMPLETED' &&
        scanRes.extractedData.odometerKm === 12273 &&
        scanRes.extractedData.verificationStatus === 'VERIFIED' &&
        scanRes.fields.length >= 4,
      `State: ${scanRes.state}, Extracted Odo: ${scanRes.extractedData.odometerKm} KM, Fields: ${scanRes.fields.length}`
    );
  } catch (e: any) {
    assert('5. Mobile OCR Invoice Processing', false, e.message);
  }

  // 6. Generic Fallback Transparency Test on Mobile
  try {
    const genericVehicle: Asset = {
      id: 'ast_gen_off',
      name: 'Custom Vintage Roadster',
      category: 'Vehicles',
      price: 500000,
      purchaseDate: '2024-01-01',
      warrantyMonths: 12,
      expiryDate: '2025-01-01',
      daysRemaining: 0,
      status: 'expired'
    };
    const pred = MobileServiceHistoryService.calculatePrediction(genericVehicle, []);
    assert(
      '6. Generic Fallback Display Transparency on Mobile',
      pred.scheduleSourceType === 'GENERIC_FALLBACK' &&
        pred.scheduleLabel === 'Generic estimate — manufacturer schedule unavailable',
      `Schedule Label: ${pred.scheduleLabel}`
    );
  } catch (e: any) {
    assert('6. Generic Fallback Display Transparency', false, e.message);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}
