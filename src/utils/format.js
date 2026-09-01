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

const NBSP = '\u00A0';

/** Compact INR for narrow metric cards. Never inserts a wrapping space in the value. */
export function formatINRCompact(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 10000000) {
    return `${sign}₹${(Math.round((abs / 10000000) * 100) / 100).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(Math.round((abs / 100000) * 100) / 100).toFixed(2)}L`;
  }
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Pick full vs compact currency from available card width (dp).
 * Narrow passport tiles (~1/3 of a phone) use compact form.
 */
export const PASSPORT_METRIC_NARROW_WIDTH = 124;

export function formatINRForWidth(amount, width = 0) {
  if (width > 0 && width < PASSPORT_METRIC_NARROW_WIDTH) return formatINRCompact(amount);
  const compact = formatINRCompact(amount);
  if (compact.length <= 8) return compact;
  if (width > 0 && width < 160) return formatINRCompact(amount);
  return formatINR(amount).replace('₹ ', `₹${NBSP}`);
}

/** Ownership duration as a single unbreakable token, e.g. "0 yrs". */
export function formatOwnershipDuration(purchaseDate, now = Date.now()) {
  if (!purchaseDate) return '—';
  const start = new Date(purchaseDate).getTime();
  if (!Number.isFinite(start)) return '—';
  const days = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
  return `${Math.floor(days / 365)}${NBSP}yrs`;
}
