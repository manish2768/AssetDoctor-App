/**
 * Asset Doctor — Canonical Identity Resolution Service
 * Implements ONE PERSON = ONE CANONICAL ASSET DOCTOR PROFILE.
 * 
 * Persistent Architecture:
 * - Persistent Firestore collection: `identityMappings/{identityKey}`
 *   Key formats:
 *     - google:<providerUid>
 *     - email:<normalizedEmail>
 *     - phone:<normalizedPhone>
 *     - authUid:<firebaseAuthUid>
 * - Authoritative User Profile: `users/{canonicalUserId}`
 * - In-memory cache is used as an L1 performance optimization and offline test fallback.
 */

import {
  normalizeCanonicalEmail,
  normalizeCanonicalPhone,
  validateIndianPincode,
  lookupPincode,
} from './identityNormalizer';

export interface GoogleIdentity {
  providerUserId: string;
  email: string;
  verified: boolean;
  linkedAt?: string;
}

export interface PhoneIdentity {
  normalizedPhone: string;
  verified: boolean;
  linkedAt?: string;
}

export interface EmailIdentity {
  normalizedEmail: string;
  verified: boolean;
  linkedAt?: string;
}

export interface CanonicalIdentities {
  google?: GoogleIdentity;
  phone?: PhoneIdentity;
  email?: EmailIdentity;
}

export interface CanonicalUserProfile {
  uid: string; // Canonical User ID
  canonicalUserId: string;
  name: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  normalizedPhoneNumber?: string;
  pincode?: string;
  city?: string;
  state?: string;
  address?: string;
  gender?: string;
  photoURL?: string;
  authProvider?: string;
  linkedProviders?: string;
  whatsappOptIn?: boolean;
  identities: CanonicalIdentities;
  isProfileComplete: boolean;
  createdAt?: string | any;
  updatedAt?: string | any;
}

export interface IdentityResolutionContext {
  authProvider?: 'google' | 'phone' | 'email' | 'linked' | 'unknown';
  extra?: Partial<CanonicalUserProfile>;
  idToken?: string;
  firestoreDb?: any;
}

export interface IdentityConflictResult {
  conflict: true;
  message: string;
  existingUserId: string;
  conflictingIdentity: string;
}

export interface IdentityMappingDoc {
  canonicalUserId: string;
  identityType: 'google' | 'phone' | 'email' | 'authUid';
  identityValue: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export class IdentityResolver {
  // L1 In-Memory Cache (survives within session, cleared on reset/test)
  private static inMemoryProfiles: Map<string, CanonicalUserProfile> = new Map();
  private static identityIndex: Map<string, string> = new Map(); // identityKey -> canonicalUserId

  // Firestore Collection Names
  public static readonly COLLECTIONS = {
    IDENTITY_MAPPINGS: 'identityMappings',
    USERS: 'users',
    LEGACY_USERS: 'Users',
  };

  /**
   * Reset in-memory cache (primarily for unit tests and deterministic simulations).
   */
  static resetCache() {
    this.inMemoryProfiles.clear();
    this.identityIndex.clear();
  }

  /**
   * Helper to get Firestore instance safely without crashing if not initialized.
   */
  private static getFirestoreInstance(customDb?: any): any {
    if (customDb) return customDb;
    try {
      const firestoreModule = require('@react-native-firebase/firestore');
      return firestoreModule.default ? firestoreModule.default() : firestoreModule();
    } catch {
      return null;
    }
  }

  /**
   * Generates unique, normalized identity keys for atomic indexing.
   */
  static buildIdentityKeys(identities: CanonicalIdentities, authUid?: string): string[] {
    const keys: string[] = [];
    if (identities.google?.providerUserId) {
      keys.push(`google:${identities.google.providerUserId}`);
    }
    if (identities.google?.email) {
      const norm = normalizeCanonicalEmail(identities.google.email);
      if (norm) keys.push(`email:${norm}`);
    }
    if (identities.phone?.normalizedPhone && identities.phone.verified) {
      const norm = normalizeCanonicalPhone(identities.phone.normalizedPhone);
      if (norm) keys.push(`phone:${norm}`);
    }
    if (identities.email?.normalizedEmail && identities.email.verified) {
      const norm = normalizeCanonicalEmail(identities.email.normalizedEmail);
      if (norm) keys.push(`email:${norm}`);
    }
    if (authUid) {
      keys.push(`authUid:${authUid}`);
    }
    return Array.from(new Set(keys));
  }

  /**
   * Resolves an authenticated Firebase User into a single Canonical User Profile.
   * Atomically queries and updates persistent Firestore identity mappings.
   * NEVER creates a duplicate profile if verified email or phone already exists.
   */
  static async resolveAuthenticatedUser(
    authUser: any,
    context: IdentityResolutionContext = {}
  ): Promise<CanonicalUserProfile> {
    if (!authUser?.uid) {
      throw new Error('Identity resolution requires a valid authenticated user object.');
    }

    const now = new Date().toISOString();
    const providerId =
      context.authProvider ||
      (authUser.providerData?.[0]?.providerId === 'google.com'
        ? 'google'
        : authUser.phoneNumber
        ? 'phone'
        : 'email');

    // 1. Extract verified identities from authentication event
    const extractedIdentities: CanonicalIdentities = {};

    // Google identity
    const googleProvider = (authUser.providerData || []).find((p: any) => p.providerId === 'google.com');
    if (googleProvider || providerId === 'google') {
      const gEmail = normalizeCanonicalEmail(authUser.email || googleProvider?.email);
      const gUid = googleProvider?.uid || authUser.uid;
      if (gUid || gEmail) {
        extractedIdentities.google = {
          providerUserId: gUid,
          email: gEmail,
          verified: true,
          linkedAt: now,
        };
        if (gEmail) {
          extractedIdentities.email = {
            normalizedEmail: gEmail,
            verified: true,
            linkedAt: now,
          };
        }
      }
    }

    // Phone identity (only marked verified if auth provider is phone or explicitly verified)
    const rawPhone = authUser.phoneNumber || context.extra?.phone || context.extra?.phoneNumber;
    const normalizedPhone = normalizeCanonicalPhone(rawPhone);
    const isPhoneVerified = Boolean(
      authUser.phoneNumber ||
      providerId === 'phone' ||
      context.extra?.identities?.phone?.verified
    );

    if (normalizedPhone && isPhoneVerified) {
      extractedIdentities.phone = {
        normalizedPhone,
        verified: true,
        linkedAt: now,
      };
    }

    // Email identity (from email auth or extra)
    const rawEmail = authUser.email || context.extra?.email;
    const normalizedEmail = normalizeCanonicalEmail(rawEmail);
    const isEmailVerified = Boolean(
      authUser.emailVerified ||
      extractedIdentities.google?.verified ||
      context.extra?.identities?.email?.verified
    );

    if (normalizedEmail && isEmailVerified && !extractedIdentities.email) {
      extractedIdentities.email = {
        normalizedEmail,
        verified: true,
        linkedAt: now,
      };
    }

    const candidateKeys = this.buildIdentityKeys(extractedIdentities, authUser.uid);

    // 2. Search for existing canonical profile across persistent mappings & local cache
    const existing = await this.findExistingCanonicalProfile({
      identities: extractedIdentities,
      email: normalizedEmail,
      phone: normalizedPhone,
      googleUid: extractedIdentities.google?.providerUserId,
      currentUid: authUser.uid,
      firestoreDb: context.firestoreDb,
    });

    if (existing) {
      // 3. Existing canonical profile found — link new verified identities idempotently
      let profileUpdated = false;
      const updatedIdentities: CanonicalIdentities = { ...existing.identities };

      if (extractedIdentities.google && !updatedIdentities.google) {
        updatedIdentities.google = extractedIdentities.google;
        profileUpdated = true;
      }
      if (extractedIdentities.phone && (!updatedIdentities.phone || !updatedIdentities.phone.verified)) {
        updatedIdentities.phone = extractedIdentities.phone;
        profileUpdated = true;
      }
      if (extractedIdentities.email && (!updatedIdentities.email || !updatedIdentities.email.verified)) {
        updatedIdentities.email = extractedIdentities.email;
        profileUpdated = true;
      }

      // Sanitize display name (strictly non-phone)
      const cleanName = this.sanitizeDisplayName(
        context.extra?.fullName ||
        context.extra?.name ||
        (existing.name !== 'Name not set' ? existing.name : authUser.displayName)
      );
      const photoURL = authUser.photoURL || context.extra?.photoURL || existing.photoURL || '';

      const rawPin = context.extra?.pinCode ?? context.extra?.pincode;
      const pinCheck = validateIndianPincode(rawPin);
      const pinAuto = pinCheck.valid ? lookupPincode(pinCheck.pincode) : null;
      const cleanPincode = existing.pincode || (pinCheck.valid ? pinCheck.pincode : undefined);
      const cleanCity = existing.city || context.extra?.city || pinAuto?.city || undefined;
      const cleanState = existing.state || context.extra?.state || pinAuto?.state || undefined;

      const updatedProfile: CanonicalUserProfile = {
        ...existing,
        name: cleanName || existing.name,
        email: existing.email || normalizedEmail || undefined,
        phone: existing.phone || (isPhoneVerified ? normalizedPhone : existing.phone) || undefined,
        phoneNumber: existing.phoneNumber || (isPhoneVerified ? normalizedPhone : existing.phoneNumber) || undefined,
        normalizedPhoneNumber: existing.normalizedPhoneNumber || (isPhoneVerified ? normalizedPhone : existing.normalizedPhoneNumber) || undefined,
        pincode: cleanPincode,
        city: cleanCity,
        state: cleanState,
        photoURL,
        identities: updatedIdentities,
        updatedAt: now,
      };

      updatedProfile.isProfileComplete = this.checkIsProfileComplete(updatedProfile);

      // Persist to Firestore and L1 Cache
      await this.saveCanonicalProfile(updatedProfile, candidateKeys, context.firestoreDb);
      return updatedProfile;
    }

    // 4. No existing profile found — create a new canonical profile
    const cleanName = this.sanitizeDisplayName(context.extra?.fullName || context.extra?.name || authUser.displayName);
    const rawPin = context.extra?.pinCode ?? context.extra?.pincode;
    const pinCheck = validateIndianPincode(rawPin);
    const pinAuto = pinCheck.valid ? lookupPincode(pinCheck.pincode) : null;

    const canonicalUserId = authUser.uid; // Stable canonical ID seeded from first verified registration

    const newProfile: CanonicalUserProfile = {
      uid: canonicalUserId,
      canonicalUserId,
      name: cleanName || 'Name not set',
      email: normalizedEmail || undefined,
      phone: isPhoneVerified ? normalizedPhone : undefined,
      phoneNumber: isPhoneVerified ? normalizedPhone : undefined,
      normalizedPhoneNumber: isPhoneVerified ? normalizedPhone : undefined,
      pincode: pinCheck.valid ? pinCheck.pincode : undefined,
      city: context.extra?.city || pinAuto?.city || undefined,
      state: context.extra?.state || pinAuto?.state || undefined,
      address: context.extra?.address || undefined,
      gender: context.extra?.gender || undefined,
      photoURL: authUser.photoURL || context.extra?.photoURL || '',
      authProvider: providerId,
      identities: extractedIdentities,
      isProfileComplete: false,
      createdAt: now,
      updatedAt: now,
    };

    newProfile.isProfileComplete = this.checkIsProfileComplete(newProfile);

    // Save canonical profile & persistent identity mappings
    await this.saveCanonicalProfile(newProfile, candidateKeys, context.firestoreDb);
    return newProfile;
  }

  /**
   * Search for an existing canonical profile across:
   * 1. L1 Memory cache
   * 2. Persistent Firestore `identityMappings` collection
   * 3. Authoritative `users` collection
   */
  static async findExistingCanonicalProfile(query: {
    identities?: CanonicalIdentities;
    email?: string;
    phone?: string;
    googleUid?: string;
    currentUid?: string;
    firestoreDb?: any;
  }): Promise<CanonicalUserProfile | null> {
    const keysToCheck: string[] = [];

    if (query.googleUid) keysToCheck.push(`google:${query.googleUid}`);
    if (query.email) {
      const norm = normalizeCanonicalEmail(query.email);
      if (norm) keysToCheck.push(`email:${norm}`);
    }
    if (query.phone) {
      const norm = normalizeCanonicalPhone(query.phone);
      if (norm) keysToCheck.push(`phone:${norm}`);
    }
    if (query.currentUid) {
      keysToCheck.push(`authUid:${query.currentUid}`);
    }

    if (query.identities) {
      keysToCheck.push(...this.buildIdentityKeys(query.identities, query.currentUid));
    }

    const uniqueKeys = Array.from(new Set(keysToCheck));

    // 1. Check L1 Memory Index
    for (const key of uniqueKeys) {
      const canonicalId = this.identityIndex.get(key);
      if (canonicalId) {
        const found = this.inMemoryProfiles.get(canonicalId);
        if (found) return found;
      }
    }

    // 2. Check Persistent Firestore `identityMappings` collection
    const db = this.getFirestoreInstance(query.firestoreDb);
    if (db) {
      for (const key of uniqueKeys) {
        try {
          const mappingSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(key).get();
          if (mappingSnap.exists) {
            const mappingData = mappingSnap.data();
            const canonicalId = mappingData?.canonicalUserId;
            if (canonicalId) {
              // Fetch authoritative user doc
              const userSnap = await db.collection(this.COLLECTIONS.USERS).doc(canonicalId).get();
              if (userSnap.exists) {
                const profile = userSnap.data() as CanonicalUserProfile;
                // Cache into L1
                this.inMemoryProfiles.set(canonicalId, profile);
                this.identityIndex.set(key, canonicalId);
                return profile;
              }
            }
          }
        } catch (err) {
          console.warn(`[IdentityResolver] Persistent lookup for ${key} failed:`, err);
        }
      }

      // Fallback query in Firestore users collection by email or phone if mapping doc not yet present
      if (query.email) {
        const normEmail = normalizeCanonicalEmail(query.email);
        if (normEmail) {
          try {
            const emailQuery = await db.collection(this.COLLECTIONS.USERS)
              .where('email', '==', normEmail)
              .limit(1)
              .get();
            if (!emailQuery.empty && emailQuery.docs?.[0]) {
              const profile = { uid: emailQuery.docs[0].id, ...emailQuery.docs[0].data() } as CanonicalUserProfile;
              this.updateCachedProfile(profile);
              this.saveCanonicalProfile(profile, uniqueKeys, db).catch(() => {});
              return profile;
            }
          } catch (err) {
            console.warn(`[IdentityResolver] Query users by email failed:`, err);
          }
        }
      }

      if (query.phone) {
        const normPhone = normalizeCanonicalPhone(query.phone);
        if (normPhone) {
          try {
            const phoneQuery = await db.collection(this.COLLECTIONS.USERS)
              .where('phone', '==', normPhone)
              .limit(1)
              .get();
            if (!phoneQuery.empty && phoneQuery.docs?.[0]) {
              const profile = { uid: phoneQuery.docs[0].id, ...phoneQuery.docs[0].data() } as CanonicalUserProfile;
              this.updateCachedProfile(profile);
              this.saveCanonicalProfile(profile, uniqueKeys, db).catch(() => {});
              return profile;
            }

            const phoneQuery2 = await db.collection(this.COLLECTIONS.USERS)
              .where('phoneNumber', '==', normPhone)
              .limit(1)
              .get();
            if (!phoneQuery2.empty && phoneQuery2.docs?.[0]) {
              const profile = { uid: phoneQuery2.docs[0].id, ...phoneQuery2.docs[0].data() } as CanonicalUserProfile;
              this.updateCachedProfile(profile);
              this.saveCanonicalProfile(profile, uniqueKeys, db).catch(() => {});
              return profile;
            }
          } catch (err) {
            console.warn(`[IdentityResolver] Query users by phone failed:`, err);
          }
        }
      }

      // Direct fallback: check `users/{currentUid}` and `Users/{currentUid}`
      if (query.currentUid) {
        try {
          let directUserSnap = await db.collection(this.COLLECTIONS.USERS).doc(query.currentUid).get();
          if (!directUserSnap.exists) {
            directUserSnap = await db.collection(this.COLLECTIONS.LEGACY_USERS).doc(query.currentUid).get();
          }
          if (directUserSnap.exists) {
            const profile = { uid: query.currentUid, ...directUserSnap.data() } as CanonicalUserProfile;
            this.updateCachedProfile(profile);
            return profile;
          }
        } catch (err) {
          console.warn(`[IdentityResolver] Direct user lookup for ${query.currentUid} failed:`, err);
        }
      }
    }

    // 3. Fallback scan in L1 memory store
    for (const profile of this.inMemoryProfiles.values()) {
      if (query.currentUid && (profile.uid === query.currentUid || profile.canonicalUserId === query.currentUid)) {
        return profile;
      }
      if (query.googleUid && profile.identities?.google?.providerUserId === query.googleUid) {
        return profile;
      }
      if (query.email) {
        const normTarget = normalizeCanonicalEmail(query.email);
        const profileEmail = normalizeCanonicalEmail(
          profile.email || profile.identities?.google?.email || profile.identities?.email?.normalizedEmail
        );
        if (normTarget && profileEmail && normTarget === profileEmail) {
          return profile;
        }
      }
      if (query.phone) {
        const normTarget = normalizeCanonicalPhone(query.phone);
        const profilePhone = normalizeCanonicalPhone(
          profile.phone || profile.phoneNumber || profile.identities?.phone?.normalizedPhone
        );
        if (normTarget && profilePhone && normTarget === profilePhone) {
          return profile;
        }
      }
    }

    return null;
  }

  /**
   * Atomically links a new verified identity (e.g. phone or Google) to an existing canonical user.
   * Rejects silent merge if the identity is already claimed by a DIFFERENT canonical user.
   */
  static async linkIdentityToExistingProfile(
    canonicalUserId: string,
    newIdentity: { type: 'google' | 'phone' | 'email'; value: any },
    firestoreDb?: any
  ): Promise<{ success: boolean; profile?: CanonicalUserProfile; conflict?: IdentityConflictResult }> {
    let profile = this.inMemoryProfiles.get(canonicalUserId);
    const db = this.getFirestoreInstance(firestoreDb);

    if (!profile && db) {
      try {
        const snap = await db.collection(this.COLLECTIONS.USERS).doc(canonicalUserId).get();
        if (snap.exists) {
          profile = snap.data() as CanonicalUserProfile;
          this.inMemoryProfiles.set(canonicalUserId, profile);
        }
      } catch (err) {
        console.warn('[IdentityResolver] Profile load failed during linking:', err);
      }
    }

    if (!profile) {
      return { success: false };
    }

    let identityKey = '';
    const now = new Date().toISOString();
    const updatedIdentities = { ...profile.identities };

    if (newIdentity.type === 'google') {
      const gUid = newIdentity.value.providerUserId || newIdentity.value.uid;
      const gEmail = normalizeCanonicalEmail(newIdentity.value.email);
      identityKey = `google:${gUid}`;

      // Check conflict in L1 index or persistent DB
      let existingOwner = this.identityIndex.get(identityKey);
      if (!existingOwner && db) {
        try {
          const mapSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(identityKey).get();
          if (mapSnap.exists) existingOwner = mapSnap.data()?.canonicalUserId;
        } catch {}
      }

      if (existingOwner && existingOwner !== canonicalUserId) {
        return {
          success: false,
          conflict: {
            conflict: true,
            message: 'This Google account is already linked to another Asset Doctor profile.',
            existingUserId: existingOwner,
            conflictingIdentity: identityKey,
          },
        };
      }

      updatedIdentities.google = {
        providerUserId: gUid,
        email: gEmail,
        verified: true,
        linkedAt: now,
      };
      if (gEmail && !profile.email) profile.email = gEmail;
    } else if (newIdentity.type === 'phone') {
      const normPhone = normalizeCanonicalPhone(newIdentity.value);
      if (!normPhone) throw new Error('Invalid phone number format for linking');
      identityKey = `phone:${normPhone}`;

      let existingOwner = this.identityIndex.get(identityKey);
      if (!existingOwner && db) {
        try {
          const mapSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(identityKey).get();
          if (mapSnap.exists) existingOwner = mapSnap.data()?.canonicalUserId;
        } catch {}
      }

      if (existingOwner && existingOwner !== canonicalUserId) {
        return {
          success: false,
          conflict: {
            conflict: true,
            message: 'This phone number is already registered to another Asset Doctor profile.',
            existingUserId: existingOwner,
            conflictingIdentity: identityKey,
          },
        };
      }

      updatedIdentities.phone = {
        normalizedPhone: normPhone,
        verified: true,
        linkedAt: now,
      };
      profile.phone = normPhone;
      profile.phoneNumber = normPhone;
      profile.normalizedPhoneNumber = normPhone;
    } else if (newIdentity.type === 'email') {
      const normEmail = normalizeCanonicalEmail(newIdentity.value);
      if (!normEmail) throw new Error('Invalid email format for linking');
      identityKey = `email:${normEmail}`;

      let existingOwner = this.identityIndex.get(identityKey);
      if (!existingOwner && db) {
        try {
          const mapSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(identityKey).get();
          if (mapSnap.exists) existingOwner = mapSnap.data()?.canonicalUserId;
        } catch {}
      }

      if (existingOwner && existingOwner !== canonicalUserId) {
        return {
          success: false,
          conflict: {
            conflict: true,
            message: 'This email is already associated with another Asset Doctor profile.',
            existingUserId: existingOwner,
            conflictingIdentity: identityKey,
          },
        };
      }

      updatedIdentities.email = {
        normalizedEmail: normEmail,
        verified: true,
        linkedAt: now,
      };
      profile.email = normEmail;
    }

    profile.identities = updatedIdentities;
    profile.updatedAt = now;
    profile.isProfileComplete = this.checkIsProfileComplete(profile);

    const keys = this.buildIdentityKeys(profile.identities, profile.uid);
    await this.saveCanonicalProfile(profile, keys, firestoreDb);
    return { success: true, profile };
  }

  /**
   * Checks whether a phone number or email is already registered to another user account.
   * Scans L1 memory cache, persistent `identityMappings`, and `users` collection.
   * Returns available: false with the requested error message if already linked to another account.
   */
  static async checkIdentityAvailable(params: {
    phone?: string;
    email?: string;
    excludeUid?: string;
    firestoreDb?: any;
  }): Promise<{ available: boolean; field?: 'phone' | 'email'; message?: string; existingUserId?: string }> {
    const { phone, email, excludeUid, firestoreDb } = params;
    const db = this.getFirestoreInstance(firestoreDb);

    if (phone) {
      const normPhone = normalizeCanonicalPhone(phone);
      if (normPhone) {
        const identityKey = `phone:${normPhone}`;

        // 1. Check L1 Memory Index
        const l1Owner = this.identityIndex.get(identityKey);
        if (l1Owner && (!excludeUid || l1Owner !== excludeUid)) {
          return {
            available: false,
            field: 'phone',
            message: 'This mobile number is already linked to another account.',
            existingUserId: l1Owner,
          };
        }

        // 2. Check persistent identityMappings
        if (db) {
          try {
            const mapSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(identityKey).get();
            if (mapSnap.exists) {
              const mappedUid = mapSnap.data()?.canonicalUserId;
              if (mappedUid && (!excludeUid || mappedUid !== excludeUid)) {
                return {
                  available: false,
                  field: 'phone',
                  message: 'This mobile number is already linked to another account.',
                  existingUserId: mappedUid,
                };
              }
            }
          } catch (e) {
            console.warn('[IdentityResolver] checkIdentityAvailable phone mapping check error:', e);
          }

          // 3. Check users collection
          try {
            const q1 = await db.collection(this.COLLECTIONS.USERS)
              .where('phone', '==', normPhone)
              .limit(2)
              .get();
            for (const doc of (q1.docs || [])) {
              const canonicalId = doc.data()?.canonicalUserId || doc.id;
              if (doc.id !== excludeUid && canonicalId !== excludeUid) {
                return {
                  available: false,
                  field: 'phone',
                  message: 'This mobile number is already linked to another account.',
                  existingUserId: canonicalId,
                };
              }
            }

            const q2 = await db.collection(this.COLLECTIONS.USERS)
              .where('phoneNumber', '==', normPhone)
              .limit(2)
              .get();
            for (const doc of (q2.docs || [])) {
              const canonicalId = doc.data()?.canonicalUserId || doc.id;
              if (doc.id !== excludeUid && canonicalId !== excludeUid) {
                return {
                  available: false,
                  field: 'phone',
                  message: 'This mobile number is already linked to another account.',
                  existingUserId: canonicalId,
                };
              }
            }
          } catch (e) {
            console.warn('[IdentityResolver] checkIdentityAvailable phone users check error:', e);
          }
        }
      }
    }

    if (email) {
      const normEmail = normalizeCanonicalEmail(email);
      if (normEmail) {
        const identityKey = `email:${normEmail}`;

        // 1. Check L1 Memory Index
        const l1Owner = this.identityIndex.get(identityKey);
        if (l1Owner && (!excludeUid || l1Owner !== excludeUid)) {
          return {
            available: false,
            field: 'email',
            message: 'This email is already associated with another account.',
            existingUserId: l1Owner,
          };
        }

        // 2. Check persistent identityMappings
        if (db) {
          try {
            const mapSnap = await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(identityKey).get();
            if (mapSnap.exists) {
              const mappedUid = mapSnap.data()?.canonicalUserId;
              if (mappedUid && (!excludeUid || mappedUid !== excludeUid)) {
                return {
                  available: false,
                  field: 'email',
                  message: 'This email is already associated with another account.',
                  existingUserId: mappedUid,
                };
              }
            }
          } catch (e) {
            console.warn('[IdentityResolver] checkIdentityAvailable email mapping check error:', e);
          }

          // 3. Check users collection
          try {
            const q = await db.collection(this.COLLECTIONS.USERS)
              .where('email', '==', normEmail)
              .limit(2)
              .get();
            for (const doc of (q.docs || [])) {
              const canonicalId = doc.data()?.canonicalUserId || doc.id;
              if (doc.id !== excludeUid && canonicalId !== excludeUid) {
                return {
                  available: false,
                  field: 'email',
                  message: 'This email is already associated with another account.',
                  existingUserId: canonicalId,
                };
              }
            }
          } catch (e) {
            console.warn('[IdentityResolver] checkIdentityAvailable email users check error:', e);
          }
        }
      }
    }

    return { available: true };
  }

  /**
   * Immediately updates in-memory L1 cache with freshly saved profile data.
   * Prevents stale cache reads across UserService.getProfile and completeProfileSetup.
   */
  static updateCachedProfile(profile: any): void {
    if (!profile) return;
    const targetUid = profile.canonicalUserId || profile.uid;
    if (targetUid) {
      this.inMemoryProfiles.set(targetUid, profile);
      this.inMemoryProfiles.set(profile.uid, profile);
      this.identityIndex.set(`authUid:${targetUid}`, targetUid);
      this.identityIndex.set(`authUid:${profile.uid}`, targetUid);
    }
    if (profile.email) {
      const normEmail = normalizeCanonicalEmail(profile.email);
      if (normEmail) this.identityIndex.set(`email:${normEmail}`, targetUid);
    }
    if (profile.phone || profile.phoneNumber) {
      const normPhone = normalizeCanonicalPhone(profile.phone || profile.phoneNumber);
      if (normPhone) this.identityIndex.set(`phone:${normPhone}`, targetUid);
    }
  }

  /**
   * Persists canonical profile into persistent Firestore collections and L1 cache.
   * Atomically writes:
   * 1. `users/{canonicalUserId}`
   * 2. `identityMappings/{identityKey}` for every verified identity
   */
  static async saveCanonicalProfile(
    profile: CanonicalUserProfile,
    additionalKeys: string[] = [],
    firestoreDb?: any
  ): Promise<void> {
    // 1. Update L1 In-Memory Store & Index
    this.inMemoryProfiles.set(profile.uid, profile);
    this.inMemoryProfiles.set(profile.canonicalUserId, profile);

    const keys = Array.from(
      new Set([...this.buildIdentityKeys(profile.identities, profile.uid), ...additionalKeys])
    );

    for (const key of keys) {
      this.identityIndex.set(key, profile.canonicalUserId);
    }

    // 2. Persist to Firestore
    const db = this.getFirestoreInstance(firestoreDb);
    if (db) {
      try {
        const batch = db.batch ? db.batch() : null;
        const now = new Date().toISOString();

        if (batch) {
          // Write authoritative user profile
          const userRef = db.collection(this.COLLECTIONS.USERS).doc(profile.canonicalUserId);
          batch.set(userRef, profile, { merge: true });

          // Write persistent identity mapping docs
          for (const key of keys) {
            const mappingRef = db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(key);
            const mappingDoc: IdentityMappingDoc = {
              canonicalUserId: profile.canonicalUserId,
              identityType: key.split(':')[0] as any,
              identityValue: key.split(':')[1] || '',
              verified: true,
              createdAt: now,
              updatedAt: now,
            };
            batch.set(mappingRef, mappingDoc, { merge: true });
          }

          await batch.commit();
        } else {
          // Direct set if batch unavailable
          await db.collection(this.COLLECTIONS.USERS).doc(profile.canonicalUserId).set(profile, { merge: true });
          for (const key of keys) {
            await db.collection(this.COLLECTIONS.IDENTITY_MAPPINGS).doc(key).set(
              {
                canonicalUserId: profile.canonicalUserId,
                identityType: key.split(':')[0],
                identityValue: key.split(':')[1] || '',
                verified: true,
                updatedAt: now,
              },
              { merge: true }
            );
          }
        }
      } catch (err) {
        console.warn('[IdentityResolver] Firestore persist note:', err);
      }
    }
  }

  /**
   * Checks if all mandatory fields (Name, PIN, City, State, Genuine Verified Identity) are complete.
   * WhatsApp and Gender are optional and never gate completion.
   */
  static checkIsProfileComplete(profile: Partial<CanonicalUserProfile>): boolean {
    const name = this.sanitizeDisplayName(profile.name || (profile as any)?.fullName);
    const isNameValid = Boolean(name && name.length >= 2 && name !== 'Name not set' && name !== 'Asset Owner');
    const pinCheck = validateIndianPincode(profile.pincode || (profile as any)?.pinCode);
    const isCityValid = Boolean(profile.city && profile.city.trim().length > 0);
    const isStateValid = Boolean(profile.state && profile.state.trim().length > 0);

    // Strict verified identity check (P1-3: unverified email or phone strings are rejected)
    const hasVerifiedPhone = Boolean(profile.identities?.phone?.verified);
    const hasVerifiedGoogle = Boolean(profile.identities?.google?.verified);
    const hasVerifiedEmail = Boolean(profile.identities?.email?.verified);

    // If no explicit identities object, legacy records with uid or phone or email are treated as verified
    const hasExplicitIdentities = Boolean(profile.identities && Object.keys(profile.identities).length > 0);
    const legacyVerified = !hasExplicitIdentities && Boolean(profile.uid || profile.phone || profile.email);
    const hasVerifiedIdentity = hasVerifiedPhone || hasVerifiedGoogle || hasVerifiedEmail || legacyVerified;

    return isNameValid && pinCheck.valid && isCityValid && isStateValid && hasVerifiedIdentity;
  }

  /**
   * Sanitizes human display name. NEVER returns a phone number as a name.
   */
  static sanitizeDisplayName(name: any): string {
    if (!name || typeof name !== 'string') return '';
    const clean = name.trim();
    if (!clean) return '';
    // If it looks like a phone number, reject it!
    if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(clean)) return '';
    if (clean === 'Asset Owner' || clean === 'Name not set') return '';
    return clean.slice(0, 80);
  }
}
