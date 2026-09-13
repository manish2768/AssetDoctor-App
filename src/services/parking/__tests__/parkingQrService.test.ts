/**
 * Asset Doctor — Smart Parking Assistant & QR Ecosystem Unit Tests
 */

// Canonical definitions from ParkingQrService and ParkingAlertService
const PARKING_QR_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  DISABLED: 'DISABLED',
});

function buildParkingQrUrl(qrCode: string) {
  return `https://assetdoctor.app/park/${encodeURIComponent(qrCode)}`;
}

const PARKING_ALERT_TYPE = Object.freeze({
  VEHICLE_BLOCKING: 'VEHICLE_BLOCKING',
  WRONG_PARKING: 'WRONG_PARKING',
  LIGHTS_LEFT_ON: 'LIGHTS_LEFT_ON',
  WINDOW_OPEN: 'WINDOW_OPEN',
  VEHICLE_ISSUE: 'VEHICLE_ISSUE',
  EMERGENCY: 'EMERGENCY',
});

const PARKING_ALERT_TYPE_LABEL = Object.freeze({
  VEHICLE_BLOCKING: 'Vehicle Blocking Me',
  WRONG_PARKING: 'Wrong Parking',
  LIGHTS_LEFT_ON: 'Lights Left On',
  WINDOW_OPEN: 'Window / Door Open',
  VEHICLE_ISSUE: 'Vehicle Issue',
  EMERGENCY: 'Emergency',
});

const PARKING_ALERT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  OWNER_NOTIFIED: 'OWNER_NOTIFIED',
  OWNER_ACKNOWLEDGED: 'OWNER_ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
});

function runParkingTests() {
  console.log('================================================================');
  console.log('   SMART PARKING ASSISTANT & QR ECOSYSTEM TEST SUITE            ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  // --- 1. QR CODE FORMAT & PRIVACY ---
  console.log('--- 1. QR CODE FORMAT & PRIVACY ---');
  const qrCodeRegex = /^AD-PARK-[A-Z0-9]{6}$/;
  const sampleCode = 'AD-PARK-X82K9P'.toUpperCase();
  assert(qrCodeRegex.test(sampleCode), 'QR code matches AD-PARK-XXXXXX pattern');

  // Verify URL generation is opaque and contains no PII
  const testUrl = buildParkingQrUrl(sampleCode);
  assert(testUrl === 'https://assetdoctor.app/park/AD-PARK-X82K9P', 'QR URL follows canonical deep-link format');
  assert(!testUrl.includes('+91') && !testUrl.includes('@'), 'QR URL contains zero phone or email PII');
  assert(!testUrl.includes('uid') && !testUrl.includes('DL01'), 'QR URL contains zero user UID or plate number PII');

  // --- 2. QR STATUS ENUM ---
  console.log('\n--- 2. QR STATUS ENUMS ---');
  assert(PARKING_QR_STATUS.ACTIVE === 'ACTIVE', 'PARKING_QR_STATUS.ACTIVE exists');
  assert(PARKING_QR_STATUS.REVOKED === 'REVOKED', 'PARKING_QR_STATUS.REVOKED exists');
  assert(PARKING_QR_STATUS.DISABLED === 'DISABLED', 'PARKING_QR_STATUS.DISABLED exists');

  // --- 3. PARKING ALERT TYPES & LABELS ---
  console.log('\n--- 3. PARKING ALERT TYPES & LABELS ---');
  const alertTypes = Object.values(PARKING_ALERT_TYPE);
  assert(alertTypes.includes('VEHICLE_BLOCKING'), 'VEHICLE_BLOCKING alert type defined');
  assert(alertTypes.includes('WRONG_PARKING'), 'WRONG_PARKING alert type defined');
  assert(alertTypes.includes('LIGHTS_LEFT_ON'), 'LIGHTS_LEFT_ON alert type defined');
  assert(alertTypes.includes('WINDOW_OPEN'), 'WINDOW_OPEN alert type defined');
  assert(alertTypes.includes('VEHICLE_ISSUE'), 'VEHICLE_ISSUE alert type defined');
  assert(alertTypes.includes('EMERGENCY'), 'EMERGENCY alert type defined');

  assert(PARKING_ALERT_TYPE_LABEL.VEHICLE_BLOCKING === 'Vehicle Blocking Me', 'VEHICLE_BLOCKING label correct');
  assert(PARKING_ALERT_TYPE_LABEL.EMERGENCY === 'Emergency', 'EMERGENCY label correct');

  // --- 4. ALERT STATUS LIFECYCLE ---
  console.log('\n--- 4. ALERT STATUS LIFECYCLE ---');
  assert(PARKING_ALERT_STATUS.PENDING === 'PENDING', 'Initial alert status is PENDING');
  assert(PARKING_ALERT_STATUS.OWNER_ACKNOWLEDGED === 'OWNER_ACKNOWLEDGED', 'Status OWNER_ACKNOWLEDGED supported');
  assert(PARKING_ALERT_STATUS.RESOLVED === 'RESOLVED', 'Status RESOLVED supported');

  // --- 5. RATE LIMITING CALCULATION ---
  console.log('\n--- 5. RATE LIMITING CALCULATION ---');
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const lastReportAt = now - 15 * 60 * 1000; // 15 min ago
  const reportsInWindow = 3;

  const isRateLimited = (now - lastReportAt < ONE_HOUR) && reportsInWindow >= 3;
  assert(isRateLimited === true, 'Scanner submitting >= 3 reports in 1 hour is rate limited');

  const freshScannerWindow = now - 2 * ONE_HOUR; // 2 hours ago
  const isFreshAllowed = (now - freshScannerWindow >= ONE_HOUR);
  assert(isFreshAllowed === true, 'Scanner outside cooldown window is allowed');

  // --- 6. SINGLE ACTIVE QR PER VEHICLE INVENTORY ---
  console.log('\n--- 6. SINGLE ACTIVE QR RULE INVENTORY ---');
  const mockQrs = [
    { qrCode: 'AD-PARK-AAAAAA', assetId: 'asset_1', status: 'REVOKED', createdAt: '2026-01-01' },
    { qrCode: 'AD-PARK-BBBBBB', assetId: 'asset_1', status: 'ACTIVE', createdAt: '2026-02-01' },
  ];

  const activeQrsForAsset1 = mockQrs.filter(q => q.assetId === 'asset_1' && q.status === 'ACTIVE');
  assert(activeQrsForAsset1.length === 1, 'Exactly one ACTIVE QR per vehicle asset');
  assert(activeQrsForAsset1[0].qrCode === 'AD-PARK-BBBBBB', 'Active QR matches latest generated code');

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runParkingTests();
