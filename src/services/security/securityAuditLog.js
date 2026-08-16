/**
 * Security audit log — metadata only, never document/OCR contents.
 */

import { EncryptedVaultStorage } from './EncryptedVaultStorage';

const KEY = (uid) => `@asset_doctor/security_audit_v1/${uid || 'guest'}`;
const MAX = 100;

export async function recordSecurityEvent(userId, type, meta = {}) {
  if (!userId || !type) return;
  const list = (await EncryptedVaultStorage.getJSON(KEY(userId), [])) || [];
  const row = {
    id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: String(type).slice(0, 64),
    at: new Date().toISOString(),
    meta: sanitizeMeta(meta),
  };
  const next = [row, ...list].slice(0, MAX);
  await EncryptedVaultStorage.setJSON(KEY(userId), next);
  return row;
}

function sanitizeMeta(meta = {}) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (/password|otp|token|secret|rawText|invoice/i.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 120);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export async function listSecurityEvents(userId, limit = 20) {
  const list = (await EncryptedVaultStorage.getJSON(KEY(userId), [])) || [];
  return list.slice(0, limit);
}

export default { recordSecurityEvent, listSecurityEvents };
