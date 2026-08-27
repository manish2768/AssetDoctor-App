/**
 * Pure welcome-queue contract (no RN / Firebase imports).
 */

export const WELCOME_QUEUE_COLLECTION = 'notification_queue';
export const WELCOME_EVENT_TYPE = 'user_welcome';
export const WELCOME_TEMPLATE_KEY = 'welcome_message';
export const WELCOME_TEMPLATE_LANGUAGE = 'en';

export function normalizeE164Phone(value) {
  if (!value) return '';
  const trimmed = String(value).replace(/[^\d+]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return `+${trimmed}`;
}

export function normalizeWhatsAppNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function maskE164ForTrace(phone) {
  const e164 = normalizeE164Phone(phone);
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 8) return '****';
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

export function welcomeQueueDocId(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return '';
  return `welcome_${uid}`;
}

export function welcomeIdempotencyKey(userId) {
  return `welcome:${String(userId || '').trim()}`;
}

export function buildWelcomeQueueItem({ userId, phone, userName, customerType = 'NEW' } = {}) {
  const uid = String(userId || '').trim();
  const e164 = normalizeE164Phone(phone);
  const metaRecipient = normalizeWhatsAppNumber(phone);
  const displayName = String(userName || 'Valued User').trim() || 'Valued User';
  const now = new Date().toISOString();
  const type = String(customerType || 'NEW').toUpperCase() === 'EXISTING' ? 'EXISTING' : 'NEW';

  if (!uid) {
    return { ok: false, error: 'userId required', errorCategory: 'MISSING_USER' };
  }
  if (!metaRecipient || metaRecipient.length < 8) {
    return { ok: false, error: 'Invalid recipient phone number.', errorCategory: 'INVALID_RECIPIENT_PHONE' };
  }

  return {
    ok: true,
    docId: welcomeQueueDocId(uid),
    item: {
      userId: uid,
      customerName: displayName.slice(0, 80),
      customerType: type,
      welcomeEligible: type === 'NEW',
      eventType: WELCOME_EVENT_TYPE,
      type: 'WELCOME',
      channel: 'whatsapp',
      templateKey: WELCOME_TEMPLATE_KEY,
      templateLanguage: WELCOME_TEMPLATE_LANGUAGE,
      recipientPhone: e164,
      maskedPhone: maskE164ForTrace(e164),
      payload: {
        userName: displayName.slice(0, 80),
        customerType: type,
        welcomeEligible: type === 'NEW',
      },
      status: 'queued',
      scheduledAt: now,
      createdAt: now,
      idempotencyKey: welcomeIdempotencyKey(uid),
      retryCount: 0,
      source: 'client_signup',
    },
  };
}
