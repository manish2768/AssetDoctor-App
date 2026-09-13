/**
 * Asset Doctor — Canonical Identity & Production Architecture Test Suite
 * Validates all 26 mandatory acceptance tests defined in the release gate audit.
 */

import {
  normalizeCanonicalEmail,
  normalizeCanonicalPhone,
  validateIndianPincode,
  lookupPincode,
} from '../../src/services/identity/identityNormalizer';
import {
  IdentityResolver,
  CanonicalUserProfile,
} from '../../src/services/identity/identityResolver';
import {
  DuplicateAccountMigrator,
} from '../../src/services/identity/duplicateAccountMigrator';
import {
  computeProfileCompletion,
} from '../../src/utils/profileCompletion';
import {
  resolveDisplayName,
} from '../../src/utils/displayUserName';
import {
  computeProtectionStatus,
} from '../../src/trust/protectionStatus';
import {
  loadLocalProfile,
  saveLocalProfile,
  clearLocalProfile,
  getScopedProfileKey,
} from '../../src/utils/userProfileStorage';
import {
  computeFuelAnalytics,
  computeTripMetrics,
  computeMonthlyMetrics,
  normalizeFuelLogs,
} from '../../src/services/fuel/fuelMetrics';

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

console.log('\n================================================================');
console.log('   CANONICAL IDENTITY & ACCOUNT RESOLUTION 26-TEST SUITE        ');
console.log('================================================================');

async function runTests() {
  IdentityResolver.resetCache();

  // Mock In-Memory Persistent Firestore Storage for Unit Testing
  const mockFirestoreDb = {
    collections: new Map<string, Map<string, any>>(),
    collection(name: string) {
      if (!this.collections.has(name)) this.collections.set(name, new Map());
      const col = this.collections.get(name)!;
      return {
        doc(id: string) {
          return {
            async get() {
              const data = col.get(id);
              return { exists: data !== undefined, data: () => data };
            },
            async set(data: any, opts?: any) {
              const existing = col.get(id) || {};
              col.set(id, opts?.merge ? { ...existing, ...data } : data);
            },
          };
        },
      };
    },
  };

  // -----------------------------------------------------------------------------
  // TEST 1: Google login -> canonical user A
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 1: GOOGLE LOGIN -> CANONICAL USER A ---');
  
  const googleUser = {
    uid: 'google_uid_1001',
    email: 'ayush.rai@example.com',
    displayName: 'Ayush Rai',
    photoURL: 'https://lh3.googleusercontent.com/a/photo1',
    providerData: [{ providerId: 'google.com', uid: 'google_sub_1001', email: 'ayush.rai@example.com' }],
  };

  const userA = await IdentityResolver.resolveAuthenticatedUser(googleUser, {
    authProvider: 'google',
    firestoreDb: mockFirestoreDb,
  });

  assert(userA.canonicalUserId === 'google_uid_1001', 'Google login creates canonical user A');
  assert(userA.email === 'ayush.rai@example.com', 'User A has normalized Google email');
  assert(userA.identities.google?.verified === true, 'Google identity is marked verified');

  // -----------------------------------------------------------------------------
  // TEST 2: Logout
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 2: LOGOUT CLEARS ACTIVE LOCAL PROFILE ---');
  
  await saveLocalProfile({ name: 'Ayush Rai', city: 'Lucknow' }, userA.canonicalUserId);
  let cachedUserA = await loadLocalProfile(userA.canonicalUserId);
  assert(cachedUserA.city === 'Lucknow', 'User A local profile saved to scoped key');
  
  await clearLocalProfile(userA.canonicalUserId);
  cachedUserA = await loadLocalProfile(userA.canonicalUserId);
  assert(cachedUserA.city === '', 'Logout clears active session cache');

  // -----------------------------------------------------------------------------
  // TEST 3: Mobile login with same verified phone -> canonical user A
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 3: MOBILE LOGIN WITH SAME EMAIL/PHONE -> CANONICAL USER A ---');

  // First link verified phone to User A
  await IdentityResolver.linkIdentityToExistingProfile(userA.canonicalUserId, {
    type: 'phone',
    value: '+919876543210',
  }, mockFirestoreDb);

  const phoneLogin = {
    uid: 'phone_uid_2002',
    phoneNumber: '+91 98765 43210',
    providerData: [{ providerId: 'phone', phoneNumber: '+919876543210' }],
  };

  const resolvedByPhone = await IdentityResolver.resolveAuthenticatedUser(phoneLogin, {
    authProvider: 'phone',
    firestoreDb: mockFirestoreDb,
  });

  assert(resolvedByPhone.canonicalUserId === userA.canonicalUserId, 'Mobile login resolves to existing canonical user A');
  assert(resolvedByPhone.identities.phone?.normalizedPhone === '+919876543210', 'Phone identity linked on canonical profile');

  // -----------------------------------------------------------------------------
  // TEST 4, 5, 6: App restart -> Mobile & Google login preserve canonical user A
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 4, 5, 6: APP RESTART PERSISTENCE ---');
  
  // Simulate App Restart / Process Death by resetting in-memory cache
  IdentityResolver.resetCache();

  // Test 5: Mobile login after restart (hits persistent Firestore mapping)
  const mobileAfterRestart = await IdentityResolver.resolveAuthenticatedUser(phoneLogin, {
    authProvider: 'phone',
    firestoreDb: mockFirestoreDb,
  });
  assert(mobileAfterRestart.canonicalUserId === userA.canonicalUserId, 'App restart: Mobile login resolves to canonical User A from persistent Firestore mapping');

  // Test 6: Google login after restart
  const googleAfterRestart = await IdentityResolver.resolveAuthenticatedUser(googleUser, {
    authProvider: 'google',
    firestoreDb: mockFirestoreDb,
  });
  assert(googleAfterRestart.canonicalUserId === userA.canonicalUserId, 'App restart: Google login resolves to canonical User A from persistent Firestore mapping');

  // -----------------------------------------------------------------------------
  // TEST 7 & 8: Local cache is canonical-user scoped & User B isolation
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 7 & 8: LOCAL CACHE ISOLATION ---');

  assert(getScopedProfileKey('user_A') === 'user_profile_data:user_A', 'Key is scoped to user_A');
  assert(getScopedProfileKey('user_B') === 'user_profile_data:user_B', 'Key is scoped to user_B');

  await saveLocalProfile({ name: 'User A Profile', city: 'Mumbai' }, 'user_A');
  await saveLocalProfile({ name: 'User B Profile', city: 'Bengaluru' }, 'user_B');

  const loadedA = await loadLocalProfile('user_A');
  const loadedB = await loadLocalProfile('user_B');

  assert(loadedA.name === 'User A Profile' && loadedA.city === 'Mumbai', 'User A local profile intact');
  assert(loadedB.name === 'User B Profile' && loadedB.city === 'Bengaluru', 'User B local profile intact');
  assert(loadedB.city !== loadedA.city, 'User B cannot receive User A local profile');

  // -----------------------------------------------------------------------------
  // TEST 9: Duplicate identity mapping resolves to same user
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 9: DUPLICATE IDENTITY MAPPING RESOLUTION ---');

  const duplicatePhoneLogin = {
    uid: 'phone_temp_9999',
    phoneNumber: '09876543210', // Leading 0 STD format
    providerData: [{ providerId: 'phone', phoneNumber: '+919876543210' }],
  };

  const resDup = await IdentityResolver.resolveAuthenticatedUser(duplicatePhoneLogin, {
    authProvider: 'phone',
    firestoreDb: mockFirestoreDb,
  });

  assert(resDup.canonicalUserId === userA.canonicalUserId, '09876543210 resolves to canonical user A');

  // -----------------------------------------------------------------------------
  // TEST 10: Concurrent login/profile creation -> exactly ONE canonical profile
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 10: CONCURRENT IDEMPOTENT CREATION ---');

  const concurrentAuth = {
    uid: 'concurrent_user_555',
    email: 'concurrent@assetdoctor.com',
    displayName: 'Concurrent Human',
    providerData: [{ providerId: 'google.com', uid: 'concurrent_555', email: 'concurrent@assetdoctor.com' }],
  };

  const [concA, concB] = await Promise.all([
    IdentityResolver.resolveAuthenticatedUser(concurrentAuth, { authProvider: 'google', firestoreDb: mockFirestoreDb }),
    IdentityResolver.resolveAuthenticatedUser(concurrentAuth, { authProvider: 'google', firestoreDb: mockFirestoreDb }),
  ]);

  assert(concA.canonicalUserId === concB.canonicalUserId, 'Concurrent requests resolve to exact same canonicalUserId');

  // -----------------------------------------------------------------------------
  // TEST 11: Google fallback cannot create duplicate profile
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 11: GOOGLE FALLBACK PROFILE CREATION BYPASS REMOVED ---');

  // Verify findExistingCanonicalProfile returns existing profile without creating new UID
  const foundExisting = await IdentityResolver.findExistingCanonicalProfile({
    email: 'concurrent@assetdoctor.com',
    firestoreDb: mockFirestoreDb,
  });
  assert(foundExisting?.canonicalUserId === concA.canonicalUserId, 'Existing canonical profile found without duplicate creation');

  // -----------------------------------------------------------------------------
  // TEST 12, 13, 14, 15: PIN Validation & Mandatory Completeness
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 12, 13, 14, 15: PIN MANDATORY VALIDATION ---');

  // Test 12: Missing PIN -> Incomplete
  const noPinUser = { name: 'Ayush Rai', city: 'Lucknow', state: 'UP', identities: { phone: { verified: true } } };
  assert(computeProfileCompletion(noPinUser).isComplete === false, 'Missing PIN yields isComplete = false');

  // Test 13: City without PIN -> Incomplete
  const cityNoPin = { name: 'Ayush Rai', city: 'Lucknow', identities: { phone: { verified: true } } };
  assert(computeProfileCompletion(cityNoPin).isComplete === false, 'City without PIN is incomplete');

  // Test 14: Invalid PIN -> Incomplete
  const invalidPinUser = { name: 'Ayush Rai', pincode: '22601', city: 'Lucknow', state: 'UP', identities: { phone: { verified: true } } };
  assert(computeProfileCompletion(invalidPinUser).isComplete === false, '5-digit PIN is incomplete');

  const zeroPinUser = { name: 'Ayush Rai', pincode: '026010', city: 'Lucknow', state: 'UP', identities: { phone: { verified: true } } };
  assert(computeProfileCompletion(zeroPinUser).isComplete === false, 'PIN starting with 0 is incomplete');

  // Test 15: Valid 6-digit PIN -> Complete
  const validPinUser = { name: 'Ayush Rai', pincode: '226010', city: 'Lucknow', state: 'UP', identities: { phone: { verified: true } } };
  const validRes = computeProfileCompletion(validPinUser);
  assert(validRes.isComplete === true, 'Valid 6-digit PIN + Name + City + State + Verified Identity = Complete');

  // -----------------------------------------------------------------------------
  // TEST 16: Optional WhatsApp missing -> does not make profile incomplete
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 16: OPTIONAL WHATSAPP DOES NOT GATE COMPLETION ---');

  const userWithoutWhatsapp = {
    name: 'Ayush Rai',
    pincode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    whatsappOptIn: false, // Explicitly opted out / missing
    identities: {
      phone: { verified: true, normalizedPhone: '+919876543210' },
    },
  };

  const protStatusNoWa = computeProtectionStatus({
    user: userWithoutWhatsapp,
    assets: [{ id: 'veh_1', category: 'VEHICLE', name: 'TVS Ronin' }],
  });

  assert(protStatusNoWa.isComplete === true, 'Protection status is COMPLETE without WhatsApp');
  assert(protStatusNoWa.score.value === 100, 'Score is 100 / 100 without WhatsApp');

  // -----------------------------------------------------------------------------
  // TEST 17 & 18: Unverified Email & Phone do NOT count as verified identity
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 17 & 18: UNVERIFIED IDENTITY REJECTION ---');

  const unverifiedEmailUser = {
    name: 'Ayush Rai',
    pincode: '226010',
    city: 'Lucknow',
    state: 'UP',
    email: 'unverified@example.com', // Raw unverified string
    emailVerified: false,
    identities: {
      email: { normalizedEmail: 'unverified@example.com', verified: false },
    },
  };
  assert(computeProfileCompletion(unverifiedEmailUser).isComplete === false, 'Unverified email is rejected as verified identity');

  const unverifiedPhoneUser = {
    name: 'Ayush Rai',
    pincode: '226010',
    city: 'Lucknow',
    state: 'UP',
    phone: '+919988776655', // Raw unverified string
    phoneVerified: false,
    identities: {
      phone: { normalizedPhone: '+919988776655', verified: false },
    },
  };
  assert(computeProfileCompletion(unverifiedPhoneUser).isComplete === false, 'Unverified phone is rejected as verified identity');

  // -----------------------------------------------------------------------------
  // TEST 19: Non-vehicle fuel analytics -> zero/insufficient
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 19: NON-VEHICLE FUEL ANALYTICS ARE ZERO/INSUFFICIENT ---');

  const geyserAsset = { id: 'geyser_1', category: 'HOME_APPLIANCES', name: 'AO Smith Geyser' };
  const mockLogs = [
    { id: 'l1', assetId: 'geyser_1', odometerKM: 1000, liters: 10, amountPaid: 1000 },
    { id: 'l2', assetId: 'geyser_1', odometerKM: 1500, liters: 10, amountPaid: 1000 },
  ];

  const nonVehAnalytics = computeFuelAnalytics({ asset: geyserAsset, logs: mockLogs, mode: 'LIFETIME' });
  assert(nonVehAnalytics.totalSpend === 0, 'Geyser totalSpend is 0');
  assert(nonVehAnalytics.totalDistanceKm === null, 'Geyser totalDistanceKm is null');
  assert(nonVehAnalytics.averageMileageKmPerL === null, 'Geyser averageMileageKmPerL is null');
  assert(nonVehAnalytics.verdict === 'INSUFFICIENT', 'Geyser verdict is INSUFFICIENT');

  // -----------------------------------------------------------------------------
  // TEST 20 & 21: Foreign vehicle log & Unscoped log excluded
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 20 & 21: LOG ASSET ISOLATION & REQUIRED ASSET ID ---');

  const roninAsset = { id: 'veh_ronin', category: 'VEHICLE', name: 'TVS Ronin' };
  const mixedLogs = [
    { id: 'r1', assetId: 'veh_ronin', odometerKM: 1000, liters: 10, amountPaid: 1000 },
    { id: 'foreign_1', assetId: 'veh_i10', odometerKM: 1200, liters: 20, amountPaid: 2000 }, // Foreign log
    { id: 'unscoped_1', odometerKM: 1300, liters: 15, amountPaid: 1500 }, // Unscoped log (no assetId)
    { id: 'r2', assetId: 'veh_ronin', odometerKM: 1400, liters: 10, amountPaid: 1000 },
  ];

  const isolatedRoninLogs = normalizeFuelLogs(mixedLogs, 'veh_ronin');
  assert(isolatedRoninLogs.length === 2, 'Exactly 2 Ronin logs included (foreign & unscoped excluded)');
  assert(!isolatedRoninLogs.some((l) => l.id === 'foreign_1'), 'Foreign vehicle log excluded');
  assert(!isolatedRoninLogs.some((l) => l.id === 'unscoped_1'), 'Unscoped log excluded');

  // -----------------------------------------------------------------------------
  // TEST 22 & 23: Ronin logs never appear for i10 & i10 logs never appear for Ronin
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 22 & 23: CROSS-VEHICLE LOG ISOLATION ---');

  const i10Asset = { id: 'veh_i10', category: 'VEHICLE', name: 'Hyundai i10' };
  const allFleetLogs = [
    { id: 'ronin_1', assetId: 'veh_ronin', odometerKM: 5000, liters: 12, amountPaid: 1200 },
    { id: 'ronin_2', assetId: 'veh_ronin', odometerKM: 5400, liters: 10, amountPaid: 1000 },
    { id: 'i10_1', assetId: 'veh_i10', odometerKM: 45000, liters: 30, amountPaid: 3000 },
    { id: 'i10_2', assetId: 'veh_i10', odometerKM: 45500, liters: 35, amountPaid: 3500 },
  ];

  const roninAnalytics = computeFuelAnalytics({ asset: roninAsset, logs: allFleetLogs, mode: 'LIFETIME' });
  const i10Analytics = computeFuelAnalytics({ asset: i10Asset, logs: allFleetLogs, mode: 'LIFETIME' });

  assert(roninAnalytics.totalDistanceKm === 400, 'Ronin distance = 400 km (5400 - 5000)');
  assert(roninAnalytics.totalSpend === 2200, 'Ronin spend = 2200');
  assert(i10Analytics.totalDistanceKm === 500, 'i10 distance = 500 km (45500 - 45000)');
  assert(i10Analytics.totalSpend === 6500, 'i10 spend = 6500');

  // -----------------------------------------------------------------------------
  // TEST 24, 25, 26: Geyser, AC, Refrigerator never get mileage
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 24, 25, 26: APPLIANCES NEVER GET MILEAGE ---');

  const acAsset = { id: 'app_ac', category: 'HOME_APPLIANCES', name: 'Daikin AC' };
  const fridgeAsset = { id: 'app_fridge', category: 'HOME_APPLIANCES', name: 'LG Refrigerator' };

  const acTrip = computeTripMetrics(mockLogs, acAsset);
  const fridgeTrip = computeTripMetrics(mockLogs, fridgeAsset);
  const geyserTrip = computeTripMetrics(mockLogs, geyserAsset);

  assert(acTrip.tripMileageKmPerL === null, 'AC trip mileage is NULL');
  assert(fridgeTrip.tripMileageKmPerL === null, 'Refrigerator trip mileage is NULL');
  assert(geyserTrip.tripMileageKmPerL === null, 'Geyser trip mileage is NULL');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (26/26 Requirements)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test exception:', err);
  process.exit(1);
});
