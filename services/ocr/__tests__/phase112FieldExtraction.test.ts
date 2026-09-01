/**
 * Phase 11.2 — OCR field extraction / normalization / validation regression.
 *
 * Kind: SYNTHETIC OCR TEXT + mocked provider disagreement.
 * Does NOT run real camera, real Vision, or on-device ML Kit.
 */

import { UniversalOcrPipeline } from '../universalPipeline.ts';
import { EntityLinker } from '../entityLinker.ts';
import { createField } from '../extractors/serviceExtractor.ts';
import { DOCUMENT_FIELD_SCHEMAS, schemaForDocumentType } from '../documentFieldSchemas.ts';
import {
  extractLabeledGrandTotal,
  extractLabeledRegistration,
  isForbiddenFinancialToken,
  looksLikeGstin,
  normalizeIndianPhone,
  reconcileProviderFieldValues,
} from '../fieldSafety.ts';
import { resolveOcrProviderWinner } from '../../../src/services/ocr/ocrProviderOrchestrator.js';
import { validateIMEI } from '../fieldChecksumValidators.ts';
import type { Asset } from '../../../src/types.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const TVS_SERVICE = `
  TAAR MOTO LEGENDS PVT LTD
  AUTHORISED TVS SERVICE CENTER
  GSTIN: 09AABCT1928K1ZX
  Phone: 9876543210
  TAX INVOICE / SERVICE BILL
  Invoice No: 81587
  Date: 20/08/2024
  Model: TVS RONIN BASE 1 CH
  Customer: NIKLESH KUMAR
  Vehicle Registration Number
  UP32QU2187
  Chassis No: MD637AN11S2F03328
  Engine No: BN1FS2302943
  Odometer: 12,450 KM
  Labour Charges: ₹ 0.00
  Parts Total: ₹ 260.00
  Tax Amount: ₹ 46.80
  Net Total Amount: ₹ 260.00
`;

const VEHICLE_PURCHASE = `
  RAFTAAR MOTO LEGENDS PVT LTD
  VEHICLE SALE INVOICE
  Invoice No: 10092
  Date: 10/01/2024
  Buyer: NIKLESH KUMAR
  Model: TVS RONIN 225 BASE
  Registration No: UP32QU2187
  Chassis No: MD637AN11S2F03328
  Engine No: BN1FS2302943
  Taxable Amount: ₹ 1,45,000.00
  GST Amount: ₹ 27,000.00
  Ex-Showroom Price: ₹ 1,49,000.00
  Grand Total: ₹ 1,72,000.00
`;

const ELECTRONICS_IMEI_TRAP = `
  FLIPKART INDIA PRIVATE LIMITED
  TAX INVOICE
  GSTIN: 29AABCU9603R1ZM
  Phone: 9876543210
  Invoice No: FA-2024-88910
  Invoice Date: 12/03/2024
  Buyer: AMIT VERMA
  Product Description: Nothing Phone (2a) 5G (Black, 128 GB)
  IMEI: 490154203237518
  Serial Number: NP2A-BLK-99881
  Qty: 1
  GST Amount: ₹ 3,660.00
  Grand Total IMEI 490154203237518 ₹23,999
  Grand Total: ₹ 23,999.00
`;

const INVALID_LUHN_IMEI = `
  TAX INVOICE
  Product: Nothing Phone (2a)
  IMEI: 869910012345679
  Grand Total: ₹ 25,960.00
`;

const INSURANCE = `
  HDFC ERGO GENERAL INSURANCE COMPANY LIMITED
  CERTIFICATE OF INSURANCE AND POLICY SCHEDULE
  Motor Two Wheeler Package Policy
  Policy Number: 2311/2025/88991122
  Period of Insurance: From 10/05/2025 to 09/05/2026
  Insured Name: ANANYA SHARMA
  Registration No: DL03XY9988
  Chassis Number: ME456ZX991002233
  Engine Number: E33445566
  Vehicle: HONDA ACTIVA 6G
  Insured Declared Value (IDV): ₹ 72,000.00
  Total Premium Payable: ₹ 2,450.00
  GSTIN: 07AABCH1234N1Z5
`;

const GSTIN_ONLY_BILL = `
  TAX INVOICE
  GSTIN: 09AABCT1928K1ZX
  Product: USB Cable
  Grand Total: ₹ 199.00
`;

const PHONE_AS_TOTAL = `
  TAX INVOICE
  Product: Phone case
  Phone: 9876543210
  Grand Total: ₹ 499.00
`;

const CHASSIS_AS_TOTAL = `
  TAAR MOTO LEGENDS PVT LTD
  SERVICE INVOICE
  RegNo. UP32QU2187
  Chassis No: MD637AN11S2F03328
  Engine No: BN1FS2302943
  Grand Total: ₹ 260.00
`;

export async function runPhase112FieldExtractionSuite(): Promise<boolean> {
  console.log('================================================================');
  console.log('PHASE 11.2 — OCR FIELD EXTRACTION (SYNTHETIC TEXT)');
  console.log('Not a real-camera / real-device / live Vision test.');
  console.log('================================================================\n');

  assert(
    schemaForDocumentType('SERVICE_INVOICE') === 'SERVICE_INVOICE' &&
      DOCUMENT_FIELD_SCHEMAS.SERVICE_INVOICE.includes('vehicleRegistration'),
    'Document schemas expose SERVICE_INVOICE registration field',
  );
  assert(
    DOCUMENT_FIELD_SCHEMAS.ELECTRONICS_PURCHASE_INVOICE.includes('imei') &&
      DOCUMENT_FIELD_SCHEMAS.VEHICLE_PURCHASE_INVOICE.includes('vinOrChassis'),
    'Electronics and vehicle purchase schemas are distinct',
  );

  console.log('\n[A] SERVICE INVOICE — newline registration');
  {
    const res = await UniversalOcrPipeline.process(TVS_SERVICE, { skipCache: true });
    const s = res.extractedData.serviceData;
    const inv = res.reviewInvoice || {};
    assert(res.classification.documentType === 'SERVICE_INVOICE', 'Classified SERVICE_INVOICE', res.classification.documentType);
    assert(
      s?.vehicleRegistration?.value === 'UP32QU2187' && inv.registration === 'UP32QU2187',
      'Registration extracted across newline (UP32QU2187)',
      `Got ${s?.vehicleRegistration?.value} / ${inv.registration}`,
    );
    assert(s?.workshopName?.value?.includes('TAAR MOTO LEGENDS') === true, 'Workshop extracted');
    assert(s?.vinOrChassis?.value === 'MD637AN11S2F03328' && inv.chassisNumber === 'MD637AN11S2F03328', 'Chassis extracted');
    assert(s?.engineNumber?.value === 'BN1FS2302943' && inv.engineNumber === 'BN1FS2302943', 'Engine extracted');
    assert(s?.odometerKm?.value === 12450, 'Odometer preserved from labelled reading', String(s?.odometerKm?.value));
    assert(s?.totalAmount?.value === 260 && inv.totalAmount === 260, 'Service total is labelled 260, not GSTIN/phone', String(s?.totalAmount?.value));
    assert(s?.gstin?.value !== s?.vehicleRegistration?.value, 'GSTIN is not used as registration');
  }

  console.log('\n[B] VEHICLE PURCHASE INVOICE — field separation');
  {
    const res = await UniversalOcrPipeline.process(VEHICLE_PURCHASE, { skipCache: true });
    const p = res.extractedData.purchaseData;
    const inv = res.reviewInvoice || {};
    assert(
      res.classification.documentType === 'PURCHASE_INVOICE' ||
        res.classification.documentType === 'VEHICLE_PURCHASE_INVOICE',
      'Classified as vehicle purchase family',
      res.classification.documentType,
    );
    assert(
      (p?.assetName?.value || inv.productName || '').toUpperCase().includes('RONIN'),
      'Vehicle model extracted',
      String(p?.assetName?.value || inv.productName),
    );
    assert(p?.vehicleRegistration?.value === 'UP32QU2187' && inv.registration === 'UP32QU2187', 'Purchase registration');
    assert(p?.vinOrChassis?.value === 'MD637AN11S2F03328' && inv.chassisNumber === 'MD637AN11S2F03328', 'Purchase chassis');
    assert(p?.engineNumber?.value === 'BN1FS2302943' && inv.engineNumber === 'BN1FS2302943', 'Purchase engine');
    assert(p?.invoiceNumber?.value === '10092', 'Invoice number');
    assert(inv.totalAmount === 172000, 'Grand Total 172000 not ex-showroom / chassis', String(inv.totalAmount));
    assert(inv.totalAmount !== 27000, 'GST is not selected as grand total');
    assert(p?.vinOrChassis?.value !== String(inv.totalAmount), 'Chassis is not the purchase amount');
  }

  console.log('\n[C] ELECTRONICS — IMEI must never become money');
  {
    const res = await UniversalOcrPipeline.process(ELECTRONICS_IMEI_TRAP, { skipCache: true });
    const e = res.extractedData.electronicsData;
    const inv = res.reviewInvoice || {};
    const imei = e?.imei?.value || inv.imei;
    assert(imei === '490154203237518', 'IMEI extracted', String(imei));
    assert(inv.totalAmount === 23999, 'Grand Total is 23999 from labelled evidence', String(inv.totalAmount));
    assert(inv.totalAmount !== 490154203237518 && inv.totalAmount !== 490154203237518.0, 'IMEI is not grand total');
    assert(inv.taxAmount !== 490154203237518, 'IMEI is not tax');
    assert(Number(inv.totalAmount) !== Number(imei), 'IMEI digits are not purchase value');
    assert(inv.registration === '' || !inv.registration, 'Phone invoice has no vehicle registration');
  }

  console.log('\n[C2] ELECTRONICS — invalid Luhn IMEI retained as NEEDS_REVIEW');
  {
    const res = await UniversalOcrPipeline.process(INVALID_LUHN_IMEI, { skipCache: true });
    const e = res.extractedData.electronicsData;
    const imei = e?.imei;
    assert(validateIMEI('869910012345679').valid === false, 'Checksum validator rejects 869910012345679');
    assert(imei?.value === '869910012345679', 'Invalid Luhn IMEI is retained', String(imei?.value));
    assert(
      imei?.status === 'NEEDS_REVIEW' || imei?.tier === 'NEEDS_REVIEW' || imei?.validationResult === 'FAIL',
      'Invalid Luhn IMEI is NEEDS_REVIEW',
      `${imei?.status}/${imei?.tier}/${imei?.validationResult}`,
    );
    assert(res.reviewInvoice?.totalAmount === 25960, 'Amount is still labelled 25960', String(res.reviewInvoice?.totalAmount));
  }

  console.log('\n[D] INSURANCE — identity vs premium/IDV');
  {
    const res = await UniversalOcrPipeline.process(INSURANCE, { skipCache: true });
    const ins = res.extractedData.insuranceData;
    const inv = res.reviewInvoice || {};
    assert(res.classification.documentType === 'INSURANCE_POLICY', 'Classified INSURANCE_POLICY', res.classification.documentType);
    assert(ins?.insurerName?.value?.toUpperCase().includes('HDFC') === true, 'Insurer extracted');
    assert(ins?.policyNumber?.value === '2311/2025/88991122', 'Policy number');
    assert(ins?.vehicleRegistration?.value === 'DL03XY9988' && inv.registration === 'DL03XY9988', 'Insurance registration');
    assert(ins?.vinOrChassis?.value === 'ME456ZX991002233', 'Insurance chassis');
    assert(ins?.engineNumber?.value === 'E33445566', 'Insurance engine');
    assert(ins?.policyStartDate?.value === '2025-05-10', 'Policy start ISO', String(ins?.policyStartDate?.value));
    assert(ins?.policyExpiryDate?.value === '2026-05-09', 'Policy expiry ISO');
    assert(ins?.premiumAmount?.value === 2450, 'Premium 2450', String(ins?.premiumAmount?.value));
    assert(ins?.idvAmount?.value === 72000, 'IDV 72000');
    assert(ins?.vehicleRegistration?.value !== String(ins?.premiumAmount?.value), 'Registration is not premium');
    assert(ins?.vinOrChassis?.value !== String(ins?.idvAmount?.value), 'Chassis is not IDV');
    assert(!looksLikeGstin(ins?.vehicleRegistration?.value), 'Registration is not GSTIN');
  }

  console.log('\n[E] GSTIN cannot become vehicle registration');
  {
    const res = await UniversalOcrPipeline.process(GSTIN_ONLY_BILL, { skipCache: true });
    const inv = res.reviewInvoice || {};
    const labelled = extractLabeledRegistration(GSTIN_ONLY_BILL);
    assert(labelled.value == null, 'Labelled registration extractor ignores GSTIN');
    assert(!inv.registration || inv.registration === '', 'Review registration empty when only GSTIN present', String(inv.registration));
  }

  console.log('\n[F] PHONE cannot become financial amount');
  {
    const res = await UniversalOcrPipeline.process(PHONE_AS_TOTAL, { skipCache: true });
    const inv = res.reviewInvoice || {};
    assert(inv.totalAmount === 499, 'Grand Total 499 not phone', String(inv.totalAmount));
    assert(inv.totalAmount !== 9876543210, 'Phone number is not total');
    assert(normalizeIndianPhone('9876543210') === '9876543210', 'Indian phone normalizes');
    assert(isForbiddenFinancialToken('9876543210') === true, 'Phone is forbidden as money');
  }

  console.log('\n[G] CHASSIS / ENGINE cannot become financial amount');
  {
    const res = await UniversalOcrPipeline.process(CHASSIS_AS_TOTAL, { skipCache: true });
    const s = res.extractedData.serviceData;
    const inv = res.reviewInvoice || {};
    assert(s?.vinOrChassis?.value === 'MD637AN11S2F03328', 'Chassis extracted');
    assert(s?.engineNumber?.value === 'BN1FS2302943', 'Engine extracted');
    assert(inv.totalAmount === 260, 'Grand Total 260 not chassis/engine', String(inv.totalAmount));
    assert(isForbiddenFinancialToken('MD637AN11S2F03328') === true, 'Chassis is forbidden as money');
    assert(isForbiddenFinancialToken('BN1FS2302943') === true, 'Engine is forbidden as money');
  }

  console.log('\n[H] AMOUNT — labelled Grand Total wins');
  {
    const picked = extractLabeledGrandTotal(`
      IMEI 490154203237518
      Qty 1
      Taxable 20339
      GST ₹3,660
      Grand Total ₹23,999
    `);
    assert(picked.amount === 23999, 'Labeled Grand Total 23999', `${picked.amount} (${picked.reason})`);
    assert(picked.reason === 'grand_total' || picked.reason.includes('grand'), 'Reason is labelled grand total', picked.reason);
  }

  console.log('\n[I] PROVIDER DISAGREEMENT → NEEDS_REVIEW');
  {
    const winner = resolveOcrProviderWinner(
      { success: true, rawText: 'POLICY 111\nREG UP32QU2187 extra-a', confidence: 0.55, engine: 'google' },
      { success: true, rawText: 'POLICY 222\nREG UP32QU2187 extra-b', confidence: 0.91, engine: 'azure-vision-read' },
    );
    assert(winner.conflict === true && winner.needsReview === true, 'Orchestrator flags provider disagreement');

    const field = createField('UP32QU2187', 0.96, 'REG UP32QU2187', 'Registration');
    reconcileProviderFieldValues('UP32QU2187', 'MH12AB5566', field);
    assert(
      field.status === 'NEEDS_REVIEW' && field.flag === 'PROVIDER_DISAGREEMENT',
      'Field-level provider disagreement is NEEDS_REVIEW',
      `${field.status}/${field.flag}`,
    );
  }

  console.log('\n[J] MATCHING — registration links without mutating document fields');
  {
    const vault: Asset[] = [
      {
        id: 'ast_ronin_vault_01',
        assetId: 'ast_ronin_vault_01',
        name: 'TVS Ronin',
        registration: 'UP32QU2187',
        chassisNumber: 'OTHERCHASSIS99999',
        engineNumber: 'OTHERENGINE99',
        currentOdometerKm: 88888,
      } as unknown as Asset,
    ];
    const res = await UniversalOcrPipeline.process(TVS_SERVICE, { skipCache: true, existingAssets: vault });
    assert(
      res.entityLink?.matchedAssetId === 'ast_ronin_vault_01' && res.entityLink?.matchType === 'EXACT_REGISTRATION',
      'Service bill links to existing UP32QU2187 asset',
      `${res.entityLink?.matchedAssetId}/${res.entityLink?.matchType}`,
    );
    assert(res.extractedData.serviceData?.odometerKm?.value === 12450, 'Document odometer stays 12450 (not asset 88888)');
    assert(res.extractedData.serviceData?.vinOrChassis?.value === 'MD637AN11S2F03328', 'Document chassis stays document evidence');
    assert(res.reviewInvoice?.odometerKm === 12450, 'Review invoice odometer is document evidence');

    const linkOnly = EntityLinker.linkDocumentToAsset(res.extractedData, vault);
    assert(linkOnly.matchedAssetId === 'ast_ronin_vault_01', 'EntityLinker exact registration match');
    assert(res.extractedData.serviceData?.odometerKm?.value === 12450, 'Linker did not copy asset odometer into OCR fields');
  }

  console.log('\n================================================================');
  console.log(`PHASE 11.2 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');
  return failed === 0;
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('phase112FieldExtraction'))) {
  runPhase112FieldExtractionSuite().then((ok) => {
    if (!ok) process.exit(1);
  });
}
