/**
 * Asset Doctor — Mobile Notification & WhatsApp Preference Service
 * Manages user notification channels, WhatsApp opt-in state, and real-time alerts.
 */

import { db, auth } from '../firebase.ts';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { syncEngine } from './mobileSyncEngine.ts';

export interface UserNotificationPreferences {
  whatsappOptIn: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  serviceDueAlerts: boolean;
  insuranceExpiryAlerts: boolean;
  pucExpiryAlerts: boolean;
  preferredLanguage: string;
  phone?: string;
  email?: string;
}

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  assetId?: string;
  channel: 'whatsapp' | 'email' | 'push' | 'in_app';
  status: 'PENDING' | 'SENT' | 'FAILED';
}

const PREFERENCES_KEY = 'notification_preferences';

export class MobileNotificationService {
  /**
   * Get Cached Preferences
   */
  public static getPreferences(userId?: string): UserNotificationPreferences {
    return syncEngine.getLocalData<UserNotificationPreferences>(
      PREFERENCES_KEY,
      {
        whatsappOptIn: true,
        emailNotifications: true,
        pushNotifications: true,
        serviceDueAlerts: true,
        insuranceExpiryAlerts: true,
        pucExpiryAlerts: true,
        preferredLanguage: 'en'
      },
      userId
    );
  }

  /**
   * Update Notification Preferences (Offline-First)
   */
  public static async updatePreferences(
    prefs: Partial<UserNotificationPreferences>,
    userId?: string
  ): Promise<void> {
    const uid = userId || auth.currentUser?.uid || 'guest_user';
    const current = this.getPreferences(uid);
    const updated = { ...current, ...prefs };

    // Save locally
    syncEngine.setLocalData(PREFERENCES_KEY, updated, uid);

    // Enqueue profile mutation for cloud sync
    await syncEngine.enqueueMutation(
      'user_profile',
      uid,
      'update',
      {
        notificationPreferences: updated,
        whatsappOptIn: updated.whatsappOptIn,
        updatedAt: new Date().toISOString()
      },
      uid
    );
  }

  /**
   * Subscribe to Live In-App Notifications
   */
  public static subscribeNotifications(
    userId: string,
    onUpdate: (notifications: InAppNotification[]) => void
  ): () => void {
    if (!userId || userId === 'guest_user') {
      onUpdate([]);
      return () => {};
    }

    try {
      const queueRef = collection(db, 'notification_queue');
      const q = query(queueRef, where('userId', '==', userId));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: InAppNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            items.push({
              id: docSnap.id,
              type: data.type || 'service_due',
              title: data.title || 'Notification',
              message: data.message || data.templateName || '',
              createdAt: data.createdAt || new Date().toISOString(),
              read: Boolean(data.read),
              assetId: data.assetId,
              channel: data.channel || 'in_app',
              status: data.status || 'SENT'
            });
          });

          items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
          onUpdate(items);
        },
        (err) => {
          console.warn('[NotificationService] Firestore listener error:', err);
          onUpdate([]);
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('[NotificationService] Failed to subscribe notifications:', e);
      return () => {};
    }
  }
}
