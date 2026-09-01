/**
 * Regression tests for the reported production defect:
 * "Gadget invoices incorrectly classified as Vehicle" and
 * "Vehicle-specific fields appearing on non-vehicle documents".
 *
 * These test the real functions used at runtime:
 *  - classifySmartCategory      (categoryClassifier.js)
 *  - familyFromDocumentType     (services/ocr/reviewSchema.ts)
 *  - classifyAssetDocumentCategory (assetCategoryClassifier.js)
 *
 * RUN: npx tsx src/services/ocr/__tests__/categoryClassificationRegression.test.js
 */
import { classifySmartCategory, SMART_CATEGORIES } from '../categoryClassifier';
import { classifyAssetDocumentCategory, ASSET_DOC_CATEGORY } from '../assetCategoryClassifier';
import { familyFromDocumentType } from '../../../../services/ocr/reviewSchema';

let passed = 0;
let failed = 0;

function assert(cond, label, extra) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAIL: ${label}${extra ? `  → got: ${JSON.stringify(extra)}` : ''}`);
  }
}

console.log('--- 1. USER-REPORTED BUG: Nothing Phone invoice is NOT Vehicle ---');
(function nothingPhone() {
  // This simulates the real "Nothing Phone (3a) Lite" via "Cloudstore Retail" invoice.
  // The old classifier returned VEHICLES because of the forced-hint override / loose
  // vehicle keyword or because the vendor text contained an ambiguous token.
  const blob =
    'Nothing Phone (3a) Lite 8+128GB | Cloudstore Retail Private Limited | Tax Invoice | Qty 1 | GSTIN 09ABCDE1234F1Z5';
  const hints = {
    productName: 'Nothing Phone (3a) Lite',
    documentKind: 'purchase_invoice',
    // Even if a chassis-like string leaks from another line, a phone must win.
    chassisNumber: '',
    engineNumber: '',
    registration: '',
  };
  const cat = classifySmartCategory(blob, hints);
  assert(
    cat === SMART_CATEGORIES.GADGETS,
    'Nothing Phone (3a) Lite → GADGET (not VEHICLE)',
    cat,
  );
})();

console.log('--- 2. USER-REPORTED BUG: family must NOT default PURCHASE_INVOICE to vehicle ---');
(function familyMapping() {
  const f = familyFromDocumentType('PURCHASE_INVOICE', {
    productName: 'Nothing Phone (3a) Lite',
    imei: '861234567890123',
  });
  assert(f === 'electronics', 'PURCHASE_INVOICE + phone product → electronics family', f);
})();

console.log('--- 3. Acceptance scenarios: never default to Vehicle ---');
(function noVehicleDefault() {
  const cases = [
    ['Nothing Phone (3a) Lite', SMART_CATEGORIES.GADGETS],
    ['iPhone 15 Pro 256GB', SMART_CATEGORIES.GADGETS],
    ['HP Laptop 15.6" i5 16GB', SMART_CATEGORIES.GADGETS],
    ['Samsung Galaxy S24 Ultra', SMART_CATEGORIES.GADGETS],
    ['OnePlus 12R 8+128', SMART_CATEGORIES.GADGETS],
    ['Samsung 43" Smart LED TV', SMART_CATEGORIES.HOME_APPLIANCES],
    ['Voltas 1.5 Ton Split AC', SMART_CATEGORIES.HOME_APPLIANCES],
    ['LG 7kg Semi Auto Washing Machine', SMART_CATEGORIES.HOME_APPLIANCES],
    ['Whirlpool 245L Refrigerator', SMART_CATEGORIES.HOME_APPLIANCES],
  ];
  for (const [product, expected] of cases) {
    const got = classifySmartCategory(product, { productName: product });
    assert(
      got === expected,
      `"${product}" → ${expected} (got ${got})`,
      got,
    );
  }
})();

console.log('--- 4. Vehicle docs still classify as Vehicle (regression safety) ---');
(function vehicleStillWorks() {
  const car = classifySmartCategory('Maruti Suzuki Baleno Zeta', {
    productName: 'Maruti Suzuki Baleno Zeta',
    chassisNumber: 'MA3FU12J0044A1234',
    engineNumber: 'K12BN12345678',
    registration: 'UP32AB1234',
  });
  assert(car === SMART_CATEGORIES.VEHICLES, 'Car purchase (with chassis/engine) → VEHICLE', car);

  const bike = classifySmartCategory('TVS Apache RTR 160', {
    productName: 'TVS Apache RTR 160',
    chassisNumber: 'MD634F2A4K1A12345',
    engineNumber: 'BS6100A12345',
    registration: 'DL01AB9988',
  });
  assert(bike === SMART_CATEGORIES.VEHICLES, 'Bike purchase (with ids) → VEHICLE', bike);

  const semantic = classifyAssetDocumentCategory('Maruti Suzuki Baleno', {
    productName: 'Maruti Suzuki Baleno',
    registration: 'UP32AB1234',
  });
  assert(
    semantic.category === ASSET_DOC_CATEGORY.VEHICLE,
    'Semantic classifier: Baleno + registration → VEHICLE',
    semantic,
  );
})();

console.log('--- 5. Vehicle service invoice stays Vehicle/Service (no regressions) ---');
(function serviceInvoice() {
  const svc = classifySmartCategory(
    'Job Card JS123 | TVS Service Centre | Oil Change | Labour 500 | Total 1200',
    {
      productName: 'TVS Apache',
      documentKind: 'service_invoice',
      chassisNumber: 'MD634F2A4K1A12345',
      engineNumber: 'BS6100A12345',
      registration: 'DL01AB9988',
    },
  );
  assert(svc === SMART_CATEGORIES.VEHICLES, 'Vehicle service invoice → VEHICLE', svc);

  const family = familyFromDocumentType('SERVICE_INVOICE', {
    productName: 'TVS Apache',
  });
  assert(family === 'service', 'SERVICE_INVOICE → service family', family);
})();

console.log('--- 6. Partial vehicle id must NOT auto-force category ---');
(function partialVehicleIdIsNotEnough() {
  // A short 4-digit chassis/engine suffix must never alone force Vehicle.
  const got = classifySmartCategory('Nothing Phone (3a) Lite', {
    productName: 'Nothing Phone (3a) Lite',
    chassisNumber: '1234',
    engineNumber: '5678',
  });
  assert(got === SMART_CATEGORIES.GADGETS, 'Phone + partial id suffix → GADGET (not vehicle)', got);

  const generic = classifySmartCategory('Smart LED TV 43 inch', {
    productName: 'Smart LED TV 43 inch',
    chassisNumber: '', // TV may contain a TV chassis? no, empty
    engineNumber: '',
  });
  assert(
    generic === SMART_CATEGORIES.HOME_APPLIANCES,
    'Smart LED TV → HOME_APPLIANCE (not vehicle)',
    generic,
  );
})();

console.log('--- 7. Unknown stays OTHER (no silent vehicle default) ---');
(function unknownIsOther() {
  const got = classifySmartCategory('Miscellaneous stationery purchase', {
    productName: 'stationery',
  });
  assert(got === SMART_CATEGORIES.OTHER, 'Stationery → OTHER (no vehicle default)', got);
})();

console.log(
  `\nCATEGORY CLASSIFICATION REGRESSION: ${passed} PASSED / ${failed} FAILED`,
);
if (failed > 0) process.exit(1);
