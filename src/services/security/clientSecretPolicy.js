/**
 * Client-side secret policy — never ship LLM/Vision keys in production builds.
 * Development may use EXPO_PUBLIC_* keys; production must use authenticated Cloud Functions.
 */

export function allowClientLlmKeys() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  if (String(process.env.EXPO_PUBLIC_ALLOW_CLIENT_LLM_KEYS || '').trim() === '1') return true;
  if (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY) return true;
  return false;
}

export function resolveClientApiKey(candidates = []) {
  if (!allowClientLlmKeys()) return '';
  const pool = [
    ...candidates,
    process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
  ];
  for (const c of pool) {
    const v = String(c || '').trim();
    if (v) return v;
  }
  return '';
}

export default { allowClientLlmKeys, resolveClientApiKey };
