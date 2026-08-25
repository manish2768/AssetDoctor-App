/**
 * Local profile cache — survives restarts and updates Home greeting instantly.
 * Key name matches product contract: user_profile_data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_PROFILE_DATA_KEY = 'user_profile_data';

export const DEFAULT_PROFILE = Object.freeze({
  name: 'Manish Kumar Rai',
  email: '',
  phone: '',
  city: '',
  address: '',
  pincode: '',
  photoURL: '',
  gender: '',
});

export async function loadLocalProfile() {
  try {
    const raw = await AsyncStorage.getItem(USER_PROFILE_DATA_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PROFILE };
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      name: String(parsed.name || DEFAULT_PROFILE.name).trim() || DEFAULT_PROFILE.name,
      email: String(parsed.email || '').trim(),
      phone: String(parsed.phone || parsed.phoneNumber || '').trim(),
      phoneNumber: String(parsed.phone || parsed.phoneNumber || '').trim(),
      city: String(parsed.city || '').trim(),
      address: String(parsed.address || '').trim(),
      pincode: String(parsed.pincode || '').trim(),
      photoURL: String(parsed.photoURL || '').trim(),
      gender: String(parsed.gender || '').trim().toLowerCase(),
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch (error) {
    console.warn('[userProfileStorage] load failed:', error?.message || error);
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveLocalProfile(updates = {}) {
  try {
    const current = await loadLocalProfile();
    const next = {
      ...current,
      ...updates,
      name:
        String(updates.name != null ? updates.name : current.name || DEFAULT_PROFILE.name).trim() ||
        DEFAULT_PROFILE.name,
      email: String(updates.email != null ? updates.email : current.email || '').trim(),
      phone: String(
        updates.phone != null
          ? updates.phone
          : updates.phoneNumber != null
            ? updates.phoneNumber
            : current.phone || '',
      ).trim(),
      city: String(updates.city != null ? updates.city : current.city || '').trim(),
      address: String(updates.address != null ? updates.address : current.address || '').trim(),
      pincode: String(updates.pincode != null ? updates.pincode : current.pincode || '').trim(),
      photoURL: String(
        updates.photoURL != null ? updates.photoURL : current.photoURL || '',
      ).trim(),
      gender: String(updates.gender != null ? updates.gender : current.gender || '')
        .trim()
        .toLowerCase(),
      updatedAt: Date.now(),
    };
    next.phoneNumber = next.phone;
    await AsyncStorage.setItem(USER_PROFILE_DATA_KEY, JSON.stringify(next));
    return { success: true, profile: next };
  } catch (error) {
    console.warn('[userProfileStorage] save failed:', error?.message || error);
    return { success: false, error: error?.message || 'Could not save profile locally' };
  }
}

export default {
  USER_PROFILE_DATA_KEY,
  DEFAULT_PROFILE,
  loadLocalProfile,
  saveLocalProfile,
};
