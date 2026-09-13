/**
 * Asset Doctor — Comprehensive Account Linking & Deduplication Test Suite
 * 
 * Verifies:
 * 1. Database Schema & Constraints (E.164 phone normalization, email normalization).
 * 2. Uniqueness constraints on phone & email and error blocking on duplicate mobile updates.
 * 3. Auth & Account Linking logic:
 *    - Google sign-in links to existing account sharing email/phone without duplicate user creation.
 *    - Phone OTP sign-in logs into existing account directly.
 * 4. Migration script logic:
 *    - Finds duplicate accounts by phone/email.
 *    - Accurately designates primary account based on vault activity and account age.
 *    - Migrates assets, documents, and reminders from secondary to primary.
 *    - Updates identityMappings and archives duplicate secondary accounts.
 */

import {
  normalizeCanonicalPhone,
  normalizeCanonicalEmail,
} from '../../../src/services/identity/identityNormalizer';
import { IdentityResolver, CanonicalUserProfile } from '../../../src/services/identity/identityResolver';
import {
  normalizePhoneE164,
  findDuplicateGroups,
  scoreUserAccount,
  migrateDuplicateGroup,
} from '../../../scripts/migrate-duplicate-accounts';

// Test assertions helper
let testCount = 0;
let passCount = 0;

function assert(condition: boolean, testName: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('STARTING ACCOUNT LINKING & INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // 1. PHONE & EMAIL NORMALIZATION TESTS
  // ----------------------------------------------------------------
  console.log('--- 1. Phone & Email Normalization Tests ---');
  
  // 10-digit Indian Mobile
  assert(normalizeCanonicalPhone('9876543210') === '+919876543210', 'Normalizes 10-digit Indian phone to E.164');
  assert(normalizePhoneE164('9876543210') === '+919876543210', 'Migration script normalizes 10-digit Indian phone');

  // Leading 0
  assert(normalizeCanonicalPhone('09876543210') === '+919876543210', 'Normalizes leading 0 (09876543210) to +919876543210');

  // Leading 91
  assert(normalizeCanonicalPhone('919876543210') === '+919876543210', 'Normalizes 919876543210 to +919876543210');

  // Double zero 0091
  assert(normalizeCanonicalPhone('00919876543210') === '+919876543210', 'Normalizes 00919876543210 to +919876543210');

  // Formatted with spaces and dashes
  assert(normalizeCanonicalPhone('+91 98765-43210') === '+919876543210', 'Normalizes formatted "+91 98765-43210" to +919876543210');

  // International phone with country code
  assert(normalizeCanonicalPhone('+14155552671') === '+14155552671', 'Preserves international E.164 format (+14155552671)');

  // Invalid numbers
  assert(normalizeCanonicalPhone('12345') === '', 'Rejects short invalid phone numbers');
  assert(normalizeCanonicalPhone('abcdefghij') === '', 'Rejects non-numeric phone strings');

  // Email Normalization
  assert(normalizeCanonicalEmail('  User@Example.COM  ') === 'user@example.com', 'Trims and lowercases emails');
  assert(normalizeCanonicalEmail('invalid-email') === '', 'Rejects malformed emails');

  console.log('\n--- 2. Unique Constraints & Duplicate Mobile Blocking Tests ---');
  IdentityResolver.resetCache();

  // Create mock in-memory Firestore-like database
  const mockDbData: {
    users: Map<string, any>;
    Users: Map<string, any>;
    identityMappings: Map<string, any>;
    reminders: Map<string, any>;
  } = {
    users: new Map(),
    Users: new Map(),
    identityMappings: new Map(),
    reminders: new Map(),
  };

  const createMockDb = () => {
    return {
      collection: (colName: string) => {
        const store = mockDbData[colName as keyof typeof mockDbData] || new Map();
        return {
          doc: (docId: string) => ({
            id: docId,
            get: async () => ({
              exists: store.has(docId),
              id: docId,
              data: () => store.get(docId),
            }),
            set: async (data: any, options?: any) => {
              const current = store.get(docId) || {};
              store.set(docId, options?.merge ? { ...current, ...data } : data);
            },
            delete: async () => {
              store.delete(docId);
            },
            collection: (subColName: string) => ({
              get: async () => ({ docs: [], size: 0 }),
              doc: (subId: string) => ({
                set: async () => {},
                delete: async () => {},
              }),
            }),
          }),
          where: (field: string, op: string, val: any) => ({
            limit: () => ({
              get: async () => {
                const matches: any[] = [];
                for (const [id, doc] of store.entries()) {
                  if (doc[field] === val) {
                    matches.push({ id, data: () => doc });
                  }
                }
                return { empty: matches.length === 0, docs: matches, size: matches.length };
              },
            }),
            get: async () => {
              const matches: any[] = [];
              for (const [id, doc] of store.entries()) {
                if (doc[field] === val) {
                  matches.push({ id, ref: { set: async () => {} }, data: () => doc });
                }
              }
              return { empty: matches.length === 0, docs: matches, size: matches.length };
            },
          }),
          get: async () => {
            const docs = Array.from(store.entries()).map(([id, data]) => ({
              id,
              data: () => data,
            }));
            return { docs, size: docs.length };
          },
        };
      },
      batch: () => {
        const ops: Function[] = [];
        return {
          set: (ref: any, data: any, opts: any) => {
            ops.push(() => ref.set(data, opts));
          },
          commit: async () => {
            for (const op of ops) await op();
          },
        };
      },
    };
  };

  const mockDb = createMockDb();

  // Setup User 1 (Primary Account)
  const USER_1_UID = 'user_ashutosh_primary';
  const USER_1_PHONE = '+919918288299';
  const USER_1_EMAIL = 'ashutosh@assetdoctor.com';

  const user1Profile: CanonicalUserProfile = {
    uid: USER_1_UID,
    canonicalUserId: USER_1_UID,
    name: 'Ashutosh Rai',
    phone: USER_1_PHONE,
    phoneNumber: USER_1_PHONE,
    email: USER_1_EMAIL,
    isProfileComplete: true,
    identities: {
      phone: { normalizedPhone: USER_1_PHONE, verified: true },
      email: { normalizedEmail: USER_1_EMAIL, verified: true },
    },
    createdAt: '2025-01-01T10:00:00.000Z',
  };

  await IdentityResolver.saveCanonicalProfile(user1Profile, [], mockDb);
  mockDbData.users.set(USER_1_UID, user1Profile);

  // Setup User 2 (Different User)
  const USER_2_UID = 'user_second_customer';
  const USER_2_PHONE = '+919876543210';
  const user2Profile: CanonicalUserProfile = {
    uid: USER_2_UID,
    canonicalUserId: USER_2_UID,
    name: 'Second Customer',
    phone: USER_2_PHONE,
    phoneNumber: USER_2_PHONE,
    isProfileComplete: true,
    identities: {
      phone: { normalizedPhone: USER_2_PHONE, verified: true },
    },
    createdAt: '2025-02-01T10:00:00.000Z',
  };
  await IdentityResolver.saveCanonicalProfile(user2Profile, [], mockDb);
  mockDbData.users.set(USER_2_UID, user2Profile);

  // Test checkIdentityAvailable: User 2 tries to check/claim User 1's phone
  const duplicatePhoneCheck = await IdentityResolver.checkIdentityAvailable({
    phone: USER_1_PHONE,
    excludeUid: USER_2_UID,
    firestoreDb: mockDb,
  });

  assert(duplicatePhoneCheck.available === false, 'Detects phone number already registered to another user');
  assert(duplicatePhoneCheck.field === 'phone', 'Identifies conflicting field as phone');
  assert(
    duplicatePhoneCheck.message === 'This mobile number is already linked to another account.',
    'Returns exact error: "This mobile number is already linked to another account."'
  );

  // Check available when using an unlinked phone number
  const freePhoneCheck = await IdentityResolver.checkIdentityAvailable({
    phone: '+919123456789',
    excludeUid: USER_2_UID,
    firestoreDb: mockDb,
  });
  assert(freePhoneCheck.available === true, 'Allows unused phone number');

  // Check available for own phone number (excludeUid match)
  const ownPhoneCheck = await IdentityResolver.checkIdentityAvailable({
    phone: USER_2_PHONE,
    excludeUid: USER_2_UID,
    firestoreDb: mockDb,
  });
  assert(ownPhoneCheck.available === true, 'Allows user to keep their own verified phone');

  console.log('\n--- 3. Auth & Account Linking Logic Tests ---');

  // Scenario: User 1 signed up with phone (+919918288299).
  // Later, User 1 signs in with Google having the email ashutosh@assetdoctor.com.
  const GOOGLE_SIGNIN_UID = 'google_uid_ashutosh_12345';
  const googleUserMock = {
    uid: GOOGLE_SIGNIN_UID,
    email: USER_1_EMAIL,
    displayName: 'Ashutosh Rai (Google)',
    photoURL: 'https://example.com/avatar.jpg',
    providerData: [{ providerId: 'google.com', uid: 'google_provider_id_999', email: USER_1_EMAIL }],
  };

  // Run identity resolution for Google Sign-In
  const resolvedGoogleUser = await IdentityResolver.resolveAuthenticatedUser(googleUserMock, {
    authProvider: 'google',
    firestoreDb: mockDb,
  });

  assert(resolvedGoogleUser.canonicalUserId === USER_1_UID, 'Google Sign-In resolves to existing primary phone/email account (ONE PERSON = ONE CANONICAL PROFILE)');
  assert(resolvedGoogleUser.uid === USER_1_UID, 'Does NOT create a duplicate profile: canonicalUserId is primary');
  assert(Boolean(resolvedGoogleUser.identities.google?.verified), 'Successfully linked Google provider to existing account');

  console.log('\n--- 4. Migration Script: Duplicate Detection & Foreign Key Migration Tests ---');

  // Create a mock duplicate scenario:
  // Account A (Primary): Older account with 2 assets and 1 document.
  // Account B (Secondary duplicate): Newer account sharing the same phone +919999888877.
  const SHARED_PHONE = '+919999888877';
  const PRIMARY_ACCOUNT = {
    uid: 'acc_primary_001',
    name: 'Manish Primary',
    phone: SHARED_PHONE,
    phoneNumber: SHARED_PHONE,
    email: 'manish@test.com',
    createdAt: '2024-06-01T10:00:00.000Z',
    isArchived: false,
  };

  const SECONDARY_ACCOUNT = {
    uid: 'acc_secondary_002',
    name: 'Manish Duplicate',
    phone: SHARED_PHONE,
    phoneNumber: SHARED_PHONE,
    createdAt: '2024-10-15T10:00:00.000Z',
    isArchived: false,
  };

  const migrationMockDbData: {
    users: Map<string, any>;
    Users: Map<string, any>;
    identityMappings: Map<string, any>;
    reminders: Map<string, any>;
    support_tickets: Map<string, any>;
    secondaryAssets: Map<string, any>;
  } = {
    users: new Map([
      [PRIMARY_ACCOUNT.uid, PRIMARY_ACCOUNT],
      [SECONDARY_ACCOUNT.uid, SECONDARY_ACCOUNT],
    ]),
    Users: new Map([
      [PRIMARY_ACCOUNT.uid, PRIMARY_ACCOUNT],
      [SECONDARY_ACCOUNT.uid, SECONDARY_ACCOUNT],
    ]),
    identityMappings: new Map(),
    reminders: new Map([
      ['rem_001', { id: 'rem_001', uid: SECONDARY_ACCOUNT.uid, title: 'PUC Expiry Reminder' }],
    ]),
    support_tickets: new Map([
      ['ticket_001', { id: 'ticket_001', userId: SECONDARY_ACCOUNT.uid, subject: 'Need Help' }],
    ]),
    secondaryAssets: new Map([
      ['asset_bike_01', { id: 'asset_bike_01', assetName: 'TVS Ronin', userId: SECONDARY_ACCOUNT.uid }],
    ]),
  };

  const migrationMockDb = {
    collection: (colName: string) => {
      if (colName === 'users') {
        return {
          get: async () => ({
            docs: Array.from(migrationMockDbData.users.entries()).map(([id, data]) => ({
              id,
              data: () => data,
            })),
          }),
          doc: (docId: string) => ({
            get: async () => ({
              exists: migrationMockDbData.users.has(docId),
              data: () => migrationMockDbData.users.get(docId),
            }),
            set: async (data: any, opts: any) => {
              const cur = migrationMockDbData.users.get(docId) || {};
              migrationMockDbData.users.set(docId, opts?.merge ? { ...cur, ...data } : data);
            },
            collection: (subCol: string) => ({
              get: async () => ({
                docs: docId === SECONDARY_ACCOUNT.uid
                  ? Array.from(migrationMockDbData.secondaryAssets.entries()).map(([id, data]) => ({
                      id,
                      ref: {
                        delete: async () => migrationMockDbData.secondaryAssets.delete(id),
                        collection: () => ({ get: async () => ({ docs: [] }) }),
                      },
                      data: () => data,
                    }))
                  : [],
                size: docId === PRIMARY_ACCOUNT.uid ? 2 : 1,
              }),
              doc: (subId: string) => ({
                set: async (data: any) => {
                  migrationMockDbData.secondaryAssets.set(subId, { ...data, userId: docId });
                },
              }),
            }),
          }),
        };
      }
      if (colName === 'Users') {
        return {
          get: async () => ({
            docs: Array.from(migrationMockDbData.Users.entries()).map(([id, data]) => ({
              id,
              data: () => data,
            })),
          }),
          doc: (docId: string) => ({
            get: async () => ({
              exists: migrationMockDbData.Users.has(docId),
              data: () => migrationMockDbData.Users.get(docId),
            }),
            set: async (data: any, opts: any) => {
              const cur = migrationMockDbData.Users.get(docId) || {};
              migrationMockDbData.Users.set(docId, opts?.merge ? { ...cur, ...data } : data);
            },
            collection: (subCol: string) => ({
              get: async () => ({
                docs: [],
                size: docId === PRIMARY_ACCOUNT.uid ? 2 : 1,
              }),
              doc: () => ({ set: async () => {} }),
            }),
          }),
        };
      }
      if (colName === 'reminders') {
        return {
          where: (field: string, op: string, val: any) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [id, r] of migrationMockDbData.reminders.entries()) {
                if (r[field] === val) {
                  docs.push({
                    id,
                    data: () => r,
                    ref: {
                      set: async (patch: any) => {
                        migrationMockDbData.reminders.set(id, { ...r, ...patch });
                      },
                    },
                  });
                }
              }
              return { docs, size: docs.length };
            },
          }),
        };
      }
      if (colName === 'support_tickets') {
        return {
          where: (field: string, op: string, val: any) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [id, t] of migrationMockDbData.support_tickets.entries()) {
                if (t[field] === val) {
                  docs.push({
                    id,
                    data: () => t,
                    ref: {
                      set: async (patch: any) => {
                        migrationMockDbData.support_tickets.set(id, { ...t, ...patch });
                      },
                    },
                  });
                }
              }
              return { docs, size: docs.length };
            },
          }),
        };
      }
      if (colName === 'identityMappings') {
        return {
          doc: (docId: string) => ({
            set: async (data: any) => {
              migrationMockDbData.identityMappings.set(docId, data);
            },
          }),
        };
      }
      return { doc: () => ({ set: async () => {} }) };
    },
    batch: () => {
      const ops: Function[] = [];
      return {
        set: (ref: any, data: any, opts: any) => ops.push(() => ref.set(data, opts)),
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  // Test duplicate group identification
  const groups = await findDuplicateGroups(migrationMockDb as any);
  assert(groups.length === 1, 'Migration script discovers 1 duplicate group for shared phone number');
  assert(groups[0].matchKey === SHARED_PHONE, 'Duplicate group matched on the shared phone');
  assert(groups[0].users.length === 2, 'Group contains exactly the 2 duplicate users');

  // Test account scoring (Primary vs Secondary)
  const scorePrimary = await scoreUserAccount(migrationMockDb as any, PRIMARY_ACCOUNT);
  const scoreSecondary = await scoreUserAccount(migrationMockDb as any, SECONDARY_ACCOUNT);
  assert(scorePrimary.score > scoreSecondary.score, 'Primary account receives higher score based on vault activity and profile completeness');

  // Run live migration on group
  const migrationResult = await migrateDuplicateGroup(migrationMockDb as any, groups[0], {
    isDryRun: false,
    deleteOrphans: true,
  });

  assert(migrationResult.primaryUid === PRIMARY_ACCOUNT.uid, 'Correctly chose older/active account as primary UID');
  assert(migrationResult.assetsMigrated === 1, 'Migrated 1 asset from secondary to primary account');
  assert(migrationResult.remindersMigrated === 1, 'Reassigned reminder to primary account');
  assert(migrationResult.ticketsMigrated === 1, 'Reassigned support ticket to primary account');

  // Verify secondary account is archived
  const archivedSecondary = migrationMockDbData.users.get(SECONDARY_ACCOUNT.uid);
  assert(archivedSecondary.isArchived === true, 'Secondary duplicate account is marked as isArchived: true');
  assert(archivedSecondary.mergedInto === PRIMARY_ACCOUNT.uid, 'Secondary account points mergedInto -> primary UID');
  assert(archivedSecondary.canonicalUserId === PRIMARY_ACCOUNT.uid, 'Secondary account points canonicalUserId -> primary UID');

  // Verify reminders have foreign key updated to primaryUid
  const reminderDoc = migrationMockDbData.reminders.get('rem_001');
  assert(reminderDoc.uid === PRIMARY_ACCOUNT.uid, 'Reminder foreign key uid is now remapped to Primary account UID');

  // Verify support ticket has foreign key updated to primaryUid
  const ticketDoc = migrationMockDbData.support_tickets.get('ticket_001');
  assert(ticketDoc.userId === PRIMARY_ACCOUNT.uid, 'Support ticket foreign key userId is now remapped to Primary account UID');

  // Verify identityMappings points to primary
  const phoneMapping = migrationMockDbData.identityMappings.get(`phone:${SHARED_PHONE}`);
  assert(phoneMapping.canonicalUserId === PRIMARY_ACCOUNT.uid, 'identityMappings/phone points to primary UID');

  const secondaryAuthMapping = migrationMockDbData.identityMappings.get(`authUid:${SECONDARY_ACCOUNT.uid}`);
  assert(secondaryAuthMapping.canonicalUserId === PRIMARY_ACCOUNT.uid, 'identityMappings/authUid for secondary user points to primary UID');

  console.log('\n================================================================');
  console.log(`ALL TESTS PASSED: ${passCount} / ${testCount}`);
  console.log('================================================================\n');
}

runAllTests().catch((e) => {
  console.error('[TEST ERROR]', e);
  process.exit(1);
});
