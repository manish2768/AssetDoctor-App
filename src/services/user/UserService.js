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

export class UserService {
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
    const verifiedPhone =
      options.extra?.phoneNumber ||
      options.extra?.phone ||
      user.phoneNumber ||
      prior.phoneNumber ||
      prior.phone ||
      '';

    const resolvedName = resolveDisplayName({
      provided: options.extra?.name,
      existing: prior.name,
      authDisplayName: user.displayName,
      phone: verifiedPhone,
    });

    /** @type {Partial<UserProfile>} */
    const payload = {
      uid: user.uid,
      email: user.email || prior.email || '',
      phone: verifiedPhone,
      phoneNumber: verifiedPhone,
      name: resolvedName,
      photoURL: user.photoURL || prior.photoURL || '',
      authProvider: options.authProvider || prior.authProvider || 'unknown',
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...options.extra,
    };

    // Keep resolved name even if extra omitted name / sent placeholder
    payload.name = resolveDisplayName({
      provided: payload.name,
      existing: prior.name,
      authDisplayName: user.displayName,
      phone: verifiedPhone,
    });
    payload.phone = verifiedPhone || payload.phone || '';
    payload.phoneNumber = verifiedPhone || payload.phoneNumber || '';

    if (!legacyExisting.exists) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
      payload.address = options.extra?.address || '';
    }

    try {
      await Promise.all([
        userRef.set(payload, { merge: true }),
        legacyRef.set(payload, { merge: true }),
      ]);
    } catch (error) {
      // Auth can succeed even if Firestore rules are not deployed yet
      console.warn('[UserService] profile write blocked:', error?.message || error);
      return {
        uid: user.uid,
        email: payload.email || '',
        phone: payload.phone || '',
        name: payload.name || '',
        photoURL: payload.photoURL || '',
        authProvider: payload.authProvider || 'unknown',
        address: payload.address || '',
        pendingFirestoreSync: true,
      };
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
          throw new Error(
            identity.message || 'Phone number / Email is already registered with another account.',
          );
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
   * First-time profile setup after Gmail / email sign-in.
   * Phone is stored after uniqueness check; prefer Auth linkPhone OTP for verified phone.
   */
  static async completeProfileSetup(uid, { name, phone, phoneNumber, photoURL } = {}) {
    Haptics.tap();
    try {
      if (!uid) throw new Error('Missing user id');
      const cleanName = String(name || '').trim();
      const cleanPhone = String(phoneNumber || phone || '').trim();
      if (!cleanName) throw new Error('Full name is required');
      if (!cleanPhone) throw new Error('Mobile number is required');

      const { IdentityService } = require('../auth/IdentityService');
      const identity = await IdentityService.checkAvailable({
        phone: cleanPhone,
        excludeUid: uid,
      });
      if (!identity.available) {
        throw new Error(
          identity.message || 'Phone number is already registered with another account.',
        );
      }

      const payload = {
        name: cleanName,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        profileSetupComplete: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
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
