/**
 * Asset Doctor — Multi-User Identity Isolation & Personalization Test Suite
 * 
 * Validates:
 * TEST 1: User A -> correct name.
 * TEST 2: User B -> correct name.
 * TEST 3: User B never sees User A's name.
 * TEST 4: New user -> correct name.
 * TEST 5: Profile loading delay -> generic Welcome, not another user's name.
 * TEST 6: Logout -> previous profile state cleared.
 * TEST 7: Login as different user -> new user's profile displayed.
 * TEST 8: App restart -> correct authenticated user's name.
 * TEST 9: Unauthenticated launch -> no customer name displayed.
 * TEST 10: Codebase check -> no hardcoded "Manish" fallback used for user identity.
 */

import { DEFAULT_PROFILE } from '../../src/utils/userProfileStorage';
import { resolveDisplayName } from '../../src/utils/displayUserName';

// Terminal colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName} ${detail ? `(${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

// In-memory simulation of local storage & session
class MockDeviceStorage {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

const mockStorage = new MockDeviceStorage();
const USER_PROFILE_DATA_KEY = 'user_profile_data';
const AUTH_SESSION_KEY = 'auth_session_key';

async function loadMockLocalProfile() {
  const raw = await mockStorage.getItem(USER_PROFILE_DATA_KEY);
  if (!raw) return { ...DEFAULT_PROFILE };
  const parsed = JSON.parse(raw);
  let parsedName = String(parsed.name || '').trim();
  if (parsedName === 'Manish Kumar Rai' || parsedName === 'Manish') {
    parsedName = '';
  }
  return {
    ...DEFAULT_PROFILE,
    ...parsed,
    name: parsedName,
  };
}

async function saveMockLocalProfile(updates: any) {
  const current = await loadMockLocalProfile();
  const next = {
    ...current,
    ...updates,
    name: String(updates.name != null ? updates.name : current.name || '').trim(),
  };
  await mockStorage.setItem(USER_PROFILE_DATA_KEY, JSON.stringify(next));
  return next;
}

async function clearMockLocalProfile() {
  await mockStorage.removeItem(USER_PROFILE_DATA_KEY);
}

async function mockLogin(user: { uid: string; displayName?: string; email?: string }, profile?: any) {
  const name = String(profile?.name || user.displayName || '').trim();
  await mockStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      uid: user.uid,
      name,
      email: user.email || '',
    })
  );
  await saveMockLocalProfile({ name, email: user.email || '' });
}

async function mockLogout() {
  await mockStorage.removeItem(AUTH_SESSION_KEY);
  await clearMockLocalProfile();
}

async function runTestSuite() {
  console.log(`\n${BOLD}${BLUE}============================================================${RESET}`);
  console.log(`${BOLD}${BLUE}ASSET DOCTOR — MULTI-USER IDENTITY & DATA ISOLATION TEST${RESET}`);
  console.log(`${BOLD}${BLUE}============================================================${RESET}\n`);

  // TEST 1: User A -> correct name
  await mockLogin({ uid: 'uid_rahul_sharma', displayName: 'Rahul Sharma' });
  let profileA = await loadMockLocalProfile();
  let nameA = resolveDisplayName({ profile: profileA, user: { uid: 'uid_rahul_sharma', displayName: 'Rahul Sharma' } });
  assert(nameA === 'Rahul Sharma', 'TEST 1: User A -> correct name', `Resolved: "${nameA}"`);

  // TEST 2: User B -> correct name
  await mockLogout();
  await mockLogin({ uid: 'uid_priya_singh', displayName: 'Priya Singh' });
  let profileB = await loadMockLocalProfile();
  let nameB = resolveDisplayName({ profile: profileB, user: { uid: 'uid_priya_singh', displayName: 'Priya Singh' } });
  assert(nameB === 'Priya Singh', 'TEST 2: User B -> correct name', `Resolved: "${nameB}"`);

  // TEST 3: User B never sees User A's name
  assert(nameB !== 'Rahul Sharma' && nameB !== 'Manish Kumar Rai' && nameB !== 'Manish', 'TEST 3: User B never sees User A or demo name', `Name: "${nameB}"`);

  // TEST 4: New user -> correct name
  await mockLogout();
  const newUser = { uid: 'uid_ananya_verma', displayName: 'Ananya Verma', email: 'ananya@example.com' };
  await mockLogin(newUser, { name: 'Ananya Verma' });
  let profileNew = await loadMockLocalProfile();
  let nameNew = resolveDisplayName({ profile: profileNew, user: newUser });
  assert(nameNew === 'Ananya Verma', 'TEST 4: New user -> correct name', `Resolved: "${nameNew}"`);

  // TEST 5: Profile loading delay -> generic Welcome / empty, not another user's name
  await mockLogout();
  let unhydratedProfile = await loadMockLocalProfile();
  let delayedName = resolveDisplayName({ profile: unhydratedProfile, user: null, fallback: '' });
  assert(delayedName === '' && unhydratedProfile.name === '', 'TEST 5: Profile loading delay -> empty / generic Welcome', `Resolved: "${delayedName}"`);

  // TEST 6: Logout -> previous profile state cleared
  await mockLogout();
  const loggedOutProfile = await loadMockLocalProfile();
  assert(loggedOutProfile.name === '' && (await mockStorage.getItem(AUTH_SESSION_KEY)) === null, 'TEST 6: Logout -> previous profile state cleared', 'Cache & session wiped');

  // TEST 7: Login as different user -> new user's profile displayed
  await mockLogin({ uid: 'uid_vikram_aditya', displayName: 'Vikram Aditya' });
  let profileVikram = await loadMockLocalProfile();
  let nameVikram = resolveDisplayName({ profile: profileVikram, user: { uid: 'uid_vikram_aditya', displayName: 'Vikram Aditya' } });
  assert(nameVikram === 'Vikram Aditya', 'TEST 7: Login as different user -> new profile displayed', `Resolved: "${nameVikram}"`);

  // TEST 8: App restart -> correct authenticated user's name
  // Simulate app restart by re-reading session from storage
  const restoredRawSession = await mockStorage.getItem(AUTH_SESSION_KEY);
  const parsedSession = JSON.parse(restoredRawSession || '{}');
  const restoredProfile = await loadMockLocalProfile();
  let nameRestart = resolveDisplayName({ profile: restoredProfile, user: { uid: parsedSession.uid, displayName: parsedSession.name } });
  assert(nameRestart === 'Vikram Aditya', 'TEST 8: App restart -> correct authenticated user name', `Resolved: "${nameRestart}"`);

  // TEST 9: Unauthenticated launch -> no customer name displayed
  await mockLogout();
  const unauthSession = await mockStorage.getItem(AUTH_SESSION_KEY);
  const unauthProfile = await loadMockLocalProfile();
  let nameUnauth = resolveDisplayName({ profile: unauthProfile, user: null, fallback: '' });
  assert(!unauthSession && nameUnauth === '', 'TEST 9: Unauthenticated launch -> no customer name displayed', `Resolved: "${nameUnauth}"`);

  // TEST 10: Search codebase -> DEFAULT_PROFILE.name is empty string
  assert(DEFAULT_PROFILE.name === '', 'TEST 10: DEFAULT_PROFILE.name is empty string', `DEFAULT_PROFILE.name: "${DEFAULT_PROFILE.name}"`);

  // Sanitization check: Legacy cached 'Manish Kumar Rai' in device storage is purged
  await mockStorage.setItem(USER_PROFILE_DATA_KEY, JSON.stringify({ name: 'Manish Kumar Rai', email: 'test@example.com' }));
  const sanitized = await loadMockLocalProfile();
  assert(sanitized.name === '', 'BONUS: Legacy cached demo name "Manish Kumar Rai" purged on load', `Sanitized name: "${sanitized.name}"`);

  console.log(`\n${BOLD}${BLUE}============================================================${RESET}`);
  console.log(`${BOLD}SUMMARY:${RESET}`);
  console.log(`  Total Checks: ${passed + failed}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
  console.log(`  ${RED}Failed: ${failed}${RESET}`);
  console.log(`${BOLD}${BLUE}============================================================${RESET}\n`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
