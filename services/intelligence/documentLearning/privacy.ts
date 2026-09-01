/**
 * Phase 13 — Privacy scrub for learning records.
 * No passwords, OTPs, API keys, WhatsApp tokens, full phones, full invoice text, or images.
 */

const SECRET_RE =
  /\b(password|passwd|otp|one[\s-]?time|api[_-]?key|access[_-]?token|secret|whatsapp[_-]?token|bearer\s+[a-z0-9._-]+)\b/i;

const FORBIDDEN_KEYS = new Set([
  'password',
  'otp',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'rawText',
  'fullText',
  'image',
  'imageUri',
  'imageBase64',
  'whatsappToken',
  'META_WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_TOKEN',
]);

export function looksLikeSecret(value: unknown): boolean {
  const s = String(value || '');
  if (!s) return false;
  if (SECRET_RE.test(s)) return true;
  if (s.length > 400) return true;
  return false;
}

export function maskPhone(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 4) return '****';
  return `******${digits.slice(-4)}`;
}

export function maskIdentifier(value: unknown): string | null {
  const compact = String(value || '').replace(/\s+/g, '');
  if (!compact) return null;
  if (compact.length <= 4) return '****';
  return `${compact.slice(0, 2)}****${compact.slice(-4)}`;
}

const PHONE_FIELDS = new Set(['phone', 'mobile', 'customerphone', 'customerPhone']);
const ID_FIELDS = new Set([
  'imei',
  'serialnumber',
  'serialNumber',
  'chassisnumber',
  'chassisNumber',
  'enginenumber',
  'engineNumber',
  'gstin',
  'shopgstin',
  'shopGstin',
]);

export function redactFieldValue(fieldName: string, value: unknown): string | number | null {
  if (value == null || String(value).trim() === '') return null;
  if (looksLikeSecret(value)) return null;
  const key = String(fieldName || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (PHONE_FIELDS.has(key) || PHONE_FIELDS.has(fieldName)) return maskPhone(value);
  if (ID_FIELDS.has(key) || ID_FIELDS.has(fieldName)) return maskIdentifier(value);
  const raw = String(value);
  if (raw.length > 64) return `${raw.slice(0, 24)}…`;
  return typeof value === 'number' && Number.isFinite(value) ? value : raw;
}

export function sanitizeLearningRecord<T extends Record<string, unknown>>(record: T): T {
  const out: Record<string, unknown> = { ...record };
  for (const key of Object.keys(out)) {
    if (FORBIDDEN_KEYS.has(key)) {
      delete out[key];
      continue;
    }
    const val = out[key];
    if (typeof val === 'string' && looksLikeSecret(val)) {
      out[key] = null;
    }
  }
  delete out.rawText;
  delete out.fullText;
  delete out.image;
  delete out.imageUri;
  delete out.imageBase64;
  if (typeof out.originalValue !== 'undefined') {
    out.originalValue = redactFieldValue(String(out.fieldName || ''), out.originalValue);
  }
  if (typeof out.correctedValue !== 'undefined') {
    out.correctedValue = redactFieldValue(String(out.fieldName || ''), out.correctedValue);
  }
  if (out.contextSignals && typeof out.contextSignals === 'object') {
    const signals = { ...(out.contextSignals as Record<string, unknown>) };
    delete signals.rawText;
    delete signals.fullText;
    out.contextSignals = signals;
  }
  return out as T;
}

export function learningRecordHasForbiddenKeys(record: Record<string, unknown> = {}): boolean {
  return Object.keys(record).some((k) => FORBIDDEN_KEYS.has(k));
}
