/**
 * Date / expiry helpers — accepts YYYY-MM-DD and common IN formats (DD/MM/YYYY).
 */

export function formatToISTDateOnly(dateObj) {
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return istFormatter.format(dateObj); // Returns YYYY-MM-DD
}

/** @returns {string|null} YYYY-MM-DD in Asia/Kolkata */
export function parseFlexibleDate(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    try {
      return formatToISTDateOnly(input.toDate());
    } catch {
      return null;
    }
  }
  const s = String(input).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  // Full timestamp or ISO string -> convert to IST calendar date
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatToISTDateOnly(d);
  return null;
}

export function daysUntil(dateStr, referenceDate) {
  const iso = parseFlexibleDate(dateStr);
  if (!iso) return null;

  const ref = referenceDate instanceof Date ? referenceDate : new Date();
  const todayISTStr = formatToISTDateOnly(ref);
  if (!todayISTStr) return null;

  const [tYear, tMonth, tDay] = todayISTStr.split('-').map(Number);
  const [expYear, expMonth, expDay] = iso.split('-').map(Number);

  const utcToday = Date.UTC(tYear, tMonth - 1, tDay);
  const utcTarget = Date.UTC(expYear, expMonth - 1, expDay);

  return Math.round((utcTarget - utcToday) / (1000 * 60 * 60 * 24));
}

export function yearsSince(dateStr) {
  const iso = parseFlexibleDate(dateStr);
  if (!iso) return 0;
  const start = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const ms = Date.now() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
}

export function formatDateIN(dateStr) {
  const iso = parseFlexibleDate(dateStr);
  if (!iso) return dateStr ? String(dateStr) : '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toISODate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Normalize user-typed date for Firestore storage */
export function normalizeStoredDate(input) {
  return parseFlexibleDate(input);
}
