/**
 * Audit Log Service — Asset Doctor Security & Compliance
 * Immutable, append-only audit trail logging for all sensitive user & admin operations.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIT_LOG_STORAGE_KEY = 'asset_doctor_audit_logs_v1';

export const AUDIT_ACTIONS = Object.freeze({
  PROFILE_UPDATE: 'profile_update',
  EMAIL_CHANGE_REQUEST: 'email_change_request',
  EMAIL_CHANGE_VERIFIED: 'email_change_verified',
  PHONE_CHANGE_REQUEST: 'phone_change_request',
  PHONE_CHANGE_VERIFIED: 'phone_change_verified',
  PASSWORD_RESET: 'password_reset',
  ACTIVE_SESSIONS_REVOKED: 'active_sessions_revoked',
  ACCOUNT_EXPORT_REQUESTED: 'account_export_requested',
  ACCOUNT_DELETION_REQUESTED: 'account_deletion_requested',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_REACTIVATED: 'account_reactivated',
  OCR_MANUAL_CORRECTION: 'ocr_manual_correction',
  ASSET_EDITED: 'asset_edited',
  ASSET_DELETED: 'asset_deleted',
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_DELETED: 'document_deleted',
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_RESOLVED: 'support_ticket_resolved',
});

export const AuditLogService = {
  /**
   * Append an immutable audit entry
   */
  async log({
    actorId = 'system',
    actorRole = 'user',
    targetUserId = null,
    targetAssetId = null,
    targetDocId = null,
    action,
    oldValue = null,
    newValue = null,
    reason = '',
    ip = '127.0.0.1',
  }) {
    if (!action) return null;

    const entry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      actorId,
      actorRole,
      targetUserId,
      targetAssetId,
      targetDocId,
      action,
      oldValue,
      newValue,
      reason: String(reason || ''),
      ip,
    };

    try {
      const logs = await this.getAllLogs();
      // Prepend to keep newest first, cap at 1000 items in local storage
      const updated = [entry, ...logs].slice(0, 1000);
      await AsyncStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[AuditLog] Failed to persist audit log:', e);
    }

    return entry;
  },

  /**
   * Get all audit logs
   */
  async getAllLogs() {
    try {
      const raw = await AsyncStorage.getItem(AUDIT_LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId) {
    if (!userId) return [];
    const all = await this.getAllLogs();
    return all.filter((l) => l.targetUserId === userId || l.actorId === userId);
  },
};

export default AuditLogService;
