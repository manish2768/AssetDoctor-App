import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyByHeuristics,
} from '../MultiDocumentClassifier';
import {
  postProcessInsuranceExtraction,
} from '../InsuranceVlmService';
import {
  postProcessPucExtraction,
} from '../PucVlmService';
import {
  postProcessElectricityExtraction,
} from '../ElectricityBillVlmService';
import {
  postProcessVehicleServiceExtraction,
} from '../VehicleServiceVlmService';
import {
  VehicleLinkingEngine,
} from '../../vehicles/VehicleLinkingEngine';
import {
  DuplicateProtectionService,
} from '../../duplicateProtectionService';
import {
  canSaveExtractedInvoice,
} from '../../ocr/finalSaveGate';

describe('Multi-Document Intelligence Engine', () => {

  // =========================================================================
  // 1. CLASSIFIER TESTS
  // =========================================================================
  describe('Phase 1: First-Stage Document Classification', () => {
    it('classifies PUC certificate from emission keywords', () => {
      const pucText = 'Government of NCT Delhi Transport Dept. Pollution Under Control Certificate PUC No: DL01234567 Valid Upto: 2026-11-20';
      const result = classifyByHeuristics(pucText);
      assert.ok(result);
      assert.equal(result.documentType, 'PUC');
      assert.ok(result.confidence >= 0.90);
    });

    it('classifies Insurance policy from policy schedule keywords', () => {
      const insText = 'TATA AIG General Insurance Policy Schedule Certificate of Insurance Policy Number: 0159988223 Period of Insurance: 2025-08-01 to 2026-07-31';
      const result = classifyByHeuristics(insText);
      assert.ok(result);
      assert.equal(result.documentType, 'INSURANCE');
      assert.ok(result.confidence >= 0.90);
    });

    it('classifies Electricity bill from power board & consumer keywords', () => {
      const elecText = 'Bangalore Electricity Supply Company BESCOM Electricity Bill Consumer No: 5410982310 Meter No: BM8871 Units Consumed: 142 kWh';
      const result = classifyByHeuristics(elecText);
      assert.ok(result);
      assert.equal(result.documentType, 'ELECTRICITY_BILL');
      assert.ok(result.confidence >= 0.90);
    });

    it('classifies Retail Invoice from tax invoice & grand total keywords', () => {
      const invText = 'Tax Invoice Retail Invoice Bill No: 180725130771 Sold by: Apex Auto Grand Total: 135500 Product Name: TVS Ronin';
      const result = classifyByHeuristics(invText);
      assert.ok(result);
      assert.equal(result.documentType, 'INVOICE');
      assert.ok(result.confidence >= 0.85);
    });

    it('classifies Vehicle Service bill from workshop & labour charges', () => {
      const srvText = 'Mandovi Motors Authorized Maruti Suzuki Service Center Job Card No: JC9988 Periodic Maintenance Odometer: 15400 km Labour Charges: 1200 Total: 4500';
      const result = classifyByHeuristics(srvText);
      assert.ok(result);
      assert.equal(result.documentType, 'VEHICLE_SERVICE');
      assert.ok(result.confidence >= 0.88);
    });

    it('returns null (unknown) on empty or non-matching text', () => {
      const unknownText = 'Random text with no identifiable markers';
      const result = classifyByHeuristics(unknownText);
      assert.equal(result, null);
    });
  });

  // =========================================================================
  // 2. SPECIALIZED VLM NORMALIZATION TESTS
  // =========================================================================
  describe('Phase 2: Specialized VLM Schemas & Normalization', () => {
    it('normalizes Insurance details and extracts chassis/engine suffixes', () => {
      const normalized = postProcessInsuranceExtraction({
        policy_number: 'POL-9988-2025',
        insurer_name: 'HDFC ERGO General Insurance',
        policy_type: 'Comprehensive Package',
        customer_name: 'Ayush Rai',
        vehicle_registration_number: 'KA 01 AB 1234',
        chassis_number: 'MD637AN115ZF03328',
        engine_number: 'ENG11223344',
        insured_declared_value: 125000,
        premium_amount: 4850.50,
        policy_start_date: '2025-08-01',
        policy_expiry_date: '2026-07-31',
        coverage_details: 'Zero Dep + Roadside Assistance',
        vehicle_make: 'TVS',
        vehicle_model: 'Ronin',
      });

      assert.equal(normalized.documentType, 'INSURANCE');
      assert.equal(normalized.vehicleRegistrationNumber, 'KA01AB1234');
      assert.equal(normalized.chassisNumber, 'MD637AN115ZF03328');
      assert.equal(normalized.chassisSuffix, 'F03328');
      assert.equal(normalized.engineSuffix, '223344');
      assert.equal(normalized.idv, 125000);
      assert.equal(normalized.premium, 4850.5);
      assert.equal(normalized.policyExpiryDate, '2026-07-31');
    });

    it('normalizes PUC details and maps validUntil correctly', () => {
      const normalized = postProcessPucExtraction({
        certificate_number: 'PUC/2026/09981',
        vehicle_registration_number: 'MH 12 CD 5678',
        vehicle_make: 'Hyundai',
        vehicle_model: 'Creta SX',
        chassis_number: 'MALC1234567890123',
        engine_number: 'D4FB12345',
        owner_name: 'Manish Kumar',
        fuel_type: 'Diesel',
        test_date: '2026-01-15',
        valid_until: '2026-07-14',
        emission_values: 'CO: 0.15%, Smoke: 22 HSU',
        issuing_authority: 'RTO Authorized Auto Center Pune',
      });

      assert.equal(normalized.documentType, 'PUC');
      assert.equal(normalized.certificateNumber, 'PUC/2026/09981');
      assert.equal(normalized.vehicleRegistrationNumber, 'MH12CD5678');
      assert.equal(normalized.validUntil, '2026-07-14');
      assert.equal(normalized.testDate, '2026-01-15');
    });

    it('normalizes Electricity bill and cross-computes units from meter readings', () => {
      const normalized = postProcessElectricityExtraction({
        provider_name: 'Tata Power DDL',
        customer_name: 'Pooja Sharma',
        consumer_number: 'CA100998234',
        account_number: 'CA100998234',
        meter_number: 'TP77610',
        service_address: 'Flat 402, Green Valley Apartments',
        billing_period: 'Jan 2026',
        bill_date: '2026-02-02',
        due_date: '2026-02-18',
        previous_reading: 10450,
        current_reading: 10680,
        units_consumed: null, // should calculate 10680 - 10450 = 230
        amount_due: 1840,
        paid_amount: null,
        payment_status: 'UNPAID',
      });

      assert.equal(normalized.documentType, 'ELECTRICITY_BILL');
      assert.equal(normalized.providerName, 'Tata Power DDL');
      assert.equal(normalized.consumerNumber, 'CA100998234');
      assert.equal(normalized.unitsConsumed, 230);
      assert.equal(normalized.amountDue, 1840);
    });

    it('normalizes Vehicle Service extraction with suffix matching and amount calculation', () => {
      const normalized = postProcessVehicleServiceExtraction({
        service_invoice_number: 'INV-SRV-2026-01',
        service_date: '2026-02-15',
        workshop_name: 'Mandovi Motors Maruti Authorized',
        customer_name: 'Ayush Rai',
        registration_number: 'KA 01 AB 1234',
        chassis_number: 'MD637AN115ZF03328',
        engine_number: 'ENG987654',
        vehicle_make: 'Maruti',
        vehicle_model: 'Swift',
        variant: 'ZXi',
        job_type: '20,000 km Periodic Service',
        odometer_km: 20450,
        service_items: [
          { description: 'Engine Oil Replacement', part_or_labour: 'PART', amount: 1800 },
          { description: 'General Service Labour', part_or_labour: 'LABOUR', amount: 1200 },
        ],
        labour_amount: 1200,
        parts_amount: 1800,
        tax_amount: 540,
        total_amount: 3540,
        next_service_date: '2026-08-15',
        next_service_km: 30000,
      });

      assert.equal(normalized.documentType, 'VEHICLE_SERVICE');
      assert.equal(normalized.registrationNumber, 'KA01AB1234');
      assert.equal(normalized.chassisNumber, 'MD637AN115ZF03328');
      assert.equal(normalized.chassisSuffix, 'F03328');
      assert.equal(normalized.engineSuffix, '987654');
      assert.equal(normalized.odometerKm, 20450);
      assert.equal(normalized.totalAmount, 3540);
      assert.equal(normalized.nextServiceKm, 30000);
    });

    it('normalizes Electricity bill with arrears, subsidies and calculation safety', () => {
      const normalized = postProcessElectricityExtraction({
        provider_name: 'BESCOM',
        customer_name: 'Ayush Rai',
        consumer_number: '5410982310',
        meter_number: 'BM8871',
        previous_reading: 1000,
        current_reading: 1200,
        units_consumed: 200,
        gross_bill_amount: 1600,
        tariff_subsidy: 200,
        late_payment_surcharge: 50,
        net_current_bill_amount: 1450,
        arrears: 300,
        total_payable_amount: 1750,
        amount_due: 1750,
        bill_month_year: '2026-02',
        disconnection_date: '2026-03-10',
      });

      assert.equal(normalized.documentType, 'ELECTRICITY_BILL');
      assert.equal(normalized.unitsConsumed, 200);
      assert.equal(normalized.calculatedConsumption, 200);
      assert.equal(normalized.readingMismatch, false);
      assert.equal(normalized.grossBillAmount, 1600);
      assert.equal(normalized.tariffSubsidy, 200);
      assert.equal(normalized.arrears, 300);
      assert.equal(normalized.netCurrentBillAmount, 1450);
      assert.equal(normalized.totalPayableAmount, 1750);
      assert.equal(normalized.amountDue, 1750);
      assert.equal(normalized.disconnectionDate, '2026-03-10');
    });
  });

  // =========================================================================
  // 3. VEHICLE MATCHING & LINKING ENGINE (PHASE 3 & PHASE 16 TESTS)
  // =========================================================================
  describe('Phase 3 & 16: Safe Vehicle Linking Engine', () => {
    const existingVehicles = [
      {
        id: 'veh_ronin_1',
        assetId: 'veh_ronin_1',
        name: 'TVS Ronin',
        brand: 'TVS',
        category: 'Vehicles',
        registration: 'KA01AB1234',
        chassisNumber: 'MD637AN115ZF03328',
        engineNumber: 'ENG987654',
      },
      {
        id: 'veh_creta_2',
        assetId: 'veh_creta_2',
        name: 'Hyundai Creta',
        brand: 'Hyundai',
        category: 'Vehicles',
        registration: 'MH12CD5678',
        chassisNumber: 'MALC9876543210999',
        engineNumber: 'D4FB554433',
      },
      {
        id: 'veh_jupiter_3',
        assetId: 'veh_jupiter_3',
        name: 'TVS Jupiter',
        brand: 'TVS',
        category: 'Vehicles',
        registration: 'KA01XY9999',
        chassisNumber: 'MD637AN999ZF03328', // Same suffix "03328" as Ronin!
        engineNumber: 'ENG112233',
      },
    ];

    it('TEST A: Exact Registration match has highest priority', () => {
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: 'KA-01-AB-1234',
          chassisNumber: 'UNKNOWN',
        },
        existingVehicles,
      );

      assert.equal(match.status, 'EXACT_MATCH');
      assert.equal(match.matchField, 'REGISTRATION');
      assert.equal(match.matchedVehicle?.id, 'veh_ronin_1');
      assert.equal(match.confidence, 1.0);
    });

    it('TEST A (Chassis): Full exact chassis match succeeds', () => {
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: '',
          chassisNumber: 'MALC9876543210999',
        },
        existingVehicles,
      );

      assert.equal(match.status, 'EXACT_MATCH');
      assert.equal(match.matchField, 'CHASSIS');
      assert.equal(match.matchedVehicle?.id, 'veh_creta_2');
    });

    it('TEST B: Last 4-6 chassis suffix corroborated by make/model is safely matched', () => {
      // Insurance document only has last digits "...0999" and says Hyundai
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: '',
          chassisNumber: '...0999',
          vehicleMake: 'Hyundai',
          vehicleModel: 'Creta',
        },
        existingVehicles,
      );

      assert.equal(match.status, 'SUFFIX_CORROBORATED');
      assert.equal(match.matchedVehicle?.id, 'veh_creta_2');
      assert.ok(match.confidence >= 0.90);
    });

    it('TEST C: Suffix match corroborated by registration plate is safely matched', () => {
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: 'KA01AB1234',
          chassisNumber: 'F03328',
        },
        [existingVehicles[0]], // Single vehicle
      );

      assert.ok(match.status === 'EXACT_MATCH' || match.status === 'SUFFIX_CORROBORATED');
      assert.equal(match.matchedVehicle?.id, 'veh_ronin_1');
    });

    it('TEST D: Multiple vehicles sharing same suffix MUST NOT auto-link (AMBIGUOUS)', () => {
      // Both Ronin and Jupiter have chassis ending in "03328"
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: '',
          chassisNumber: '03328',
          vehicleMake: '', // No specific make to disambiguate
        },
        existingVehicles,
      );

      assert.equal(match.status, 'AMBIGUOUS');
      assert.equal(match.matchedVehicle, undefined);
      assert.equal(match.candidates.length, 2);
    });

    it('TEST E: Suffix match with conflicting vehicle brand is rejected (CONFLICT)', () => {
      // Suffix 0999 matches Creta (Hyundai), but document says "Honda"
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: '',
          chassisNumber: '0999',
          vehicleMake: 'Honda',
          vehicleModel: 'City',
        },
        existingVehicles,
      );

      assert.equal(match.status, 'CONFLICT');
      assert.equal(match.matchedVehicle, undefined);
    });

    it('TEST F: Empty user vault returns NO_MATCH cleanly', () => {
      const match = VehicleLinkingEngine.resolveVehicleLink(
        {
          registrationNumber: 'DL01AB1234',
        },
        [],
      );

      assert.equal(match.status, 'NO_MATCH');
      assert.equal(match.matchedVehicle, undefined);
    });
  });

  // =========================================================================
  // 4. DUPLICATE PROTECTION TESTS
  // =========================================================================
  describe('Phase 9: Multi-Document Duplicate Protection', () => {
    it('detects duplicate insurance policy on same vehicle', () => {
      const vehicle = {
        id: 'veh_1',
        insurancePolicyNumber: 'POL-12345',
      };
      const res = DuplicateProtectionService.checkInsuranceDuplicate('POL-12345', vehicle);
      assert.equal(res.isDuplicate, true);
    });

    it('allows new insurance policy on vehicle when policy number differs', () => {
      const vehicle = {
        id: 'veh_1',
        insurancePolicyNumber: 'POL-12345',
      };
      const res = DuplicateProtectionService.checkInsuranceDuplicate('POL-67890-NEW', vehicle);
      assert.equal(res.isDuplicate, false);
    });

    it('detects duplicate PUC certificate on same vehicle', () => {
      const vehicle = {
        id: 'veh_1',
        pucCertificateNumber: 'PUC-9988',
      };
      const res = DuplicateProtectionService.checkPucDuplicate('PUC-9988', vehicle);
      assert.equal(res.isDuplicate, true);
    });

    it('detects duplicate electricity bill for same consumer and period', () => {
      const existingBills = [
        { consumerId: 'CA-1001', billingMonth: 'Jan 2026' },
      ];
      const res = DuplicateProtectionService.checkElectricityDuplicate(
        { consumerNumber: 'CA-1001', billingPeriod: 'Jan 2026' },
        existingBills,
      );
      assert.equal(res.isDuplicate, true);
    });

    it('detects duplicate Vehicle Service bill on same vehicle', () => {
      const vehicle = {
        id: 'veh_1',
        serviceHistory: [
          { serviceInvoiceNumber: 'INV-9988', serviceDate: '2026-01-15' },
        ],
      };
      const res = DuplicateProtectionService.checkVehicleServiceDuplicate('INV-9988', '2026-01-15', vehicle);
      assert.equal(res.isDuplicate, true);
    });
  });

  // =========================================================================
  // 5. SAVE GATE VALIDATION TESTS
  // =========================================================================
  describe('Phase 12: Multi-Document Save Gate Validation', () => {
    it('INVOICE: Allows save when productName is present', () => {
      const gate = canSaveExtractedInvoice({ productName: 'CMF Phone 1', totalAmount: 15999 }, 'INVOICE');
      assert.equal(gate.allowed, true);
    });

    it('INVOICE: Blocks save when both productName and amount are missing', () => {
      const gate = canSaveExtractedInvoice({}, 'INVOICE');
      assert.equal(gate.allowed, false);
      assert.ok(gate.message);
    });

    it('INSURANCE: Allows save when policyNumber is present', () => {
      const gate = canSaveExtractedInvoice({ policyNumber: 'POL-9988' }, 'INSURANCE');
      assert.equal(gate.allowed, true);
    });

    it('INSURANCE: Blocks save when policy, registration, and chassis are all missing', () => {
      const gate = canSaveExtractedInvoice({ totalAmount: 4500 }, 'INSURANCE');
      assert.equal(gate.allowed, false);
    });

    it('PUC: Allows save when certificateNumber is present', () => {
      const gate = canSaveExtractedInvoice({ certificateNumber: 'PUC-123' }, 'PUC');
      assert.equal(gate.allowed, true);
    });

    it('PUC: Blocks save when certificate, registration, and chassis are all missing', () => {
      const gate = canSaveExtractedInvoice({}, 'PUC');
      assert.equal(gate.allowed, false);
    });

    it('ELECTRICITY_BILL: Allows save when consumerNumber is present', () => {
      const gate = canSaveExtractedInvoice({ consumerNumber: 'CA100200' }, 'ELECTRICITY_BILL');
      assert.equal(gate.allowed, true);
    });

    it('ELECTRICITY_BILL: Blocks save when consumer, account, and meter numbers are all missing', () => {
      const gate = canSaveExtractedInvoice({ totalAmount: 1200 }, 'ELECTRICITY_BILL');
      assert.equal(gate.allowed, false);
    });

    it('VEHICLE_SERVICE: Allows save when serviceInvoiceNumber is present', () => {
      const gate = canSaveExtractedInvoice({ serviceInvoiceNumber: 'INV-SRV-1' }, 'VEHICLE_SERVICE');
      assert.equal(gate.allowed, true);
    });

    it('VEHICLE_SERVICE: Blocks save when registration, chassis, invoice, and workshop are all missing', () => {
      const gate = canSaveExtractedInvoice({ totalAmount: 4500 }, 'VEHICLE_SERVICE');
      assert.equal(gate.allowed, false);
    });
  });
});
