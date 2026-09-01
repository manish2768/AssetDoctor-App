/**
 * Phase 11.1 — category isolation (no OCR, no Firebase, no Meta).
 */

import {
  normalizeCategory,
  resolveAssetCategory,
  assetMatchesCategory,
  filterAssetsByCategory,
  searchAssetsInCategory,
  resolveRouteCategory,
  getCategoryMeta,
} from '../../../src/utils/categoryNormalization.js';
import { DEMO_ASSETS } from '../../../src/data/demoAssets.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('   PHASE 11.1 CATEGORY ISOLATION                                ');
console.log('================================================================\n');

assert(normalizeCategory('bike') === 'vehicle', 'bike → vehicle');
assert(normalizeCategory('Gadgets & Electronics') === 'gadget', 'display label → gadget');
assert(normalizeCategory('Home & Appliances') === 'home', 'display label → home');
assert(normalizeCategory('washing_machine') === 'home', 'washing_machine → home');
assert(normalizeCategory('card') !== 'vehicle', '"card" does not match vehicle via "car"');
assert(normalizeCategory('review') !== 'vehicle', '"review" does not match vehicle via "ev"');
assert(normalizeCategory('vac') !== 'home', '"vac" does not match home via "ac"');

const bike = { categoryId: 'bike', category: 'Vehicle', categoryLabel: 'Bike', assetName: 'TVS Ronin' };
const ac = { categoryId: 'ac', category: 'Electronics', categoryLabel: 'AC', assetName: 'Daikin AC' };
const phone = { categoryId: 'mobile', category: 'Electronics', categoryLabel: 'Phone', assetName: 'Nothing Phone' };
const inverter = { categoryId: 'inverter', category: 'Equipment', assetName: 'Luminous Inverter' };
const pos = { categoryId: 'pos', category: 'Business', assetName: 'POS Terminal' };
const legal = { categoryId: 'legal_document', category: 'Personal', assetName: 'Rent papers' };
const unknown = { category: 'Electronics', assetName: 'Unknown electronics group only' };

assert(resolveAssetCategory(bike) === 'vehicle', 'TVS Ronin is vehicle');
assert(resolveAssetCategory(ac) === 'home', 'AC is home despite category=Electronics');
assert(resolveAssetCategory(phone) === 'gadget', 'Phone is gadget despite category=Electronics');
assert(resolveAssetCategory(inverter) === 'equipment', 'Inverter is equipment');
assert(resolveAssetCategory(pos) === 'business', 'POS is business');
assert(resolveAssetCategory(legal) === 'other', 'Legal document is other');
assert(resolveAssetCategory(unknown) == null, 'Ambiguous Electronics group without id is unmatched');

const vault = [bike, ac, phone, inverter, pos, legal, unknown];
assert(filterAssetsByCategory(vault, 'vehicle').every((a) => a === bike), 'Vehicles list is only the bike');
assert(filterAssetsByCategory(vault, 'gadget').every((a) => a === phone), 'Gadgets list is only the phone');
assert(filterAssetsByCategory(vault, 'home').every((a) => a === ac), 'Home list is only the AC');
assert(filterAssetsByCategory(vault, 'equipment').every((a) => a === inverter), 'Equipment list is only inverter');
assert(filterAssetsByCategory(vault, 'business').every((a) => a === pos), 'Business list is only POS');
assert(
  filterAssetsByCategory(vault, 'other').length === 2 &&
    filterAssetsByCategory(vault, 'other').includes(legal) &&
    filterAssetsByCategory(vault, 'other').includes(unknown),
  'Other includes explicit other + unmatched, not vehicles/gadgets',
);

const gadgetSearch = searchAssetsInCategory(vault, 'gadget', 'TVS');
assert(gadgetSearch.length === 0, 'Gadgets search for TVS does not leak the bike');
const vehicleSearch = searchAssetsInCategory(vault, 'vehicle', 'TVS');
assert(vehicleSearch.length === 1 && vehicleSearch[0] === bike, 'Vehicles search for TVS returns the bike');

assert(resolveRouteCategory({ category: 'gadget' }).key === 'gadget', 'Route category=gadget');
assert(resolveRouteCategory({ params: { category: 'home' } }).key === 'home', 'Nested params.category=home');
assert(resolveRouteCategory({ folder: 'vehicle' }).key === 'vehicle', 'Legacy folder=vehicle still works');
assert(resolveRouteCategory({ folder: 'electronics' }).valid === false, 'Legacy folder=electronics is invalid, not all');
assert(resolveRouteCategory({ folder: 'property' }).valid === false, 'Legacy folder=property is invalid, not all');
assert(resolveRouteCategory({}).key === 'all', 'Missing params defaults to all');
assert(resolveRouteCategory({ category: 'not-a-real-bucket' }).valid === false, 'Unknown category is invalid');
assert(filterAssetsByCategory(vault, null as unknown as string).length === 0, 'Invalid filter returns empty, not all');

assert(getCategoryMeta('gadget').title === 'Gadgets & Electronics', 'Gadget header title');
assert(getCategoryMeta('gadget').emptyTitle === 'No gadgets yet', 'Gadget empty title');
assert(getCategoryMeta('home').searchPlaceholder.includes('Home & Appliances'), 'Home search is scoped');

const demoVehicles = filterAssetsByCategory(DEMO_ASSETS, 'vehicle');
const demoHome = filterAssetsByCategory(DEMO_ASSETS, 'home');
const demoGadgets = filterAssetsByCategory(DEMO_ASSETS, 'gadget');
assert(
  demoVehicles.every((a) => ['demo_bike', 'demo_car'].includes(a.assetId)),
  'Demo vehicles are bike + car only',
);
assert(demoHome.every((a) => a.assetId === 'demo_ac'), 'Demo home is AC only');
assert(demoGadgets.length === 0, 'Demo vault has no gadgets mixed into vehicles');
assert(
  !demoVehicles.some((a) => a.assetId === 'demo_ac'),
  'Daikin AC does not appear in Vehicles',
);

console.log('\n================================================================');
console.log(`CATEGORY ISOLATION RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
