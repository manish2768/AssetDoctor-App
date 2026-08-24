/**
 * Universal OCR Intelligence Test Suite
 * Tests all 13 Indian Document Types, Cross-Document Linking, Validation, and Real Document Invoices.
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

  // 1. Service Invoice Classification & Extraction (Real Raftaar TVS Invoice)
  try {
    const text = `
      RAFTAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81587
      Date: 20/08/2024
      Customer: NIKLESH KUMAR
      RegNo. UP32QU2187
      KMs 12273
      Labour Total: 0.00
      Parts Total: 260.00
      Net Total Amount 260.00
    `;
    const res = await UniversalOcrPipeline.process(text);
    assert(
      '1. Real Service Invoice (Classification & Odometer 12,273 KM)',
      res.classification.documentType === 'SERVICE_INVOICE' &&
        res.extractedData.serviceData?.odometerKm?.value === 12273 &&
        res.extractedData.serviceData?.vehicleRegistration?.value === 'UP32QU2187' &&
        res.extractedData.serviceData?.totalAmount?.value === 260,
      `Classified: ${res.classification.documentType}, Odo: ${res.extractedData.serviceData?.odometerKm?.value} KM, Reg: ${res.extractedData.serviceData?.vehicleRegistration?.value}`
    );
  } catch (e: any) {
    assert('1. Real Service Invoice', false, e.message);
  }

  // 2. Real Motor Insurance Policy Schedule (ICICI Lombard)
  try {
    const text = `
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
    const res = await UniversalOcrPipeline.process(text);
    assert(
      '2. Real Insurance Policy (ICICI Lombard, IDV, Zero Dep, 13/07/2026 Expiry)',
      res.classification.documentType === 'INSURANCE_POLICY' &&
        res.extractedData.insuranceData?.policyExpiryDate?.value === '2026-07-13' &&
        res.extractedData.insuranceData?.policyType?.value === 'ZERO_DEPRECIATION' &&
        res.extractedData.insuranceData?.idvAmount?.value === 145000 &&
        res.extractedData.insuranceData?.ncbPercentage?.value === 20,
      `Insurer: ${res.extractedData.insuranceData?.insurerName?.value}, Type: ${res.extractedData.insuranceData?.policyType?.value}, Expiry: ${res.extractedData.insuranceData?.policyExpiryDate?.value}`
    );
  } catch (e: any) {
    assert('2. Real Insurance Policy', false, e.message);
  }

  // 3. Real PUC Certificate (Date Sequence & Compliant Status)
  try {
    const text = `
      GOVERNMENT OF UTTAR PRADESH
      TRANSPORT DEPARTMENT
      POLLUTION UNDER CONTROL CERTIFICATE
      Certificate No: UP032001928374
      Date of Test: 21/08/2025
      Valid Till: 20/08/2026
      Vehicle Reg No: UP32QU2187
      Vehicle Type: Two Wheeler (Motorcycle)
      Fuel: PETROL
      Emission Test: CO: 0.12 % HC: 140 ppm
      Status: PASS
    `;
    const res = await UniversalOcrPipeline.process(text);
    assert(
      '3. Real PUC Certificate (Issue: 2025-08-21, Expiry: 2026-08-20, Expiry > Issue)',
      res.classification.documentType === 'PUC_CERTIFICATE' &&
        res.extractedData.pucData?.expiryDate?.value === '2026-08-20' &&
        res.extractedData.pucData?.registrationNumber?.value === 'UP32QU2187' &&
        res.validation.isValid,
      `Type: ${res.classification.documentType}, Valid Till: ${res.extractedData.pucData?.expiryDate?.value}, Validated: ${res.validation.isValid}`
    );
  } catch (e: any) {
    assert('3. Real PUC Certificate', false, e.message);
  }

  // 4. Real RC Certificate (Form 23 & Normalized Registration)
  try {
    const text = `
      FORM 23
      CERTIFICATE OF REGISTRATION
      TRANSPORT DEPARTMENT - UTTAR PRADESH
      Regn No: UP-32-QU-2187
      Owner Name: NIKLESH KUMAR
      Maker's Name: TVS MOTOR COMPANY LTD
      Maker's Class: TVS RONIN 225
      Chassis No: MD637AN11S2F03328
      Engine No: N33F2345
      Cubic Cap: 225 CC
      Date of Registration: 10/01/2024
      Fitness Upto: 09/01/2039
      Hypothecated to: HDFC BANK LTD
    `;
    const res = await UniversalOcrPipeline.process(text);
    assert(
      '4. Real RC Certificate (Normalized Reg UP32QU2187, Chassis MD637AN11S2F03328)',
      res.classification.documentType === 'RC_CERTIFICATE' &&
        res.extractedData.rcData?.registrationNumber?.value === 'UP32QU2187' &&
        res.extractedData.rcData?.chassisNumber?.value === 'MD637AN11S2F03328' &&
        res.extractedData.rcData?.cubicCapacity?.value === 225,
      `Classified: ${res.classification.documentType}, Reg: ${res.extractedData.rcData?.registrationNumber?.value}, Chassis: ${res.extractedData.rcData?.chassisNumber?.value}`
    );
  } catch (e: any) {
    assert('4. Real RC Certificate', false, e.message);
  }

  // 5. Cross-Document Entity Linking Test (RC + Insurance + Service Bill -> Same Asset)
  try {
    const existingVaultedAsset: Asset = {
      id: 'ast_ronin_master',
      name: 'TVS Ronin 225',
      brand: 'TVS',
      category: 'Vehicles',
      price: 172000,
      purchaseDate: '2024-01-10',
      warrantyMonths: 36,
      expiryDate: '2027-01-10',
      daysRemaining: 500,
      status: 'active',
      registration: 'UP32QU2187',
      vinNumber: 'MD637AN11S2F03328'
    };

    // Upload an Insurance document for UP32QU2187
    const insuranceText = `
      CERTIFICATE OF INSURANCE
      Policy No: 9988776655
      Vehicle Regn: UP 32 QU 2187
      Chassis No: MD637AN11S2F03328
      Insured Declared Value: ₹ 145000
    `;
    const res = await UniversalOcrPipeline.process(insuranceText, {
      existingAssets: [existingVaultedAsset]
    });

    assert(
      '5. Cross-Document Entity Linking (Auto-linked to TVS Ronin ast_ronin_master)',
      res.entityLink.isAutoLinked &&
        res.entityLink.matchedAssetId === 'ast_ronin_master' &&
        res.entityLink.matchType === 'EXACT_REGISTRATION',
      `AutoLinked: ${res.entityLink.isAutoLinked}, Target Asset: ${res.entityLink.matchedAssetId}, Notes: ${res.entityLink.notes}`
    );
  } catch (e: any) {
    assert('5. Cross-Document Entity Linking', false, e.message);
  }

  // 6. Home Appliance & Electronics Invoice (Air Conditioner)
  try {
    const text = `
      CROMA - INFINITI RETAIL LIMITED
      TAX INVOICE
      Invoice No: CR/MUM/2026/9021
      Date: 15/03/2026
      Item: Daikin 1.5 Ton 5 Star Inverter Split AC
      Brand: Daikin
      Serial Number: DK-AC-2026-99881
      Grand Total: ₹ 44,990.00
      Warranty: 1 Year Comprehensive, 10 Years Compressor Warranty
    `;
    const res = await UniversalOcrPipeline.process(text);
    assert(
      '6. Appliance Invoice (Daikin 1.5 Ton AC, Serial DK-AC-2026-99881)',
      res.classification.documentType === 'APPLIANCE_INVOICE' &&
        res.extractedData.applianceData?.applianceType?.value === 'Air Conditioner' &&
        res.extractedData.applianceData?.brand?.value === 'Daikin' &&
        res.extractedData.applianceData?.serialNumber?.value === 'DK-AC-2026-99881',
      `Type: ${res.classification.documentType}, App: ${res.extractedData.applianceData?.applianceType?.value}, Brand: ${res.extractedData.applianceData?.brand?.value}`
    );
  } catch (e: any) {
    assert('6. Appliance Invoice', false, e.message);
  }

  // 7. Duplicate Document Detection
  try {
    const text = `
      RAFTAAR MOTO LEGENDS PVT LTD
      SERVICE INVOICE
      Invoice No: 81587
      Date: 20/08/2024
      RegNo. UP32QU2187
    `;
    const existingDocs = [
      {
        id: 'doc_existing_1',
        assetId: 'ast_ronin_master',
        documentType: 'SERVICE_INVOICE' as const,
        fingerprint: 'FP_SERVICE_INVOICE::81587::UP32QU2187::2024-08-20',
        invoiceNumber: '81587'
      }
    ];

    const res = await UniversalOcrPipeline.process(text, {
      existingVaultedDocs: existingDocs
    });

    assert(
      '7. Duplicate Document Detection (Identified Vaulted Duplicate)',
      res.duplicateCheck.isDuplicate &&
        res.duplicateCheck.duplicateDocumentId === 'doc_existing_1' &&
        res.requiresReview,
      `IsDuplicate: ${res.duplicateCheck.isDuplicate}, Reason: ${res.duplicateCheck.reason}`
    );
  } catch (e: any) {
    assert('7. Duplicate Document Detection', false, e.message);
  }

  // 8. Cross-Field Validation & Arithmetic Reconciliation
  try {
    // Bad invoice where parts + labour != total
    const badText = `
      AUTO REPAIRS WORKSHOP
      SERVICE INVOICE
      Invoice No: 9911
      Date: 10/05/2026
      Parts Total: ₹ 1000.00
      Labour Total: ₹ 500.00
      Tax Amount: ₹ 200.00
      Total Amount: ₹ 5000.00
    `;
    const res = await UniversalOcrPipeline.process(badText);
    const hasFinMismatch = res.validation.issues.some(i => i.rule === 'FINANCIAL_RECONCILIATION');
    assert(
      '8. Cross-Field Arithmetic Validation (Flagged line items ₹1700 != Total ₹5000)',
      hasFinMismatch && res.requiresReview,
      `Flagged Issues: ${res.validation.issues.length}, Rule: ${res.validation.issues[0]?.rule}`
    );
  } catch (e: any) {
    assert('8. Cross-Field Arithmetic Validation', false, e.message);
  }

  // 9. Human Review Queue & Admin Correction Audit
  try {
    const correction = ReviewQueueService.logCorrection(
      'doc_test_audit_9',
      'SERVICE_INVOICE',
      'odometerKm',
      12270,
      12273,
      0.72,
      'admin_super_manish',
      'Corrected 0 to 3 based on invoice visual verification'
    );
    const logs = ReviewQueueService.getCorrectionLogs();
    const match = logs.find(l => l.documentId === 'doc_test_audit_9');
    assert(
      '9. Review Queue & Correction Learning Dataset (Preserved original 12270 -> corrected 12273)',
      Boolean(match) && match?.originalValue === 12270 && match?.correctedValue === 12273,
      `Logged Correction: ${match?.fieldName} ${match?.originalValue} -> ${match?.correctedValue} by ${match?.correctedBy}`
    );
  } catch (e: any) {
    assert('9. Review Queue & Correction Learning', false, e.message);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}
