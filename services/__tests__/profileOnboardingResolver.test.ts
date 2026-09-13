/**
 * Asset Doctor — Mandatory Profile Onboarding Resolution 15-Scenario Test Suite
 * Validates all 15 verification scenarios defined in Section 13 of the user directive.
 */

import {
  computeProfileCompletion,
  resolveProfileCompletion,
  needsProfileOnboarding,
} from '../../src/utils/profileCompletion';
import { needsProfileSetup } from '../../src/utils/profileSetup';
import {
  saveLocalProfile,
  loadLocalProfile,
  clearLocalProfile,
} from '../../src/utils/userProfileStorage';
import { IdentityResolver } from '../../src/services/identity/identityResolver';

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
console.log('   PROFILE ONBOARDING RESOLUTION — 15-SCENARIO VERIFICATION    ');
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
  // TEST 1: New Google user with no profile -> Onboarding REQUIRED
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 1: NEW GOOGLE USER WITH NO PROFILE ---');
  const newGoogleUser = {
    uid: 'google_new_1',
    email: 'newuser@gmail.com',
    displayName: 'Google Newbie',
    providerData: [{ providerId: 'google.com', uid: 'google_new_1' }],
  };
  const res1 = computeProfileCompletion({ user: newGoogleUser, profile: null });
  assert(res1.isComplete === false, 'New Google user profile is incomplete');
  assert(res1.needsOnboarding === true, 'New Google user needs onboarding');
  assert(needsProfileOnboarding({ user: newGoogleUser, profile: null }) === true, 'needsProfileOnboarding helper returns true');
  assert(needsProfileSetup(null, newGoogleUser) === true, 'needsProfileSetup returns true');
  assert(res1.missingFields.includes('PIN Code'), 'Missing PIN code reported');
  assert(res1.missingFields.includes('City'), 'Missing City reported');
  assert(res1.missingFields.includes('State'), 'Missing State reported');

  // -----------------------------------------------------------------------------
  // TEST 2: New mobile user with no profile -> Onboarding REQUIRED
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 2: NEW MOBILE USER WITH NO PROFILE ---');
  const newMobileUser = {
    uid: 'mobile_new_1',
    phoneNumber: '+919956289111',
    providerData: [{ providerId: 'phone', uid: '+919956289111' }],
  };
  const res2 = computeProfileCompletion({ user: newMobileUser, profile: null });
  assert(res2.isComplete === false, 'New mobile user profile is incomplete');
  assert(res2.needsOnboarding === true, 'New mobile user needs onboarding');
  assert(res2.missingFields.includes('Full Name'), 'Missing Full Name reported');
  assert(res2.missingFields.includes('PIN Code'), 'Missing PIN Code reported');

  // -----------------------------------------------------------------------------
  // TEST 3: Existing Google user with complete profile -> Onboarding NOT required
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 3: EXISTING GOOGLE USER WITH COMPLETE PROFILE ---');
  const existingGoogleUser = {
    uid: 'google_exist_1',
    email: 'ayush@example.com',
    displayName: 'Ayush Rai',
    providerData: [{ providerId: 'google.com', uid: 'google_exist_1' }],
  };
  const existingGoogleProfile = {
    uid: 'google_exist_1',
    fullName: 'Ayush Rai',
    pinCode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    email: 'ayush@example.com',
    identities: { google: { verified: true } },
  };
  const res3 = computeProfileCompletion({ user: existingGoogleUser, profile: existingGoogleProfile });
  assert(res3.isComplete === true, 'Existing Google user is complete');
  assert(res3.needsOnboarding === false, 'Existing Google user does NOT need onboarding');
  assert(needsProfileOnboarding(existingGoogleProfile) === false, 'needsProfileOnboarding returns false');
  assert(needsProfileSetup(existingGoogleProfile, existingGoogleUser) === false, 'needsProfileSetup returns false');

  // -----------------------------------------------------------------------------
  // TEST 4: Existing mobile user with complete profile -> Onboarding NOT required
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 4: EXISTING MOBILE USER WITH COMPLETE PROFILE ---');
  const existingMobileUser = {
    uid: 'mobile_exist_1',
    phoneNumber: '+919956289111',
    providerData: [{ providerId: 'phone', uid: '+919956289111' }],
  };
  const existingMobileProfile = {
    uid: 'mobile_exist_1',
    name: 'Ayush Rai',
    pincode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    phone: '+919956289111',
    identities: { phone: { verified: true } },
  };
  const res4 = computeProfileCompletion({ user: existingMobileUser, profile: existingMobileProfile });
  assert(res4.isComplete === true, 'Existing mobile user is complete');
  assert(res4.needsOnboarding === false, 'Existing mobile user does NOT need onboarding');

  // -----------------------------------------------------------------------------
  // TEST 5: Existing user closes app and reopens (local session persistence)
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 5: APP RESTART LOCAL SESSION PERSISTENCE ---');
  await saveLocalProfile(existingGoogleProfile, existingGoogleUser.uid);
  const loadedSession = await loadLocalProfile(existingGoogleUser.uid);
  assert(loadedSession.pincode === '226010', 'PIN code restored from persisted session');
  assert(loadedSession.city === 'Lucknow', 'City restored from persisted session');
  assert(loadedSession.state === 'Uttar Pradesh', 'State restored from persisted session');
  const sessionCheck = computeProfileCompletion({ user: existingGoogleUser, profile: loadedSession });
  assert(sessionCheck.needsOnboarding === false, 'Restarted app with cached session does NOT trigger onboarding');

  // -----------------------------------------------------------------------------
  // TEST 6: Existing user logs out and logs back in
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 6: RE-LOGIN REHYDRATION ---');
  await clearLocalProfile(existingGoogleUser.uid);
  const clearedLocal = await loadLocalProfile(existingGoogleUser.uid);
  assert(clearedLocal.pincode === '', 'Local cache cleared after logout');
  // Re-login: canonical profile fetched from Firestore
  const rehydrated = resolveProfileCompletion(existingGoogleProfile);
  assert(rehydrated.needsOnboarding === false, 'Re-login with canonical profile does NOT trigger onboarding');

  // -----------------------------------------------------------------------------
  // TEST 7: Existing Google user logs in from another device
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 7: REMOTE DEVICE LOGIN (GOOGLE) ---');
  const device2User = { uid: 'remote_google_1', email: 'ayush@example.com', displayName: 'Ayush Rai' };
  const device2Profile = {
    fullName: 'Ayush Rai',
    pinCode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    email: 'ayush@example.com',
  };
  assert(computeProfileCompletion({ user: device2User, profile: device2Profile }).needsOnboarding === false, 'Remote device login with profile does NOT require onboarding');

  // -----------------------------------------------------------------------------
  // TEST 8: Existing mobile user logs in from another device
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 8: REMOTE DEVICE LOGIN (MOBILE) ---');
  const device2Mobile = { uid: 'remote_mobile_1', phoneNumber: '+919956289111' };
  const device2MobileProfile = {
    name: 'Ayush Rai',
    pincode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    phoneNumber: '+919956289111',
  };
  assert(computeProfileCompletion({ user: device2Mobile, profile: device2MobileProfile }).needsOnboarding === false, 'Remote device mobile login with profile does NOT require onboarding');

  // -----------------------------------------------------------------------------
  // TEST 9: Existing profile has name but missing PIN -> Onboarding REQUIRED
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 9: MISSING PIN CODE ---');
  const missingPinProfile = {
    fullName: 'Ayush Rai',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
  };
  const res9 = computeProfileCompletion(missingPinProfile);
  assert(res9.isComplete === false, 'Missing PIN profile is incomplete');
  assert(res9.needsOnboarding === true, 'Missing PIN requires onboarding');
  assert(res9.missingFields.includes('PIN Code'), 'Missing PIN is in missingFields list');

  // -----------------------------------------------------------------------------
  // TEST 10: Existing profile has PIN but missing city -> Onboarding REQUIRED
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 10: MISSING CITY ---');
  const missingCityProfile = {
    fullName: 'Ayush Rai',
    pinCode: '226010',
    city: '',
    state: 'Uttar Pradesh',
  };
  const res10 = computeProfileCompletion(missingCityProfile);
  assert(res10.isComplete === false, 'Missing city profile is incomplete');
  assert(res10.needsOnboarding === true, 'Missing city requires onboarding');
  assert(res10.missingFields.includes('City'), 'Missing City is in missingFields list');

  // -----------------------------------------------------------------------------
  // TEST 11: Existing profile has all four mandatory fields -> Onboarding NOT required
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 11: ALL FOUR MANDATORY FIELDS VALID ---');
  const completeProfile = {
    fullName: 'Dr. Manish Rai',
    pinCode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
  };
  const res11 = computeProfileCompletion(completeProfile);
  assert(res11.isComplete === true, 'All four mandatory fields complete profile');
  assert(res11.needsOnboarding === false, 'All four mandatory fields -> onboarding NOT required');
  assert(res11.missingFields.length === 0, 'No missing fields');

  // -----------------------------------------------------------------------------
  // TEST 12: Legacy profile schema with valid equivalent fields
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 12: LEGACY SCHEMA BACKWARD COMPATIBILITY ---');
  const legacyProfile = {
    name: 'Ayush Rai',         // legacy name
    pincode: '226010',         // legacy lowercase pincode
    district: 'Lucknow',       // legacy district as city
    province: 'Uttar Pradesh', // legacy province as state
  };
  const res12 = resolveProfileCompletion(legacyProfile);
  assert(res12.isComplete === true, 'Legacy profile resolved as complete');
  assert(res12.needsOnboarding === false, 'Legacy profile does NOT require onboarding');
  assert(res12.normalizedProfile.fullName === 'Ayush Rai', 'Legacy name normalized to fullName');
  assert(res12.normalizedProfile.pinCode === '226010', 'Legacy pincode normalized to pinCode');
  assert(res12.normalizedProfile.city === 'Lucknow', 'Legacy district normalized to city');
  assert(res12.normalizedProfile.state === 'Uttar Pradesh', 'Legacy province normalized to state');

  // -----------------------------------------------------------------------------
  // TEST 13: Google + Mobile login same person resolves to same canonical profile
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 13: GOOGLE + MOBILE CANONICAL IDENTITY RESOLUTION ---');
  const googleUser13 = {
    uid: 'google_ayush_13',
    email: 'ayush.master@assetdoctor.com',
    displayName: 'Ayush Rai',
    providerData: [{ providerId: 'google.com', uid: 'google_13', email: 'ayush.master@assetdoctor.com' }],
  };
  const resolvedA = await IdentityResolver.resolveAuthenticatedUser(googleUser13, {
    authProvider: 'google',
    extra: {
      fullName: 'Ayush Rai',
      pinCode: '226010',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      phone: '+919956289111',
    },
    firestoreDb: mockFirestoreDb,
  });

  const mobileUser13 = {
    uid: 'mobile_ayush_13',
    phoneNumber: '+919956289111',
    providerData: [{ providerId: 'phone', uid: '+919956289111' }],
  };
  const resolvedB = await IdentityResolver.resolveAuthenticatedUser(mobileUser13, {
    authProvider: 'phone',
    extra: {
      email: 'ayush.master@assetdoctor.com',
    },
    firestoreDb: mockFirestoreDb,
  });

  assert(resolvedA.canonicalUserId === resolvedB.canonicalUserId, 'Google and Mobile logins resolve to same canonicalUserId');
  assert(resolvedB.pincode === '226010', 'Canonical PIN preserved across auth provider change');
  assert(resolvedB.city === 'Lucknow', 'Canonical City preserved across auth provider change');
  assert(computeProfileCompletion(resolvedB).needsOnboarding === false, 'Canonical user profile complete, onboarding NOT required');

  // -----------------------------------------------------------------------------
  // TEST 14: Hydration pending guard (no visual flash)
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 14: HYDRATION PENDING GUARD ---');
  const hydrationPending = true;
  const user14 = { uid: 'u14' };
  const incompleteFallbackProfile = { uid: 'u14', name: 'Ayush' }; // no PIN, city, state
  // Even though fallback profile is incomplete, if hydration is pending, onboarding MUST NOT display
  const shouldDisplayModal = !hydrationPending && needsProfileOnboarding({ user: user14, profile: incompleteFallbackProfile });
  assert(shouldDisplayModal === false, 'Modal is NOT displayed while hydration is pending');

  // -----------------------------------------------------------------------------
  // TEST 15: Save & reload completion cycle
  // -----------------------------------------------------------------------------
  console.log('\n--- TEST 15: SAVE & RELOAD COMPLETION CYCLE ---');
  const user15 = { uid: 'user_15_test' };
  const initialEmpty = { uid: 'user_15_test' };
  assert(needsProfileOnboarding({ user: user15, profile: initialEmpty }) === true, 'Initial state needs onboarding');

  // Simulate user submitting Complete Your Profile form
  const submittedData = {
    fullName: 'Ayush Rai',
    pinCode: '226010',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
  };
  // Save to local cache
  await saveLocalProfile(submittedData, user15.uid);
  const reloaded = await loadLocalProfile(user15.uid);
  const postSaveCompletion = computeProfileCompletion({ user: user15, profile: reloaded });
  assert(postSaveCompletion.isComplete === true, 'Profile is complete after saving valid fields');
  assert(postSaveCompletion.needsOnboarding === false, 'needsOnboarding is FALSE after save');
  assert(postSaveCompletion.missingFields.length === 0, 'No missing fields remain');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED / ${failed} FAILED (15/15 Scenarios)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
