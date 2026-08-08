/**
 * Shared HTTP helpers for WhatsApp Cloud Functions.
 */

function cors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.rawBody?.toString?.() || '{}');
  } catch {
    return {};
  }
}

/**
 * Protect admin-only endpoints. Set WHATSAPP_ADMIN_SECRET in functions env / secrets.
 * If secret is unset, endpoint stays locked (fail closed) except local emulator.
 */
function requireAdminSecret(req, res) {
  const expected = String(process.env.WHATSAPP_ADMIN_SECRET || '').trim();
  if (!expected || expected.includes('REPLACE')) {
    res.status(503).json({
      success: false,
      error: 'Admin endpoint locked — set WHATSAPP_ADMIN_SECRET',
    });
    return false;
  }
  const provided =
    req.get('x-admin-secret') ||
    req.get('X-Admin-Secret') ||
    (typeof req.body === 'object' ? req.body.adminSecret : '') ||
    '';
  if (String(provided).trim() !== expected) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }
  return true;
}

/** India calendar day YYYY-MM-DD in Asia/Kolkata */
function kolkataTodayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Days until ISO/date field relative to Kolkata calendar date */
function daysUntilKolkata(dateValue, now = new Date()) {
  if (!dateValue) return null;
  let target;
  try {
    if (typeof dateValue === 'string') {
      target = new Date(`${dateValue.slice(0, 10)}T00:00:00+05:30`);
    } else if (typeof dateValue.toDate === 'function') {
      target = dateValue.toDate();
    } else if (dateValue instanceof Date) {
      target = dateValue;
    }
  } catch {
    return null;
  }
  if (!target || Number.isNaN(target.getTime())) return null;

  const todayStr = kolkataTodayKey(now);
  const targetStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);

  const start = Date.parse(`${todayStr}T00:00:00+05:30`);
  const end = Date.parse(`${targetStr}T00:00:00+05:30`);
  return Math.round((end - start) / 86400000);
}

module.exports = {
  cors,
  readJson,
  requireAdminSecret,
  kolkataTodayKey,
  daysUntilKolkata,
};
