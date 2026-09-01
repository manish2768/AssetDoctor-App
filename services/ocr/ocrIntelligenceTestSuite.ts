/**
 * Universal OCR Intelligence Test Suite
 * Comprehensive 10-point regression suite verifying:
 * - Document classification gating (Service vs Insurance vs PUC vs RC)
 * - Zero hallucination policy (null & NOT_FOUND for missing fields)
 * - Semantic odometer extraction & negative filter collision protection
 * - Separate provenance & Next Service KM extraction
 * - Entity linking and caching performance
 */

import { UniversalOcrPipeline } from './universalPipeline.ts';
import { DocumentClassifier } from './classifier.ts';
import { ReviewQueueService } from './reviewQueueService.ts';
import type { Asset } from '../../src/types.ts';

export interface OcrTestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function runOcrIntelligenceTestSuite(): Promise<{ passed: number; failed: number; results: OcrTestResult[] }> {
  const results: OcrTestResult[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      results.push({ name, passed: true, details });
    } else {
      results.push({ name, passed: false, details: details || 'Assertion failed' });
    }
  }

  // 1. TEST A: Insurance Policy -> Insurance fields ONLY, zero service fields
  try {
    const insuranceText = `
      ICICI LOMBARD GENERAL INSURANCE COMPANY LTD
      CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
      Policy Number: 3005/2024/09871234
      Period of Insurance: From 14/07/2025 to 13/07/2026
      Insured Name: NIKLESH KUMAR
      Registration No: UP32QU2187
      Chassis Number: MD637AN11S2F03328
      Engine Number: N33F2345
      Vehicle Make & Model: TVS MOTORS RONIN 225
      Insured Declared Value (IDV): ₹ 1,45,000.00
      Zero Depreciation Add-on: Included
      Own Damage Premium: ₹ 3,450.00
      Total Premium Payable: ₹ 4,850.00
      No Claim Bonus (NCB): 20%
    `;
    const res = await UniversalOcrPipeline.process(insuranceText, { skipCache: true });
    assert(
      '1. Insurance Policy Gating (Insurance fields ONLY, zero service fields)',
      res.classification.documentType === 'INSURANCE_POLICY' &&
        res.extractedData.insuranceData?.insurerName?.value?.includes('ICICI Lombard') === true &&
        res.extractedData.insuranceData?.policyExpiryDate?.value === '2026-07-13' &&
        res.extractedData.insuranceData?.idvAmount?.value === 145000 &&
        res.extractedData.serviceData === undefined,
      `Classified: ${res.classification.documentType}, Insurer: ${res.extractedData.insuranceData?.insurerName?.value}, ServiceData: ${res.extractedData.serviceData}`
    );
  } catch (e: any) {
    assert('1. Insurance Policy Gating', false, e.message);
  }

  // 2. TEST B: TVS Ronin Service Invoice -> Workshop, UP32QU2187, 12,450 KM, unobserved fields NOT_FOUND
  try {
    const serviceText = `
      TAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81587
      Date: 20/08/2024
      Model: TVS RONIN BASE 1 CH
      Customer: NIKLESH KUMAR
      RegNo. UP32QU2187
      Odometer: 12,450 KM
      Labour Total: 0.00
      Parts Total: 260.00
      Net Total Amount 260.00
    `;
    const res = await UniversalOcrPipeline.process(serviceText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '2. TVS Ronin Service Invoice (Observed values extracted, unobserved NOT_FOUND)',
      res.classification.documentType === 'SERVICE_INVOICE' &&
        s?.vehicleRegistration?.value === 'UP32QU2187' &&
        s?.odometerKm?.value === 12450 &&
        s?.odometerKm?.status === 'VERIFIED' &&
        s?.vehicleModel?.value?.includes('TVS RONIN') === true &&
        s?.workshopName?.value?.includes('TAAR MOTO LEGENDS') === true &&
        s?.nextServiceOdometerKm === undefined, // No fake next service target!
      `Odo: ${s?.odometerKm?.value} KM (Status: ${s?.odometerKm?.status}), NextService: ${s?.nextServiceOdometerKm?.value || 'NOT_FOUND'}`
    );
  } catch (e: any) {
    assert('2. TVS Ronin Service Invoice', false, e.message);
  }

  // 3. Purchase Invoice without Odometer -> Odometer is strictly NOT_FOUND / undefined (Zero Hallucination)
  try {
    const purchaseText = `
      RAFTAAR MOTO LEGENDS PVT LTD
      VEHICLE SALE INVOICE
      Invoice No: 10092
      Date: 10/01/2024
      Buyer: NIKLESH KUMAR
      Model: TVS RONIN 225 BASE
      Chassis No: MD637AN11S2F03328
      Ex-Showroom Price: ₹ 1,49,000.00
      Total Amount: ₹ 1,72,000.00
    `;
    const res = await UniversalOcrPipeline.process(purchaseText, { skipCache: true });
    assert(
      '3. Purchase Invoice Zero Hallucination (Zero invented odometer)',
      (res.classification.documentType === 'PURCHASE_INVOICE' || res.classification.documentType === 'VEHICLE_PURCHASE_INVOICE') &&
        res.extractedData.serviceData === undefined,
      `Classified: ${res.classification.documentType}, ServiceData: ${res.extractedData.serviceData}`
    );
  } catch (e: any) {
    assert('3. Purchase Invoice Zero Hallucination', false, e.message);
  }

  // 4. Negative Filter Collision Test: Phone, GSTIN, Total Amount, PIN code & Vehicle KM
  try {
    const collisionText = `
      TAAR MOTORS SERVICE
      SERVICE INVOICE
      GSTIN: 09ABCDE1234F1Z5
      Phone: 9876543210
      PIN Code: 226010
      Invoice No: 5544
      Date: 12/04/2026
      Vehicle KM: 12450
      Grand Total: ₹ 12450.00
    `;
    const res = await UniversalOcrPipeline.process(collisionText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '4. Negative Filter Collision Protection (Odometer strictly 12,450 from Vehicle KM label)',
      s?.odometerKm?.value === 12450 &&
        s?.customerPhone?.value === '9876543210' &&
        s?.gstin?.value === '09ABCDE1234F1Z5' &&
        s?.totalAmount?.value === 12450,
      `Odo: ${s?.odometerKm?.value}, Phone: ${s?.customerPhone?.value}, GSTIN: ${s?.gstin?.value}`
    );
  } catch (e: any) {
    assert('4. Negative Filter Collision Protection', false, e.message);
  }

  // 5. Chassis Extraction Test without fabricating Engine Number
  try {
    const chassisOnlyText = `
      SERVICE ESTIMATE
      WORKSHOP: EXPRESS GARAGE
      Chassis Number: MD637AN11S2F03328
      Invoice No: 4412
      Date: 05/05/2026
      Total Amount: ₹ 1,500.00
    `;
    const res = await UniversalOcrPipeline.process(chassisOnlyText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '5. Chassis Extraction without Fake Engine Number',
      s?.vinOrChassis?.value === 'MD637AN11S2F03328' &&
        s?.engineNumber === undefined,
      `Chassis: ${s?.vinOrChassis?.value}, Engine: ${s?.engineNumber?.value || 'NOT_FOUND'}`
    );
  } catch (e: any) {
    assert('5. Chassis Extraction', false, e.message);
  }

  // 6. Engine Extraction Test without fabricating Chassis Number
  try {
    const engineOnlyText = `
      SERVICE ESTIMATE
      WORKSHOP: EXPRESS GARAGE
      Engine Number: N33F2345
      Invoice No: 4413
      Date: 06/05/2026
      Total Amount: ₹ 2,000.00
    `;
    const res = await UniversalOcrPipeline.process(engineOnlyText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '6. Engine Extraction without Fake Chassis Number',
      s?.engineNumber?.value === 'N33F2345' &&
        s?.vinOrChassis === undefined,
      `Engine: ${s?.engineNumber?.value}, Chassis: ${s?.vinOrChassis?.value || 'NOT_FOUND'}`
    );
  } catch (e: any) {
    assert('6. Engine Extraction', false, e.message);
  }

  // 7. Multiple KM Values (In KM vs Out KM)
  try {
    const multiKmText = `
      AUTHORISED SERVICE CENTER
      JOB CARD & SERVICE BILL
      Invoice No: 7721
      Date: 15/06/2026
      Opening KM: 12450
      Out KM: 12455
      Total Amount: ₹ 3,200.00
    `;
    const res = await UniversalOcrPipeline.process(multiKmText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '7. Multiple KM Values Disambiguation (Opening KM 12,450 resolved)',
      s?.odometerKm?.value === 12450,
      `Resolved Odometer: ${s?.odometerKm?.value}`
    );
  } catch (e: any) {
    assert('7. Multiple KM Values Disambiguation', false, e.message);
  }

  // 8. Next Service KM Separation (Current KM vs Next Service Due KM)
  try {
    const nextServiceText = `
      TAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 9901
      Date: 25/08/2026
      Current KM: 12450
      Next Service Due At: 15000 KM
      Total Amount: ₹ 850.00
    `;
    const res = await UniversalOcrPipeline.process(nextServiceText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '8. Next Service KM Separation (Current KM: 12450, Next Service: 15000, Provenance: OCR_DOCUMENT)',
      s?.odometerKm?.value === 12450 &&
        s?.nextServiceOdometerKm?.value === 15000 &&
        s?.odometerKm?.sourceType === 'OCR_DOCUMENT' &&
        s?.nextServiceOdometerKm?.sourceType === 'OCR_DOCUMENT',
      `Current: ${s?.odometerKm?.value}, Next Service: ${s?.nextServiceOdometerKm?.value}, SourceType: ${s?.odometerKm?.sourceType}`
    );
  } catch (e: any) {
    assert('8. Next Service KM Separation', false, e.message);
  }

  // 9. Blurry / Degraded Document -> Low Confidence / NEEDS_REVIEW (No fake fallback)
  try {
    const degradedText = `
      SRVCE INV
      Invc N: ???
      Dt: 12/26
      Totl: 500
    `;
    const res = await UniversalOcrPipeline.process(degradedText, { skipCache: true });
    assert(
      '9. Degraded Document Flagged NEEDS_REVIEW (Zero Fake Fields)',
      res.requiresReview === true &&
        res.extractedData.serviceData?.odometerKm === undefined &&
        res.extractedData.serviceData?.vinOrChassis === undefined,
      `RequiresReview: ${res.requiresReview}, Odo: ${res.extractedData.serviceData?.odometerKm?.value || 'NOT_FOUND'}`
    );
  } catch (e: any) {
    assert('9. Degraded Document Flagged', false, e.message);
  }

  // 10. Mixed Indian Invoice Layout (GSTIN, HSN table, labour charges, customer details)
  try {
    const indianLayoutText = `
      SHREE GANESH AUTO REPAIRS & SPARES
      TAX INVOICE / CASH MEMO
      GSTIN: 07AABCS1429B1ZB
      Invoice No: SG/2026/102
      Date: 18/09/2026
      Customer Name: RAJESH SHARMA
      Phone: 9811223344
      Vehicle No: DL01AB9988
      KM Reading: 34,200
      HSN 8714: Brake Shoes - ₹ 650.00
      Labour Charges: ₹ 400.00
      Parts Total: ₹ 650.00
      Total Tax: ₹ 189.00
      Total Amount: ₹ 1,239.00
    `;
    const res = await UniversalOcrPipeline.process(indianLayoutText, { skipCache: true });
    const s = res.extractedData.serviceData;
    assert(
      '10. Mixed Indian Invoice Layout (Registration DL01AB9988, Odo 34200, Labour 400, Parts 650, Total 1239)',
      res.classification.documentType === 'SERVICE_INVOICE' &&
        s?.vehicleRegistration?.value === 'DL01AB9988' &&
        s?.odometerKm?.value === 34200 &&
        s?.labourCharges?.value === 400 &&
        s?.partsTotal?.value === 650 &&
        s?.totalAmount?.value === 1239,
      `Classified: ${res.classification.documentType}, Reg: ${s?.vehicleRegistration?.value}, Odo: ${s?.odometerKm?.value}, Total: ${s?.totalAmount?.value}`
    );
  } catch (e: any) {
    assert('10. Mixed Indian Invoice Layout', false, e.message);
  }

  const existingTvsAsset: Asset = {
    id: 'asset_tvs_ronin',
    name: 'TVS Ronin Base',
    registration: 'UP32QU2187',
    serialNumber: '',
    brand: 'TVS',
  } as Asset;
  (existingTvsAsset as any).chassisNumber = 'MD637AN11S2F03328';
  (existingTvsAsset as any).engineNumber = 'BN1FS2302943';
  (existingTvsAsset as any).odometerKm = 12450;

  const nothingPhoneText = `
    NOTHING TECH LTD
    TAX INVOICE
    Invoice No: NP-8821
    Date: 20/08/2024
    Buyer: AYUSH RAI
    Product: Nothing Phone (2a)
    IMEI: 869910012345678
    Serial No: NP2A8X91K2
    HSN: 8517
    Taxable Value: 22,000.00
    GST: 3,960.00
    Grand Total: ₹ 25,960.00
  `;

  // TEST A/B — Nothing Phone must not inherit TVS Ronin / vehicle service fields
  try {
    const res = await UniversalOcrPipeline.process(nothingPhoneText, {
      skipCache: true,
      existingAssets: [existingTvsAsset],
      previousVerifiedOdometer: 12450,
    });
    const inv = res.reviewInvoice || {};
    const banned = ['UP32QU2187', 'MD637AN11S2F03328', 'BN1FS2302943', '12450', '15000'];
    const blob = JSON.stringify(res.extractedData || {});
    const leaked = banned.filter((b) => blob.includes(b) || String(inv.registration || '').includes(b) || String(inv.chassisNumber || '').includes(b));
    assert(
      'A. Nothing Phone invoice must NOT contain TVS Ronin vehicle service data',
      (res.classification.documentType === 'ELECTRONICS_PURCHASE_INVOICE' ||
        res.classification.documentType === 'OTHER_PURCHASE_DOCUMENT' ||
        res.classification.documentType === 'GENERIC_DOCUMENT') &&
        res.extractedData.serviceData === undefined &&
        inv.odometerKm == null &&
        !inv.pucExpiry &&
        leaked.length === 0,
      `Type=${res.classification.documentType} leaked=${leaked.join(',')} odo=${inv.odometerKm} service=${!!res.extractedData.serviceData}`,
    );
    assert(
      'B. Nothing Phone must not contain 12450/15000/UP32QU2187/chassis/engine unless printed',
      leaked.length === 0 &&
        inv.registration !== 'UP32QU2187' &&
        inv.chassisNumber !== 'MD637AN11S2F03328' &&
        inv.engineNumber !== 'BN1FS2302943',
      `reg=${inv.registration} chassis=${inv.chassisNumber} engine=${inv.engineNumber}`,
    );
  } catch (e: any) {
    assert('A/B Nothing Phone isolation', false, e.message);
  }

  // TEST C — no automatic 2026-12-31
  try {
    const res = await UniversalOcrPipeline.process(nothingPhoneText, { skipCache: true });
    const blob = JSON.stringify({
      dates: [
        res.reviewInvoice?.invoiceDate,
        res.reviewInvoice?.warrantyExpiry,
        res.reviewInvoice?.pucExpiry,
        res.reviewInvoice?.insuranceExpiry,
        res.reviewInvoice?.nextServiceDue,
        res.extractedData,
      ],
    });
    assert(
      'C. No automatic date 2026-12-31',
      !blob.includes('2026-12-31'),
      'no 2026-12-31 in extracted dates',
    );
  } catch (e: any) {
    assert('C. No automatic date 2026-12-31', false, e.message);
  }

  // TEST D — no automatic next service 15000
  try {
    const res = await UniversalOcrPipeline.process(nothingPhoneText, { skipCache: true });
    assert(
      'D. No automatic next service 15000 KM',
      res.reviewInvoice?.nextServiceOdometerKm == null &&
        res.extractedData.serviceData?.nextServiceOdometerKm == null,
      `nextService=${res.reviewInvoice?.nextServiceOdometerKm}`,
    );
  } catch (e: any) {
    assert('D. No automatic next service 15000 KM', false, e.message);
  }

  // TEST E — service invoice must not inherit previous asset values that are not on the bill
  try {
    const serviceNoOdo = `
      TAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81588
      Date: 21/08/2024
      Model: Honda Activa
      Customer: TEST USER
      Labour Total: 200.00
      Net Total Amount 200.00
    `;
    const res = await UniversalOcrPipeline.process(serviceNoOdo, {
      skipCache: true,
      existingAssets: [existingTvsAsset],
      previousVerifiedOdometer: 12450,
    });
    const s = res.extractedData.serviceData;
    assert(
      'E. Service invoice does not inherit previous asset odometer/reg/chassis',
      s?.odometerKm === undefined &&
        s?.vehicleRegistration === undefined &&
        s?.vinOrChassis === undefined &&
        s?.engineNumber === undefined,
      `odo=${s?.odometerKm?.value} reg=${s?.vehicleRegistration?.value} chassis=${s?.vinOrChassis?.value}`,
    );
  } catch (e: any) {
    assert('E. Service invoice isolation from previous asset', false, e.message);
  }

  // TEST F — sales invoice must not inherit previous vehicle values
  try {
    const sales = `
      RELIANCE RETAIL
      TAX INVOICE
      Invoice No: RR-100
      Date: 01/02/2024
      Item: USB-C Cable
      Grand Total: ₹ 499.00
    `;
    const res = await UniversalOcrPipeline.process(sales, {
      skipCache: true,
      existingAssets: [existingTvsAsset],
    });
    assert(
      'F. Sales invoice must not inherit previous vehicle values',
      res.extractedData.serviceData === undefined &&
        res.reviewInvoice?.registration !== 'UP32QU2187' &&
        res.reviewInvoice?.odometerKm == null,
      `type=${res.classification.documentType} reg=${res.reviewInvoice?.registration}`,
    );
  } catch (e: any) {
    assert('F. Sales invoice isolation', false, e.message);
  }

  // TEST G — consecutive different documents are independent
  try {
    const a = await UniversalOcrPipeline.process(nothingPhoneText, { skipCache: true, scanSessionId: 'sess_a' });
    const b = await UniversalOcrPipeline.process(
      `
      TAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81587
      Date: 20/08/2024
      Model: TVS RONIN BASE 1 CH
      RegNo. UP32QU2187
      Odometer: 12,450 KM
      Net Total Amount 260.00
      `,
      { skipCache: true, scanSessionId: 'sess_b' },
    );
    assert(
      'G. Two consecutive scans produce independent extraction objects',
      a.scanSessionId === 'sess_a' &&
        b.scanSessionId === 'sess_b' &&
        a.reviewInvoice?.imei &&
        b.reviewInvoice?.registration === 'UP32QU2187' &&
        a.reviewInvoice?.registration !== b.reviewInvoice?.registration,
      `A sess=${a.scanSessionId} imei=${a.reviewInvoice?.imei} B reg=${b.reviewInvoice?.registration}`,
    );
  } catch (e: any) {
    assert('G. Consecutive scan isolation', false, e.message);
  }

  // TEST H — stale session guard
  try {
    const { ScanSessionGuard } = await import('./scanSession.ts');
    const guard = new ScanSessionGuard();
    const first = guard.begin('scan_A');
    const second = guard.begin('scan_B');
    assert(
      'H. Late scan A must not overwrite scan B (session guard)',
      !guard.isCurrent(first.scanSessionId, first.generation) &&
        guard.isCurrent(second.scanSessionId, second.generation),
      `current=${guard.current}`,
    );
  } catch (e: any) {
    assert('H. Stale session guard', false, e.message);
  }

  // TEST I — same image/text hits cache
  try {
    UniversalOcrPipeline.clearCache();
    const first = await UniversalOcrPipeline.process(nothingPhoneText, { skipCache: false });
    const second = await UniversalOcrPipeline.process(nothingPhoneText, { skipCache: false });
    assert(
      'I. Same image/text twice should use cache',
      second.metrics.cacheHit === true && first.metrics.cacheHit !== true,
      `firstCache=${first.metrics.cacheHit} secondCache=${second.metrics.cacheHit}`,
    );
  } catch (e: any) {
    assert('I. Cache hit for same content', false, e.message);
  }

  // TEST J — different content must not use previous cache even with same filename hint
  try {
    UniversalOcrPipeline.clearCache();
    const first = await UniversalOcrPipeline.process(nothingPhoneText, {
      skipCache: false,
      documentId: 'invoice.jpg',
    });
    const second = await UniversalOcrPipeline.process(
      `
      ICICI LOMBARD GENERAL INSURANCE COMPANY LTD
      CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
      Policy Number: 3005/2024/09871234
      Period of Insurance: From 14/07/2025 to 13/07/2026
      Registration No: MH12AB9999
      `,
      { skipCache: false, documentId: 'invoice.jpg' },
    );
    assert(
      'J. Different image with same filename must NOT use previous cache',
      second.metrics.cacheHit !== true &&
        second.classification.documentType === 'INSURANCE_POLICY' &&
        first.classification.documentType !== second.classification.documentType,
      `secondType=${second.classification.documentType} cache=${second.metrics.cacheHit}`,
    );
  } catch (e: any) {
    assert('J. Filename must not be the cache key', false, e.message);
  }

  // Insurance must not contain service/labour/odometer
  try {
    const insuranceText = `
      ICICI LOMBARD GENERAL INSURANCE COMPANY LTD
      CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
      Policy Number: 3005/2024/09871234
      Period of Insurance: From 14/07/2025 to 13/07/2026
      Insured Name: NIKLESH KUMAR
      Registration No: DL01AB9988
    `;
    const res = await UniversalOcrPipeline.process(insuranceText, { skipCache: true });
    assert(
      'K. Insurance has no service/labour/odometer fields',
      res.extractedData.serviceData === undefined &&
        res.reviewInvoice?.odometerKm == null &&
        res.reviewInvoice?.labourCharges == null,
      `service=${!!res.extractedData.serviceData} odo=${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('K. Insurance service-field isolation', false, e.message);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}
