/**
 * Asset Doctor — Master OCR Regression & Negative Test Suite
 * Tests all 9 real-world document fixtures and critical negative assertions.
 */

import { UniversalOcrPipeline } from '../universalPipeline.ts';
import { EntityLinker } from '../entityLinker.ts';
import type { Asset } from '../../../src/types.ts';

interface AssertionResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: AssertionResult[] = [];

function assert(name: string, condition: boolean, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✓ ${name}`);
  } else {
    results.push({ name, passed: false, details: details || 'Assertion failed' });
    console.error(`  ✗ ${name} — ${details || 'FAILED'}`);
  }
}

export async function runMasterRegressionSuite(): Promise<boolean> {
  console.log('\n========================================================');
  console.log('STARTING MASTER OCR PRODUCTION REGRESSION TEST SUITE');
  console.log('========================================================\n');

  // -------------------------------------------------------------------------
  // FIXTURE 1: TVS Ronin 225 Service Invoice
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 1] TVS Ronin Service Invoice');
  try {
    const tvsServiceText = `
      TAAR MOTO LEGENDS PVT LTD
      AUTHORISED TVS SERVICE CENTER
      GSTIN: 09AABCT1928K1ZX
      Phone: 9876543210
      TAX INVOICE / SERVICE BILL
      Invoice No: 81587
      Date: 20/08/2024
      Model: TVS RONIN BASE 1 CH
      Customer: NIKLESH KUMAR
      RegNo. UP32QU2187
      Chassis No: MD637AN11S2F03328
      Engine No: BN1FS2302943
      Odometer: 12,450 KM
      Labour Charges: ₹ 0.00
      Parts Total: ₹ 260.00
      Tax Amount: ₹ 46.80
      Net Total Amount: ₹ 260.00
    `;
    const res = await UniversalOcrPipeline.process(tvsServiceText, { skipCache: true });
    const s = res.extractedData.serviceData;
    const inv = res.reviewInvoice || {};

    assert(
      '1.1 TVS Ronin Document Classified as SERVICE_INVOICE',
      res.classification.documentType === 'SERVICE_INVOICE',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '1.2 TVS Ronin Registration Extracted (UP32QU2187)',
      s?.vehicleRegistration?.value === 'UP32QU2187' && inv.registration === 'UP32QU2187',
      `Got: ${s?.vehicleRegistration?.value}`,
    );
    assert(
      '1.3 TVS Ronin Current Odometer Extracted (12450 KM)',
      s?.odometerKm?.value === 12450 && inv.odometerKm === 12450,
      `Got: ${s?.odometerKm?.value}`,
    );
    assert(
      '1.4 TVS Ronin Chassis Number Extracted (MD637AN11S2F03328)',
      s?.vinOrChassis?.value === 'MD637AN11S2F03328' && inv.chassisNumber === 'MD637AN11S2F03328',
      `Got: ${s?.vinOrChassis?.value}`,
    );
    assert(
      '1.5 TVS Ronin Engine Number Extracted (BN1FS2302943)',
      s?.engineNumber?.value === 'BN1FS2302943' && inv.engineNumber === 'BN1FS2302943',
      `Got: ${s?.engineNumber?.value}`,
    );
    assert(
      '1.6 TVS Ronin Workshop Extracted (TAAR MOTO LEGENDS)',
      s?.workshopName?.value?.includes('TAAR MOTO LEGENDS') === true,
      `Got: ${s?.workshopName?.value}`,
    );
    assert(
      '1.7 TVS Ronin Zero Hallucinated Next Service Odometer (Must be undefined/null)',
      s?.nextServiceOdometerKm === undefined && inv.nextServiceOdometerKm == null,
      `Got: ${s?.nextServiceOdometerKm?.value}`,
    );
    assert(
      '1.8 TVS Ronin Zero Hallucinated Next Service Date (Must be null)',
      inv.nextServiceDue == null,
      `Got: ${inv.nextServiceDue}`,
    );
  } catch (e: any) {
    assert('1.0 TVS Ronin Fixture Processing', false, e.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 2: Royal Enfield Service Invoice
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2] Royal Enfield Service Invoice');
  try {
    const reText = `
      ROYAL ENFIELD AUTHORISED WORKSHOP
      RE MOTORS PVT LTD
      GSTIN: 27AABCR1234F1Z8
      Phone: 9123456789
      TAX INVOICE
      Invoice Number: RE/2024/0991
      Date: 15/09/2024
      Model: CLASSIC 350 STEALTH BLACK
      Registration No: MH12AB5566
      KM Reading: 5,420
      Labour Amount: ₹ 850.00
      Parts Amount: ₹ 1,450.00
      Tax Amount: ₹ 414.00
      Grand Total: ₹ 2,714.00
    `;
    const res = await UniversalOcrPipeline.process(reText, { skipCache: true });
    const s = res.extractedData.serviceData;

    assert(
      '2.1 Royal Enfield Classified as SERVICE_INVOICE',
      res.classification.documentType === 'SERVICE_INVOICE',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '2.2 Royal Enfield Reg (MH12AB5566) and Odo (5420 KM)',
      s?.vehicleRegistration?.value === 'MH12AB5566' && s?.odometerKm?.value === 5420,
      `Reg: ${s?.vehicleRegistration?.value}, Odo: ${s?.odometerKm?.value}`,
    );
    assert(
      '2.3 Royal Enfield Financial Breakdown (Labour: 850, Parts: 1450, Total: 2714)',
      s?.labourCharges?.value === 850 && s?.partsTotal?.value === 1450 && s?.totalAmount?.value === 2714,
      `Labour: ${s?.labourCharges?.value}, Parts: ${s?.partsTotal?.value}, Total: ${s?.totalAmount?.value}`,
    );
  } catch (e: any) {
    assert('2.0 Royal Enfield Fixture Processing', false, e.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 3: Motor Insurance Policy
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3] Motor Insurance Policy');
  try {
    const insuranceText = `
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
    `;
    const res = await UniversalOcrPipeline.process(insuranceText, { skipCache: true });
    const ins = res.extractedData.insuranceData;
    const inv = res.reviewInvoice || {};

    assert(
      '3.1 Insurance Classified as INSURANCE_POLICY',
      res.classification.documentType === 'INSURANCE_POLICY',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '3.2 Insurance Policy Number and Expiry Extracted (2026-05-09)',
      ins?.policyNumber?.value === '2311/2025/88991122' && ins?.policyExpiryDate?.value === '2026-05-09',
      `Policy: ${ins?.policyNumber?.value}, Expiry: ${ins?.policyExpiryDate?.value}`,
    );
    assert(
      '3.3 Insurance IDV and Premium Extracted (IDV: 72000, Premium: 2450)',
      ins?.idvAmount?.value === 72000 && ins?.premiumAmount?.value === 2450,
      `IDV: ${ins?.idvAmount?.value}, Premium: ${ins?.premiumAmount?.value}`,
    );
    assert(
      '3.4 ZERO Service Data on Insurance Policy (odometerKm must be null, serviceData undefined)',
      res.extractedData.serviceData === undefined && inv.odometerKm == null && inv.labourCharges == null,
      `ServiceData: ${res.extractedData.serviceData}, Odo: ${inv.odometerKm}`,
    );
  } catch (e: any) {
    assert('3.0 Insurance Policy Fixture Processing', false, e.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 4: Smartphone Purchase Invoice (Nothing Phone 2a)
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4] Smartphone Purchase Invoice');
  try {
    const phoneText = `
      FLIPKART INDIA PRIVATE LIMITED
      TAX INVOICE
      GSTIN: 29AABCU9603R1ZM
      Invoice No: FA-2024-88910
      Invoice Date: 12/03/2024
      Buyer: AMIT VERMA
      Product Description: Nothing Phone (2a) 5G (Black, 128 GB)
      IMEI: 861234567890123
      Serial Number: NP2A-BLK-99881
      HSN Code: 8517
      Total Amount: ₹ 23,999.00
    `;
    const res = await UniversalOcrPipeline.process(phoneText, { skipCache: true });
    const e = res.extractedData.electronicsData;
    const inv = res.reviewInvoice || {};

    assert(
      '4.1 Smartphone Classified as ELECTRONICS_PURCHASE_INVOICE or PURCHASE_INVOICE',
      res.classification.documentType === 'ELECTRONICS_PURCHASE_INVOICE' ||
        res.classification.documentType === 'PURCHASE_INVOICE' ||
        res.classification.documentType === 'OTHER_PURCHASE_DOCUMENT',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '4.2 Smartphone IMEI Extracted (861234567890123)',
      e?.imei?.value === '861234567890123' || inv.imei === '861234567890123',
      `Got IMEI: ${e?.imei?.value || inv.imei}`,
    );
    assert(
      '4.3 Smartphone Serial Extracted (NP2A-BLK-99881)',
      e?.serialNumber?.value === 'NP2A-BLK-99881' || inv.serialNumber === 'NP2A-BLK-99881',
      `Got Serial: ${e?.serialNumber?.value || inv.serialNumber}`,
    );
    assert(
      '4.4 Smartphone Total Amount Extracted (23999)',
      (e?.totalAmount?.value === 23999 || inv.totalAmount === 23999),
      `Got Total: ${e?.totalAmount?.value || inv.totalAmount}`,
    );
    assert(
      '4.5 ZERO Vehicle Fields on Phone Invoice (No registration, no odometer, no chassis)',
      res.extractedData.serviceData === undefined &&
        inv.registration === '' &&
        inv.odometerKm == null &&
        inv.chassisNumber === '',
      `Reg: ${inv.registration}, Odo: ${inv.odometerKm}, Chassis: ${inv.chassisNumber}`,
    );
  } catch (err: any) {
    assert('4.0 Smartphone Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 5: Home Appliance Purchase Invoice (Daikin AC)
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5] Appliance Purchase Invoice');
  try {
    const applianceText = `
      RELIANCE RETAIL LIMITED
      RELIANCE DIGITAL STORE
      TAX INVOICE
      Invoice Number: RD/2024/7711
      Date: 15/04/2024
      Product: Daikin 1.5 Ton 5 Star Inverter Split AC
      Model: FTKM50TV
      Serial No: DK-AC-55443322
      Compressor Warranty: 10 Years
      Total Amount: ₹ 45,990.00
    `;
    const res = await UniversalOcrPipeline.process(applianceText, { skipCache: true });
    const a = res.extractedData.applianceData || res.extractedData.purchaseData;
    const inv = res.reviewInvoice || {};

    assert(
      '5.1 Appliance Classified as APPLIANCE_INVOICE or PURCHASE_INVOICE',
      res.classification.documentType === 'APPLIANCE_INVOICE' ||
        res.classification.documentType === 'APPLIANCE_PURCHASE_INVOICE' ||
        res.classification.documentType === 'PURCHASE_INVOICE',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '5.2 Appliance Serial Extracted (DK-AC-55443322)',
      a?.serialNumber?.value === 'DK-AC-55443322' || inv.serialNumber === 'DK-AC-55443322',
      `Got Serial: ${a?.serialNumber?.value || inv.serialNumber}`,
    );
    assert(
      '5.3 Appliance Price Extracted (45990)',
      inv.totalAmount === 45990 || a?.purchasePrice?.value === 45990,
      `Got Price: ${inv.totalAmount || a?.purchasePrice?.value}`,
    );
    assert(
      '5.4 ZERO Vehicle Fields on Appliance Invoice',
      inv.registration === '' && inv.odometerKm == null,
      `Reg: ${inv.registration}, Odo: ${inv.odometerKm}`,
    );
  } catch (err: any) {
    assert('5.0 Appliance Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 6: Warranty Document
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6] Warranty Document');
  try {
    const warrantyText = `
      LG ELECTRONICS INDIA PVT LTD
      MANUFACTURER WARRANTY CARD
      Warranty Certificate No: LG-WARR-2024-901
      Product Name: LG Front Load Washing Machine
      Serial Number: LG-WM-998811
      Warranty Period: 24 Months
      Warranty Start Date: 01/06/2024
      Warranty Expiry Date: 01/06/2026
      Customer Name: SURESH KUMAR
    `;
    const res = await UniversalOcrPipeline.process(warrantyText, { skipCache: true });
    const w = res.extractedData.warrantyData;
    const inv = res.reviewInvoice || {};

    assert(
      '6.1 Warranty Document Classified as WARRANTY_DOCUMENT',
      res.classification.documentType === 'WARRANTY_DOCUMENT' ||
        res.classification.documentType === 'APPLIANCE_WARRANTY',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '6.2 Warranty Expiry Date Extracted (2026-06-01)',
      w?.warrantyEndDate?.value === '2026-06-01' || inv.warrantyExpiry === '2026-06-01',
      `Got Expiry: ${w?.warrantyEndDate?.value || inv.warrantyExpiry}`,
    );
  } catch (err: any) {
    assert('6.0 Warranty Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 7: PUC Certificate
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 7] PUC Certificate');
  try {
    const pucText = `
      TRANSPORT DEPARTMENT GOVT OF NCT DELHI
      POLLUTION UNDER CONTROL CERTIFICATE
      FORM 59
      Certificate No: DL010998812345
      Vehicle Registration No: DL01AB9988
      Date of Emission Test: 10/01/2026
      Valid Till: 09/07/2026
      Vehicle Category: 2 Wheeler
      Carbon Monoxide (CO): 0.12 %
      Hydro Carbon (HC): 180 ppm
      Testing Centre: EXPRESS AUTO EMISSION TESTING CENTRE
    `;
    const res = await UniversalOcrPipeline.process(pucText, { skipCache: true });
    const puc = res.extractedData.pucData;
    const inv = res.reviewInvoice || {};

    assert(
      '7.1 PUC Classified as PUC_CERTIFICATE',
      res.classification.documentType === 'PUC_CERTIFICATE',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '7.2 PUC Reg (DL01AB9988) and Valid Till Date (2026-07-09)',
      (puc?.registrationNumber?.value === 'DL01AB9988' || inv.registration === 'DL01AB9988') &&
        (puc?.expiryDate?.value === '2026-07-09' || inv.pucExpiry === '2026-07-09'),
      `Reg: ${puc?.registrationNumber?.value || inv.registration}, Expiry: ${puc?.expiryDate?.value || inv.pucExpiry}`,
    );
  } catch (err: any) {
    assert('7.0 PUC Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 8: RC Certificate
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 8] RC Certificate');
  try {
    const rcText = `
      GOVERNMENT OF UTTAR PRADESH
      TRANSPORT DEPARTMENT
      CERTIFICATE OF REGISTRATION
      FORM 23
      Registration Number: UP32QU2187
      Registration Date: 12/06/2024
      Owner Name: NIKLESH KUMAR
      Chassis Number: MD637AN11S2F03328
      Engine Number: BN1FS2302943
      Maker / Model: TVS MOTOR COMPANY LTD / TVS RONIN 225
      Vehicle Class: M-CYCLE/SCOOTER
      Fuel Type: PETROL
    `;
    const res = await UniversalOcrPipeline.process(rcText, { skipCache: true });
    const rc = res.extractedData.rcData;
    const inv = res.reviewInvoice || {};

    assert(
      '8.1 RC Classified as RC_CERTIFICATE',
      res.classification.documentType === 'RC_CERTIFICATE',
      `Got: ${res.classification.documentType}`,
    );
    assert(
      '8.2 RC Registration, Chassis, and Engine Match Exactly',
      (rc?.registrationNumber?.value === 'UP32QU2187' || inv.registration === 'UP32QU2187') &&
        (rc?.chassisNumber?.value === 'MD637AN11S2F03328' || inv.chassisNumber === 'MD637AN11S2F03328') &&
        (rc?.engineNumber?.value === 'BN1FS2302943' || inv.engineNumber === 'BN1FS2302943'),
      `Reg: ${rc?.registrationNumber?.value}, Chassis: ${rc?.chassisNumber?.value}, Engine: ${rc?.engineNumber?.value}`,
    );
  } catch (err: any) {
    assert('8.0 RC Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // FIXTURE 9: Generic Invoice
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 9] Generic Retail Invoice');
  try {
    const genericText = `
      STATIONERY MART
      RETAIL BILL / CASH RECEIPT
      Receipt No: 4421
      Date: 05/08/2024
      Item: Office Supplies & File Folders
      Qty: 5
      Total Amount: ₹ 1,250.00
    `;
    const res = await UniversalOcrPipeline.process(genericText, { skipCache: true });
    const inv = res.reviewInvoice || {};

    assert(
      '9.1 Generic Document Processed without Crashing or Fake Vehicle Fields',
      inv.totalAmount === 1250 && inv.odometerKm == null && inv.registration === '',
      `Total: ${inv.totalAmount}, Odo: ${inv.odometerKm}, Reg: ${inv.registration}`,
    );
  } catch (err: any) {
    assert('9.0 Generic Fixture Processing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // CRITICAL NEGATIVE TESTS (12 Critical Guards)
  // -------------------------------------------------------------------------
  console.log('\n[TEST GROUP 10] Critical Negative Tests & Collision Prevention');

  // Negative 1: Phone number != Odometer
  try {
    const text = `
      SERVICE BILL
      Phone: 9876543210
      Total: 500
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N1: Phone number (9876543210) never parsed as Odometer',
      res.extractedData.serviceData?.odometerKm?.value !== 9876543210 &&
        res.reviewInvoice?.odometerKm !== 9876543210,
      `Odo: ${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('N1', false, e.message);
  }

  // Negative 2: GSTIN != Odometer
  try {
    const text = `
      SERVICE BILL
      GSTIN: 09124501234F1Z5
      Total: 500
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N2: GSTIN token never parsed as Odometer',
      res.extractedData.serviceData?.odometerKm?.value !== 12450 &&
        res.reviewInvoice?.odometerKm == null,
      `Odo: ${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('N2', false, e.message);
  }

  // Negative 3: Invoice Amount != Odometer
  try {
    const text = `
      SERVICE BILL
      Invoice No: 123
      Total Amount: ₹ 15,000.00
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N3: Invoice Amount (15000) without KM label never parsed as Odometer',
      res.extractedData.serviceData?.odometerKm?.value !== 15000 &&
        res.reviewInvoice?.odometerKm == null,
      `Odo: ${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('N3', false, e.message);
  }

  // Negative 4: Part Number != Odometer
  try {
    const text = `
      SERVICE BILL
      Part No: 12450-TVS-01
      Oil Filter
      Total: 250
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N4: Part Number (12450-TVS-01) never parsed as Odometer',
      res.extractedData.serviceData?.odometerKm?.value !== 12450 &&
        res.reviewInvoice?.odometerKm == null,
      `Odo: ${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('N4', false, e.message);
  }

  // Negative 5: Chassis Number != Odometer
  try {
    const text = `
      SERVICE BILL
      Chassis No: MD637AN11S2F12450
      Total: 500
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N5: Chassis Number numeric suffix never parsed as Odometer',
      res.extractedData.serviceData?.odometerKm?.value !== 12450 &&
        res.reviewInvoice?.odometerKm == null,
      `Odo: ${res.reviewInvoice?.odometerKm}`,
    );
  } catch (e: any) {
    assert('N5', false, e.message);
  }

  // Negative 6: Cross-Asset Data Isolation (TVS Ronin in vault != iPhone scan)
  try {
    const existingVehicle: Asset = {
      id: 'vehicle_1',
      name: 'TVS Ronin',
      registration: 'UP32QU2187',
      serialNumber: '',
      brand: 'TVS',
    } as Asset;
    (existingVehicle as any).chassisNumber = 'MD637AN11S2F03328';
    (existingVehicle as any).odometerKm = 12450;

    const iphoneText = `
      APPLE STORE BKC MUMBAI
      TAX INVOICE
      Invoice: AP-9922
      Date: 10/10/2024
      Product: iPhone 15 Pro (128 GB)
      IMEI: 359123456789012
      Serial: G6TX9910LL
      Total: ₹ 1,29,900.00
    `;
    const res = await UniversalOcrPipeline.process(iphoneText, {
      skipCache: true,
      existingAssets: [existingVehicle],
      previousVerifiedOdometer: 12450,
    });
    const inv = res.reviewInvoice || {};

    assert(
      'N6: Cross-Asset Isolation: iPhone scan NEVER inherits TVS Ronin vehicle reg, chassis, or odometer',
      inv.registration !== 'UP32QU2187' &&
        inv.chassisNumber !== 'MD637AN11S2F03328' &&
        inv.odometerKm == null &&
        inv.imei === '359123456789012',
      `Reg: ${inv.registration}, Chassis: ${inv.chassisNumber}, Odo: ${inv.odometerKm}, IMEI: ${inv.imei}`,
    );
  } catch (e: any) {
    assert('N6', false, e.message);
  }

  // Negative 7: Priority Entity Linking 1-7 (Exact Reg Match)
  try {
    const existingVehicle: Asset = {
      id: 'asset_target_123',
      name: 'My TVS Ronin',
      registration: 'UP32QU2187',
    } as Asset;

    const link = EntityLinker.linkDocumentToAsset(
      {
        serviceData: {
          vehicleRegistration: {
            value: 'UP32QU2187',
            confidence: 0.95,
            rawText: 'UP32QU2187',
            tier: 'VERIFIED',
            status: 'VERIFIED',
            sourceType: 'OCR_DOCUMENT',
          },
        },
      },
      [existingVehicle],
    );

    assert(
      'N7: Priority 1 Linking: Exact Registration UP32QU2187 matches asset_target_123 without creating duplicate',
      link.matchedAssetId === 'asset_target_123' &&
        link.matchType === 'EXACT_REGISTRATION' &&
        link.isAutoLinked === true,
      `Matched: ${link.matchedAssetId}, Type: ${link.matchType}`,
    );
  } catch (e: any) {
    assert('N7', false, e.message);
  }

  // Negative 8: Priority Entity Linking (Exact IMEI Match)
  try {
    const existingPhone: Asset = {
      id: 'phone_target_456',
      name: 'Amit Nothing Phone',
      serialNumber: '861234567890123',
    } as Asset;
    (existingPhone as any).imei = '861234567890123';

    const link = EntityLinker.linkDocumentToAsset(
      {
        electronicsData: {
          imei: {
            value: '861234567890123',
            confidence: 0.98,
            rawText: '861234567890123',
            tier: 'VERIFIED',
            status: 'VERIFIED',
            sourceType: 'OCR_DOCUMENT',
          },
        },
      },
      [existingPhone],
    );

    assert(
      'N8: Priority 5 Linking: Exact IMEI matches phone_target_456 without duplicate',
      link.matchedAssetId === 'phone_target_456' &&
        link.matchType === 'EXACT_IMEI' &&
        link.isAutoLinked === true,
      `Matched: ${link.matchedAssetId}, Type: ${link.matchType}`,
    );
  } catch (e: any) {
    assert('N8', false, e.message);
  }

  // Negative 9: Missing Expiry on Bill strictly evaluates to null
  try {
    const text = `
      TAX INVOICE
      Invoice: 101
      Date: 10/01/2024
      Product: Table Fan
      Total: 1500
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N9: Missing Expiry on document evaluates strictly to null (no 2026-12-31 hallucination)',
      res.reviewInvoice?.warrantyExpiry == null &&
        res.reviewInvoice?.pucExpiry == null &&
        res.reviewInvoice?.insuranceExpiry == null,
      `WarrantyExpiry: ${res.reviewInvoice?.warrantyExpiry}`,
    );
  } catch (e: any) {
    assert('N9', false, e.message);
  }

  // Negative 10: Missing Next Service KM strictly evaluates to null
  try {
    const text = `
      SERVICE BILL
      Invoice: 102
      Date: 10/01/2024
      Odometer: 5000 KM
      Total: 800
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N10: Missing Next Service KM on bill strictly evaluates to null (no 15000 KM hallucination)',
      res.extractedData.serviceData?.nextServiceOdometerKm === undefined &&
        res.reviewInvoice?.nextServiceOdometerKm == null,
      `NextServiceKm: ${res.reviewInvoice?.nextServiceOdometerKm}`,
    );
  } catch (e: any) {
    assert('N10', false, e.message);
  }

  // Negative 11: Missing Warranty strictly evaluates to null
  try {
    const text = `
      CASH BILL
      Item: Generic Cable
      Total: 150
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N11: Missing Warranty strictly evaluates to null (no fake 12-month warranty)',
      res.extractedData.warrantyData === undefined &&
        res.reviewInvoice?.warrantyExpiry == null,
      `Warranty: ${res.reviewInvoice?.warrantyExpiry}`,
    );
  } catch (e: any) {
    assert('N11', false, e.message);
  }

  // Negative 12: Banned Placeholder Strings ('Leave blank if not on bill' / 'unknown' filtered)
  try {
    const text = `
      TAX INVOICE
      Customer: Leave blank if not on bill
      Serial No: N/A
      Total: 500
    `;
    const res = await UniversalOcrPipeline.process(text, { skipCache: true });
    assert(
      'N12: Placeholder strings (Leave blank / N/A) stripped by evidence gate',
      res.reviewInvoice?.customerName !== 'Leave blank if not on bill' &&
        res.reviewInvoice?.serialNumber !== 'N/A',
      `Customer: ${res.reviewInvoice?.customerName}, Serial: ${res.reviewInvoice?.serialNumber}`,
    );
  } catch (e: any) {
    assert('N12', false, e.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n========================================================');
  console.log(`MASTER REGRESSION TEST RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('========================================================\n');

  return failed === 0;
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('ocrRegressionFixtures.test'))) {
  runMasterRegressionSuite().then((ok) => {
    if (!ok) process.exit(1);
  });
}
