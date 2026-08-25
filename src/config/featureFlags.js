/**
 * Runtime feature flags — unfinished modules stay off.
 * Public Expo vars only. Secrets stay on Cloud Functions.
 */

function flag(name, defaultOn = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return defaultOn;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return defaultOn;
}

export const FEATURE = Object.freeze({
  DOCUMENT_AI_ENABLED: flag('EXPO_PUBLIC_DOCUMENT_AI_ENABLED', false),
  GEMINI_VALIDATION: flag('EXPO_PUBLIC_GEMINI_VALIDATION', true),
  WHATSAPP: flag('EXPO_PUBLIC_FEATURE_WHATSAPP', false),
  PARTNER_MARKETPLACE: flag('EXPO_PUBLIC_FEATURE_PARTNER_MARKETPLACE', false),
  BUY_SELL: flag('EXPO_PUBLIC_FEATURE_BUY_SELL', false),
});

/** auto | document_ai | cloud_vision | mlkit */
export const OCR_PROVIDER = String(process.env.EXPO_PUBLIC_OCR_PROVIDER || 'auto')
  .trim()
  .toLowerCase() || 'auto';

export default { FEATURE, OCR_PROVIDER };
