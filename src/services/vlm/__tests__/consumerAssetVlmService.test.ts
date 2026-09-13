/**
 * Unit tests for ConsumerAssetVlmService post-processing and normalization.
 *
 * Run with: npx tsx src/services/vlm/__tests__/consumerAssetVlmService.test.ts
 */

import {
  normalizeChassisNumber,
  computeWarrantyExpiry,
  sanitizeAmount,
  postProcessVlmExtraction,
  ConsumerAssetExtraction,
} from '../ConsumerAssetVlmService';

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    process.exitCode = 1;
  }
}

console.log('\n=== Testing ConsumerAssetVlmService ===\n');

// 1. Chassis / VIN Normalization
console.log('1. Chassis / VIN Normalization:');
assert(
  'Strips whitespace and converts to uppercase',
  normalizeChassisNumber(' md637 an115 zf03328 ') === 'MD637AN115ZF03328'
);
assert(
  'Replaces letter O with digit 0 in VINs',
  normalizeChassisNumber('MD637AN115ZFO3328') === 'MD637AN115ZF03328'
);
assert(
  'Handles null and empty string safely',
  normalizeChassisNumber(null) === '' && normalizeChassisNumber('') === ''
);

// 2. Warranty Expiry Computation
console.log('\n2. Warranty Expiry Computation:');
assert(
  'Computes 1 Year warranty correctly from purchase date',
  computeWarrantyExpiry('2025-07-14', '1 Year') === '2026-07-14'
);
assert(
  'Computes 2 Years warranty correctly',
  computeWarrantyExpiry('2024-01-15', '2 Years') === '2026-01-15'
);
assert(
  'Computes 6 Months warranty correctly',
  computeWarrantyExpiry('2025-03-01', '6 Months') === '2025-09-01'
);
assert(
  'Computes domestic warranty format (e.g. 1 Year Domestic Warranty)',
  computeWarrantyExpiry('2025-07-14', '1 Year Domestic Warranty') === '2026-07-14'
);
assert(
  'Returns null if purchase date is missing or invalid',
  computeWarrantyExpiry(null, '1 Year') === null &&
  computeWarrantyExpiry('invalid-date', '1 Year') === null
);

// 3. Amount Sanitization
console.log('\n3. Amount Sanitization:');
assert('Parses pure number', sanitizeAmount(135500.0) === 135500.0);
assert('Parses currency formatted string with ₹ and commas', sanitizeAmount('₹1,35,500.00') === 135500);
assert('Parses Rs. string', sanitizeAmount('Rs. 2,499') === 2499);
assert('Handles null and empty safely', sanitizeAmount(null) === null && sanitizeAmount('') === null);

// 4. End-to-End Extraction Normalization (TVS Ronin sample from prompt)
console.log('\n4. TVS Ronin Extraction Normalization:');
const tvsSample: ConsumerAssetExtraction = {
  product_name: 'TVS Ronin',
  brand: 'TVS',
  model_variant: 'Base Lightning Black',
  serial_or_identifier: 'MD637AN115ZFO3328', // Has misread letter 'O'
  identifier_type: 'CHASSIS_NUMBER',
  seller_name: 'Apex Moto Services Pvt. Ltd.',
  buyer_name: 'Manish Rai',
  purchase_date: '2025-07-14',
  invoice_number: '180725130771',
  total_paid_amount: 135500.0,
  warranty_period: '1 Year',
  warranty_expiry_date: null, // Test automatic computation
};

const tvsNormalized = postProcessVlmExtraction(tvsSample);
assert('Product name preserved', tvsNormalized.productName === 'TVS Ronin');
assert('Brand preserved', tvsNormalized.brand === 'TVS');
assert('Model variant preserved', tvsNormalized.model === 'Base Lightning Black');
assert('Chassis number normalized (O -> 0)', tvsNormalized.chassisNumber === 'MD637AN115ZF03328');
assert('Identifier type is CHASSIS_NUMBER', tvsNormalized.identifierType === 'CHASSIS_NUMBER');
assert('Seller name preserved', tvsNormalized.shopName === 'Apex Moto Services Pvt. Ltd.');
assert('Buyer name preserved', tvsNormalized.customerName === 'Manish Rai');
assert('Purchase date preserved', tvsNormalized.invoiceDate === '2025-07-14');
assert('Invoice number preserved', tvsNormalized.invoiceNumber === '180725130771');
assert('Total amount preserved', tvsNormalized.totalAmount === 135500.0);
assert('Warranty period preserved', tvsNormalized.warrantyPeriod === '1 Year');
assert('Warranty expiry auto-computed as 2026-07-14', tvsNormalized.warrantyExpiry === '2026-07-14');
assert('Classified as Vehicle category', tvsNormalized.category === 'Vehicle');

// 5. Electronics sample (CMF Buds 2 Plus from prompt)
console.log('\n5. CMF Buds 2 Plus Electronics Normalization:');
const cmfSample: ConsumerAssetExtraction = {
  product_name: 'CMF Buds 2 Plus',
  brand: 'CMF by Nothing',
  model_variant: 'Dark Grey',
  serial_or_identifier: 'CMF9988123445',
  identifier_type: 'SERIAL_NUMBER',
  seller_name: 'BTPL Distribution',
  buyer_name: 'Ayush Rai',
  purchase_date: '2025-08-10',
  invoice_number: 'INV-2025-992',
  total_paid_amount: 2499.0,
  warranty_period: '1 Year Domestic Warranty',
  warranty_expiry_date: null,
};

const cmfNormalized = postProcessVlmExtraction(cmfSample);
assert('Product name is CMF Buds 2 Plus', cmfNormalized.productName === 'CMF Buds 2 Plus');
assert('Serial number populated', cmfNormalized.serialNumber === 'CMF9988123445');
assert('Chassis number empty for electronics', cmfNormalized.chassisNumber === '');
assert('Warranty expiry auto-computed as 2026-08-10', cmfNormalized.warrantyExpiry === '2026-08-10');
assert('Classified as Gadget category', cmfNormalized.category === 'Gadget');

console.log('\n=== All Tests Finished ===\n');
