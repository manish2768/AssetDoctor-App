/** Provider adapter — WhatsApp / email / push / SMS. Credentials stay server-side. */
export const NOTIFICATION_CHANNEL = Object.freeze({
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  SMS: 'SMS',
});

/**
 * @typedef {object} NotificationPayload
 * @property {string} userId
 * @property {string} templateId
 * @property {Record<string, string>} variables
 * @property {string} channel
 */

/** Replaceable provider — no fake API calls in mobile client. */
export class NotificationProvider {
  /** @param {NotificationPayload} _payload */
  async send(_payload) {
    throw new Error('NotificationProvider.send not implemented');
  }

  /** @param {string} _userId */
  async hasConsent(_userId, _channel) {
    return false;
  }
}

export default NotificationProvider;
