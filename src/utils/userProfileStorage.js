/**
 * Asset Doctor — Canonical User-Scoped Local Profile Cache
 * Storage key format: `user_profile_data:<canonicalUserId>`
 * Prevents cross-user cache contamination on logout / account switching.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_PROFILE_DATA_PREFIX = 'user_profile_data';
export const USER_PROFILE_DATA_KEY = 'user_profile_data'; // fallback guest key

export const DEFAULT_PROFILE = Object.freeze({
  name: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  address: '',
  pincode: '',
  photoURL: '',
  gender: '',
});

// In-memory fallback for unit tests & environments where window/AsyncStorage is not bound
const memoryStore = new Map();

async function safeStorageGet(key) {
  try {
    if (typeof window === 'undefined' && (typeof global === 'undefined' || !global.window)) {
      return memoryStore.get(key) || null;
    }
    const val = await AsyncStorage.getItem(key);
    return val;
  } catch {
    return memoryStore.get(key) || null;
  }
}

async function safeStorageSet(key, value) {
  memoryStore.set(key, value);
  try {
    if (typeof window !== 'undefined' || (typeof global !== 'undefined' && global.window)) {
      await AsyncStorage.setItem(key, value);
    }
  } catch {
    // Memory store already set
  }
}

async function safeStorageRemove(key) {
  memoryStore.delete(key);
  try {
    if (typeof window !== 'undefined' || (typeof global !== 'undefined' && global.window)) {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Memory store already deleted
  }
}

/**
 * Returns the scoped storage key for a canonical user.
 */
export function getScopedProfileKey(canonicalUserId) {
  if (!canonicalUserId || canonicalUserId === 'guest' || canonicalUserId === 'anonymous') {
    return `${USER_PROFILE_DATA_PREFIX}:guest`;
  }
  return `${USER_PROFILE_DATA_PREFIX}:${canonicalUserId}`;
}

/**
 * Clears local profile cache for a specific user, or clears active session.
 */
export async function clearLocalProfile(canonicalUserId) {
  try {
    const key = getScopedProfileKey(canonicalUserId);
    await safeStorageRemove(key);
    await safeStorageRemove(USER_PROFILE_DATA_KEY);
  } catch (error) {
    console.warn('[userProfileStorage] clear failed:', error?.message || error);
  }
}

/**
 * Loads local profile strictly scoped to the specified canonicalUserId.
 */
export async function loadLocalProfile(canonicalUserId) {
  try {
    const key = getScopedProfileKey(canonicalUserId);
    const raw = await safeStorageGet(key);
    if (!raw) {
      return { ...DEFAULT_PROFILE };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROFILE };

    let parsedName = String(parsed.name || '').trim();
    // Disallow phone numbers or placeholders as display name
    if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(parsedName) || parsedName === 'Name not set' || parsedName === 'Asset Owner') {
      parsedName = '';
    }

    const cleanPin = String(parsed.pinCode || parsed.pincode || '').trim();
    const cleanFullName = String(parsed.fullName || parsedName).trim();

    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      canonicalUserId: canonicalUserId || parsed.canonicalUserId || '',
      name: parsedName,
      fullName: cleanFullName,
      email: String(parsed.email || '').trim(),
      phone: String(parsed.phone || parsed.phoneNumber || '').trim(),
      phoneNumber: String(parsed.phone || parsed.phoneNumber || '').trim(),
      city: String(parsed.city || '').trim(),
      state: String(parsed.state || '').trim(),
      address: String(parsed.address || '').trim(),
      pincode: cleanPin,
      pinCode: cleanPin,
      photoURL: String(parsed.photoURL || '').trim(),
      gender: String(parsed.gender || '').trim().toLowerCase(),
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch (error) {
    console.warn('[userProfileStorage] load failed:', error?.message || error);
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Saves local profile strictly scoped to the specified canonicalUserId.
 */
export async function saveLocalProfile(updates = {}, canonicalUserId) {
  try {
    const targetUserId = canonicalUserId || updates.canonicalUserId || updates.uid;
    const current = await loadLocalProfile(targetUserId);

    let cleanName = typeof (updates.fullName || updates.name) === 'string'
      ? String(updates.fullName || updates.name).trim()
      : current.name;
    if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(cleanName) || cleanName === 'Name not set' || cleanName === 'Asset Owner') {
      cleanName = '';
    }

    const cleanPin = typeof (updates.pinCode || updates.pincode) === 'string'
      ? String(updates.pinCode || updates.pincode).trim()
      : (current.pinCode || current.pincode || '');

    const merged = {
      ...current,
      ...updates,
      canonicalUserId: targetUserId || '',
      name: cleanName,
      fullName: cleanName,
      email: typeof updates.email === 'string' ? updates.email.trim() : current.email,
      phone: typeof updates.phone === 'string' ? updates.phone.trim() : (updates.phoneNumber ? String(updates.phoneNumber).trim() : current.phone),
      phoneNumber: typeof updates.phone === 'string' ? updates.phone.trim() : (updates.phoneNumber ? String(updates.phoneNumber).trim() : current.phoneNumber),
      city: typeof updates.city === 'string' ? updates.city.trim() : current.city,
      state: typeof updates.state === 'string' ? updates.state.trim() : current.state,
      address: typeof updates.address === 'string' ? updates.address.trim() : current.address,
      pincode: cleanPin,
      pinCode: cleanPin,
      photoURL: typeof updates.photoURL === 'string' ? updates.photoURL.trim() : current.photoURL,
      gender: typeof updates.gender === 'string' ? updates.gender.trim().toLowerCase() : current.gender,
      updatedAt: Date.now(),
    };

    const key = getScopedProfileKey(targetUserId);
    await safeStorageSet(key, JSON.stringify(merged));
    return { success: true, profile: merged };
  } catch (error) {
    console.warn('[userProfileStorage] save failed:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to save local profile' };
  }
}
