/**
 * Node/Cloud Function dispatcher for notification_queue WhatsApp jobs.
 * Reads META_WHATSAPP_* from the server environment only.
 */

import {
  sendMetaWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../../src/services/whatsapp/MetaWhatsAppService.js';

const WELCOME_TEMPLATE = 'welcome_message';
const WELCOME_LANGUAGE = 'en';

export async function dispatchQueuedWhatsApp(queueItem = {}) {
  const templateKey = String(queueItem.templateKey || '').trim();
  const phone = queueItem.recipientPhone || queueItem.phone;
  const userName = queueItem.payload?.userName || queueItem.userName || 'Valued User';

  if (templateKey !== WELCOME_TEMPLATE) {
    return {
      success: false,
      errorCategory: 'UNSUPPORTED_TEMPLATE',
      error: `Queue worker handles welcome_message only. Got: ${templateKey || 'empty'}`,
    };
  }

  const recipient = normalizeWhatsAppNumber(phone);
  if (!recipient || recipient.length < 8) {
    return {
      success: false,
      errorCategory: 'INVALID_RECIPIENT_PHONE',
      error: 'Invalid recipient phone number.',
    };
  }

  console.log('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT', templateKey);

  const result = await sendMetaWhatsAppMessage({
    to: recipient,
    template: WELCOME_TEMPLATE,
    languageCode: WELCOME_LANGUAGE,
    components: [
      {
        type: 'body',
        parameters: [{ type: 'text', text: String(userName).slice(0, 80) }],
      },
    ],
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
