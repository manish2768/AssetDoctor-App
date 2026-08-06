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
 * @property {string} [authProvider] - 'google' | 'phone' | 'unknown'
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

    const verifiedPhone =
      user.phoneNumber ||
      legacyExisting.data()?.phoneNumber ||
      legacyExisting.data()?.phone ||
      '';

    /** @type {Partial<UserProfile>} */
    const payload = {
      uid: user.uid,
      email: user.email || legacyExisting.data()?.email || '',
      phone: verifiedPhone,
      /** Verified Auth phone (E.164) — same as auth.currentUser.phoneNumber when linked */
      phoneNumber: verifiedPhone,
      name: user.displayName || legacyExisting.data()?.name || DEFAULT_DISPLAY_NAME,
      photoURL: user.photoURL || legacyExisting.data()?.photoURL || '',
      authProvider: options.authProvider || legacyExisting.data()?.authProvider || 'unknown',
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...options.extra,
    };

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
        name: payload.name || DEFAULT_DISPLAY_NAME,
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
      if (typeof updates.whatsappRemindersOptOut === 'boolean') {
        allowed.whatsappRemindersOptOut = updates.whatsappRemindersOptOut;
      }

      if (Object.keys(allowed).length === 0) {
        throw new Error('No valid profile fields to update');
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

    return usersCollection()
      .doc(uid)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) {
            onChange(null);
            return;
          }
          onChange(/** @type {UserProfile} */ ({ uid, ...snap.data() }));
        },
        () => {
          Haptics.error();
          onChange(null);
        },
      );
  }
}

export default UserService;
