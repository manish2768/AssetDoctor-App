/**
 * Asset Doctor — User Profile Service (Firestore)
 * Creates / reads / updates user documents under Users/{uid}.
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS, DEFAULT_DISPLAY_NAME } from '../constants';
import { Haptics } from '../haptics/triggerHaptic';

/**
 * @typedef {Object} UserProfile
 * @property {string} uid
 * @property {string} email
 * @property {string} phone
 * @property {string} name
 * @property {string} [address]
 * @property {string} [photoURL]
 * @property {string} [authProvider] - 'google' | 'phone' | 'unknown'
 * @property {FirebaseFirestoreTypes.FieldValue | Date} [createdAt]
 * @property {FirebaseFirestoreTypes.FieldValue | Date} [updatedAt]
 */

function usersCollection() {
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
    const existing = await userRef.get();

    /** @type {Partial<UserProfile>} */
    const payload = {
      uid: user.uid,
      email: user.email || existing.data()?.email || '',
      phone: user.phoneNumber || existing.data()?.phone || '',
      name: user.displayName || existing.data()?.name || DEFAULT_DISPLAY_NAME,
      photoURL: user.photoURL || existing.data()?.photoURL || '',
      authProvider: options.authProvider || existing.data()?.authProvider || 'unknown',
      updatedAt: firestore.FieldValue.serverTimestamp(),
      ...options.extra,
    };

    if (!existing.exists) {
      payload.createdAt = firestore.FieldValue.serverTimestamp();
      payload.address = options.extra?.address || '';
    }

    await userRef.set(payload, { merge: true });

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
    if (!snap.exists) return null;
    return /** @type {UserProfile} */ ({ uid, ...snap.data() });
  }

  /**
   * Update editable profile fields (name, phone, address, photo).
   * Triggers success/error haptics.
   * @param {string} uid
   * @param {Partial<Pick<UserProfile, 'name' | 'phone' | 'address' | 'photoURL' | 'email'>>} updates
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
      if (typeof updates.photoURL === 'string') allowed.photoURL = updates.photoURL.trim();
      if (typeof updates.email === 'string') allowed.email = updates.email.trim();

      if (Object.keys(allowed).length === 0) {
        throw new Error('No valid profile fields to update');
      }

      await usersCollection().doc(uid).set(
        {
          ...allowed,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

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
