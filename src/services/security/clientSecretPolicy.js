/**
 * Client-side secret policy — never ship LLM/Vision keys in production builds.
 * Development may use EXPO_PUBLIC_* keys; production must use authenticated Cloud Functions.
 */

export function allowClientLlmKeys() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  return String(process.env.EXPO_PUBLIC_ALLOW_CLIENT_LLM_KEYS || '').trim() === '1';
}

export function resolveClientApiKey(candidates = []) {
  if (!allowClientLlmKeys()) return '';
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (v) return v;
  }
  return '';
}

export default { allowClientLlmKeys, resolveClientApiKey };
