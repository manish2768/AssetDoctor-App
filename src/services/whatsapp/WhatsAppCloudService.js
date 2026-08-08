/**
 * Client helper — WhatsApp Cloud API via Asset Doctor Cloud Functions.
 * OTP auth uses custom tokens; welcome is sent server-side on first verify.
 */

import auth from '@react-native-firebase/auth';
import Constants from 'expo-constants';

import { Haptics } from '../haptics/triggerHaptic';
import { UserService } from '../user/UserService';

const PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  Constants.expoConfig?.extra?.firebaseProjectId ||
  'assetdoctor-5fd25';

const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-south1';

function functionUrl(name) {
  const override = process.env.EXPO_PUBLIC_WHATSAPP_FUNCTIONS_BASE;
  if (override) return `${String(override).replace(/\/$/, '')}/${name}`;
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json;
}

function normalizePhone(phoneNumber) {
  const trimmed = String(phoneNumber || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  return trimmed.startsWith('91') && trimmed.length === 12 ? `+${trimmed}` : trimmed;
}

export class WhatsAppCloudService {
  /** Request OTP via Cloud Function `sendWhatsAppOtp` (template `asset_doctor_otp`). */
  static async sendOtp(phoneNumber) {
    Haptics.tap();
    try {
      const phone = normalizePhone(phoneNumber);
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        throw new Error('Enter a valid mobile number with country code (e.g. +919876543210)');
      }
      const result = await postJson(functionUrl('sendWhatsAppOtp'), { phoneNumber: phone });
      if (result?.success !== true) {
        throw new Error(result?.error || 'Failed to send WhatsApp OTP');
      }
      Haptics.success();
      return { success: true, ...result, phone };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to send WhatsApp OTP' };
    }
  }

  /**
   * Verify OTP via `verifyWhatsAppOtp` → sign in with custom token only on success.
   * Does NOT sign in on invalid OTP / API errors.
   * @returns {Promise<{ success: boolean, user?: object, profile?: object, isNewUser?: boolean, error?: string }>}
   */
  static async verifyOtp(phoneNumber, otpCode, { name } = {}) {
    Haptics.tap();
    try {
      const phone = normalizePhone(phoneNumber);
      const otp = String(otpCode || '').trim();
      if (!phone) throw new Error('OTP session expired. Please request a new code.');
      if (!/^\d{6}$/.test(otp)) throw new Error('Enter the 6-digit OTP');

      const result = await postJson(functionUrl('verifyWhatsAppOtp'), {
        phoneNumber: phone,
        otp,
        name: name ? String(name).trim().slice(0, 80) : undefined,
      });

      // Hard gate — never treat a partial / missing token response as logged-in
      if (result?.success !== true || !result?.customToken) {
        throw new Error(result?.error || 'Invalid OTP');
      }

      const credential = await auth().signInWithCustomToken(result.customToken);
      if (!credential?.user?.uid) {
        throw new Error('Sign-in failed after OTP verification');
      }

      const displayName = String(name || '').trim().slice(0, 80);
      const profile = await UserService.syncUserToFirestore(credential.user, {
        authProvider: 'whatsapp_otp',
        extra: {
          phone: result.phone || phone,
          phoneNumber: result.phone || phone,
          name: displayName || undefined,
          profileSetupComplete: Boolean(displayName),
        },
      });

      Haptics.success();
      return {
        success: true,
        user: credential.user,
        profile,
        isNewUser: Boolean(result.isNewUser),
        welcomeSent: Boolean(result.welcomeSent),
        phone: result.phone || phone,
      };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Invalid OTP' };
    }
  }

  /**
   * Admin-only welcome retry — requires server WHATSAPP_ADMIN_SECRET.
   * App login does not call this; verifyWhatsAppOtp sends welcome for new users.
   */
  static async sendWelcome({ uid, phoneNumber, name, adminSecret } = {}) {
    try {
      if (!phoneNumber) return { success: false, error: 'phoneNumber required' };
      if (!adminSecret) {
        return { success: false, error: 'Admin secret required for welcome retry' };
      }
      return await postJson(functionUrl('sendWelcomeWhatsApp'), {
        uid,
        phoneNumber: normalizePhone(phoneNumber),
        name: name || undefined,
        adminSecret,
      });
    } catch (error) {
      return { success: false, error: error?.message || 'Welcome WhatsApp failed' };
    }
  }
}

export default WhatsAppCloudService;
