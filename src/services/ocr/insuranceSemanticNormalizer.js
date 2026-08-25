/**
 * Semantic Indian motor-insurance field normalizer.
 * Insurer-agnostic labels, provenance-aware dates, no invented values, no date swapping.
 */

import { buildCanonicalInsuranceObject, flattenCanonical } from './insuranceCanonicalBuilder';

const MONTH_INDEX = Object.freeze({
  JAN: '01',
  JANUARY: '01',
  FEB: '02',
  FEBRUARY: '02',
  MAR: '03',
  MARCH: '03',
  APR: '04',
  APRIL: '04',
  MAY: '05',
  JUN: '06',
  JUNE: '06',
  JUL: '07',
  JULY: '07',
  AUG: '08',
  AUGUST: '08',
  SEP: '09',
  SEPT: '09',
  SEPTEMBER: '09',
  OCT: '10',
  OCTOBER: '10',
  NOV: '11',
  NOVEMBER: '11',
  DEC: '12',
  DECEMBER: '12',
});

const FORBIDDEN_DATE_BEFORE =
  /\b(?:puc|pollution|invoice\s*date|purchase\s*date|bill\s*date|tax\s*invoice|print\s*date|generated\s*date|document\s*date|receipt\s*date|manufactur(?:e|ing)|fitment|dob|date\s*of\s*birth|proposal\s*date|issue\s*date|issued\s*on|policy\s*issue|transaction\s*date|payment\s*date|endorsement\s*date|renewal\s*date|previous\s*policy|vehicle\s*purchase|registration\s*date|rc\s*date|inspection\s*date|cancellation\s*date)\b/i;

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

function isoIfValid(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return null;
  return iso;
}

function collapseDateToken(raw) {
  const original = String(raw || '');
  let s = original.replace(/[Oo]/g, '0').replace(/[Tt]/g, (ch, i, str) => {
    const around = str.slice(Math.max(0, i - 1), i + 2);
    return /\d/.test(around.replace(ch, '')) ? '7' : ch;
  });
  if (!/[\/\-.]/.test(original) && !/\s/.test(original) && !/[A-Za-z]/.test(original)) return s.trim();
  s = s.replace(/\s+/g, ' ').trim();
  const monthName = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (monthName) return `${monthName[1]} ${monthName[2]} ${monthName[3]}`;
  s = s.replace(/\s+/g, '');
  const glued = s.match(/^(\d{1,2})[\/\-.]?(\d{1,2})[\/\-.]?(\d{2,4})$/);
  if (glued) return `${glued[1]}/${glued[2]}/${glued[3]}`;
  return s;
}

export function parseIndianPolicyDate(raw) {
  const cleaned = cleanLine(raw);
  if (!cleaned) return null;
  if (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/.test(cleaned)) {
    return isoIfValid(cleaned.slice(0, 4), cleaned.slice(5, 7), cleaned.slice(8, 10));
  }
  const s = collapseDateToken(cleaned);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoIfValid(s.slice(0, 4), s.slice(5, 7), s.slice(8, 10));
  const mmm = s.match(/^(\d{1,2})[\/\-.\s]+([A-Za-z]{3,9})\.?[\/\-.\s]+(\d{2,4})$/);
  if (mmm) {
    const mm = MONTH_INDEX[mmm[2].toUpperCase()] || MONTH_INDEX[mmm[2].toUpperCase().slice(0, 3)];
    if (!mm) return null;
    let yy = mmm[3];
    if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
    return isoIfValid(yy, mm, mmm[1]);
  }
  const us = s.match(/^([A-Za-z]{3,9})\.?[\/\-.\s]+(\d{1,2}),?[\/\-.\s]+(\d{2,4})$/);
  if (us) {
    const mm = MONTH_INDEX[us[1].toUpperCase()] || MONTH_INDEX[us[1].toUpperCase().slice(0, 3)];
    if (!mm) return null;
    let yy = us[3];
    if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
    return isoIfValid(yy, mm, us[2]);
  }
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
  return isoIfValid(yy, mm, dd);
}

const DATE_TOKEN_RE =
  /(\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}|\d{1,2}\s+\d{1,2}\s+\d{2,4}|\d{1,2}[\/\-.\s]+[A-Za-z]{3,9}\.?[\/\-.\s]+\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2}|\d{1,2}[\s\/\-O0-9oT.]{3,18}?\d{2,4})/g;

function lastReIndex(text, re) {
  const src = String(text || '');
  const copy = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let last = -1;
  let m = copy.exec(src);
  while (m) {
    last = m.index;
    if (m.index === copy.lastIndex) copy.lastIndex += 1;
    m = copy.exec(src);
  }
  return last;
}

function isForbiddenDateContext(text, index) {
  const src = String(text || '');
  const immediate = src.slice(Math.max(0, index - 52), index);
  if (!FORBIDDEN_DATE_BEFORE.test(immediate)) {
    const wider = src.slice(Math.max(0, index - 140), index);
    if (!FORBIDDEN_DATE_BEFORE.test(wider)) return false;
    const lastPeriod = lastReIndex(
      wider,
      /period\s*of\s*(?:insurance|policy|cover)|policy\s*period|hours\s+on|midnight\s+of|valid\s*from|effective\s*from/i,
    );
    const lastForbidden = lastReIndex(wider, FORBIDDEN_DATE_BEFORE);
    return lastForbidden > lastPeriod;
  }
  return true;
}

function provenance(value, sourceLabel, semanticType, coverageType, confidence, extra = {}) {
  if (!value) return null;
  return {
    value,
    sourceLabel,
    semanticType,
    coverageType,
    confidence,
    sourceText: extra.sourceText || value,
    sourceContext: extra.sourceContext || sourceLabel,
  };
}

function keepPair(start, end) {
  if (start && end && end < start) return { start: null, end: null };
  return { start: start || null, end: end || null };
}

function collectParsedDates(text = '') {
  const src = String(text || '');
  const out = [];
  const re = new RegExp(DATE_TOKEN_RE.source, 'gi');
  let lastEnd = -1;
  let m = re.exec(src);
  while (m) {
    if (m.index >= lastEnd && !isForbiddenDateContext(src, m.index)) {
      const iso = parseIndianPolicyDate(m[0]);
      if (iso) {
        out.push({ iso, index: m.index, raw: m[0] });
        lastEnd = m.index + m[0].length;
      } else {
        re.lastIndex = m.index + 1;
      }
    } else {
      re.lastIndex = m.index + 1;
    }
    m = re.exec(src);
  }
  return out;
}

function firstTwoDates(text = '') {
  const dates = collectParsedDates(text);
  const uniq = [];
  for (const d of dates) {
    if (!uniq.some((x) => x.iso === d.iso)) uniq.push(d);
    if (uniq.length === 2) break;
  }
  if (uniq.length < 2) return { start: null, end: null };
  return keepPair(uniq[0].iso, uniq[1].iso);
}

function contextAround(text, index, before = 90, after = 36) {
  const src = String(text || '');
  return src.slice(Math.max(0, index - before), Math.min(src.length, index + after));
}

function periodContext(before) {
  return /\b(?:period\s*of\s*(?:insurance|policy|cover|risk)|policy\s*period|insurance\s*period|cover(?:age)?\s*period|validity\s*period|effective\s*period|policy\s*tenure)\b/i.test(
    before,
  );
}

/**
 * Classify a date from nearby labels. Never use OCR order alone.
 */
export function classifyInsuranceDate(fullText, index, iso) {
  const src = String(fullText || '');
  const before = src.slice(Math.max(0, index - 96), index);
  const around = contextAround(src, index);
  const year = Number(String(iso || '').slice(0, 4));
  const base = {
    value: iso,
    sourceText: src.slice(index, index + 24),
    sourceContext: around.replace(/\s+/g, ' ').trim().slice(0, 160),
    confidence: 0.5,
  };
  if (!iso) return { ...base, semanticType: 'UNKNOWN_DATE', confidence: 0 };
  if (/previous\s*policy/i.test(before)) {
    const startish = /\b(?:start|from|commencement)\b/i.test(before.slice(-40));
    return {
      ...base,
      semanticType: startish ? 'PREVIOUS_POLICY_START' : 'PREVIOUS_POLICY_EXPIRY',
      confidence: 0.9,
    };
  }
  if (isForbiddenDateContext(src, index)) {
    return { ...base, semanticType: 'ISSUE_DATE', confidence: 0.86 };
  }
  const beforeLc = before.toLowerCase();
  const odAt = Math.max(
    beforeLc.lastIndexOf('own damage'),
    beforeLc.lastIndexOf('od cover'),
    beforeLc.lastIndexOf('od period'),
    beforeLc.lastIndexOf('od from'),
    beforeLc.lastIndexOf('od to'),
    beforeLc.search(/(?:^|[^a-z])od\s*(?:from|to|period|cover)\b/),
  );
  const tpAt = Math.max(
    beforeLc.lastIndexOf('third party'),
    beforeLc.lastIndexOf('third-party'),
    beforeLc.lastIndexOf('tp cover'),
    beforeLc.lastIndexOf('tp period'),
    beforeLc.lastIndexOf('tp from'),
    beforeLc.lastIndexOf('tp to'),
    beforeLc.lastIndexOf('tp liability'),
    beforeLc.lastIndexOf('liability only'),
    beforeLc.search(/(?:^|[^a-z])tp\s*(?:from|to|period|cover)\b/),
  );
  const odNear = odAt >= 0 && odAt >= tpAt;
  const tpNear = tpAt >= 0 && tpAt > odAt;
  const startish =
    /(?:hours\s+on|policy\s*start|start(?:\s*date)?|commencement|inception|effective\s*from|valid\s*from|period\s*from|from(?:\s*date)?|begins|commences)\b/i.test(
      before.slice(-80),
    );
  const endish =
    /(?:midnight\s+of|policy\s*(?:end|expiry)|expir(?:y|es|ation)|end(?:s|ing)?(?:\s*date)?|effective\s*to|valid\s*(?:till|to|until|upto|up\s*to)|period\s*to|\bto\b|till|until)\b/i.test(
      before.slice(-80),
    );
  const fromToAllowed = periodContext(before) || /(?:policy|insurance|cover)\b/i.test(before.slice(-80));
  if (odNear && (startish || endish || /period|valid/i.test(around))) {
    return {
      ...base,
      semanticType: endish && !startish ? 'OD_EXPIRY' : startish && !endish ? 'OD_START' : endish ? 'OD_EXPIRY' : 'OD_START',
      confidence: 0.9,
    };
  }
  if (tpNear && (startish || endish || /period|valid/i.test(around))) {
    return {
      ...base,
      semanticType: endish && !startish ? 'TP_EXPIRY' : startish && !endish ? 'TP_START' : endish ? 'TP_EXPIRY' : 'TP_START',
      confidence: 0.9,
    };
  }
  if (startish && fromToAllowed) {
    return { ...base, semanticType: 'POLICY_START', confidence: 0.92 };
  }
  if (endish && fromToAllowed) {
    return { ...base, semanticType: 'POLICY_EXPIRY', confidence: 0.92 };
  }
  if (startish && !/\bfrom\b/i.test(before.slice(-12))) {
    return { ...base, semanticType: 'POLICY_START', confidence: 0.88 };
  }
  if (endish && !/\bto\b/i.test(before.slice(-8))) {
    return { ...base, semanticType: 'POLICY_EXPIRY', confidence: 0.88 };
  }
  return { ...base, semanticType: 'UNKNOWN_DATE', confidence: 0.2, year };
}

function windowAfterLabel(text, labelRe, span = 320) {
  const src = String(text || '');
  const m = src.match(labelRe);
  if (!m || m.index == null) return '';
  return src.slice(m.index, m.index + span);
}

export function cleanInsurerName(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(/\bISO\s*\d{3,5}(?:\s*:\s*\d{4})?\b[\s\S]*$/i, '');
  s = s.replace(/\b(?:an?\s+)?ISO[\s\-]*certified[\s\S]*$/i, '');
  s = s.replace(/\bcertified\s+company\b[\s\S]*$/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(?:pvt\.?|private)\s+(?:ltd\.?|limited)\b\.?\s*$/i, '');
  s = s.replace(/\bcompany\s+limited\b\.?\s*$/i, '');
  s = s.replace(/\bco\.?\s*ltd\.?\b\.?\s*$/i, '');
  s = s.replace(/\blimited\b\.?\s*$/i, '');
  s = s.replace(/\bIRDAI[\s\S]*$/i, '');
  s = s.replace(/\bCIN\s*[:.\-]?\s*[A-Z0-9][\s\S]*$/i, '');
  s = s.replace(/\bUIN\s*[:.\-]?\s*[A-Z0-9][\s\S]*$/i, '');
  s = s.replace(/\b(?:regd\.?|registered|corporate|branch)\s*office[\s\S]*$/i, '');
  s = s.replace(/\b(?:www\.|https?:\/\/)[\s\S]*$/i, '');
  s = s.replace(/\b(?:toll[\s\-]?free|customer\s*care|helpline|care@)[\s\S]*$/i, '');
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[\s\S]*$/i, '');
  s = s.replace(/\b(?:pin\s*code|pincode|gstin)\b[\s\S]*$/i, '');
  return cleanLine(s).replace(/[,\-;|]+$/g, '').trim();
}

export function stripHonorific(name) {
  return String(name || '')
    .replace(/^\s*(?:mr|mrs|ms|smt|shri|m\/?s)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(raw) {
  const s = String(raw || '')
    .replace(/₹/g, '')
    .replace(/\brs\.?/gi, '')
    .replace(/\binr\b/gi, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1800 || n === 2666 || n === 1860) return null;
  return Math.round(n * 100) / 100;
}

const POLICY_DATE_CAPTURE =
  '(\\d{4}[\\/\\-]\\d{2}[\\/\\-]\\d{2}|\\d{1,2}\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{2,4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{2,4}|\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{1,2}[\\s\\/\\-O0-9oT.]{3,16}?\\d{2,4})';

function capture(text, patterns) {
  for (const re of patterns) {
    const m = String(text || '').match(re);
    if (m?.[1]) {
      const v = cleanLine(m[1]);
      if (v) return v;
    }
  }
  return '';
}

function labeledPolicyDate(text, labelRe) {
  const src = String(text || '');
  const found = src.match(labelRe);
  if (!found || found.index == null) return null;
  if (/previous\s*policy/i.test(src.slice(Math.max(0, found.index - 48), found.index + found[0].length))) {
    return null;
  }
  const win = src.slice(found.index, found.index + 180);
  const m = win.match(new RegExp(`${labelRe.source}[\\s:\\-#]*${POLICY_DATE_CAPTURE}`, 'i'));
  if (m?.[1]) return parseIndianPolicyDate(m[1]);
  const dates = collectParsedDates(win);
  return dates[0]?.iso || null;
}

function coveragePeriodWindow(text, labelRe) {
  const src = String(text || '');
  const re = new RegExp(labelRe.source, labelRe.flags.includes('g') ? labelRe.flags : `${labelRe.flags}g`);
  let best = '';
  let m = re.exec(src);
  while (m) {
    const win = src.slice(m.index, Math.min(src.length, m.index + 240));
    const head = win.slice(0, 110);
    // Reject false bridges like "Own Damage" + "Policy Number" (no real period context).
    if (
      /own\s*damage/i.test(m[0]) &&
      /\bpolicy\s*(?:no|number|ref|#)\b/i.test(head) &&
      !/\b(?:period|from|to|valid|start|end|expir)\b/i.test(head)
    ) {
      m = re.exec(src);
      continue;
    }
    if (!/(?:period|valid(?:ity)?|from|to|start|end|expir)/i.test(head)) {
      m = re.exec(src);
      continue;
    }
    const dates = collectParsedDates(win);
    const uniq = [];
    for (const d of dates) {
      if (!uniq.some((x) => x.iso === d.iso)) uniq.push(d);
    }
    if (uniq.length >= 2) return win;
    if (!best) best = win;
    m = re.exec(src);
  }
  return best;
}

function pairFromClassifiedWindow(fullText, win, startType, endType) {
  if (!win) return { start: null, end: null, startHit: null, endHit: null };
  const startAt = String(fullText || '').indexOf(win);
  const dates = collectParsedDates(win);
  const uniqHits = [];
  for (const d of dates) {
    const cls = classifyInsuranceDate(fullText, (startAt >= 0 ? startAt : 0) + d.index, d.iso);
    if (
      cls.semanticType === 'ISSUE_DATE' ||
      cls.semanticType === 'PREVIOUS_POLICY_EXPIRY' ||
      cls.semanticType === 'PREVIOUS_POLICY_START'
    ) {
      continue;
    }
    uniqHits.push({ ...d, cls });
  }
  const starts = uniqHits.filter((d) => d.cls.semanticType === startType);
  const ends = uniqHits.filter((d) => d.cls.semanticType === endType);
  let start = starts[0]?.iso || null;
  let end = ends.find((d) => d.iso !== start)?.iso || ends[0]?.iso || null;
  if ((!start || !end || start === end) && /(?:from|to|period|valid|start|end|expir)/i.test(win)) {
    const uniq = [];
    for (const d of uniqHits) {
      if (!uniq.some((x) => x.iso === d.iso)) uniq.push(d);
    }
    if (uniq.length >= 2) {
      start = uniq[0].iso;
      end = uniq[1].iso;
    }
  }
  const kept = keepPair(start, end);
  return { start: kept.start, end: kept.end, startHit: starts[0]?.cls || null, endHit: ends[0]?.cls || null };
}

function extractOdTpDatePairs(text = '') {
  // Prefer explicit OD/TP period/from labels. Avoid matching "Own Damage" + "Policy Number".
  const odWin = coveragePeriodWindow(
    text,
    /(?:own\s*damage\s*(?:cover|period|policy\s*period|from)|(?:\bOD\b|\bSAOD\b|\bSOD\b)\s*(?:cover|policy|period|from)|stand[\s\-]?alone\s*(?:own\s*damage|od)(?:\s*(?:cover|period|from))?)/i,
  );
  const tpWin = coveragePeriodWindow(
    text,
    /(?:third[\s\-]?party(?:\s*liability)?\s*(?:cover|period|from|liability)?|(?:\bTP\b)\s*(?:cover|period|from|liability)|(?:liability\s*only|act\s*only)\s*period)/i,
  );
  const od = pairFromClassifiedWindow(text, odWin, 'OD_START', 'OD_EXPIRY');
  const tp = pairFromClassifiedWindow(text, tpWin, 'TP_START', 'TP_EXPIRY');
  return {
    odStart: od.start,
    odExpiry: od.end,
    tpStart: tp.start,
    tpExpiry: tp.end,
  };
}

function yearOf(iso) {
  const y = Number(String(iso || '').slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function rejectOutlierYear(iso, peerIsos) {
  const y = yearOf(iso);
  const peers = (peerIsos || []).map(yearOf).filter((n) => n != null);
  if (y == null || peers.length < 2) return false;
  const median = peers.slice().sort((a, b) => a - b)[Math.floor(peers.length / 2)];
  return Math.abs(y - median) > 2;
}

/**
 * Master + OD/TP dates with provenance. Never swaps an inverted pair.
 */
export function extractSemanticPolicyDates(blob = '') {
  const text = String(blob || '');
  const empty = {
    overallStartDate: null,
    overallExpiryDate: null,
    policyStartDate: null,
    policyExpiryDate: null,
    odStartDate: null,
    odExpiryDate: null,
    odExpiry: null,
    tpStartDate: null,
    tpExpiryDate: null,
    tpExpiry: null,
    policyIssueDate: null,
    endorsementDate: null,
    renewalDate: null,
    previousPolicyStartDate: null,
    previousPolicyExpiryDate: null,
    fieldProvenance: {},
  };
  if (!text.trim()) return empty;

  const periodLabel =
    /per[il1]od\s*of\s*[il1]?nsur|periodofinsur|perlodofinsur|period\s*of\s*insurance|period\s*of\s*policy|period\s*of\s*cover|period\s*of\s*risk|policy\s*period|insur(?:ance)?\s*per[il1]od|validity\s*period|cover(?:age)?\s*period|effective\s*period|policy\s*tenure|insurance\s*tenure|cover\s*period|risk\s*period/i;
  const periodWin = windowAfterLabel(text, periodLabel, 320);
  let period = { start: null, end: null };
  if (periodWin) {
    const startAt = text.indexOf(periodWin);
    const classified = collectParsedDates(periodWin)
      .map((d) => ({
        ...d,
        cls: classifyInsuranceDate(text, (startAt >= 0 ? startAt : 0) + d.index, d.iso),
      }))
      .filter(
        (d) =>
          d.cls.semanticType !== 'ISSUE_DATE' &&
          d.cls.semanticType !== 'PREVIOUS_POLICY_EXPIRY' &&
          d.cls.semanticType !== 'PREVIOUS_POLICY_START' &&
          d.cls.semanticType !== 'OD_START' &&
          d.cls.semanticType !== 'OD_EXPIRY' &&
          d.cls.semanticType !== 'TP_START' &&
          d.cls.semanticType !== 'TP_EXPIRY',
      );
    const uniq = [];
    for (const d of classified) {
      if (!uniq.some((x) => x.iso === d.iso)) uniq.push(d);
    }
    const layoutPair = uniq.length >= 2 ? keepPair(uniq[0].iso, uniq[1].iso) : { start: null, end: null };
    const cStart = classified.find((d) => d.cls.semanticType === 'POLICY_START');
    const cEnd = classified.find((d) => d.cls.semanticType === 'POLICY_EXPIRY');
    const labeledPair = keepPair(cStart?.iso || null, cEnd?.iso || null);
    if (uniq.length >= 2) {
      period = layoutPair;
    } else if (labeledPair.start || labeledPair.end) {
      period = labeledPair;
    }
  }
  let startProv = period.start
    ? provenance(period.start, 'Period of Insurance', 'POLICY_START', 'master', 0.9)
    : null;
  let endProv = period.end
    ? provenance(period.end, 'Period of Insurance', 'POLICY_EXPIRY', 'master', 0.9)
    : null;

  const hoursOn = text.match(/hours\s+on\s+(\d{1,2}[\s\/\-O0-9A-Za-z.]{4,24}\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  const hoursIso = hoursOn ? parseIndianPolicyDate(hoursOn[1]) : null;
  if (hoursIso) {
    period.start = hoursIso;
    startProv = provenance(hoursIso, 'From / hours on', 'POLICY_START', 'master', 0.96);
  }
  const midnight = text.match(
    /(?:to\s+)?midnight\s+of\s+(\d{1,2}[\s\/\-O0-9A-Za-z.]{4,24}\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  const midnightIso = midnight ? parseIndianPolicyDate(midnight[1]) : null;
  if (midnightIso) {
    period.end = midnightIso;
    endProv = provenance(midnightIso, 'To midnight of', 'POLICY_EXPIRY', 'master', 0.96);
  }

  if (!period.start || !period.end) {
    const fromTo = text.match(
      /\b(?:period\s*of\s*insurance|policy\s*period|valid(?:ity)?|effective)\b[\s\S]{0,80}?\bfrom\b[\s\S]{0,120}?(\d{4}-\d{2}-\d{2}|\d{1,2}[\s\/\-O0-9A-Za-z.]{3,24}\d{2,4})[\s\S]{0,120}?\b(?:to|till|until|upto|up\s*to)\b[\s\S]{0,60}?(\d{4}-\d{2}-\d{2}|\d{1,2}[\s\/\-O0-9A-Za-z.]{3,24}\d{2,4})/i,
    );
    if (fromTo && !isForbiddenDateContext(text, fromTo.index || 0)) {
      const startIso = parseIndianPolicyDate(fromTo[1]);
      const endIso = parseIndianPolicyDate(fromTo[2]);
      const pair = keepPair(startIso, endIso);
      if (pair.start) {
        period.start = period.start || pair.start;
        startProv = startProv || provenance(pair.start, 'From / To', 'POLICY_START', 'master', 0.92);
      }
      if (pair.end) {
        period.end = period.end || pair.end;
        endProv = endProv || provenance(pair.end, 'From / To', 'POLICY_EXPIRY', 'master', 0.92);
      }
    }
  }

  if (!period.end) {
    const labeledEnd = labeledPolicyDate(
      text,
      /(?:policy\s*(?:end|expiry|ends)|valid\s*(?:till|until|upto|to)|risk\s*end|expiry\s*(?:date|of\s*policy)|end\s*date|cover\s*ends|insurance\s*expires)/i,
    );
    if (labeledEnd) {
      period.end = labeledEnd;
      endProv = provenance(labeledEnd, 'Expiry / Valid till', 'POLICY_EXPIRY', 'master', 0.88);
    }
  }

  if (!period.start) {
    const labeledStart = labeledPolicyDate(
      text,
      /(?:policy\s*start(?:\s*date)?|commencement(?:\s*date)?|date\s*of\s*commencement|inception(?:\s*date)?|date\s*of\s*inception|risk\s*commencement|effective(?:\s*from(?:\s*date)?)?|cover\s*start|insurance\s*start|insurance\s*commences|policy\s*begins|cover\s*commences|start\s*of\s*policy)/i,
    );
    if (labeledStart) {
      period.start = labeledStart;
      startProv = provenance(labeledStart, 'Policy start / commencement', 'POLICY_START', 'master', 0.9);
    }
  }

  const checked = keepPair(period.start, period.end);
  period = checked;

  const odtpRaw = extractOdTpDatePairs(text);
  period = keepPair(period.start, period.end);

  const odKept = keepPair(odtpRaw.odStart, odtpRaw.odExpiry);
  const tpKept = keepPair(odtpRaw.tpStart, odtpRaw.tpExpiry);
  const odtp = {
    odStart: odKept.start,
    odExpiry: odKept.end,
    tpStart: tpKept.start,
    tpExpiry: tpKept.end,
  };

  let overallStart = period.start || null;
  let overallEnd = period.end || null;
  if (!overallStart && !overallEnd) {
    overallStart = odtp.odStart || odtp.tpStart || null;
    const ends = [odtp.odExpiry, odtp.tpExpiry].filter(Boolean).sort();
    if (ends.length === 1) overallEnd = ends[0];
    else if (ends.length === 2) overallEnd = ends[1];
  }
  const overall = keepPair(overallStart, overallEnd);

  const issue = parseIndianPolicyDate(
    capture(text, [/\b(?:policy\s*)?issue(?:d)?\s*date\s*[:\-#]?\s*(\d{1,2}[\s\/\-O0-9A-Za-z.]{4,24}\d{2,4}|\d{4}-\d{2}-\d{2})/i]),
  );
  const endorsement = parseIndianPolicyDate(
    capture(text, [/\bendorsement\s*date\s*[:\-#]?\s*(\d{1,2}[\s\/\-O0-9A-Za-z.]{4,24}\d{2,4}|\d{4}-\d{2}-\d{2})/i]),
  );
  const renewal = parseIndianPolicyDate(
    capture(text, [/\brenewal\s*date\s*[:\-#]?\s*(\d{1,2}[\s\/\-O0-9A-Za-z.]{4,24}\d{2,4}|\d{4}-\d{2}-\d{2})/i]),
  );
  const prevWin = windowAfterLabel(text, /previous\s*policy/i, 280);
  const prev = prevWin ? firstTwoDates(prevWin) : { start: null, end: null };

  const fieldProvenance = {};
  if (startProv) fieldProvenance.overallStartDate = startProv;
  if (endProv) fieldProvenance.overallExpiryDate = endProv;
  if (odtp.odStart) {
    fieldProvenance.odStartDate = provenance(odtp.odStart, 'Own Damage period', 'OD_START', 'od', 0.9);
  }
  if (odtp.odExpiry) {
    fieldProvenance.odExpiryDate = provenance(odtp.odExpiry, 'Own Damage period', 'OD_EXPIRY', 'od', 0.9);
  }
  if (odtp.tpStart) {
    fieldProvenance.tpStartDate = provenance(odtp.tpStart, 'Third Party period', 'TP_START', 'tp', 0.9);
  }
  if (odtp.tpExpiry) {
    fieldProvenance.tpExpiryDate = provenance(odtp.tpExpiry, 'Third Party period', 'TP_EXPIRY', 'tp', 0.9);
  }

  return {
    overallStartDate: overall.start,
    overallExpiryDate: overall.end,
    policyStartDate: overall.start,
    policyExpiryDate: overall.end,
    odStartDate: odtp.odStart || null,
    odExpiryDate: odtp.odExpiry || null,
    odExpiry: odtp.odExpiry || null,
    tpStartDate: odtp.tpStart || null,
    tpExpiryDate: odtp.tpExpiry || null,
    tpExpiry: odtp.tpExpiry || null,
    policyIssueDate: issue,
    endorsementDate: endorsement,
    renewalDate: renewal,
    previousPolicyStartDate: prev.start,
    previousPolicyExpiryDate: prev.end,
    fieldProvenance,
  };
}

function hasExplicitOdPeriod(text = '') {
  return /(?:own\s*damage\s*(?:cover|period|from)|(?:\bOD\b)\s*(?:cover|period|from|to))/i.test(text);
}

function hasExplicitTpPeriod(text = '') {
  return /(?:third[\s\-]?party(?:\s*liability)?\s*(?:cover|period|from)|(?:\bTP\b)\s*(?:cover|period|from|to))/i.test(
    text,
  );
}

export function normalizeCoverageType(text = '') {
  const t = String(text || '');
  // Bundled / package-with-OD+TP terminology (OCR-tolerant: Bundled / Bundted / Bundle).
  if (
    /\b(?:od\s*\+\s*tp|tp\s*\+\s*od|own\s*damage\s*\+\s*third\s*party|third\s*party\s*\+\s*own\s*damage)\b/i.test(t) ||
    /\bbundl\w*(?:\s*[-–—:]?\s*(?:two[\s\-]?wheeler|2[\s\-]?wheeler|policy|cover|package))?/i.test(t) ||
    /\blong\s*term\s*bundl\w*/i.test(t) ||
    /\btwo[\s\-]?wheeler\s+(?:bundl\w*|package)\s*policy\b/i.test(t)
  ) {
    return 'BUNDLED';
  }
  if (/\bcomprehensive(?:\s*(?:policy|cover|motor\s*insurance))?\b|\bmotor\s*package|\bpackage\s*policy\b/i.test(t)) {
    return 'COMPREHENSIVE';
  }
  if (/\b(?:liability\s*only|act\s*only|act\s*policy|third[\s\-]?party\s*only|tp\s*only)\b/i.test(t)) {
    return 'THIRD_PARTY';
  }
  if (/\b(?:stand[\s\-]?alone\s*(?:own\s*damage|od)|own\s*damage\s*only|\bSAOD\b|\bSOD\b)\b/i.test(t)) {
    return 'STANDALONE_OD';
  }
  // Explicit OD + TP period sections ⇒ bundled cover, not TP-only (section headers alone).
  if (
    hasExplicitOdPeriod(t) &&
    hasExplicitTpPeriod(t) &&
    !/\b(?:liability\s*only|act\s*only|third[\s\-]?party\s*only|tp\s*only|own\s*damage\s*only|stand[\s\-]?alone)\b/i.test(t)
  ) {
    return 'BUNDLED';
  }
  if (/\bthird[\s\-]?party(?:\s*liability)?\b|\btp\s*cover\b|\btp\s*liability\b/i.test(t)) return 'THIRD_PARTY';
  if (/\bown\s*damage(?:\s*cover|\s*policy)?\b|\bod\s*cover\b/i.test(t)) return 'OWN_DAMAGE';
  return 'UNKNOWN';
}

export function extractAddOns(text = '') {
  const named = [
    /Zero\s*Dep(?:reciation)?/gi,
    /Nil\s*Dep(?:reciation)?/gi,
    /Return\s*to\s*Invoice|\bRTI\b/gi,
    /Engine\s*Protect(?:or|ion)?/gi,
    /Road[\s\-]?side\s*Assistance|\bRSA\b/gi,
    /Consumables?/gi,
    /Key\s*Protect/gi,
    /Tyre\s*Protect/gi,
    /NCB\s*Protect|No\s*Claim\s*Bonus\s*Protection/gi,
    /PA\s*Cover(?:\s*for\s*Owner(?:\s*Driver)?)?/gi,
    /Geographical\s*Area(?:\s*Extension)?/gi,
  ];
  const out = [];
  const seen = new Set();
  for (const re of named) {
    let m = re.exec(text);
    while (m) {
      const name = String(m[0]).replace(/\s+/g, ' ').trim();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        out.push({ name, amount: null });
      }
      m = re.exec(text);
    }
  }
  return out;
}

export function extractNcb(text = '') {
  const m = String(text || '').match(
    /\b(?:ncb|no\s*claim\s*(?:bonus|discount)|claim\s*free\s*discount|ncb\s*%|bonus\s*%|ncb\s*earned|ncb\s*discount)\b[^0-9%]{0,24}(\d{1,2})\s*%/i,
  );
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function extractDeductibles(text = '') {
  const compulsory = parseMoney(
    capture(text, [
      /(?:compulsory\s*(?:deductible|excess))\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    ]),
  );
  const voluntary = parseMoney(
    capture(text, [
      /(?:voluntary\s*(?:deductible|excess))\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
    ]),
  );
  if (compulsory == null && voluntary == null) return null;
  return { compulsory, voluntary };
}

/**
 * Flat canonical values for Review aliases / regression tests.
 * Full evidence object: buildCanonicalInsuranceObject().
 */
export function toCanonicalInsuranceFields(src = {}) {
  return flattenCanonical(buildCanonicalInsuranceObject(src));
}

export default {
  parseIndianPolicyDate,
  cleanInsurerName,
  stripHonorific,
  extractSemanticPolicyDates,
  classifyInsuranceDate,
  normalizeCoverageType,
  extractAddOns,
  extractNcb,
  extractDeductibles,
  toCanonicalInsuranceFields,
};
