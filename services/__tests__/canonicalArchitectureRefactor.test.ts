/**
 * Asset Doctor — Canonical Architecture Refactor Regression Suite
 * Comprehensive automated regression testing across all 18 refactoring phases:
 * 1. Category Domain Model & Normalization
 * 2. Capability Guards & Authoritative Invariants
 * 3. Hardened Service Due Engine (Vehicle vs Non-Vehicle)
 * 4. Service Prediction Engine Order of Operations
 * 5. Fuel Analytics Engine & Vehicle State Isolation
 * 6. Home Alert Zero-Mileage Invariant for Appliances & Electronics
 * 7. Sharing & Capture Resilience
 */

import {
  normalizeToCanonicalCategory,
  resolveCanonicalAssetCategory,
  isVehicleAsset,
  isElectronicsAsset,
  isHomeApplianceAsset,
  isBusinessAsset,
  isPersonalDocumentAsset,
  supportsOdometer,
  supportsMileage,
  supportsFuelTracking,
  supportsVehicleDocuments,
  supportsCalendarService,
} from '../../src/domain/asset/assetGuards';

import { getAssetCapabilities } from '../../src/utils/assetCapabilities';
import { evaluateServiceDue, SERVICE_STATUS } from '../../src/services/health/serviceDueEngine';
import { predictNextServiceDue, calculateDrivingVelocity } from '../servicePrediction/predictionEngine';
import {
  computeFuelAnalytics,
  normalizeFuelLogs,
  maskVehicleNumber,
  maskSpend,
} from '../../src/services/fuel/fuelMetrics';
import { buildAssetInsights } from '../../src/services/health/insightsRulesEngine';
import { buildCountdownTasks } from '../../src/utils/countdownTasks';
import { computeProtectionStatus } from '../../src/trust/protectionStatus';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}`, detail !== undefined ? detail : '');
  }
}

console.log('================================================================');
console.log('   CANONICAL ARCHITECTURE REFACTOR REGRESSION SUITE             ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: CANONICAL DOMAIN MODEL & CATEGORY NORMALIZATION
// -----------------------------------------------------------------------------
console.log('--- 1. CANONICAL CATEGORY NORMALIZATION ---');

assert(normalizeToCanonicalCategory('VEHICLE') === 'VEHICLE', 'Direct canonical uppercase VEHICLE');
assert(normalizeToCanonicalCategory('Vehicles') === 'VEHICLE', 'Legacy "Vehicles" normalizes to VEHICLE');
assert(normalizeToCanonicalCategory('car') === 'VEHICLE', 'Alias "car" normalizes to VEHICLE');
assert(normalizeToCanonicalCategory('bike') === 'VEHICLE', 'Alias "bike" normalizes to VEHICLE');
assert(normalizeToCanonicalCategory('scooter') === 'VEHICLE', 'Alias "scooter" normalizes to VEHICLE');

assert(normalizeToCanonicalCategory('ELECTRONICS') === 'ELECTRONICS', 'Direct canonical uppercase ELECTRONICS');
assert(normalizeToCanonicalCategory('gadgets') === 'ELECTRONICS', 'Legacy "gadgets" normalizes to ELECTRONICS');
assert(normalizeToCanonicalCategory('phone') === 'ELECTRONICS', 'Alias "phone" normalizes to ELECTRONICS');
assert(normalizeToCanonicalCategory('smartphone') === 'ELECTRONICS', 'Alias "smartphone" normalizes to ELECTRONICS');

assert(normalizeToCanonicalCategory('HOME_APPLIANCES') === 'HOME_APPLIANCES', 'Direct canonical HOME_APPLIANCES');
assert(normalizeToCanonicalCategory('Appliances') === 'HOME_APPLIANCES', 'Legacy "Appliances" normalizes to HOME_APPLIANCES');
assert(normalizeToCanonicalCategory('geyser') === 'HOME_APPLIANCES', 'Alias "geyser" normalizes to HOME_APPLIANCES');
assert(normalizeToCanonicalCategory('washing_machine') === 'HOME_APPLIANCES', 'Alias "washing_machine" normalizes to HOME_APPLIANCES');
assert(normalizeToCanonicalCategory('ac') === 'HOME_APPLIANCES', 'Alias "ac" normalizes to HOME_APPLIANCES');

assert(normalizeToCanonicalCategory('business') === 'BUSINESS', 'Legacy "business" normalizes to BUSINESS');
assert(normalizeToCanonicalCategory('pos') === 'BUSINESS', 'Alias "pos" normalizes to BUSINESS');

assert(normalizeToCanonicalCategory('personal_document') === 'PERSONAL_DOCUMENT', 'Canonical PERSONAL_DOCUMENT');
assert(normalizeToCanonicalCategory('other') === 'PERSONAL_DOCUMENT', 'Legacy "other" normalizes to PERSONAL_DOCUMENT');
assert(normalizeToCanonicalCategory(null) === 'PERSONAL_DOCUMENT', 'Null category defaults safely to PERSONAL_DOCUMENT');

// Authoritative category resolution: NEVER guess vehicle from name
const geyserWithBikeName = {
  id: 'g-1',
  name: 'Bajaj Pulsar Water Geyser 15L',
  category: 'HOME_APPLIANCES',
  registration: 'DL01AB1234', // stray registration shouldn't make it a vehicle
};
assert(resolveCanonicalAssetCategory(geyserWithBikeName) === 'HOME_APPLIANCES', 'Appliance with bike name is authoritatively HOME_APPLIANCES');
assert(!isVehicleAsset(geyserWithBikeName), 'Appliance is NOT a vehicle despite bike keyword');
assert(isHomeApplianceAsset(geyserWithBikeName), 'isHomeApplianceAsset is true for geyser');

const businessInvoice = {
  id: 'b-1',
  name: 'Dell Server Rack',
  category: 'BUSINESS',
  serialNumber: 'DL-998822',
};
assert(isBusinessAsset(businessInvoice), 'Business asset resolves isBusinessAsset');
assert(!isVehicleAsset(businessInvoice), 'Business asset is NOT a vehicle');

// -----------------------------------------------------------------------------
// SECTION 2: CAPABILITY GUARDS & STRICT ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. CAPABILITY GUARDS & ISOLATION ---');

const vehicleCar = { id: 'v-1', category: 'VEHICLE', fuelType: 'petrol', odometerKm: 12000 };
const vehicleEV = { id: 'v-2', category: 'VEHICLE', fuelType: 'ev', odometerKm: 8500 };
const smartPhone = { id: 'p-1', category: 'ELECTRONICS', name: 'iPhone 15 Pro', batteryHealthPercent: 94 };
const airConditioner = { id: 'a-1', category: 'HOME_APPLIANCES', name: 'Daikin 1.5 Ton AC' };

assert(supportsOdometer(vehicleCar) === true, 'Vehicle supports odometer');
assert(supportsOdometer(vehicleEV) === true, 'EV vehicle supports odometer');
assert(supportsOdometer(smartPhone) === false, 'Smartphone NEVER supports odometer');
assert(supportsOdometer(airConditioner) === false, 'Air Conditioner NEVER supports odometer');

assert(supportsMileage(vehicleCar) === true, 'Vehicle supports mileage');
assert(supportsMileage(smartPhone) === false, 'Smartphone NEVER supports mileage');
assert(supportsMileage(airConditioner) === false, 'Air Conditioner NEVER supports mileage');

assert(supportsFuelTracking(vehicleCar) === true, 'Combustion vehicle supports liquid fuel tracking');
assert(supportsFuelTracking(vehicleEV) === false, 'EV does not participate in liquid fuel tracking');
assert(supportsFuelTracking(airConditioner) === false, 'Air Conditioner does not participate in fuel tracking');

assert(supportsVehicleDocuments(vehicleCar) === true, 'Vehicle supports vehicle docs');
assert(supportsVehicleDocuments(smartPhone) === false, 'Phone does not support vehicle docs');
assert(supportsVehicleDocuments(airConditioner) === false, 'Appliance does not support vehicle docs');

assert(supportsCalendarService(vehicleCar) === true, 'Vehicle supports calendar service');
assert(supportsCalendarService(airConditioner) === true, 'Appliance supports calendar service');

// Check getAssetCapabilities adapter
const appCaps = getAssetCapabilities(airConditioner);
assert(appCaps.isVehicle === false, 'Appliance capabilities: isVehicle is false');
assert(appCaps.hasOdometer === false, 'Appliance capabilities: hasOdometer is false');
assert(appCaps.hasVehicleServiceSchedule === false, 'Appliance capabilities: hasVehicleServiceSchedule is false');
assert(appCaps.isAppliance === true, 'Appliance capabilities: isAppliance is true');
assert(appCaps.hasApplianceServiceSchedule === true, 'Appliance capabilities: hasApplianceServiceSchedule is true');

// -----------------------------------------------------------------------------
// SECTION 3: HARDENED SERVICE DUE ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- 3. HARDENED SERVICE DUE ENGINE ---');

// Non-vehicle (AC) with accidental odometerKm property
const acWithOdo = {
  id: 'ac-1',
  category: 'HOME_APPLIANCES',
  name: 'Voltas Inverter AC',
  odometerKm: 50000,
  nextServiceOdometerKm: 10000, // this would be overdue by 40,000 km if vehicle!
  nextServiceDate: '2026-10-15',
};
const acServiceEval = evaluateServiceDue(acWithOdo, { now: new Date('2026-09-01T12:00:00Z') });

assert(acServiceEval.supportsOdometer === false, 'AC service eval: supportsOdometer is false');
assert(acServiceEval.kmRemaining === null, 'AC service eval: kmRemaining is strictly null');
assert(acServiceEval.status !== SERVICE_STATUS.SERVICE_OVERDUE, 'AC is NOT overdue by mileage');
assert(!acServiceEval.message.includes('odometer'), 'AC service message NEVER mentions odometer');

// Vehicle with overdue odometer
const carWithOdo = {
  id: 'car-1',
  category: 'VEHICLE',
  name: 'Hyundai i10',
  odometerKm: 10500,
  nextServiceOdometerKm: 10000,
  nextServiceDate: '2026-12-01',
};
const carServiceEval = evaluateServiceDue(carWithOdo, { now: new Date('2026-09-01T12:00:00Z') });
assert(carServiceEval.supportsOdometer === true, 'Car service eval: supportsOdometer is true');
assert(carServiceEval.kmRemaining === -500, 'Car service eval: kmRemaining is -500');
assert(carServiceEval.status === SERVICE_STATUS.SERVICE_OVERDUE, 'Car is overdue based on odometer');
assert(carServiceEval.message.includes('odometer'), 'Car service message correctly notes odometer');

// -----------------------------------------------------------------------------
// SECTION 4: SERVICE PREDICTION ENGINE ORDER OF OPERATIONS
// -----------------------------------------------------------------------------
console.log('\n--- 4. SERVICE PREDICTION ENGINE ---');

// Non-vehicle prediction
const geyserPred = predictNextServiceDue(
  {
    id: 'gey-1',
    category: 'HOME_APPLIANCES',
    name: 'Havells 25L Geyser',
    odometerKm: 12000,
  },
  [],
  { referenceDateIST: new Date('2026-09-01T12:00:00Z') }
);

assert(geyserPred.avgDailyKm === null, 'Non-vehicle prediction: avgDailyKm is null');
assert(geyserPred.remainingKm === 0, 'Non-vehicle prediction: remainingKm is 0');
assert(geyserPred.projectedKmThresholdDate === null, 'Non-vehicle prediction: projectedKmThresholdDate is null');
assert(geyserPred.hasOdometerAnomaly === false, 'Non-vehicle prediction: hasOdometerAnomaly is false');

// Vehicle driving velocity and odometer anomaly test
const bikeAsset = {
  id: 'bike-1',
  category: 'VEHICLE',
  name: 'TVS Ronin',
  odometerKm: 12000,
  purchaseDate: '2025-01-01',
};
const validHistory = [
  { id: 'sr-1', serviceDate: '2025-06-01', odometerKm: 3000, verificationStatus: 'VERIFIED' as const, serviceType: '1st Service' },
  { id: 'sr-2', serviceDate: '2025-12-01', odometerKm: 9000, verificationStatus: 'VERIFIED' as const, serviceType: '2nd Service' },
];
const velocityResult = calculateDrivingVelocity(bikeAsset, validHistory, '2026-09-01');
assert(velocityResult.avgDailyKm !== null && velocityResult.avgDailyKm > 0, 'Vehicle computes driving velocity from verified records');
assert(velocityResult.confidence === 'HIGH', 'Two verified records yield HIGH confidence');

// Odometer anomaly detection (decreasing odometer)
const tamperedHistory = [
  { id: 'sr-1', serviceDate: '2025-06-01', odometerKm: 15000, verificationStatus: 'VERIFIED' as const, serviceType: '1st Service' },
  { id: 'sr-2', serviceDate: '2025-12-01', odometerKm: 10000, verificationStatus: 'VERIFIED' as const, serviceType: '2nd Service' },
];
const tamperedVelocity = calculateDrivingVelocity(bikeAsset, tamperedHistory, '2026-09-01');
assert(tamperedVelocity.hasOdometerAnomaly === true, 'Detected odometer regression anomaly');

// -----------------------------------------------------------------------------
// SECTION 5: CANONICAL FUEL ENGINE & VEHICLE ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. FUEL ENGINE & VEHICLE ISOLATION ---');

// Ronin logs vs i10 logs isolation
const roninId = 'ronin-asset-123';
const i10Id = 'i10-asset-456';

const allUserLogs = [
  // Ronin logs (May 2026)
  { id: 'l1', assetId: roninId, odometerKM: 5000, amountPaid: 1000, liters: 10, isFullTank: true, createdAt: '2026-05-02T10:00:00Z' },
  { id: 'l2', assetId: roninId, odometerKM: 5500, amountPaid: 1100, liters: 11, isFullTank: true, createdAt: '2026-05-15T10:00:00Z' },
  { id: 'l3', assetId: roninId, odometerKM: 6000, amountPaid: 1200, liters: 10, isFullTank: true, createdAt: '2026-05-28T10:00:00Z' },
  // i10 logs (May 2026)
  { id: 'l4', assetId: i10Id, odometerKM: 42000, amountPaid: 3500, liters: 35, isFullTank: true, createdAt: '2026-05-05T10:00:00Z' },
  { id: 'l5', assetId: i10Id, odometerKM: 42500, amountPaid: 3600, liters: 36, isFullTank: true, createdAt: '2026-05-20T10:00:00Z' },
];

const roninFilteredLogs = allUserLogs.filter(l => l.assetId === roninId);
const i10FilteredLogs = allUserLogs.filter(l => l.assetId === i10Id);

const roninMonthlyAnalytics = computeFuelAnalytics({
  asset: { vehicleType: 'bike', assetName: 'TVS Ronin' },
  logs: roninFilteredLogs,
  mode: 'MONTHLY',
  month: '2026-05',
});

assert(roninMonthlyAnalytics.refillCount === 3, 'Ronin has exactly 3 refills in May');
assert(roninMonthlyAnalytics.totalDistanceKm === 1000, 'Ronin May distance is 6000 - 5000 = 1000 km');
assert(roninMonthlyAnalytics.totalSpend === 3300, 'Ronin May spend is ₹3,300');
assert(roninMonthlyAnalytics.totalLitres === 31, 'Ronin May litres is 31L');
assert(roninMonthlyAnalytics.averageMileageKmPerL === 32.3, 'Ronin May avg mileage is 1000/31 = 32.3 km/L');

const i10MonthlyAnalytics = computeFuelAnalytics({
  asset: { vehicleType: 'car', assetName: 'Hyundai i10' },
  logs: i10FilteredLogs,
  mode: 'MONTHLY',
  month: '2026-05',
});

assert(i10MonthlyAnalytics.refillCount === 2, 'i10 has exactly 2 refills in May (hard isolated from Ronin)');
assert(i10MonthlyAnalytics.totalDistanceKm === 500, 'i10 May distance is 42500 - 42000 = 500 km');
assert(i10MonthlyAnalytics.totalSpend === 7100, 'i10 May spend is ₹7,100');

// Lifetime Analytics Mode
const roninLifetimeAnalytics = computeFuelAnalytics({
  asset: { vehicleType: 'bike', assetName: 'TVS Ronin' },
  logs: roninFilteredLogs,
  mode: 'LIFETIME',
});
assert(roninLifetimeAnalytics.mode === 'LIFETIME', 'Lifetime mode returns mode LIFETIME');
assert(roninLifetimeAnalytics.totalDistanceKm === 1000, 'Lifetime distance is 1000 km');
assert(roninLifetimeAnalytics.totalSpend === 3300, 'Lifetime total spend is ₹3,300');
assert(roninLifetimeAnalytics.refillCount === 3, 'Lifetime refill count is 3');

// Zero fabrication when single entry
const singleLogAnalytics = computeFuelAnalytics({
  logs: [{ id: 's1', odometerKM: 5000, amountPaid: 1000, liters: 10, createdAt: '2026-05-01' }],
  mode: 'MONTHLY',
  month: '2026-05',
});
assert(singleLogAnalytics.totalDistanceKm === null, 'Single log has no distance span (never fabricated)');
assert(singleLogAnalytics.averageMileageKmPerL === null, 'Single log has null mileage (never fabricated)');

// Masking privacy tests
assert(maskVehicleNumber('UP32HK8483', true) === '•• •• ••••', 'Masked plate hides plate');
assert(maskVehicleNumber('UP32HK8483', false) === 'UP32HK8483', 'Unmasked plate shows full plate');
assert(maskSpend(3300, true) === '₹ ••••', 'Masked spend hides digits');
assert(maskSpend(3300, false) === '₹3,300', 'Unmasked spend formats INR');

// -----------------------------------------------------------------------------
// SECTION 6: HOME SCREEN ZERO-MILEAGE ALERT INVARIANT
// -----------------------------------------------------------------------------
console.log('\n--- 6. HOME SCREEN ZERO-MILEAGE ALERT INVARIANT ---');

const nonVehicleAppliances = [
  { id: 'app-1', name: 'AO Smith Geyser 25L', category: 'HOME_APPLIANCES', odometerKm: 25000, warrantyExpiry: '2026-09-03' },
  { id: 'app-2', name: 'LG 1.5T Split AC', category: 'HOME_APPLIANCES', nextServiceOdometerKm: 5000, nextServiceDate: '2026-10-01' },
  { id: 'app-3', name: 'Samsung Refrigerator 350L', category: 'HOME_APPLIANCES' },
  { id: 'app-4', name: 'Sony Bravia 55 OLED TV', category: 'ELECTRONICS' },
  { id: 'app-5', name: 'iPhone 15 Pro Max', category: 'ELECTRONICS', batteryHealthPercent: 92 },
];

for (const app of nonVehicleAppliances) {
  const insights = buildAssetInsights(app);
  const mileageAlerts = insights.filter((i) =>
    i.type.includes('MILEAGE') ||
    i.type.includes('ODOMETER') ||
    i.title.toLowerCase().includes(' km') ||
    i.message.toLowerCase().includes('odometer')
  );
  assert(mileageAlerts.length === 0, `Zero mileage/odometer alerts generated in insights for ${app.name} (${app.category})`);

  const countdowns = buildCountdownTasks([app]);
  const kmCountdowns = countdowns.filter((c: any) => c.kind === 'service_km' || (c.subtitle && c.subtitle.includes('KM')));
  assert(kmCountdowns.length === 0, `Zero KM-based countdown tasks generated for ${app.name} (${app.category})`);
}

// -----------------------------------------------------------------------------
// SECTION 7: MONTH FILTERING (SEP != AUG != JUL)
// -----------------------------------------------------------------------------
console.log('\n--- 7. MONTH FILTERING ISOLATION ---');

const multiMonthLogs = [
  { id: 'jul-1', odometerKM: 1000, amountPaid: 500, liters: 5, createdAt: '2026-07-15T10:00:00Z' },
  { id: 'jul-2', odometerKM: 1200, amountPaid: 500, liters: 5, createdAt: '2026-07-28T10:00:00Z' },
  { id: 'aug-1', odometerKM: 1500, amountPaid: 800, liters: 8, createdAt: '2026-08-10T10:00:00Z' },
  { id: 'aug-2', odometerKM: 1900, amountPaid: 900, liters: 9, createdAt: '2026-08-25T10:00:00Z' },
  { id: 'sep-1', odometerKM: 2300, amountPaid: 1000, liters: 10, createdAt: '2026-09-01T10:00:00Z' },
  { id: 'sep-2', odometerKM: 2800, amountPaid: 1100, liters: 11, createdAt: '2026-09-15T10:00:00Z' },
];

const julMetrics = computeFuelAnalytics({ logs: multiMonthLogs, mode: 'MONTHLY', month: '2026-07' });
const augMetrics = computeFuelAnalytics({ logs: multiMonthLogs, mode: 'MONTHLY', month: '2026-08' });
const sepMetrics = computeFuelAnalytics({ logs: multiMonthLogs, mode: 'MONTHLY', month: '2026-09' });

assert(julMetrics.refillCount === 2, 'July has exactly 2 logs');
assert(julMetrics.totalDistanceKm === 200, 'July distance is 1200 - 1000 = 200 km');
assert(augMetrics.refillCount === 2, 'August has exactly 2 logs');
assert(augMetrics.totalDistanceKm === 400, 'August distance is 1900 - 1500 = 400 km');
assert(sepMetrics.refillCount === 2, 'September has exactly 2 logs');
assert(sepMetrics.totalDistanceKm === 500, 'September distance is 2800 - 2300 = 500 km');
assert(sepMetrics.totalSpend !== augMetrics.totalSpend && augMetrics.totalSpend !== julMetrics.totalSpend, 'September logs != August logs != July logs');

// -----------------------------------------------------------------------------
// SECTION 8: SHARE PASSPORT CAPTUREVIEW RESILIENCE
// -----------------------------------------------------------------------------
console.log('\n--- 8. SHARE PASSPORT CAPTUREVIEW RESILIENCE ---');

async function testCaptureResilience() {
  const { captureView } = await import('../../src/services/share/cardShare');

  // Null ref
  const nullResult = await captureView(null as any);
  assert(nullResult === null, 'captureView(null) safely returns null without crash');

  // Unmounted ref
  const unmountedResult = await captureView({ current: null } as any);
  assert(unmountedResult === null, 'captureView(unmountedRef) safely returns null without crash');

  // Erroring ref
  const throwingRef = {
    current: {
      capture: async () => {
        throw new Error('Native view shot failed');
      },
    },
  };
  const throwingResult = await captureView(throwingRef as any);
  assert(throwingResult === null, 'captureView(throwingRef) safely catches error and returns null');

  // Successful capture ref
  const successfulRef = {
    current: {
      capture: async () => 'file:///data/user/0/com.assetdoctor/cache/passport.png',
    },
  };
  const successResult = await captureView(successfulRef as any);
  assert(successResult === 'file:///data/user/0/com.assetdoctor/cache/passport.png', 'captureView(validRef) returns temporary image URI');
}

// -----------------------------------------------------------------------------
// SECTION 9: PROFILE PROTECTION CANONICAL STATE ENGINE
// -----------------------------------------------------------------------------
console.log('\n--- 9. PROFILE PROTECTION CANONICAL STATE ENGINE ---');

// 1. All requirements complete
const fullyProtectedUser = {
  name: 'Ayush Rai',
  phone: '+919876543210',
  whatsappOptIn: true,
  pincode: '226010',
};
const activeAssetsList = [{ id: 'a1', name: 'MacBook Pro' }];

const completeStatus = computeProtectionStatus({
  user: fullyProtectedUser,
  assets: activeAssetsList,
  documents: [],
});

assert(completeStatus.status === 'COMPLETE', 'All requirements complete: status is COMPLETE');
assert(completeStatus.score.value === 100, 'All requirements complete: score value is 100');
assert(completeStatus.score.display === '100 / 100', 'All requirements complete: score display is "100 / 100"');
assert(completeStatus.badge.label === 'Protection Setup Complete', 'All requirements complete: badge is "Protection Setup Complete"');
assert(completeStatus.badge.tone === 'success', 'All requirements complete: badge tone is success');

// 2. Identity missing
const missingIdentityStatus = computeProtectionStatus({
  user: { phone: '+919876543210', whatsappOptIn: true, pincode: '226010' },
  assets: activeAssetsList,
});
assert(missingIdentityStatus.status === 'INCOMPLETE', 'Identity missing: status is INCOMPLETE');
assert(missingIdentityStatus.score.value === 80, 'Identity missing: score is 80 / 100');
assert(missingIdentityStatus.badge.label === 'Protection Setup Incomplete', 'Identity missing: badge is "Protection Setup Incomplete"');

// 3. Mobile missing
const missingMobileStatus = computeProtectionStatus({
  user: { name: 'Ayush Rai', whatsappOptIn: true, pincode: '226010' },
  assets: activeAssetsList,
});
assert(missingMobileStatus.status === 'INCOMPLETE', 'Mobile missing: status is INCOMPLETE');
assert(missingMobileStatus.score.value === 80, 'Mobile missing: score is 80 / 100');

// 4. WhatsApp missing
const missingWhatsappStatus = computeProtectionStatus({
  user: { name: 'Ayush Rai', phone: '+919876543210', whatsappOptIn: false, pincode: '226010' },
  assets: activeAssetsList,
});
assert(missingWhatsappStatus.status === 'INCOMPLETE', 'WhatsApp missing: status is INCOMPLETE');
assert(missingWhatsappStatus.score.value === 80, 'WhatsApp missing: score is 80 / 100');

// 5. PIN missing
const missingPinStatus = computeProtectionStatus({
  user: { name: 'Ayush Rai', phone: '+919876543210', whatsappOptIn: true },
  assets: activeAssetsList,
});
assert(missingPinStatus.status === 'INCOMPLETE', 'PIN missing: status is INCOMPLETE');
assert(missingPinStatus.score.value === 80, 'PIN missing: score is 80 / 100');

// 6. Assets missing
const missingAssetsStatus = computeProtectionStatus({
  user: fullyProtectedUser,
  assets: [],
});
assert(missingAssetsStatus.status === 'INCOMPLETE', 'Assets missing: status is INCOMPLETE');
assert(missingAssetsStatus.score.value === 80, 'Assets missing: score is 80 / 100');

// 7. Impossible state assertion: all items complete MUST NOT be Incomplete
assert(
  !(completeStatus.items.every((it: any) => it.complete) && completeStatus.status === 'INCOMPLETE'),
  'Impossible state: All items complete cannot yield INCOMPLETE badge',
);
assert(
  !(completeStatus.score.value === 100 && completeStatus.badge.label === 'Protection Setup Incomplete'),
  'Impossible state: 100/100 score cannot yield Protection Setup Incomplete badge',
);

testCaptureResilience().then(() => {
  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
});
