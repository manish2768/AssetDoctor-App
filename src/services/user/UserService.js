/**
 * Asset Doctor — User Profile Service (Firestore)
 * Profile docs live at users/{uid} (and mirrored to Users/{uid} for legacy assets).
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS, DEFAULT_DISPLAY_NAME } from '../constants';
import { Haptics } from '../haptics/triggerHaptic';

/**
 * @typedef {Object} UserProfile
 * @property {string} uid
 * @property {string} email
 * @property {string} phone
 * @property {string} [phoneNumber] - Verified Auth phone (E.164)
 * @property {string} name
 * @property {string} [address]
 * @property {string} [pincode]
 * @property {string} [photoURL]
 * @property {string} [authProvider] - 'google' | 'phone' | 'email' | 'whatsapp_otp' | 'unknown'
 * @property {boolean} [profileSetupComplete]
 * @property {boolean} [welcomeWhatsAppSent]
 * @property {FirebaseFirestoreTypes.FieldValue | Date} [createdAt]
 * @property {FirebaseFirestoreTypes.FieldValue | Date} [updatedAt]
 */

/** Primary path: users/{uid} */
function usersCollection() {
  return firestore().collection('users');
}

/** Legacy mirror: Users/{uid} (nested Assets / Vendors still hang off this tree) */
function legacyUsersCollection() {
  return firestore().collection(COLLECTIONS.USERS);
}

import { IdentityResolver } from '../identity/identityResolver';
import {
  normalizeCanonicalEmail,
  normalizeCanonicalPhone,
  validateIndianPincode,
  lookupPincode,
} from '../identity/identityNormalizer';
import { computeProfileCompletion } from '../../utils/profileCompletion';
import { saveLocalProfile } from '../../utils/userProfileStorage';

/**
 * Resolve a display name without inventing "Asset Owner" and NEVER returning a phone number.
 */
function resolveDisplayName({ provided, existing, authDisplayName } = {}) {
  const clean = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (s === DEFAULT_DISPLAY_NAME || s === 'Name not set') return '';
    if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(s)) return '';
    return s.slice(0, 80);
  };
  return (
    clean(provided) ||
    clean(existing) ||
    clean(authDisplayName) ||
    'Name not set'
  );
}

import {
  normalizePhone,
  normalizeE164Phone,
  toWhatsAppDigits,
  isValidPhoneNumber,
} from '../../utils/phoneUtils';

export { normalizeE164Phone, normalizePhone, toWhatsAppDigits, isValidPhoneNumber };

export class UserService {
  /**
   * Single identity resolution mechanism that looks up a customer by phone number.
   * Handles all Indian & International formats (+91 99182 88299, 09918288299, 9918288299, +919918288299).
   * @param {string} phoneNumber
   * @returns {Promise<UserProfile | null>}
   */
  static async resolveCustomerByPhone(phoneNumber) {
    if (!phoneNumber) return null;
    const normalized = normalizeE164Phone(phoneNumber);
    if (!normalized) return null;
    const rawDigits = normalized.replace(/\D/g, '');
    const tenDigits = rawDigits.slice(-10);

    const candidates = Array.from(new Set([
      normalized,
      rawDigits,
      tenDigits,
      `+91${tenDigits}`,
      `91${tenDigits}`,
      `0${tenDigits}`,
    ])).filter(Boolean);

    try {
      for (const phoneVariant of candidates) {
        const q1 = await usersCollection().where('normalizedPhoneNumber', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q1.empty && q1.docs?.[0]) return { uid: q1.docs[0].id, customerId: q1.docs[0].id, ...q1.docs[0].data() };

        const q2 = await usersCollection().where('phoneNumber', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q2.empty && q2.docs?.[0]) return { uid: q2.docs[0].id, customerId: q2.docs[0].id, ...q2.docs[0].data() };

        const q3 = await usersCollection().where('phone', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q3.empty && q3.docs?.[0]) return { uid: q3.docs[0].id, customerId: q3.docs[0].id, ...q3.docs[0].data() };

        const q4 = await legacyUsersCollection().where('phoneNumber', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q4.empty && q4.docs?.[0]) return { uid: q4.docs[0].id, customerId: q4.docs[0].id, ...q4.docs[0].data() };
      }
    } catch (e) {
      console.warn('[UserService] resolveCustomerByPhone note:', e?.message);
    }
    return null;
  }

  /**
   * Upsert Firebase Auth user into Firestore (merge-safe).
   * Call after successful Google or Phone sign-in.
   * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User} user
   * @param {{ authProvider?: string, extra?: Partial<UserProfile> }} [options]
   * @returns {Promise<UserProfile>}
   */
  static async syncUserToFirestore(user, options = {}) {
    if (!user?.uid) {
      throw new Error('Cannot sync profile: missing user uid');
    }

    const userRef = usersCollection().doc(user.uid);
    const legacyRef = legacyUsersCollection().doc(user.uid);

    let existing;
    let legacyExisting;
    try {
      existing = await userRef.get();
      legacyExisting = existing.exists ? existing : await legacyRef.get();
    } catch (error) {
      // Read blocked (rules not deployed) — still try write; fall back to auth fields
      console.warn('[UserService] profile read blocked:', error?.message || error);
      existing = { exists: false, data: () => null };
      legacyExisting = { exists: false, data: () => null };
    }

    const prior = legacyExisting.data() || {};
    const rawPhone =
      options.extra?.phoneNumber ||
      options.extra?.phone ||
      user.phoneNumber ||
      prior.phoneNumber ||
      prior.phone ||
      '';

    const normalizedPhone = normalizeCanonicalPhone(rawPhone);
    const normalizedEmail = normalizeCanonicalEmail(options.extra?.email || user.email || prior.email);

    const resolvedName = resolveDisplayName({
      provided: options.extra?.fullName || options.extra?.name,
      existing: prior.fullName || prior.name,
      authDisplayName: user.displayName,
    });

    // Resolve canonical identity
    let canonical = null;
    try {
      canonical = await IdentityResolver.resolveAuthenticatedUser(user, {
        authProvider: options.authProvider,
        extra: {
          ...prior,
          ...options.extra,
          name: resolvedName,
          fullName: resolvedName,
          email: normalizedEmail || undefined,
          phone: normalizedPhone || undefined,
        },
      });
    } catch (e) {
      console.warn('[UserService] Canonical identity resolve warning:', e?.message || e);
    }

    const resolvedPincode =
      options.extra?.pinCode ||
      options.extra?.pincode ||
      prior.pinCode ||
      prior.pincode ||
      canonical?.pinCode ||
      canonical?.pincode ||
      '';

    const resolvedCity = options.extra?.city || prior.city || canonical?.city || '';
    const resolvedState = options.extra?.state || prior.state || canonical?.state || '';

    // If an existing canonical user already exists with profile data, this is not a new user
    const hasCanonicalProfile = Boolean(canonical && (canonical.name || canonical.pincode || canonical.pinCode));
    const isNewUser = !legacyExisting.exists && !existing.exists && !hasCanonicalProfile;

    const completion = computeProfileCompletion({
      name: resolvedName,
      fullName: resolvedName,
      pincode: resolvedPincode,
      pinCode: resolvedPincode,
      city: resolvedCity,
      state: resolvedState,
      identities: canonical?.identities || prior.identities || {},
      phone: normalizedPhone,
      email: normalizedEmail,
      uid: user.uid,
      createdAt: prior.createdAt,
      customerId: prior.customerId || canonical?.customerId,
      canonicalUserId: canonical?.canonicalUserId || user.uid,
      isNewUser,
      profileSetupComplete: prior.profileSetupComplete,
      onboardingCompleted: prior.onboardingCompleted,
    });

    /** @type {Partial<UserProfile>} */
    const payload = {
      uid: user.uid,
      customerId: user.uid,
      canonicalUserId: canonical?.canonicalUserId || user.uid,
      email: normalizedEmail || user.email || prior.email || '',
      phone: normalizedPhone || rawPhone || prior.phone || '',
      phoneNumber: normalizedPhone || rawPhone || prior.phoneNumber || '',
      normalizedPhoneNumber: normalizedPhone || prior.normalizedPhoneNumber || '',
      pincode: resolvedPincode,
      pinCode: resolvedPincode,
      city: resolvedCity,
      state: resolvedState,
      whatsappNumber: normalizedPhone || prior.whatsappNumber || '',
      whatsappLinked: Boolean(normalizedPhone || prior.whatsappLinked),
      whatsappOptIn: typeof prior.whatsappOptIn === 'boolean' ? prior.whatsappOptIn : true,
      whatsappOptInSource: prior.whatsappOptInSource || options.authProvider || 'signup',
      welcomeMessageSent: Boolean(prior.welcomeMessageSent),
      welcomeMessageSentAt: prior.welcomeMessageSentAt || null,
      name: resolvedName,
      fullName: resolvedName,
      photoURL: user.photoURL || prior.photoURL || '',
      authProvider: options.authProvider || prior.authProvider || 'unknown',
      identities: canonical?.identities || prior.identities || {},
      isProfileComplete: completion.isComplete,
      profileSetupComplete: completion.isComplete || Boolean(prior.profileSetupComplete) || (!isNewUser && !completion.needsOnboarding),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...options.extra,
    };

    if (isNewUser) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
      payload.whatsappOptInAt = firestore.FieldValue.serverTimestamp();
      payload.address = options.extra?.address || '';
      payload.welcomeExperiencePending = true;
      payload.welcomeExperienceCompleted = false;
      payload.welcomeExperienceVersion = '10.1';
      payload.onboardingCompleted = false;
    }

    try {
      await Promise.all([
        userRef.set(payload, { merge: true }),
        legacyRef.set(payload, { merge: true }),
      ]);
      IdentityResolver.updateCachedProfile({ uid: user.uid, ...payload });
    } catch (error) {
      console.warn('[UserService] profile write blocked:', error?.message || error);
      return {
        uid: user.uid,
        customerId: user.uid,
        email: payload.email || '',
        phone: payload.phone || '',
        name: payload.name || '',
        photoURL: payload.photoURL || '',
        authProvider: payload.authProvider || 'unknown',
        address: payload.address || '',
        pendingFirestoreSync: true,
      };
    }

    // First-time WhatsApp welcome: queue server-side. Never call Meta from the APK.
    // Skip/fail reasons are written to notification_queue — never silent.
    const effectivePhone = normalizedPhone || rawPhone;
    const hasPhone = Boolean(effectivePhone && String(effectivePhone).trim() !== '');
    const welcomeNotSent = !prior.welcomeMessageSent;
    const isPendingPhone = prior.welcomeMessageStatus === 'PENDING_PHONE';
    const shouldAttemptWelcome = welcomeNotSent && (
      (isNewUser && hasPhone) ||
      (isPendingPhone && hasPhone) ||
      (prior.welcomeMessageQueued === false && hasPhone)
    );

    if (!hasPhone && welcomeNotSent && !prior.welcomeMessageQueued) {
      // Scenario B: User registered without phone (e.g. Email/Password signup)
      // DO NOT write a dead failed record to notification_queue!
      // Keep welcome state as PENDING_PHONE on user profile so it cleanly queues when phone is added.
      await Promise.all([
        userRef.set(
          {
            welcomeMessageQueued: false,
            welcomeMessageStatus: 'PENDING_PHONE',
            welcomeSkipReason: 'MISSING_PHONE',
          },
          { merge: true },
        ),
        legacyRef.set(
          {
            welcomeMessageQueued: false,
            welcomeMessageStatus: 'PENDING_PHONE',
            welcomeSkipReason: 'MISSING_PHONE',
          },
          { merge: true },
        ),
      ]).catch(() => {});
    } else if (shouldAttemptWelcome) {
      try {
        console.log('[WHATSAPP_TRACE] AUTH_SUCCESS', user.uid);
        console.log('[WHATSAPP_TRACE] USER_CREATED', isNewUser ? 'new' : 'phone_added_or_retry');
        console.log('[WHATSAPP_TRACE] NEW_USER_DETECTED', isNewUser);
        const { enqueueWelcomeWhatsApp } = await import('../whatsapp/WhatsAppQueueService.js');
        const welcomeResult = await enqueueWelcomeWhatsApp({
          userId: user.uid,
          phone: effectivePhone,
          userName: resolvedName || 'Valued Member',
          customerType: 'NEW',
          whatsappOptIn: payload.whatsappOptIn === true,
          welcomeMessageSent: Boolean(prior.welcomeMessageSent),
        });
        const queued = Boolean(welcomeResult?.queued || welcomeResult?.duplicate);
        const status = queued ? 'QUEUED' : (welcomeResult?.skipped ? 'SKIPPED' : 'FAILED');
        await Promise.all([
          userRef.set(
            {
              welcomeMessageQueued: queued,
              welcomeMessageStatus: status,
              welcomeMessageQueuedAt: queued ? new Date().toISOString() : null,
              welcomeSkipReason: welcomeResult?.reason || null,
            },
            { merge: true },
          ),
          legacyRef.set(
            {
              welcomeMessageQueued: queued,
              welcomeMessageStatus: status,
              welcomeMessageQueuedAt: queued ? new Date().toISOString() : null,
              welcomeSkipReason: welcomeResult?.reason || null,
            },
            { merge: true },
          ),
        ]).catch(() => {});
      } catch (e) {
        console.warn('[WHATSAPP_TRACE] WELCOME_EVENT_CREATE_FAILED', e?.message);
        await Promise.all([
          userRef.set({ welcomeMessageQueued: false, welcomeMessageStatus: 'FAILED' }, { merge: true }),
          legacyRef.set({ welcomeMessageQueued: false, welcomeMessageStatus: 'FAILED' }, { merge: true }),
        ]).catch(() => {});
      }
    }

    try {
      const snap = await userRef.get();
      return /** @type {UserProfile} */ (snap.data() || { uid: user.uid, ...payload });
    } catch {
      return /** @type {UserProfile} */ ({ uid: user.uid, ...payload });
    }
  }

  /**
   * Safe canonical wrapper for Google profile sync.
   * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User} user
   */
  static async saveGoogleUserProfile(user) {
    if (!user?.uid) throw new Error('Missing Google user uid');
    return this.syncUserToFirestore(user, {
      authProvider: 'google',
      extra: {
        name: user.displayName || undefined,
        email: user.email || undefined,
        photoURL: user.photoURL || undefined,
      },
    });
  }

  /**
   * Persist first-time welcome completion. Never throws — signup/home must proceed.
   */
  static async markWelcomeExperienceComplete(uid) {
    if (!uid) return { success: false };
    const { buildWelcomeExperienceCompletePatch } = require('../onboarding/welcomeExperience');
    const patch = {
      ...buildWelcomeExperienceCompletePatch(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    try {
      await Promise.all([
        usersCollection().doc(uid).set(patch, { merge: true }),
        legacyUsersCollection().doc(uid).set(patch, { merge: true }),
      ]);
      return { success: true };
    } catch (error) {
      console.warn('[UserService] welcome experience complete note:', error?.message || error);
      return { success: false, error: error?.message };
    }
  }

  /**
   * Fetch a user profile by canonical uid (or auth uid via mapping).
   * @param {string} uid
   * @returns {Promise<UserProfile | null>}
   */
  static async getProfile(uid) {
    if (!uid) return null;
    try {
      // 1. Check L1/Persistent Canonical Identity
      const cached = await IdentityResolver.findExistingCanonicalProfile({ currentUid: uid });
      if (cached) return cached;

      // 2. Fetch from Firestore users collection
      const snap = await usersCollection().doc(uid).get();
      if (snap.exists) {
        const data = snap.data();
        if (data?.canonicalUserId && data.canonicalUserId !== uid) {
          const canonicalSnap = await usersCollection().doc(data.canonicalUserId).get();
          if (canonicalSnap.exists) {
            const resolved = /** @type {UserProfile} */ ({ uid: data.canonicalUserId, ...canonicalSnap.data() });
            IdentityResolver.updateCachedProfile(resolved);
            return resolved;
          }
        }
        const resolved = /** @type {UserProfile} */ ({ uid, ...data });
        IdentityResolver.updateCachedProfile(resolved);
        return resolved;
      }

      const legacy = await legacyUsersCollection().doc(uid).get();
      if (!legacy.exists) return null;
      const resolved = /** @type {UserProfile} */ ({ uid, ...legacy.data() });
      IdentityResolver.updateCachedProfile(resolved);
      return resolved;
    } catch (e) {
      console.warn('[UserService] getProfile error:', e?.message || e);
      return null;
    }
  }

  /**
   * Update editable profile fields (name, phone, address, photo).
   * Writes to authoritative users/{canonicalUserId}.
   * @param {string} uid
   * @param {Partial<Pick<UserProfile, 'name' | 'phone' | 'address' | 'pincode' | 'photoURL' | 'email'>> & { whatsappRemindersOptOut?: boolean }} updates
   * @returns {Promise<{ success: boolean, profile?: UserProfile, error?: string }>}
   */
  static async updateProfile(uid, updates) {
    Haptics.tap();

    try {
      if (!uid) throw new Error('Missing user id');

      const existingProfile = await this.getProfile(uid);
      const targetUid = existingProfile?.canonicalUserId || existingProfile?.uid || uid;

      const allowed = {};
      if (typeof updates.name === 'string') {
        const cleanName = IdentityResolver.sanitizeDisplayName(updates.name);
        if (cleanName) allowed.name = cleanName;
      }

      // Check phone uniqueness BEFORE doing any database write!
      let requestedPhone = null;
      if (typeof updates.phone === 'string' && updates.phone.trim()) {
        requestedPhone = updates.phone;
      } else if (typeof updates.phoneNumber === 'string' && updates.phoneNumber.trim()) {
        requestedPhone = updates.phoneNumber;
      }

      if (requestedPhone) {
        const norm = normalizeCanonicalPhone(requestedPhone);
        if (!norm) {
          throw new Error('Enter a valid mobile number with country code (e.g. +91XXXXXXXXXX)');
        }
        // Check if phone number is already registered to another user
        const check = await IdentityResolver.checkIdentityAvailable({
          phone: norm,
          excludeUid: targetUid,
        });
        if (!check.available) {
          throw new Error('This mobile number is already linked to another account.');
        }
        allowed.phone = norm;
        allowed.phoneNumber = norm;
        allowed.normalizedPhoneNumber = norm;
      }

      // Check email uniqueness BEFORE doing any database write!
      if (typeof updates.email === 'string' && updates.email.trim()) {
        const normEmail = normalizeCanonicalEmail(updates.email);
        if (normEmail) {
          const check = await IdentityResolver.checkIdentityAvailable({
            email: normEmail,
            excludeUid: targetUid,
          });
          if (!check.available) {
            throw new Error(check.message || 'This email is already associated with another account.');
          }
          allowed.email = normEmail;
        }
      }

      if (typeof updates.address === 'string') allowed.address = updates.address.trim();
      if (typeof updates.city === 'string') allowed.city = updates.city.trim();
      if (typeof updates.state === 'string') allowed.state = updates.state.trim();
      if (typeof updates.pincode === 'string' && updates.pincode.trim()) {
        const pinCheck = validateIndianPincode(updates.pincode);
        if (!pinCheck.valid) {
          throw new Error(pinCheck.error || 'Invalid 6-digit Indian PIN Code');
        }
        allowed.pincode = pinCheck.pincode;
        if (!allowed.state || !allowed.city) {
          const auto = lookupPincode(pinCheck.pincode);
          if (auto) {
            if (!allowed.state && auto.state) allowed.state = auto.state;
            if (!allowed.city && auto.city) allowed.city = auto.city;
          }
        }
      }
      if (typeof updates.photoURL === 'string') allowed.photoURL = updates.photoURL.trim();
      if (typeof updates.gender === 'string') {
        const g = updates.gender.trim().toLowerCase();
        if (['male', 'female', 'other', ''].includes(g)) allowed.gender = g;
      }
      if (typeof updates.profileSetupComplete === 'boolean') {
        allowed.profileSetupComplete = updates.profileSetupComplete;
      }
      if (typeof updates.pushRemindersOptOut === 'boolean') {
        allowed.pushRemindersOptOut = updates.pushRemindersOptOut;
      }
      if (typeof updates.whatsappRemindersOptOut === 'boolean') {
        allowed.whatsappRemindersOptOut = updates.whatsappRemindersOptOut;
        if (typeof updates.pushRemindersOptOut !== 'boolean') {
          allowed.pushRemindersOptOut = updates.whatsappRemindersOptOut;
        }
      }

      if (Object.keys(allowed).length === 0) {
        throw new Error('No valid profile fields to update');
      }

      // Atomically reserve identity mappings if phone or email is being updated
      const now = new Date().toISOString();
      const db = firestore();
      const batch = db.batch ? db.batch() : null;

      const userPayload = {
        ...allowed,
        canonicalUserId: targetUid,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (batch) {
        batch.set(usersCollection().doc(targetUid), userPayload, { merge: true });
        batch.set(legacyUsersCollection().doc(targetUid), userPayload, { merge: true });
        if (allowed.phone) {
          batch.set(
            db.collection('identityMappings').doc(`phone:${allowed.phone}`),
            {
              canonicalUserId: targetUid,
              identityType: 'phone',
              identityValue: allowed.phone,
              verified: true,
              updatedAt: now,
            },
            { merge: true }
          );
        }
        if (allowed.email) {
          batch.set(
            db.collection('identityMappings').doc(`email:${allowed.email}`),
            {
              canonicalUserId: targetUid,
              identityType: 'email',
              identityValue: allowed.email,
              verified: true,
              updatedAt: now,
            },
            { merge: true }
          );
        }
        await batch.commit();
      } else {
        await Promise.all([
          usersCollection().doc(targetUid).set(userPayload, { merge: true }),
          legacyUsersCollection().doc(targetUid).set(userPayload, { merge: true }),
        ]);
        if (allowed.phone) {
          await db.collection('identityMappings').doc(`phone:${allowed.phone}`).set(
            {
              canonicalUserId: targetUid,
              identityType: 'phone',
              identityValue: allowed.phone,
              verified: true,
              updatedAt: now,
            },
            { merge: true }
          );
        }
        if (allowed.email) {
          await db.collection('identityMappings').doc(`email:${allowed.email}`).set(
            {
              canonicalUserId: targetUid,
              identityType: 'email',
              identityValue: allowed.email,
              verified: true,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      }

      IdentityResolver.updateCachedProfile({ uid: targetUid, canonicalUserId: targetUid, ...allowed });
      if (uid !== targetUid) {
        IdentityResolver.updateCachedProfile({ uid, canonicalUserId: targetUid, ...allowed });
      }
      const profile = await this.getProfile(uid);
      if (profile) IdentityResolver.updateCachedProfile(profile);
      Haptics.success();
      return { success: true, profile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to update profile' };
    }
  }

  /**
   * Optional profile polish after sign-in. Phone is NOT required.
   * Validates uniqueness if phone or email is supplied.
   */
  static async completeProfileSetup(uid, { name, fullName, phone, phoneNumber, pincode, pinCode, city, state, email, photoURL, skipPhone, skipPhoneCheck } = {}) {
    Haptics.tap();
    try {
      if (!uid) throw new Error('Missing user id');
      const cleanName = IdentityResolver.sanitizeDisplayName(fullName || name);
      if (!cleanName || cleanName.length < 2) {
        throw new Error('Full Name is required (minimum 2 characters).');
      }

      const rawPin = pinCode || pincode;
      const pinCheck = validateIndianPincode(rawPin);
      if (!pinCheck.valid) {
        throw new Error(pinCheck.error || 'Valid 6-digit Indian PIN Code is required.');
      }

      const cleanCity = String(city || '').trim();
      if (!cleanCity) {
        throw new Error('City is required.');
      }

      const cleanState = String(state || '').trim();
      if (!cleanState) {
        throw new Error('State is required.');
      }

      const cleanPhone = normalizeCanonicalPhone(phoneNumber || phone);
      const cleanEmail = normalizeCanonicalEmail(email);

      if (cleanPhone && !skipPhone && !skipPhoneCheck) {
        const check = await IdentityResolver.checkIdentityAvailable({ phone: cleanPhone, excludeUid: uid });
        if (!check.available) {
          throw new Error('This mobile number is already linked to another account.');
        }
      }

      if (cleanEmail) {
        const check = await IdentityResolver.checkIdentityAvailable({ email: cleanEmail, excludeUid: uid });
        if (!check.available) {
          throw new Error(check.message || 'This email is already associated with another account.');
        }
      }

      const payload = {
        name: cleanName,
        fullName: cleanName,
        pincode: pinCheck.pincode,
        pinCode: pinCheck.pincode,
        city: cleanCity,
        state: cleanState,
        isProfileComplete: true,
        profileSetupComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (cleanEmail) payload.email = cleanEmail;

      if (cleanPhone && !skipPhone) {
        payload.phone = cleanPhone;
        payload.phoneNumber = cleanPhone;
        payload.normalizedPhoneNumber = cleanPhone;
      }

      if (typeof photoURL === 'string' && photoURL.trim()) {
        payload.photoURL = photoURL.trim();
      }

      await Promise.all([
        usersCollection().doc(uid).set(payload, { merge: true }),
        legacyUsersCollection().doc(uid).set(payload, { merge: true }),
      ]);

      const localRecord = {
        uid,
        name: cleanName,
        fullName: cleanName,
        pincode: pinCheck.pincode,
        pinCode: pinCheck.pincode,
        city: cleanCity,
        state: cleanState,
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        photoURL: payload.photoURL || undefined,
        isProfileComplete: true,
        profileSetupComplete: true,
      };

      // Immediately update L1 cache so getProfile and listeners never see stale pre-save state
      IdentityResolver.updateCachedProfile(localRecord);

      // Atomically sync to local persistent cache
      await saveLocalProfile(localRecord, uid).catch(() => {});

      // Verify Firestore write-back
      const snap = await usersCollection().doc(uid).get().catch(() => null);
      const confirmedProfile = snap?.exists
        ? { uid, ...snap.data(), ...localRecord }
        : localRecord;
      IdentityResolver.updateCachedProfile(confirmedProfile);

      Haptics.success();
      return { success: true, profile: confirmedProfile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Profile setup failed' };
    }
  }

  /** Count non-deleted assets in Users/{uid}/Assets */
  static async countVaultedAssets(uid) {
    if (!uid) return 0;
    try {
      const snap = await legacyUsersCollection().doc(uid).collection('Assets').get();
      return snap.docs.filter((d) => !d.data()?.deletedAt).length;
    } catch {
      return 0;
    }
  }

  /**
   * Subscribe to live profile changes.
   * @param {string} uid
   * @param {(profile: UserProfile | null) => void} onChange
   * @returns {() => void} unsubscribe
   */
  static subscribeToProfile(uid, onChange) {
    if (!uid) {
      onChange(null);
      return () => {};
    }

    let cancelled = false;

    // Prefer primary users/{uid}; fall back to legacy Users/{uid} once if needed
    const unsub = usersCollection()
      .doc(uid)
      .onSnapshot(
        async (snap) => {
          if (cancelled) return;
          if (snap.exists) {
            onChange(/** @type {UserProfile} */ ({ uid, ...snap.data() }));
            return;
          }
          try {
            const legacy = await legacyUsersCollection().doc(uid).get();
            if (cancelled) return;
            if (legacy.exists) {
              onChange(/** @type {UserProfile} */ ({ uid, ...legacy.data() }));
              return;
            }
          } catch {
            /* ignore — keep prior profile */
          }
          // Do NOT emit null here — AuthProvider keeps auth fallback / last profile
          onChange(undefined);
        },
        (error) => {
          console.warn('[UserService] profile subscribe error:', error?.message || error);
          // Never clear a signed-in session to "Guest" on a transient listener error
          onChange(undefined);
        },
      );

    return () => {
      cancelled = true;
      unsub();
    };
  }
}

export default UserService;
