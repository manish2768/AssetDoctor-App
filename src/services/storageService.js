/**
 * AsyncStorage vault helpers — normalize purchase / expiry fields for Home.
 * Wraps OfflineVaultCache so Home always gets safe, typed values.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { OfflineVaultCache } from './offline/OfflineVaultCache';
import { parseFlexibleDate } from '../utils/dates';
import { toVaultValue } from '../utils/parseMoneyValue';

const GUEST_ASSETS_KEY = '@asset_doctor/assets_v2/guest_local';

function pickDate(...vals) {
  for (const v of vals) {
    const iso = parseFlexibleDate(v);
    if (iso) return iso;
  }
  return null;
}

function pickMoney(...vals) {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = toVaultValue(v, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/**
 * Ensure Home Screen fields are always present and typed.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeAssetRecord(raw = {}) {
  if (!raw || typeof raw !== 'object') return raw;

  const purchasePrice = pickMoney(
    raw.purchasePrice,
    raw.value,
    raw.totalAmount,
    raw.price,
    raw.invoiceMeta?.totalAmount,
    raw.invoiceMeta?.grandTotal,
    raw.ocrExtract?.total_amount,
  );

  const purchaseDate = pickDate(
    raw.purchaseDate,
    raw.invoiceDate,
    raw.invoiceMeta?.invoiceDate,
    raw.invoiceMeta?.purchaseDate,
    raw.ocrExtract?.purchase_or_issue_date,
    raw.ocrExtract?.purchase_date,
  );

  const warrantyExpiry = pickDate(
    raw.warrantyExpiry,
    raw.invoiceMeta?.warrantyExpiry,
    raw.ocrExtract?.warranty_expiry,
  );

  const insuranceExpiry = pickDate(
    raw.insuranceExpiry,
    raw.invoiceMeta?.insuranceExpiry,
    raw.ocrExtract?.insurance_expiry,
  );

  return {
    ...raw,
    purchasePrice,
    value: purchasePrice || pickMoney(raw.value) || 0,
    purchaseDate,
    warrantyExpiry,
    insuranceExpiry,
    // Keep aliases that older UI may read
    totalAmount: purchasePrice || pickMoney(raw.totalAmount) || 0,
  };
}

export function normalizeAssetList(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeAssetRecord(item));
}

/**
 * Read cached assets for a user (or guest), with Home fields normalized.
 */
export async function getAssetsFromStorage(userId) {
  try {
    if (userId) {
      const cached = await OfflineVaultCache.getAssets(userId);
      return normalizeAssetList(cached);
    }
    const raw = await AsyncStorage.getItem(GUEST_ASSETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return normalizeAssetList(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.warn('[storageService] getAssets failed:', error?.message || error);
    return [];
  }
}

/**
 * Persist assets and ensure valuation / expiry fields are written through.
 */
export async function saveAssetsToStorage(userId, assets = []) {
  const normalized = normalizeAssetList(assets);
  try {
    if (userId) {
      await OfflineVaultCache.cacheAssets(userId, normalized);
      return { success: true, assets: normalized };
    }
    await AsyncStorage.setItem(GUEST_ASSETS_KEY, JSON.stringify(normalized));
    return { success: true, assets: normalized };
  } catch (error) {
    console.warn('[storageService] saveAssets failed:', error?.message || error);
    return { success: false, error: error?.message || 'Could not save assets', assets: normalized };
  }
}

export default {
  normalizeAssetRecord,
  normalizeAssetList,
  getAssetsFromStorage,
  saveAssetsToStorage,
};
