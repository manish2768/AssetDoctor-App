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

/**
 * Resolve a display name without inventing "Asset Owner".
 * Preference: provided name → existing profile → Auth displayName (if not placeholder) → phone → ''.
 */
function resolveDisplayName({ provided, existing, authDisplayName, phone } = {}) {
  const clean = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (s === DEFAULT_DISPLAY_NAME) return '';
    return s.slice(0, 80);
  };
  return (
    clean(provided) ||
    clean(existing) ||
    clean(authDisplayName) ||
    clean(phone) ||
    ''
  );
}

/**
 * Normalize phone numbers strictly to E.164 format (e.g. "+919918288299").
 */
export function normalizeE164Phone(value) {
  if (!value) return '';
  const trimmed = String(value).replace(/[^\d+]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return `+${trimmed}`;
}

export class UserService {
  /**
   * Single identity resolution mechanism that looks up a customer by phone number.
   * Handles all Indian & International formats (+91 99182 88299, 9918288299, +919918288299).
   * @param {string} phoneNumber
   * @returns {Promise<UserProfile | null>}
   */
  static async resolveCustomerByPhone(phoneNumber) {
    if (!phoneNumber) return null;
    const normalized = normalizeE164Phone(phoneNumber);
    const rawDigits = normalized.replace(/\D/g, '');
    const tenDigits = rawDigits.slice(-10);

    const candidates = [
      normalized,
      rawDigits,
      tenDigits,
      `+91${tenDigits}`,
      `91${tenDigits}`,
    ];

    try {
      for (const phoneVariant of candidates) {
        if (!phoneVariant) continue;
        const q1 = await usersCollection().where('normalizedPhoneNumber', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q1.empty && q1.docs?.[0]) return { uid: q1.docs[0].id, customerId: q1.docs[0].id, ...q1.docs[0].data() };

        const q2 = await usersCollection().where('phoneNumber', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q2.empty && q2.docs?.[0]) return { uid: q2.docs[0].id, customerId: q2.docs[0].id, ...q2.docs[0].data() };

        const q3 = await usersCollection().where('phone', '==', phoneVariant).limit(1).get().catch(() => ({ empty: true }));
        if (!q3.empty && q3.docs?.[0]) return { uid: q3.docs[0].id, customerId: q3.docs[0].id, ...q3.docs[0].data() };
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

    const normalizedPhone = normalizeE164Phone(rawPhone);

    const resolvedName = resolveDisplayName({
      provided: options.extra?.name,
      existing: prior.name,
      authDisplayName: user.displayName,
      phone: normalizedPhone || rawPhone,
    });

    const isNewUser = !legacyExisting.exists && !existing.exists;

    /** @type {Partial<UserProfile>} */
    const payload = {
      uid: user.uid,
      customerId: user.uid,
      email: user.email || prior.email || '',
      phone: rawPhone || prior.phone || '',
      phoneNumber: rawPhone || prior.phoneNumber || '',
      normalizedPhoneNumber: normalizedPhone || prior.normalizedPhoneNumber || '',
      whatsappNumber: normalizedPhone || prior.whatsappNumber || '',
      whatsappLinked: Boolean(normalizedPhone || prior.whatsappLinked),
      whatsappOptIn: typeof prior.whatsappOptIn === 'boolean' ? prior.whatsappOptIn : true,
      whatsappOptInSource: prior.whatsappOptInSource || options.authProvider || 'signup',
      welcomeMessageSent: Boolean(prior.welcomeMessageSent),
      welcomeMessageSentAt: prior.welcomeMessageSentAt || null,
      name: resolvedName,
      photoURL: user.photoURL || prior.photoURL || '',
      authProvider: options.authProvider || prior.authProvider || 'unknown',
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
    const shouldAttemptWelcome = isNewUser || prior.welcomeMessageQueued === false;
    if (shouldAttemptWelcome) {
      try {
        console.log('[WHATSAPP_TRACE] AUTH_SUCCESS', user.uid);
        console.log('[WHATSAPP_TRACE] USER_CREATED', isNewUser ? 'new' : 'retry_unqueued');
        console.log('[WHATSAPP_TRACE] NEW_USER_DETECTED', isNewUser);
        const { enqueueWelcomeWhatsApp } = await import('../whatsapp/WhatsAppQueueService.js');
        const welcomeResult = await enqueueWelcomeWhatsApp({
          userId: user.uid,
          phone: normalizedPhone || rawPhone,
          userName: resolvedName || 'Valued Member',
          customerType: 'NEW',
          whatsappOptIn: payload.whatsappOptIn === true,
          welcomeMessageSent: Boolean(prior.welcomeMessageSent),
        });
        const queued = Boolean(welcomeResult?.queued || welcomeResult?.duplicate);
        await Promise.all([
          userRef.set(
            {
              welcomeMessageQueued: queued,
              welcomeMessageQueuedAt: queued ? new Date().toISOString() : null,
              welcomeSkipReason: welcomeResult?.reason || null,
            },
            { merge: true },
          ),
          legacyRef.set(
            {
              welcomeMessageQueued: queued,
              welcomeMessageQueuedAt: queued ? new Date().toISOString() : null,
              welcomeSkipReason: welcomeResult?.reason || null,
            },
            { merge: true },
          ),
        ]).catch(() => {});
      } catch (e) {
        console.warn('[WHATSAPP_TRACE] WELCOME_EVENT_CREATE_FAILED', e?.message);
        await Promise.all([
          userRef.set({ welcomeMessageQueued: false }, { merge: true }),
          legacyRef.set({ welcomeMessageQueued: false }, { merge: true }),
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
   * Persist Google account identity fields under users/{userId}.
   * Fields: uid, name, email, photoURL, createdAt
   * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User} user
   */
  static async saveGoogleUserProfile(user) {
    if (!user?.uid) throw new Error('Missing Google user uid');

    const userRef = usersCollection().doc(user.uid);
    const existing = await userRef.get();

    const payload = {
      uid: user.uid,
      name: user.displayName || DEFAULT_DISPLAY_NAME,
      email: user.email || '',
      photoURL: user.photoURL || '',
      authProvider: 'google',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    if (!existing.exists) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
    }

    await Promise.all([
      userRef.set(payload, { merge: true }),
      legacyUsersCollection().doc(user.uid).set(payload, { merge: true }),
    ]);

    const snap = await userRef.get();
    return /** @type {UserProfile} */ (snap.data());
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
   * Fetch a user profile by uid.
   * @param {string} uid
   * @returns {Promise<UserProfile | null>}
   */
  static async getProfile(uid) {
    if (!uid) return null;
    const snap = await usersCollection().doc(uid).get();
    if (snap.exists) {
      return /** @type {UserProfile} */ ({ uid, ...snap.data() });
    }
    const legacy = await legacyUsersCollection().doc(uid).get();
    if (!legacy.exists) return null;
    return /** @type {UserProfile} */ ({ uid, ...legacy.data() });
  }

  /**
   * Update editable profile fields (name, phone, address, photo).
   * Triggers success/error haptics.
   * @param {string} uid
   * @param {Partial<Pick<UserProfile, 'name' | 'phone' | 'address' | 'pincode' | 'photoURL' | 'email'>> & { whatsappRemindersOptOut?: boolean }} updates
   * @returns {Promise<{ success: boolean, profile?: UserProfile, error?: string }>}
   */
  static async updateProfile(uid, updates) {
    Haptics.tap();

    try {
      if (!uid) throw new Error('Missing user id');

      const allowed = {};
      if (typeof updates.name === 'string') allowed.name = updates.name.trim();
      if (typeof updates.phone === 'string') allowed.phone = updates.phone.trim();
      if (typeof updates.address === 'string') allowed.address = updates.address.trim();
      if (typeof updates.pincode === 'string') allowed.pincode = updates.pincode.trim();
      if (typeof updates.photoURL === 'string') allowed.photoURL = updates.photoURL.trim();
      if (typeof updates.email === 'string') allowed.email = updates.email.trim();
      if (typeof updates.gender === 'string') {
        const g = updates.gender.trim().toLowerCase();
        if (['male', 'female', 'other', ''].includes(g)) allowed.gender = g;
      }
      if (typeof updates.phoneNumber === 'string') {
        allowed.phoneNumber = updates.phoneNumber.trim();
        if (!allowed.phone) allowed.phone = allowed.phoneNumber;
      }
      if (typeof updates.profileSetupComplete === 'boolean') {
        allowed.profileSetupComplete = updates.profileSetupComplete;
      }
      if (typeof updates.pushRemindersOptOut === 'boolean') {
        allowed.pushRemindersOptOut = updates.pushRemindersOptOut;
      }
      if (typeof updates.whatsappRemindersOptOut === 'boolean') {
        // Legacy mirror — prefer pushRemindersOptOut going forward
        allowed.whatsappRemindersOptOut = updates.whatsappRemindersOptOut;
        if (typeof updates.pushRemindersOptOut !== 'boolean') {
          allowed.pushRemindersOptOut = updates.whatsappRemindersOptOut;
        }
      }

      if (Object.keys(allowed).length === 0) {
        throw new Error('No valid profile fields to update');
      }

      if (allowed.phone || allowed.phoneNumber || allowed.email) {
        const { IdentityService } = require('../auth/IdentityService');
        const identity = await IdentityService.checkAvailable({
          phone: allowed.phoneNumber || allowed.phone,
          email: allowed.email,
          excludeUid: uid,
        });
        if (!identity.available) {
          // Never hard-block profile save for phone taken elsewhere — Auth OTP link merges sessions
          if (identity.field === 'phone' || allowed.phone || allowed.phoneNumber) {
            delete allowed.phone;
            delete allowed.phoneNumber;
            if (Object.keys(allowed).length === 0) {
              return {
                success: true,
                profile: await this.getProfile(uid),
                phoneNeedsOtpLink: true,
                message:
                  'This mobile is already used for login. Use Verify mobile (OTP) in Profile to connect it seamlessly.',
              };
            }
          } else {
            throw new Error(
              identity.message ||
                'This email is already on another account. Sign in with that email instead.',
            );
          }
        }
      }

      await Promise.all([
        usersCollection().doc(uid).set(
          {
            ...allowed,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
        legacyUsersCollection().doc(uid).set(
          {
            ...allowed,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ]);

      const profile = await this.getProfile(uid);
      Haptics.success();
      return { success: true, profile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to update profile' };
    }
  }

  /**
   * Optional profile polish after sign-in. Phone is NOT required.
   * Already-registered phones never block — caller should use Phone OTP sign-in instead.
   */
  static async completeProfileSetup(uid, { name, phone, phoneNumber, photoURL, skipPhone, skipPhoneCheck } = {}) {
    Haptics.tap();
    try {
      if (!uid) throw new Error('Missing user id');
      const cleanName = String(name || '').trim() || 'Asset Owner';
      const cleanPhone = String(phoneNumber || phone || '').trim();

      const payload = {
        name: cleanName,
        profileSetupComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (cleanPhone && !skipPhone) {
        if (!skipPhoneCheck) {
          const { IdentityService } = require('../auth/IdentityService');
          const identity = await IdentityService.checkAvailable({
            phone: cleanPhone,
            excludeUid: uid,
          });
          // Do not throw — optional phone; skip storing if owned by another account
          if (identity.available) {
            payload.phone = cleanPhone;
            payload.phoneNumber = cleanPhone;
          }
        } else {
          payload.phone = cleanPhone;
          payload.phoneNumber = cleanPhone;
        }
      }

      if (typeof photoURL === 'string' && photoURL.trim()) {
        payload.photoURL = photoURL.trim();
      }

      await Promise.all([
        usersCollection().doc(uid).set(payload, { merge: true }),
        legacyUsersCollection().doc(uid).set(payload, { merge: true }),
      ]);

      const profile = await this.getProfile(uid);
      Haptics.success();
      return { success: true, profile };
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
