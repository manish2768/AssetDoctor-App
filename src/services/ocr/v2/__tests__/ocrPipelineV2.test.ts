/**
 * ASSET DOCTOR — OCR PIPELINE V2 COMPREHENSIVE TEST SUITE
 * Verifies document classification, schema validation, odometer extraction,
 * registration normalization, identity conflict resolution, and review gating.
 */

import { OcrPipelineV2 } from '../OcrPipelineV2';
import { validateAndExtractOdometer } from '../validation/odometerValidator';
import { normalizeIndianRegistration, validateVehicleIdentity } from '../validation/vehicleIdentityValidator';
import { classifyDocumentV2 } from '../classifier/documentClassifierV2';

describe('OCR Pipeline V2 Architecture Tests', () => {
  test('1. Document Classification — Vehicle RC', () => {
    const rawText = `
      INDIAN UNION VEHICLE REGISTRATION CERTIFICATE
      FORM 23
      REGT. NO: UP 32 AB 1234
      NAME: RAJESH KUMAR
      CHASSIS NO: MA3EWB1S000123456
      ENGINE NO: K12MN123456
      MAKER NAME: MARUTI SUZUKI INDIA LTD
    `;
    const res = classifyDocumentV2(rawText);
    expect(res.documentType).toBe('VEHICLE_RC');
    expect(res.documentCategory).toBe('VEHICLE');
    expect(res.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('2. Document Classification — Vehicle Service Invoice', () => {
    const rawText = `
      AUTOVISTA SERVICE CENTER
      JOB CARD NO: JC-2026-9812
      DATE: 15/05/2026
      REGISTRATION NO: UP32AB1234
      ODOMETER: 45,200 KM
      ENGINE OIL SYNTHETIC: RS 2500
      WHEEL BALANCING: RS 800
      LABOUR CHARGES: RS 1200
      TOTAL AMOUNT: RS 4500
    `;
    const res = classifyDocumentV2(rawText);
    expect(res.documentType).toBe('VEHICLE_SERVICE_INVOICE');
    expect(res.documentCategory).toBe('VEHICLE');
  });

  test('3. Document Classification — PUC Certificate', () => {
    const rawText = `
      TRANSPORT DEPARTMENT GOVT OF UTTAR PRADESH
      POLLUTION UNDER CONTROL CERTIFICATE
      PUC NO: UP0050012903
      VEHICLE REGT NO: UP 32 AB 1234
      VALID TILL: 20/12/2026
    `;
    const res = classifyDocumentV2(rawText);
    expect(res.documentType).toBe('VEHICLE_PUC');
    expect(res.documentCategory).toBe('VEHICLE');
  });

  test('4. Registration Normalization — Formats Equivalence', () => {
    expect(normalizeIndianRegistration('UP 32 AB 1234')).toBe('UP32AB1234');
    expect(normalizeIndianRegistration('UP-32-AB-1234')).toBe('UP32AB1234');
    expect(normalizeIndianRegistration('DL.01.C.9999')).toBe('DL01C9999');
    expect(normalizeIndianRegistration('MH02BZ5555')).toBe('MH02BZ5555');
  });

  test('5. Odometer Validation — High Priority Anchor Label', () => {
    const text = `
      JOB CARD NO: 98120
      GSTIN: 07AAAAA0000A1Z5
      CUSTOMER PHONE: 9819201928
      ODOMETER: 62450 KM
      TOTAL BILL: RS 5400
    `;
    const result = validateAndExtractOdometer(text);
    expect(result.value).toBe(62450);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.validationStatus).toBe('VALID');
  });

  test('6. Odometer Validation — Reject Phone & GSTIN as Odometer', () => {
    const text = `
      INVOICE NO: 109283
      PHONE: 9819201928
      GSTIN: 27AAAAA0000A1Z5
      TOTAL AMOUNT: 12500
    `;
    const result = validateAndExtractOdometer(text);
    expect(result.value).toBeNull();
    expect(result.validationStatus).toBe('NOT_FOUND');
  });

  test('7. Vehicle Identity Validation — Mismatch Detection', () => {
    const docOcr = {
      vehicleRegistrationNumber: 'UP32AB1238',
      chassisNumber: 'MA3EWB1S000999999',
    };
    const existingAsset = {
      registrationNumber: 'UP32AB1234',
      chassisNumber: 'MA3EWB1S000123456',
    };

    const match = validateVehicleIdentity(docOcr, existingAsset);
    expect(match.isMatch).toBe(false);
    expect(match.updateAllowed).toBe(false);
    expect(match.status).toBe('POTENTIAL_MISMATCH');
    expect(match.mismatchWarnings.length).toBeGreaterThan(0);
  });

  test('8. End-to-End Pipeline V2 Execution', async () => {
    // Mock sample URI and process
    const sampleUri = 'file:///dummy/invoice_sample.jpg';
    const result = await OcrPipelineV2.process(sampleUri, { skipQualityCheck: true });

    expect(result.ocrPipelineVersion).toBe('v2');
    expect(result.processingId).toBeDefined();
    expect(result.documentHash).toBeDefined();
    expect(result.processedAt).toBeDefined();
  });
});
