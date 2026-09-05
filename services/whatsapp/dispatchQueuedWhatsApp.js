/**
 * Node/Cloud Function dispatcher for notification_queue WhatsApp jobs.
 * Reads META_WHATSAPP_* from the server environment only.
 */

import {
  sendMetaWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../../src/services/whatsapp/MetaWhatsAppService.js';

export function resolveNodeTemplate(templateKey, payload = {}) {
  const rawKey = String(templateKey || '').trim().toLowerCase();

  // 1. WELCOME
  if (rawKey === 'welcome_message' || rawKey === 'welcome' || rawKey === 'user_welcome') {
    const userName = payload.userName || payload.customerName || payload.name || 'Valued User';
    return {
      ok: true,
      templateName: 'welcome_message',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(userName).slice(0, 80) }],
        },
      ],
    };
  }

  // 2. EXPIRY REMINDER
  if (
    rawKey === 'expiry_reminder' ||
    rawKey === 'expiry' ||
    rawKey === 'insurance_expiry' ||
    rawKey === 'warranty_expiry' ||
    rawKey === 'puc_expiry'
  ) {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Customer').trim().slice(0, 80);
    const veh = String(payload.vehicleName || payload.assetName || payload.asset || 'Vehicle').trim().slice(0, 80);
    const doc = String(payload.docType || payload.documentType || 'Document').trim().slice(0, 80);
    const exp = String(payload.expiryDate || payload.expiry || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'expiry_reminder',
      languageCode: 'hi',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust },
            { type: 'text', text: veh },
            { type: 'text', text: doc },
            { type: 'text', text: exp },
          ],
        },
      ],
    };
  }

  // 3. OTP AUTHENTICATION
  if (rawKey === 'asset_doctor_otp' || rawKey === 'otp' || rawKey === 'auth_otp') {
    const code = String(payload.otp || payload.code || '').trim();
    if (!code || code.length < 4) {
      return {
        ok: false,
        errorCategory: 'INVALID_PARAMETER',
        error: 'Missing or invalid OTP code in payload (requires at least 4 digits).',
      };
    }
    return {
      ok: true,
      templateName: 'asset_doctor_otp',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code.slice(0, 8) }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code.slice(0, 8) }],
        },
      ],
    };
  }

  // 4. SERVICE REMINDER (Template Guard: unapproved on Meta)
  if (rawKey === 'service_reminder' || rawKey === 'ad_service_reminder' || rawKey === 'service') {
    return {
      ok: false,
      errorCategory: 'TEMPLATE_UNAVAILABLE',
      error: 'Service reminder template "service_reminder" is currently unapproved on Meta WABA.',
    };
  }

  return {
    ok: false,
    errorCategory: 'TEMPLATE_UNAVAILABLE',
    error: `Template "${templateKey}" is not registered or approved on Meta.`,
  };
}

export async function dispatchQueuedWhatsApp(queueItem = {}) {
  const templateKey = String(queueItem.templateKey || queueItem.templateName || queueItem.type || '').trim();
  const phone = queueItem.recipientWhatsApp || queueItem.recipientPhone || queueItem.phone;

  const recipient = normalizeWhatsAppNumber(phone);
  if (!recipient || recipient.length < 8) {
    return {
      success: false,
      errorCategory: 'INVALID_RECIPIENT_PHONE',
      error: 'Invalid recipient phone number.',
    };
  }

  const resolved = resolveNodeTemplate(templateKey, queueItem.payload);
  if (!resolved.ok) {
    return {
      success: false,
      errorCategory: resolved.errorCategory,
      error: resolved.error,
    };
  }

  console.log('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT', resolved.templateName);

  const result = await sendMetaWhatsAppMessage({
    to: recipient,
    template: resolved.templateName,
    languageCode: resolved.languageCode,
    components: resolved.components,
  });

  if (result.success) {
    console.log('[WHATSAPP_TRACE] META_RESPONSE', 'accepted', result.messageId ? 'wamid_present' : 'wamid_missing');
  } else {
    console.warn(
      '[WHATSAPP_TRACE] META_RESPONSE',
      result.errorCategory || 'FAILED',
      result.metaCode || result.httpStatus || '',
    );
  }

  return result;
}

