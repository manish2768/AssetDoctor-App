/**
 * Feedback / Report Issue helpers
 */

import { Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

import { Haptics } from '../haptics/triggerHaptic';

const DRAFT_KEY = '@asset_doctor/feedback_draft_v1';

import { buildWhatsAppLink, isValidPhoneNumber } from '../../utils/phoneUtils';

export class FeedbackService {
  static async saveLocalDraft(payload) {
    try {
      await AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ ...payload, savedAt: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  static async sendWhatsApp({ phone, text }) {
    Haptics.tap();
    try {
      if (phone && !isValidPhoneNumber(phone)) {
        Haptics.error();
        return {
          success: false,
          error: `Invalid phone number (${phone}). Please provide a valid 10-digit number.`,
        };
      }

      const { appUrl, webUrl, hasPhone } = buildWhatsAppLink({ phone, message: text || '' });

      if (!hasPhone) {
        await Share.share({ message: text || '' });
        return { success: true, via: 'share' };
      }

      try {
        const can = await Linking.canOpenURL(appUrl);
        if (can) {
          await Linking.openURL(appUrl);
          return { success: true, via: 'whatsapp' };
        }
      } catch {
        /* fallback to wa.me */
      }

      try {
        const canWeb = await Linking.canOpenURL(webUrl);
        if (canWeb) {
          await Linking.openURL(webUrl);
          return { success: true, via: 'wa_web' };
        }
      } catch {
        /* fallback to share */
      }

      await Share.share({ message: text || '' });
      return { success: true, via: 'system_share' };
    } catch (error) {
      return { success: false, error: error?.message || 'WhatsApp failed' };
    }
  }

  /**
   * Store feedback in Firestore feedback_reports for the signed-in owner.
   */
  static async submitToCloud({ category, message, contact, uid, device }) {
    Haptics.tap();
    try {
      await firestore().collection('feedback_reports').add({
        category: category || 'other',
        message: String(message || '').slice(0, 4000),
        contact: String(contact || '').slice(0, 200),
        uid: uid || null,
        device: String(device || '').slice(0, 500),
        status: 'new',
        createdAt: firestore.FieldValue.serverTimestamp(),
        source: 'app',
      });
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Cloud submit failed' };
    }
  }
}

export default FeedbackService;
