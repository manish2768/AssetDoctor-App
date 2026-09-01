/**
 * Encrypted local vault storage.
 * - AES key kept in expo-secure-store (hardware-backed when available)
 * - Ciphertext payloads in AsyncStorage (user-scoped keys only)
 */

import '../../polyfills/installSecureCrypto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';

import { ensureCryptoSurface } from '../../polyfills/installSecureCrypto';
import { secureRandomHex } from './secureId';

const KEY_ALIAS = 'asset_doctor_vault_aes_v1';
const PREFIX = 'ad_enc_v1:';

let cachedKey = null;

async function getOrCreateKey() {
  if (cachedKey) return cachedKey;
  try {
    let key = await SecureStore.getItemAsync(KEY_ALIAS);
    if (!key) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      key = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await SecureStore.setItemAsync(KEY_ALIAS, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    cachedKey = key;
    return key;
  } catch (error) {
    console.warn('[EncryptedVaultStorage] SecureStore unavailable:', error?.message || error);
    // Device-session ephemeral key — never a shared hardcoded secret.
    // Data encrypted with this key is not durable across process restarts.
    if (!cachedKey) {
      try {
        const bytes = await Crypto.getRandomBytesAsync(32);
        cachedKey = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch {
        cachedKey = `ephemeral_${secureRandomHex(16)}`;
      }
    }
    return cachedKey;
  }
}

function encryptString(plain, key) {
  const run = () => PREFIX + CryptoJS.AES.encrypt(String(plain), key).toString();
  try {
    return run();
  } catch (error) {
    ensureCryptoSurface();
    return run();
  }
}

function decryptString(cipher, key) {
  const raw = String(cipher || '');
  if (!raw.startsWith(PREFIX)) {
    // Legacy plaintext — return as-is for migration
    return raw;
  }
  const bytes = CryptoJS.AES.decrypt(raw.slice(PREFIX.length), key);
  const out = bytes.toString(CryptoJS.enc.Utf8);
  if (!out) throw new Error('Decrypt failed');
  return out;
}

export class EncryptedVaultStorage {
  static async setItem(key, value) {
    const aes = await getOrCreateKey();
    const plain = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(key, encryptString(plain, aes));
  }

  static async getItem(key) {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    try {
      const aes = await getOrCreateKey();
      return decryptString(raw, aes);
    } catch (error) {
      console.warn('[EncryptedVaultStorage] getItem decrypt:', error?.message || error);
      // Attempt plaintext legacy read
      return raw.startsWith(PREFIX) ? null : raw;
    }
  }

  static async removeItem(key) {
    await AsyncStorage.removeItem(key);
  }

  static async multiRemove(keys = []) {
    if (!keys.length) return;
    await AsyncStorage.multiRemove(keys);
  }

  static async getJSON(key, fallback = null) {
    const raw = await EncryptedVaultStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  static async setJSON(key, value) {
    await EncryptedVaultStorage.setItem(key, JSON.stringify(value));
  }
}

export default EncryptedVaultStorage;
