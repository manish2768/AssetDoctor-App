/**
 * Privacy preferences — vault lock already in AppLockService.
 * These prefs control notification privacy and backup status display.
 */

let _storage = null;
async function getStorage() {
  if (!_storage) {
    const mod = await import('./EncryptedVaultStorage');
    _storage = mod.EncryptedVaultStorage;
  }
  return _storage;
}

const KEY = (uid) => `@asset_doctor/privacy_prefs_v1/${uid || 'guest'}`;

const DEFAULTS = Object.freeze({
  notificationPrivacy: true, // hide plates / detailed names on lock screen
  crashlyticsEmail: false,
  vaultLockEnabled: null, // null = defer to AppLockService
  updatedAt: null,
});

export async function getPrivacyPrefs(userId) {
  try {
    const storage = await getStorage();
    const stored = await storage.getJSON(KEY(userId), null);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setPrivacyPrefs(userId, patch = {}) {
  const current = await getPrivacyPrefs(userId);
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  try {
    const storage = await getStorage();
    await storage.setJSON(KEY(userId), next);
  } catch {
    // Graceful fallback if storage unavailable
  }
  return next;
}

/**
 * Redact plate-like / overly specific asset labels for notifications.
 */
export function privacySafeAssetLabel(asset = {}, privacyOn = true) {
  const raw = String(asset.nickname || asset.assetName || 'Asset').trim() || 'Asset';
  if (!privacyOn) return raw;
  // Indian plate patterns / long alphanumeric codes
  if (/^[A-Z]{2}[-\s]?\d{1,2}[-\s]?[A-Z]{1,3}[-\s]?\d{3,4}$/i.test(raw.replace(/\s+/g, ' '))) {
    return 'Your vehicle';
  }
  if (/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/i.test(raw.replace(/[\s-]/g, ''))) {
    return 'Your vehicle';
  }
  if (/\b\d{10,}\b/.test(raw)) return 'Your asset';
  // Truncate very long names
  if (raw.length > 28) return `${raw.slice(0, 24)}…`;
  return raw;
}

export default { getPrivacyPrefs, setPrivacyPrefs, privacySafeAssetLabel };
