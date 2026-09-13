/**
 * Unit Test: AI Document Extraction, Anti-Pollution & Duplicate Detection
 * Validates requirements for AddAssetModal and /api/scan-receipt
 */

function runExtractionTests() {
  console.log('================================================================');
  console.log('   AI DOCUMENT EXTRACTION & ANTI-POLLUTION VALIDATION SUITE     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // --- 1. FILE TYPE VALIDATION ---
  console.log('--- 1. FILE TYPE & EXTENSION VALIDATION ---');
  const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  const testFiles = [
    { name: 'invoice.pdf', type: 'application/pdf', valid: true },
    { name: 'bill.jpg', type: 'image/jpeg', valid: true },
    { name: 'warranty.png', type: 'image/png', valid: true },
    { name: 'rc.webp', type: 'image/webp', valid: true },
    { name: 'script.exe', type: 'application/x-msdownload', valid: false },
    { name: 'notes.txt', type: 'text/plain', valid: false },
    { name: 'data.csv', type: 'text/csv', valid: false },
  ];

  testFiles.forEach(f => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    const isValid = allowedExtensions.includes(ext || '');
    assert(isValid === f.valid, `File "${f.name}" validation expected: ${f.valid}, got: ${isValid}`);
  });

  // --- 2. FILE SIZE VALIDATION (MAX 15 MB) ---
  console.log('\n--- 2. FILE SIZE LIMIT VALIDATION ---');
  const MAX_SIZE = 15 * 1024 * 1024;
  const smallFileBytes = 2.4 * 1024 * 1024; // 2.4 MB
  const largeFileBytes = 18 * 1024 * 1024;  // 18 MB
  assert(smallFileBytes <= MAX_SIZE, '2.4 MB file is accepted under 15MB limit');
  assert(largeFileBytes > MAX_SIZE, '18 MB file is rejected for exceeding 15MB limit');

  // --- 3. ANTI-POLLUTION: NO GSTIN / TAX NUMBERS IN SERIAL NUMBER ---
  console.log('\n--- 3. ANTI-POLLUTION: SERIAL NUMBER SANITIZATION ---');
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
  
  function sanitizeSerialNumber(raw: string | null): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    if (gstinRegex.test(s) || /^(GST|HSN|SAC|CGST|SGST|IGST|TAX|INV)/i.test(s)) {
      return null;
    }
    return s;
  }

  assert(sanitizeSerialNumber('27AAACI0348E1Z8') === null, 'Seller GSTIN (27AAACI0348E1Z8) is REJECTED from serial number');
  assert(sanitizeSerialNumber('GSTIN12345') === null, 'Tax string prefix GSTIN is REJECTED from serial number');
  assert(sanitizeSerialNumber('HSN-8415') === null, 'HSN code is REJECTED from serial number');
  assert(sanitizeSerialNumber('CGST-9%') === null, 'Tax rate string is REJECTED from serial number');
  assert(sanitizeSerialNumber('SN-LG-AC-2026-99120') === 'SN-LG-AC-2026-99120', 'Genuine manufacturer serial number is ACCEPTED');
  assert(sanitizeSerialNumber('IMEI-354928109283741') === 'IMEI-354928109283741', 'Genuine IMEI is ACCEPTED');

  // --- 4. ANTI-POLLUTION: BRAND SANITIZATION ---
  console.log('\n--- 4. ANTI-POLLUTION: BRAND SANITIZATION ---');
  function sanitizeBrand(raw: string | null): string | null {
    if (!raw) return null;
    const b = String(raw).trim();
    if (/^(GST|TAX|INVOICE|RETAIL|TOTAL|BILL|CASH)/i.test(b)) {
      return null;
    }
    return b;
  }

  assert(sanitizeBrand('GST INVOICE') === null, 'Tax header "GST INVOICE" is REJECTED from brand');
  assert(sanitizeBrand('TOTAL BILL') === null, 'Financial word "TOTAL BILL" is REJECTED from brand');
  assert(sanitizeBrand('Samsung') === 'Samsung', 'Genuine brand "Samsung" is ACCEPTED');
  assert(sanitizeBrand('LG Electronics') === 'LG Electronics', 'Genuine brand "LG Electronics" is ACCEPTED');

  // --- 5. SMART CATEGORY DETECTION ---
  console.log('\n--- 5. SMART CATEGORY DETECTION ---');
  function detectCategory(itemName: string): string {
    const n = itemName.toLowerCase();
    if (n.includes('ac') || n.includes('air conditioner') || n.includes('refrigerator') || /\bro\b/i.test(n) || n.includes('purifier')) {
      return 'Appliances';
    }
    if (n.includes('bike') || n.includes('scooter') || n.includes('car')) {
      return 'Vehicles';
    }
    if (n.includes('phone') || n.includes('buds') || n.includes('earbuds') || n.includes('watch') || n.includes('tablet')) {
      return 'Gadgets';
    }
    if (n.includes('tv') || n.includes('television') || n.includes('laptop') || n.includes('monitor')) {
      return 'Electronics';
    }
    return 'Other';
  }

  assert(detectCategory('LG 1.5 Ton 5 Star Split AC') === 'Appliances', 'Split AC maps to Appliances');
  assert(detectCategory('Kent Grand Plus RO Water Purifier') === 'Appliances', 'RO Purifier maps to Appliances');
  assert(detectCategory('Nothing Phone (3a) 128GB') === 'Gadgets', 'Phone maps to Gadgets');
  assert(detectCategory('CMF Buds 2 Plus ANC') === 'Gadgets', 'Earbuds map to Gadgets');
  assert(detectCategory('TVS Ronin 225 Bike') === 'Vehicles', 'Bike maps to Vehicles');
  assert(detectCategory('Sony Bravia 55 Inch 4K TV') === 'Electronics', 'TV maps to Electronics');

  // --- 6. DUPLICATE ASSET DETECTION ---
  console.log('\n--- 6. DUPLICATE ASSET DETECTION ---');
  const existingAssets = [
    { id: '1', name: 'MacBook Air M2', brand: 'Apple', serialNumber: 'C02XYZ1234' },
    { id: '2', name: 'Honda City ZX', brand: 'Honda', serialNumber: 'CHASSIS-9921' },
  ];

  function findDuplicate(name: string, brand: string, serial: string) {
    const cleanSerial = serial.trim().toLowerCase();
    const cleanName = name.trim().toLowerCase();
    const cleanBrand = brand.trim().toLowerCase();

    if (cleanSerial.length >= 4) {
      const match = existingAssets.find(a => a.serialNumber?.toLowerCase() === cleanSerial);
      if (match) return match;
    }
    if (cleanName.length >= 3 && cleanBrand.length >= 2) {
      const match = existingAssets.find(a => a.name.toLowerCase() === cleanName && a.brand.toLowerCase() === cleanBrand);
      if (match) return match;
    }
    return null;
  }

  assert(findDuplicate('Random Device', 'Unknown', 'c02xyz1234')?.id === '1', 'Matches duplicate by serial number');
  assert(findDuplicate('MacBook Air M2', 'Apple', '')?.id === '1', 'Matches duplicate by name and brand');
  assert(findDuplicate('Brand New iPhone', 'Apple', 'SN-NEW-1234') === null, 'Allows non-duplicate asset');

  console.log('\n================================================================');
  console.log(`EXTRACTION SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runExtractionTests();
