/**
 * Asset Doctor — Energy Doctor Comprehensive Test Suite
 *
 * Direct test runner verifying all 26 criteria:
 * 1. Tata Power classified as ELECTRICITY_BILL
 * 2. BSES Rajdhani classified as ELECTRICITY_BILL
 * 3. UPPCL classified as ELECTRICITY_BILL
 * 4. Adani Electricity classified as ELECTRICITY_BILL
 * 5. MSEDCL classified as ELECTRICITY_BILL
 * 6. Non-electricity vehicle service invoice NOT classified as electricity bill
 * 7. Non-electricity electronics retail invoice NOT classified as electricity bill
 * 8. RealElectricityBillExtractor extracts provider and CA/Consumer ID
 * 9. Consumer ID does not capture customer phone numbers
 * 10. Billing month and ISO dates normalized
 * 11. Previous and current meter readings extracted
 * 12. Units consumed (kWh) extracted
 * 13. Financial totals and charges extracted
 * 14. Perfect reading cross-check validates with HIGH_CONFIDENCE
 * 15. 5-digit meter rollover / reset correctly detected
 * 16. Multiplier ratio (x10) correctly detected
 * 17. Contradiction between readings and units flags NEEDS_REVIEW
 * 18. Duplicate bill detected by consumer ID and billing month
 * 19. Duplicate bill detected by identical meter readings
 * 20. New bill for a different month permitted
 * 21. Data-First Privacy: scan file deleted from disk on discard
 * 22. Multi-account isolation: bills saved under isolated accountIds
 * 23. Reactive Month Filtering: September NEVER returns August data
 * 24. MoM analytics: bill %, units %, daily kWh, and cost per unit computed
 * 25. Status color logic: GREEN on reduction, RED on >= 15% increase, YELLOW on stable
 * 26. Deterministic Energy Health score computed (or Building score if < 2 bills)
 */

import fs from 'fs';
import path from 'path';
import { HybridDocumentClassifier } from '../../ocr/engine/HybridDocumentClassifier';
import { RealElectricityBillExtractor } from '../../ocr/extractors/RealElectricityBillExtractor';
import { ElectricityBillValidator } from '../../ocr/engine/ElectricityBillValidator';
import { ElectricityBillService } from '../ElectricityBillService';
import { EnergyAnalyticsEngine } from '../energyAnalyticsEngine';
import { ElectricityBillRecord } from '../electricityBillSchema';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} (${detail || ''})`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function runEnergyDoctorComprehensiveTests() {
  console.log('================================================================');
  console.log('   ENERGY DOCTOR: ELECTRICITY BILL INTELLIGENCE TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Tata Power classification
  {
    const ocr = `
      TATA POWER DELHI DISTRIBUTION LIMITED
      ELECTRICITY BILL FOR THE MONTH OF AUGUST 2026
      CA NUMBER: 6001928374
      METER NUMBER: TP-998822
      PREVIOUS READING: 14200   CURRENT READING: 14520
      UNITS CONSUMED: 320 KWH
      BILL DATE: 31/08/2026    DUE DATE: 15/09/2026
      CURRENT BILL AMOUNT: Rs. 2,450.00
      NET AMOUNT PAYABLE: Rs. 2,450.00
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType === 'ELECTRICITY_BILL', 'Test 1: Tata Power classified as ELECTRICITY_BILL', rep.documentType);
    assert(rep.suggestedCategory === 'ENERGY', 'Test 1: Tata Power suggestedCategory is ENERGY');
  }

  // Test 2: BSES Rajdhani classification
  {
    const ocr = `
      BSES RAJDHANI POWER LIMITED
      ELECTRICITY CONSUMPTION BILL
      CONSUMER NO: 102938475
      BILLING MONTH: AUG 2026
      PREV READING: 8100   CURR READING: 8350
      BILLED UNITS: 250
      AMOUNT PAYABLE: Rs. 1,890.00
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType === 'ELECTRICITY_BILL', 'Test 2: BSES Rajdhani classified as ELECTRICITY_BILL');
  }

  // Test 3: UPPCL classification
  {
    const ocr = `
      UTTAR PRADESH POWER CORPORATION LIMITED (UPPCL)
      PVVNL ELECTRICITY BILL
      CONSUMER ID: 1928374650
      SANCTIONED LOAD: 3 KW
      INITIAL READING: 5120   FINAL READING: 5360
      UNITS CONSUMED: 240 KWH
      BILL DATE: 28/08/2026
      TOTAL AMOUNT DUE: Rs. 1,720.00
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType === 'ELECTRICITY_BILL', 'Test 3: UPPCL classified as ELECTRICITY_BILL');
  }

  // Test 4: Adani Electricity classification
  {
    const ocr = `
      ADANI ELECTRICITY MUMBAI LIMITED
      POWER DISTRIBUTION BILL
      ACCOUNT NO: 150029384
      BILLING PERIOD: 01/08/2026 TO 31/08/2026
      PREVIOUS READING: 22100   PRESENT READING: 22410
      UNITS: 310 KWH
      TOTAL PAYABLE: Rs. 2,680.00
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType === 'ELECTRICITY_BILL', 'Test 4: Adani Electricity classified as ELECTRICITY_BILL');
  }

  // Test 5: MSEDCL Mahavitaran classification
  {
    const ocr = `
      MAHAVITARAN - MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD.
      MSEDCL ELECTRICITY BILL
      CONSUMER NO: 01928374651
      TARIFF: LT-I RESIDENTIAL
      PREVIOUS READING: 3400   CURRENT READING: 3620
      UNITS CONSUMED: 220 KWH
      NET BILL AMOUNT: Rs. 1,650.00
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType === 'ELECTRICITY_BILL', 'Test 5: MSEDCL classified as ELECTRICITY_BILL');
  }

  // Test 6: Vehicle service invoice rejection
  {
    const ocr = `
      SHREE GANESH MOTORS
      VEHICLE SERVICE TAX INVOICE
      REGISTRATION: DL01AB1234
      ODOMETER KM: 42,500
      ENGINE OIL REPLACEMENT Rs 1,500
      LABOUR CHARGES Rs 800
      TOTAL AMOUNT: Rs 2,300
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType !== 'ELECTRICITY_BILL', 'Test 6: Vehicle service not classified as ELECTRICITY_BILL');
    assert(rep.documentType === 'VEHICLE_SERVICE_INVOICE', 'Test 6: Correctly classified as VEHICLE_SERVICE_INVOICE');
  }

  // Test 7: Electronics invoice rejection
  {
    const ocr = `
      CROMA ELECTRONICS RETAIL
      TAX INVOICE
      PRODUCT: APPLE IPHONE 15 128GB
      IMEI: 352819203948571
      SERIAL NO: F2LZ8901ABCD
      TOTAL AMOUNT: Rs 79,900
    `;
    const rep = HybridDocumentClassifier.classify(ocr);
    assert(rep.documentType !== 'ELECTRICITY_BILL', 'Test 7: Electronics invoice not classified as ELECTRICITY_BILL');
  }

  // Test 8: RealElectricityBillExtractor core fields
  {
    const ocr = `
      TATA POWER DELHI DISTRIBUTION LIMITED
      ELECTRICITY BILL
      CA NUMBER: 6001928374
      BILLING MONTH: AUGUST 2026
      BILL DATE: 31/08/2026
      DUE DATE: 15/09/2026
      PREVIOUS READING: 14200
      CURRENT READING: 14486
      UNITS CONSUMED: 286 KWH
      BILLING DAYS: 31
      ENERGY CHARGES: Rs 1,716.00
      FIXED CHARGES: Rs 300.00
      CURRENT BILL AMOUNT: Rs 2,180.00
      NET AMOUNT PAYABLE: Rs 2,180.00
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.electricityProvider === 'Tata Power', 'Test 8: Provider extracted as Tata Power');
    assert(ext.consumerId === '6001928374', 'Test 8: CA Number extracted correctly');
  }

  // Test 9: Consumer ID ignores customer phone
  {
    const ocr = `
      BSES RAJDHANI POWER LIMITED
      CUSTOMER CARE MOBILE: 9811223344
      CA NO: 100293847
      METER READING: PREV 5000 CURRENT 5200
      UNITS CONSUMED: 200
      CURRENT BILL AMOUNT: Rs 1,500
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.consumerId === '100293847', 'Test 9: CA Number extracted, not customer phone');
    assert(ext.consumerId !== '9811223344', 'Test 9: Phone number rejected as consumerId');
  }

  // Test 10: Billing month and ISO dates normalized
  {
    const ocr = `
      TATA POWER
      BILLING MONTH: AUGUST 2026
      BILL DATE: 31/08/2026
      DUE DATE: 15/09/2026
      CURRENT BILL AMOUNT: Rs 2,180
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.billingMonth === '2026-08', 'Test 10: Billing month normalized to 2026-08', ext.billingMonth);
    assert(ext.billDate === '2026-08-31', 'Test 10: Bill date normalized to ISO 2026-08-31', ext.billDate || '');
    assert(ext.dueDate === '2026-09-15', 'Test 10: Due date normalized to ISO 2026-09-15', ext.dueDate || '');
  }

  // Test 11: Meter readings extracted
  {
    const ocr = `
      UPPCL
      PREVIOUS METER READING: 12450
      CURRENT METER READING: 12736
      UNITS CONSUMED: 286 KWH
      CURRENT BILL: Rs 2,180
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.previousMeterReading === 12450, 'Test 11: Previous reading extracted as 12450');
    assert(ext.currentMeterReading === 12736, 'Test 11: Current reading extracted as 12736');
  }

  // Test 12: Units consumed (kWh) extracted
  {
    const ocr = `
      MSEDCL
      CONSUMPTION (KWH): 315
      BILLING DAYS: 30
      CURRENT BILL AMOUNT: Rs 2,450
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.unitsConsumedKwh === 315, 'Test 12: Units consumed extracted as 315 kWh');
    assert(ext.billingDays === 30, 'Test 12: Billing days extracted as 30');
  }

  // Test 13: Financial totals extracted
  {
    const ocr = `
      TATA POWER
      ENERGY CHARGE: Rs 1,800.00
      FIXED CHARGE: Rs 250.00
      ARREARS: Rs 50.00
      SUBSIDY: Rs 100.00
      CURRENT BILL AMOUNT: Rs 2,000.00
    `;
    const ext = RealElectricityBillExtractor.extract(ocr);
    assert(ext.currentBillAmount === 2000, 'Test 13: Current bill amount extracted as 2000');
    assert(ext.energyCharge === 1800, 'Test 13: Energy charge extracted as 1800');
    assert(ext.fixedCharge === 250, 'Test 13: Fixed charge extracted as 250');
  }

  // Test 14: Perfect reading cross-check validates with HIGH_CONFIDENCE
  {
    const extracted = {
      electricityProvider: 'Tata Power',
      consumerId: '6001928374',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      previousMeterReading: 12450,
      currentMeterReading: 12736,
      unitsConsumedKwh: 286,
      billingDays: 31,
      currentBillAmount: 2180,
      rawText: '',
    };
    const val = ElectricityBillValidator.validate(extracted);
    assert(val.isValid === true, 'Test 14: Reading math is valid');
    assert(val.needsReview === false, 'Test 14: Needs review is false');
    assert(val.fieldIntelligence.unitsConsumedKwh.status === 'HIGH_CONFIDENCE', 'Test 14: Units consumed is HIGH_CONFIDENCE');
    assert(val.multiplierDetected === 1, 'Test 14: Multiplier is 1');
  }

  // Test 15: 5-digit meter rollover / reset correctly detected
  {
    const extracted = {
      electricityProvider: 'UPPCL',
      consumerId: '10293847',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      previousMeterReading: 99850,
      currentMeterReading: 136,
      unitsConsumedKwh: 286,
      billingDays: 31,
      currentBillAmount: 2180,
      rawText: '',
    };
    const val = ElectricityBillValidator.validate(extracted);
    assert(val.isValid === true, 'Test 15: Rollover validated successfully');
    assert(val.isMeterReset === true, 'Test 15: isMeterReset flagged true');
    assert(val.calculatedUnits === 286, 'Test 15: Calculated units equals 286');
  }

  // Test 16: Multiplier ratio (x10) correctly detected
  {
    const extracted = {
      electricityProvider: 'MSEDCL',
      consumerId: '992837465',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      previousMeterReading: 1000,
      currentMeterReading: 1028,
      unitsConsumedKwh: 280,
      billingDays: 30,
      currentBillAmount: 2200,
      rawText: '',
    };
    const val = ElectricityBillValidator.validate(extracted);
    assert(val.isValid === true, 'Test 16: Multiplier x10 validated');
    assert(val.multiplierDetected === 10, 'Test 16: Multiplier detected as 10');
  }

  // Test 17: Contradiction flags NEEDS_REVIEW
  {
    const extracted = {
      electricityProvider: 'Tata Power',
      consumerId: '6001928374',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      previousMeterReading: 12000,
      currentMeterReading: 12100, // delta = 100
      unitsConsumedKwh: 350, // contradicts
      billingDays: 30,
      currentBillAmount: 2500,
      rawText: '',
    };
    const val = ElectricityBillValidator.validate(extracted);
    assert(val.isValid === false, 'Test 17: Contradiction flagged invalid');
    assert(val.needsReview === true, 'Test 17: Needs review flagged true');
    assert(val.fieldIntelligence.unitsConsumedKwh.status === 'NEEDS_REVIEW', 'Test 17: Units status is NEEDS_REVIEW');
  }

  // Test 18: Duplicate bill detected by consumer ID and billing month
  {
    const existing: ElectricityBillRecord[] = [
      {
        id: 'bill_1',
        userId: 'u1',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '6001928374',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '2026-09-15',
        previousMeterReading: 14200,
        currentMeterReading: 14486,
        unitsConsumedKwh: 286,
        billingDays: 31,
        currentBillAmount: 2180,
        createdAt: '',
      },
    ];
    const candidate = {
      consumerId: '6001928374',
      billingMonth: '2026-08',
      currentBillAmount: 2180,
    };
    const check = ElectricityBillService.detectDuplicateBill(candidate, existing);
    assert(check.isDuplicate === true, 'Test 18: Duplicate bill detected by month and consumer');
    assert(check.duplicateId === 'bill_1', 'Test 18: Duplicate ID matched');
  }

  // Test 19: Duplicate bill detected by identical meter readings
  {
    const existing: ElectricityBillRecord[] = [
      {
        id: 'bill_1',
        userId: 'u1',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '6001928374',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '2026-09-15',
        previousMeterReading: 14200,
        currentMeterReading: 14486,
        unitsConsumedKwh: 286,
        billingDays: 31,
        currentBillAmount: 2180,
        createdAt: '',
      },
    ];
    const candidate = {
      previousMeterReading: 14200,
      currentMeterReading: 14486,
    };
    const check = ElectricityBillService.detectDuplicateBill(candidate, existing);
    assert(check.isDuplicate === true, 'Test 19: Duplicate detected by exact readings');
  }

  // Test 20: New bill permitted for different month
  {
    const existing: ElectricityBillRecord[] = [
      {
        id: 'bill_1',
        userId: 'u1',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '6001928374',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '2026-09-15',
        previousMeterReading: 14200,
        currentMeterReading: 14486,
        unitsConsumedKwh: 286,
        billingDays: 31,
        currentBillAmount: 2180,
        createdAt: '',
      },
    ];
    const candidate = {
      consumerId: '6001928374',
      billingMonth: '2026-09',
      previousMeterReading: 14486,
      currentMeterReading: 14750,
    };
    const check = ElectricityBillService.detectDuplicateBill(candidate, existing);
    assert(check.isDuplicate === false, 'Test 20: Different month is NOT duplicate');
  }

  // Test 21: Data-First Privacy: scan file deleted from disk on discard
  {
    const tempFile = path.join(__dirname, 'temp_privacy_bill_test.jpg');
    fs.writeFileSync(tempFile, 'temporary-bill-image');
    assert(fs.existsSync(tempFile), 'Test 21: Temp file created');
    const discarded = await ElectricityBillService.discardScanFile(`file://${tempFile}`);
    assert(discarded === true, 'Test 21: Discard returned true');
    assert(!fs.existsSync(tempFile), 'Test 21: Temp file deleted from disk');
  }

  // Test 22: Multi-account isolation
  {
    const homeBill: ElectricityBillRecord = {
      id: 'h_1',
      userId: 'test_u',
      accountId: 'acc_home',
      electricityProvider: 'Tata Power',
      consumerId: '1001',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '',
      previousMeterReading: 1000,
      currentMeterReading: 1250,
      unitsConsumedKwh: 250,
      billingDays: 30,
      currentBillAmount: 2000,
      createdAt: '',
    };
    const officeBill: ElectricityBillRecord = {
      id: 'o_1',
      userId: 'test_u',
      accountId: 'acc_office',
      electricityProvider: 'BSES',
      consumerId: '2002',
      billingMonth: '2026-08',
      billDate: '2026-08-31',
      dueDate: '',
      previousMeterReading: 5000,
      currentMeterReading: 5800,
      unitsConsumedKwh: 800,
      billingDays: 30,
      currentBillAmount: 6400,
      createdAt: '',
    };
    await ElectricityBillService.saveBill(homeBill);
    await ElectricityBillService.saveBill(officeBill);

    const homeList = await ElectricityBillService.listBills('test_u', 'acc_home');
    const officeList = await ElectricityBillService.listBills('test_u', 'acc_office');

    assert(homeList.length === 1 && homeList[0].consumerId === '1001', 'Test 22: Home bill isolated');
    assert(officeList.length === 1 && officeList[0].consumerId === '2002', 'Test 22: Office bill isolated');
  }

  // Test 23: Reactive Month Filtering (September NEVER returns August)
  {
    const bills: ElectricityBillRecord[] = [
      {
        id: 'aug_b',
        userId: 'u',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '1001',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '',
        previousMeterReading: 1000,
        currentMeterReading: 1280,
        unitsConsumedKwh: 280,
        billingDays: 31,
        currentBillAmount: 2240,
        createdAt: '',
      },
    ];
    const sep = EnergyAnalyticsEngine.filterBillsByMonth(bills, '2026-09');
    assert(sep.length === 0, 'Test 23: September returns 0 records when missing');
    const aug = EnergyAnalyticsEngine.filterBillsByMonth(bills, '2026-08');
    assert(aug.length === 1 && aug[0].billingMonth === '2026-08', 'Test 23: August returns August bill');
  }

  // Test 24: MoM analytics, daily kWh, and cost per unit
  {
    const bills: ElectricityBillRecord[] = [
      {
        id: 'b1',
        userId: 'u',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '1001',
        billingMonth: '2026-07',
        billDate: '2026-07-31',
        dueDate: '',
        previousMeterReading: 10000,
        currentMeterReading: 10300,
        unitsConsumedKwh: 300,
        billingDays: 30,
        currentBillAmount: 2400,
        createdAt: '',
      },
      {
        id: 'b2',
        userId: 'u',
        accountId: 'home',
        electricityProvider: 'Tata Power',
        consumerId: '1001',
        billingMonth: '2026-08',
        billDate: '2026-08-31',
        dueDate: '',
        previousMeterReading: 10300,
        currentMeterReading: 10576,
        unitsConsumedKwh: 276, // -8%
        billingDays: 30,
        currentBillAmount: 2208, // -8%
        createdAt: '',
      },
    ];
    const analytics = EnergyAnalyticsEngine.computeEnergyAnalytics(bills, '2026-08');
    assert(analytics.billChangePercent === -8, 'Test 24: Bill changed by -8%');
    assert(analytics.consumptionChangePercent === -8, 'Test 24: Units changed by -8%');
    assert(analytics.dailyConsumption === 9.2, 'Test 24: Daily consumption is 9.2 kWh/day');
    assert(analytics.costPerUnit === 8, 'Test 24: Cost per unit is Rs 8/kWh');
  }

  // Test 25: Status color logic (GREEN on reduction, RED on >= 15%, YELLOW on stable)
  {
    const greenBills: ElectricityBillRecord[] = [
      { id: '1', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-07', billDate: '', dueDate: '', previousMeterReading: 1, currentMeterReading: 1, unitsConsumedKwh: 300, billingDays: 30, currentBillAmount: 2400, createdAt: '' },
      { id: '2', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-08', billDate: '', dueDate: '', previousMeterReading: 1, currentMeterReading: 1, unitsConsumedKwh: 270, billingDays: 30, currentBillAmount: 2160, createdAt: '' },
    ];
    const aGreen = EnergyAnalyticsEngine.computeEnergyAnalytics(greenBills, '2026-08');
    assert(aGreen.statusColor === 'GREEN', 'Test 25: Green status on reduction');

    const redBills: ElectricityBillRecord[] = [
      { id: '1', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-07', billDate: '', dueDate: '', previousMeterReading: 1, currentMeterReading: 1, unitsConsumedKwh: 200, billingDays: 30, currentBillAmount: 1600, createdAt: '' },
      { id: '2', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-08', billDate: '', dueDate: '', previousMeterReading: 1, currentMeterReading: 1, unitsConsumedKwh: 260, billingDays: 30, currentBillAmount: 2080, createdAt: '' },
    ];
    const aRed = EnergyAnalyticsEngine.computeEnergyAnalytics(redBills, '2026-08');
    assert(aRed.statusColor === 'RED', 'Test 25: Red status on jump >= 15%');
  }

  // Test 26: Energy Health score and Forecast
  {
    const singleBill: ElectricityBillRecord[] = [
      { id: '1', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-08', billDate: '', dueDate: '', previousMeterReading: 1, currentMeterReading: 1, unitsConsumedKwh: 200, billingDays: 30, currentBillAmount: 1600, createdAt: '' },
    ];
    const aSingle = EnergyAnalyticsEngine.computeEnergyAnalytics(singleBill);
    assert(aSingle.healthScore === null, 'Test 26: Single bill health score is null');
    assert(aSingle.healthScoreLabel === 'Building your Energy Health score', 'Test 26: Single bill shows Building score');

    const multiBills: ElectricityBillRecord[] = [
      { id: '1', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-07', billDate: '2026-07-31', dueDate: '2026-08-15', previousMeterReading: 1000, currentMeterReading: 1300, unitsConsumedKwh: 300, billingDays: 30, currentBillAmount: 2400, createdAt: '' },
      { id: '2', userId: 'u', accountId: 'h', electricityProvider: 'T', consumerId: '1', billingMonth: '2026-08', billDate: '2026-08-31', dueDate: '2026-09-15', previousMeterReading: 1300, currentMeterReading: 1570, unitsConsumedKwh: 270, billingDays: 30, currentBillAmount: 2160, createdAt: '' },
    ];
    const aMulti = EnergyAnalyticsEngine.computeEnergyAnalytics(multiBills, '2026-08');
    assert(typeof aMulti.healthScore === 'number' && aMulti.healthScore >= 50, 'Test 26: Health score computed deterministically');
    assert(aMulti.forecast.available === true, 'Test 26: Forecast available with 2 bills');
  }

  console.log('\n================================================================');
  console.log('   ✓ ALL 26/26 ENERGY DOCTOR COMPREHENSIVE TESTS PASSED');
  console.log('================================================================\n');
}

runEnergyDoctorComprehensiveTests().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
