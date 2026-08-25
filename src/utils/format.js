/**
 * Currency / number formatting (India)
 */

export function formatINR(amount) {
  return `₹ ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatINRExact(amount) {
  return `₹ ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatLakhs(amount) {
  const n = Number(amount || 0);
  if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)}L`;
  return formatINR(n);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
