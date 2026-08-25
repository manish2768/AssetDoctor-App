/**
 * Insurance-document OCR extraction.
 * Never fabricates missing fields. Never reconstructs a full chassis/engine
 * from a 4-digit suffix. Gated to insurance documents only.
 * Never copies purchase date / seller / price from a vehicle invoice.
 */

import {
  cleanInsurerName,
  stripHonorific,
  extractSemanticPolicyDates,
  normalizeCoverageType,
  extractAddOns,
  extractNcb,
  extractDeductibles,
  toCanonicalInsuranceFields,
} from './insuranceSemanticNormalizer';
import { buildCanonicalInsuranceObject } from './insuranceCanonicalBuilder';
import {
  preferServiceBillOverInsurance,
  hasExclusiveInsuranceSignals,
  resolveInsuranceVsService,
} from './documentTypeArbitration';
import { findLabeledValue, findIndianPlates, isIndianPlateToken, compactPlate } from './semanticFieldFinder';

const INSURER_HINT =
  /\b(?:ICICI|HDFC|BAJAJ|TATA\s*AIG|RELIANCE|GO\s*DIGIT|ACKO|UNITED\s*INDIA|NEW\s*INDIA|ORIENTAL|NATIONAL|CHOLA|MAGMA|FUTURE\s*GENERALI|SBI|KOTAK|IFFCO|ROYAL\s*SUNDARAM|LIBERTY|SHRIRAM|UNIVERSAL\s*SOMPO|DIGIT|LOMBARD|ALLIANZ|ERGO|GENERAL\s*INSURANCE)\b/i;

const IDENTITY_LABEL =
  /^(?:no|n\/a|na|nil|null|yes|y|n|number|no\.|chassis|engine|frame|vin|registration|regn|policy|premium|idv|gstin|hsn|details|owner|insured|vehicle|make|model|protect|protector|from|to|of|on|hours|midnight|period|insurance)$/i;

const ENGINE_JUNK_RE =
  /INSUR|PERIOD|MIDNIGHT|CERTIFICATE|POLICY|CHASSIS|NUMBER|PREMIUM|HOURS|VALID|COVERAGE|COMPREHENSIVE/;

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

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

function collapseDateToken(raw) {
  const original = String(raw || '');
  let s = original.replace(/[Oo]/g, '0');
  // Compact 4–6 digit chassis/engine suffixes are not dates.
  if (!/[\/\-.]/.test(original) && !/\s/.test(original) && !/[A-Za-z]/.test(original)) return s.trim();
  s = s.replace(/\s+/g, ' ').trim();
  const monthName = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (monthName) return `${monthName[1]} ${monthName[2]} ${monthName[3]}`;
  s = s.replace(/\s+/g, '');
  const glued = s.match(/^(\d{1,2})[\/\-.]?(\d{1,2})[\/\-.]?(\d{2,4})$/);
  if (glued) return `${glued[1]}/${glued[2]}/${glued[3]}`;
  return s;
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

function parseLooseDate(raw) {
  const cleaned = cleanLine(raw);
  if (!cleaned) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return isoIfValid(cleaned.slice(0, 4), cleaned.slice(5, 7), cleaned.slice(8, 10));
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
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
  return isoIfValid(yy, mm, dd);
}

const DATE_TOKEN_RE =
  /(\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}|\d{1,2}\s+\d{1,2}\s+\d{2,4}|\d{1,2}[\/\-.\s]+[A-Za-z]{3,9}\.?[\/\-.\s]+\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\s\/\-O0-9o.]{3,18}?\d{2,4})/g;

function isForbiddenDateContext(text, index) {
  const before = String(text || '').slice(Math.max(0, index - 56), index);
  return /\b(?:puc|pollution|invoice\s*date|purchase\s*date|bill\s*date|tax\s*invoice|manufactur(?:e|ing)|fitment|dob|date\s*of\s*birth|proposal\s*date|issue\s*date|policy\s*issue|transaction\s*date|payment\s*date|endorsement\s*date|renewal\s*date|previous\s*policy|vehicle\s*purchase|registration\s*date|rc\s*date|inspection\s*date|cancellation\s*date)\b/i.test(
    before,
  );
}

function collectParsedDates(text = '') {
  const src = String(text || '');
  const out = [];
  const re = new RegExp(DATE_TOKEN_RE.source, 'gi');
  let lastEnd = -1;
  let m = re.exec(src);
  while (m) {
    if (m.index >= lastEnd && !isForbiddenDateContext(src, m.index)) {
      const iso = parseLooseDate(m[0]);
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
  if (!uniq.length) return { start: null, end: null };
  if (uniq.length === 1) return { start: null, end: uniq[0].iso };
  return { start: uniq[0].iso, end: uniq[1].iso };
}

function windowAfterLabel(text, labelRe, span = 320) {
  const src = String(text || '');
  const m = src.match(labelRe);
  if (!m || m.index == null) return '';
  return src.slice(m.index, m.index + span);
}

function extractOdTpDates(text = '') {
  const odWin = windowAfterLabel(
    text,
    /(?:own\s*damage|\bOD\b)[\s\S]{0,40}?(?:period|valid(?:ity)?|from|:)/i,
    220,
  );
  const tpWin = windowAfterLabel(
    text,
    /(?:third[\s\-]?party|\bTP\b|liability)[\s\S]{0,40}?(?:period|valid(?:ity)?|from|:)/i,
    220,
  );
  const od = odWin ? firstTwoDates(odWin) : { start: null, end: null };
  const tp = tpWin ? firstTwoDates(tpWin) : { start: null, end: null };
  return {
    odStart: od.start,
    odExpiry: od.end,
    tpStart: tp.start,
    tpExpiry: tp.end,
  };
}

/**
 * Policy start/end from Indian motor insurance OCR. Never uses invoice/PUC dates.
 * Does not invent missing dates.
 */
export function extractInsurancePolicyDates(blob = '') {
  const dates = extractSemanticPolicyDates(blob);
  return {
    policyStartDate: dates.policyStartDate,
    policyExpiryDate: dates.policyExpiryDate,
    odExpiry: dates.odExpiry,
    tpExpiry: dates.tpExpiry,
    odStartDate: dates.odStartDate,
    odExpiryDate: dates.odExpiryDate,
    tpStartDate: dates.tpStartDate,
    tpExpiryDate: dates.tpExpiryDate,
    overallStartDate: dates.overallStartDate,
    overallExpiryDate: dates.overallExpiryDate,
    fieldProvenance: dates.fieldProvenance,
  };
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

function isInsuranceText(text = '') {
  return (
    /\binsurance\s*polic/i.test(text) ||
    /\bpolicy\s*(?:no|number|n[o°])/i.test(text) ||
    /\bpol[il1]cy\s*(?:no|number)/i.test(text) ||
    /\bperiod\s*of\s*insurance\b/i.test(text) ||
    /\bcertificate\s*of\s*insurance\b/i.test(text) ||
    /\bmotor\s*insurance\b/i.test(text) ||
    /\bidv\b/i.test(text) ||
    /\bown\s*damage\b/i.test(text) ||
    /\bthird[\s\-]?party\b/i.test(text)
  );
}

function looksLikeDate(token) {
  const s = collapseDateToken(token);
  return /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isJunkInsuranceVendor(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^insurance\s*policy$/i.test(v)) return true;
  if (looksLikeDate(v)) return true;
  if (/https?:|www\.|\.html/i.test(v)) return true;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(v)) return true;
  if (
    /ombudsman|general\s*insurance\s*council|toll\s*free|customer\s*care|helpline|policy\s*&\s*owner|owner\s*details|policy\s*type|policy\s*details|registration\s*details|vehicle\s*details/i.test(
      v,
    )
  ) {
    return true;
  }
  if (/^(?:policy|owner|details|insured|vehicle|premium|idv|company|insurer|limited|ltd|gic|general)$/i.test(v)) return true;
  if (/^(?:certificate\s*of\s*insurance|motor\s*insurance(?:\s*policy)?)$/i.test(v)) return true;
  return false;
}

export function isJunkPolicyHolder(value) {
  const v = String(value || '').replace(/\s+/g, ' ').trim();
  if (!v || v.length < 4) return true;
  if (/@/.test(v) || looksLikeDate(v)) return true;
  if (
    /^(?:up\s*to(?:\s*the)?|the|policy|insured|name|holder|proposer|address|vehicle|period|insurance|from|to|midnight|limited|liability|idv|details|owner)$/i.test(
      v,
    )
  ) {
    return true;
  }
  if (/\b(?:up\s*to(?:\s*the)?|limited\s*to|sum\s*insured|declared\s*value)\b/i.test(v) && v.split(/\s+/).length <= 5) {
    return true;
  }
  if (!/[A-Za-z]{3,}/.test(v)) return true;
  if (v.split(/\s+/).length === 1 && v.length < 5) return true;
  return IDENTITY_LABEL.test(v);
}

export function isPlausibleInsuranceEngine(value) {
  const raw = String(value || '');
  if (!raw || /@/.test(raw) || /\.(?:com|in|net|org)\b/i.test(raw)) return false;
  if (/https?:|www\./i.test(raw)) return false;
  const compact = compactIdentity(raw);
  return isLikelyEngineId(compact);
}

function sanitizeIdentityToken(raw) {
  const token = cleanLine(raw).replace(/[,:]$/, '');
  if (!token) return '';
  if (/@/.test(token) || /\.(?:com|in|net|org)\b/i.test(token)) return '';
  if (looksLikeDate(token)) return '';
  if (IDENTITY_LABEL.test(token)) return '';
  const compact = token.replace(/[^A-Za-z0-9]/g, '');
  if (compact.length < 4) return '';
  if (IDENTITY_LABEL.test(compact)) return '';
  // Generic OCR header words — never treat as chassis/engine.
  if (/^[A-Za-z]+$/.test(compact) && compact.length <= 10 && !/\d/.test(compact)) return '';
  return token;
}

function compactIdentity(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isLikelyVinOrChassis(compact) {
  if (!compact || compact.length < 4) return false;
  if (IDENTITY_LABEL.test(compact)) return false;
  if (/^[A-Z]+$/.test(compact) && compact.length <= 10) return false;
  if (compact.length === 17) return true;
  if (compact.length >= 11 && /^[A-HJ-NPR-Z0-9]+$/.test(compact)) return true;
  if (/^\d{4,6}$/.test(compact)) return true;
  if (compact.length >= 4 && compact.length <= 10 && /\d/.test(compact)) return true;
  return false;
}

function isLikelyEngineId(compact) {
  if (!compact || compact.length < 4) return false;
  if (IDENTITY_LABEL.test(compact)) return false;
  if (ENGINE_JUNK_RE.test(compact)) return false;
  if (/GMAIL|EMAIL|OUTLOOK|YAHOO|HOTMAIL/.test(compact)) return false;
  if (/^MD[A-HJ-NPR-Z0-9]{10,}/.test(compact)) return false;
  if (/^[A-Z]+$/.test(compact) && compact.length <= 10) return false;
  if (/20\d{2}/.test(compact) && !/^[A-Z]{2,5}\d/.test(compact)) return false;
  if (/^\d/.test(compact) && /[A-Z]/.test(compact) && compact.length > 8) return false;
  if (/^\d{4,6}$/.test(compact)) return true;
  return compact.length >= 6 && /\d/.test(compact) && /[A-Z]/.test(compact);
}

function scoreChassisToken(compact) {
  if (!isLikelyVinOrChassis(compact)) return 0;
  if (compact.length === 17) return 200;
  if (compact.length >= 11) return 150 + compact.length;
  if (compact.length >= 6) return 80 + compact.length;
  return 40 + compact.length;
}

function scoreEngineToken(compact) {
  if (!isLikelyEngineId(compact)) return 0;
  let score = 40 + compact.length;
  if (compact.length >= 6) score = 90 + compact.length;
  if (compact.length >= 10 && /\d/.test(compact) && /[A-Z]/.test(compact)) score = 180 + compact.length;
  if (/^[A-Z]{2,}/.test(compact)) score += 30;
  if (/^\d/.test(compact) && compact.length > 6) score -= 50;
  return score;
}

function tokensInWindow(text, fromIndex, span = 320, cutRe = null) {
  let slice = String(text || '').slice(fromIndex, fromIndex + span);
  if (cutRe) {
    const cut = slice.search(cutRe);
    if (cut > 0) slice = slice.slice(0, cut);
  }
  return slice
    .split(/[\s|;,]+/)
    .map((t) => cleanLine(t).replace(/^[:\-#]+|[:\-#]+$/g, ''))
    .filter(Boolean);
}

function pickFromLabelWindow(text, labelRe, scorer, cutRe) {
  const src = String(text || '');
  const re = new RegExp(labelRe.source, labelRe.flags.includes('g') ? labelRe.flags : `${labelRe.flags}g`);
  let best = { token: '', score: 0 };
  let m = re.exec(src);
  while (m) {
    const tokens = glueCandidateTokens(tokensInWindow(src, m.index + m[0].length, 360, cutRe));
    for (const token of tokens) {
      if (!sanitizeIdentityToken(token)) continue;
      const compact = compactIdentity(token);
      const score = scorer(compact);
      if (score > best.score) best = { token, score };
      if (score >= 180) break;
    }
    m = re.exec(src);
  }
  return best.score ? best.token : '';
}

function extractChassisRaw(text) {
  const fromWindow = pickFromLabelWindow(
    text,
    /\b(?:chassis\s*(?:\/\s*)?frame|chassis|frame|vin|vehicle\s*identification(?:\s*number)?|chassis\s*\/\s*vin)\s*(?:no\.?|number|n[o°]|#)?/gi,
    scoreChassisToken,
    /\b(?:engine\s*(?:no|number)|policy\s*(?:no|number)|period\s*of|idv|premium|registration|make\s*\/\s*model)\b/i,
  );
  if (fromWindow && sanitizeIdentityToken(fromWindow)) return fromWindow;
  const md = String(text || '')
    .toUpperCase()
    .match(/\b(MD[A-HJ-NPR-Z0-9]{11,17})\b/);
  return md?.[1] && sanitizeIdentityToken(md[1]) ? md[1] : '';
}

function glueCandidateTokens(tokens = []) {
  const out = [...tokens];
  for (let i = 0; i < tokens.length; i += 1) {
    const first = compactIdentity(tokens[i]);
    if (!first || IDENTITY_LABEL.test(first) || ENGINE_JUNK_RE.test(first)) continue;
    if (/^[A-Z]+$/.test(first) && first.length > 4) continue;
    let acc = first;
    for (let j = i + 1; j < tokens.length && j <= i + 3; j += 1) {
      const nxt = compactIdentity(tokens[j]);
      if (!nxt || nxt.length > 14) break;
      if (IDENTITY_LABEL.test(nxt) || ENGINE_JUNK_RE.test(nxt)) break;
      if (looksLikeDate(tokens[j]) || looksLikeDate(nxt)) break;
      if (/^[A-Z]+$/.test(nxt) && nxt.length > 4) break;
      if (!/\d/.test(first) && !/\d/.test(nxt) && acc.length + nxt.length > 6) break;
      acc += nxt;
      if (acc.length >= 8 && acc.length <= 20 && /\d/.test(acc) && /[A-Z]/.test(acc)) out.push(acc);
      if (acc.length >= 17) break;
    }
  }
  return out;
}

function isChassisLikeToken(compact, chassisHint = '') {
  const c = compactIdentity(compact);
  const hint = compactIdentity(chassisHint);
  if (!c) return false;
  if (hint && c === hint) return true;
  return /^MD[A-HJ-NPR-Z0-9]{10,}/.test(c);
}

function considerEngineToken(token, chassisHint, best) {
  if (!isPlausibleInsuranceEngine(token)) return best;
  const cleaned = sanitizeIdentityToken(token);
  if (!cleaned) return best;
  const compact = compactIdentity(cleaned);
  if (isChassisLikeToken(compact, chassisHint)) return best;
  const score = scoreEngineToken(compact);
  if (score > best.score) return { token: cleaned, score };
  return best;
}

function fallbackEngineFromText(text, chassisHint = '') {
  const src = String(text || '');
  const start = src.search(/\b(?:chassis|engine|motor\s*no|vehicle\s*details|registration)\b/i);
  const window = start >= 0 ? src.slice(Math.max(0, start - 40), start + 720) : '';
  if (!window) return '';
  let best = { token: '', score: 0 };
  const glued = glueCandidateTokens(tokensInWindow(window, 0, window.length, null));
  for (const token of glued) {
    if (!isPlausibleInsuranceEngine(token)) continue;
    const compact = compactIdentity(token);
    if (!/^[A-Z]{2,}/.test(compact) && !/^\d{4,6}$/.test(compact)) continue;
    best = considerEngineToken(token, chassisHint, best);
  }
  return best.score ? best.token : '';
}

function engineBesideChassisLine(text, chassisHint = '') {
  let best = { token: '', score: 0 };
  for (const line of String(text || '').split(/\n/)) {
    const glued = glueCandidateTokens(tokensInWindow(line, 0, line.length, null));
    const hasVin = glued.some((t) => isChassisLikeToken(compactIdentity(t), chassisHint));
    if (!hasVin) continue;
    for (const token of glued) best = considerEngineToken(token, chassisHint, best);
  }
  return best.score ? best.token : '';
}

const ENGINE_LABEL_RE =
  /(?:eng[il1]ne(?:\s*(?:no\.?|number|n[o°]|#))?|motor\s*(?:no\.?|number|#))(?!\s*(?:protect|protection|cover|oil))/gi;

function extractEngineRaw(text, chassisHint = '') {
  let afterBest = { token: '', score: 0 };
  let aroundBest = { token: '', score: 0 };
  const src = String(text || '');
  const re = new RegExp(ENGINE_LABEL_RE.source, 'gi');
  let m = re.exec(src);
  while (m) {
    const after = glueCandidateTokens(
      tokensInWindow(
        src,
        m.index + m[0].length,
        160,
        /\b(?:policy\s*(?:no|number)|period\s*of|idv|premium|make\s*\/\s*model|pa\s*cover|coverage|insured\s*declared)\b/i,
      ),
    );
    for (const token of after) afterBest = considerEngineToken(token, chassisHint, afterBest);
    const around = src.slice(Math.max(0, m.index - 220), Math.min(src.length, m.index + m[0].length + 220));
    for (const token of glueCandidateTokens(tokensInWindow(around, 0, around.length, null))) {
      aroundBest = considerEngineToken(token, chassisHint, aroundBest);
    }
    m = re.exec(src);
  }

  if (afterBest.score) return afterBest.token;

  const beside = engineBesideChassisLine(src, chassisHint);
  if (beside) {
    const hit = considerEngineToken(beside, chassisHint, { token: '', score: 0 });
    if (hit.score) return hit.token;
  }

  if (aroundBest.score) return aroundBest.token;
  return fallbackEngineFromText(text, chassisHint);
}

function preferStoredIdentity(extracted, previous) {
  const next = sanitizeIdentityToken(extracted);
  const prev = sanitizeIdentityToken(previous);
  if (!next) return prev || '';
  if (!prev) return next;
  const nc = compactIdentity(next);
  const pc = compactIdentity(prev);
  if (pc.length >= 8 && nc.length < pc.length && pc.endsWith(nc)) return prev;
  return next;
}

function preferStoredEngine(extracted, previous) {
  const next = isPlausibleInsuranceEngine(extracted) ? sanitizeIdentityToken(extracted) : '';
  const prev = isPlausibleInsuranceEngine(previous) ? sanitizeIdentityToken(previous) : '';
  if (!next) return prev || '';
  if (!prev) return next;
  const nc = compactIdentity(next);
  const pc = compactIdentity(prev);
  if (pc.length >= 8 && nc.length < pc.length && pc.endsWith(nc)) return prev;
  return next;
}

function labeledValue(text, labelRe, opts = {}) {
  const src = String(text || '');
  const re = new RegExp(labelRe.source, labelRe.flags.includes('g') ? labelRe.flags : `${labelRe.flags}g`);
  let m = re.exec(src);
  while (m) {
    const after = src.slice(m.index + m[0].length, m.index + m[0].length + (opts.span || 280));
    const parts = after.split(/\n/).map((l) => cleanLine(l)).filter(Boolean);
    const same = cleanLine((after.split(/\n/)[0] || '').replace(/^[:\-#]+/, ''));
    const cands = same && !parts.includes(same) ? [same, ...parts] : parts.length ? parts : [same];
    for (const cand of cands.slice(0, 8)) {
      if (!cand) continue;
      if (opts.reject && opts.reject(cand)) continue;
      if (opts.accept ? opts.accept(cand) : true) return cand;
    }
    m = re.exec(src);
  }
  return '';
}

function isPolicyNumberCandidate(v) {
  const compact = String(v || '').replace(/\s+/g, '');
  if (!compact || !/[0-9]/.test(compact)) return false;
  if (IDENTITY_LABEL.test(v) || /^(?:number|no\.?|chassis|engine|policy)$/i.test(v)) return false;
  if (looksLikeDate(v) || looksLikeDate(compact)) return false;
  if (/cover\s*from|from\s*\d|to\s*\d|period\s*of|hours\s+on|midnight/i.test(v)) return false;
  if (/invoice|receipt|customer\s*id|transaction|proposal|quotation/i.test(v)) return false;
  if (/^MD[A-HJ-NPR-Z0-9]{10,}/i.test(compact)) return false;
  if (/@|\.(?:com|in|net|org)\b/i.test(v)) return false;
  // Indian motor policies often look like 3005/HT-1799111/00/0000
  if (compact.length < 6 || compact.length > 48) return false;
  return /^[A-Z0-9][A-Z0-9\/.\-]{4,47}$/i.test(compact);
}

function pickPolicyNumber(text) {
  const raw = labeledValue(
    text,
    /(?:pol[il1]cy\s*(?:no\.?|number|n[o°]|#|id(?:\s*no\.?)?|reference(?:\s*no\.?)?|ref(?:\.?|erence)?)|certificate(?:\s*policy)?\s*(?:no\.?|number)|contract\s*(?:no\.?|number)|cover\s*note\s*(?:no\.?|number))/gi,
    {
      span: 360,
      accept: isPolicyNumberCandidate,
    },
  );
  if (raw) return raw.replace(/\s+/g, '');

  const semantic = findLabeledValue(text, {
    labels: [
      /pol[il1]cy\s*(?:no\.?|number|n[o°]|#|id|reference|ref)/i,
      /certificate(?:\s*policy)?\s*(?:no\.?|number)/i,
      /cover\s*note\s*(?:no\.?|number)/i,
      /contract\s*(?:no\.?|number)/i,
    ],
    accept: isPolicyNumberCandidate,
    reject: (v) => /proposal|quotation|customer\s*id|transaction|receipt/i.test(v),
    maxLinesAfter: 6,
  });
  if (semantic?.value) return semantic.value.replace(/\s+/g, '');

  // Multi-line layouts: "Policy No" / "Number" / value on following lines.
  const labelRe =
    /(?:pol[il1]cy\s*(?:no\.?|number|n[o°]|#|ref(?:\.?|erence)?)|certificate\s*(?:no\.?|number)|cover\s*note\s*(?:no\.?|number))/gi;
  let m = labelRe.exec(text);
  while (m) {
    const after = String(text || '').slice(m.index + m[0].length, m.index + m[0].length + 400);
    const lines = after.split(/\n/).map((l) => cleanLine(l)).filter(Boolean);
    for (const line of lines.slice(0, 8)) {
      if (/^(?:number|no\.?|#)$/i.test(line)) continue;
      const token = line.split(/\s{2,}|(?=\s(?:chassis|engine|insured|period|from|to)\b)/i)[0];
      const candidate = cleanLine(token).replace(/\s+/g, '');
      if (isPolicyNumberCandidate(candidate)) return candidate;
      const embedded = line.match(/\b([A-Z0-9][A-Z0-9\/.\-]{5,47})\b/i);
      if (embedded && isPolicyNumberCandidate(embedded[1])) return embedded[1].replace(/\s+/g, '');
    }
    m = labelRe.exec(text);
  }

  if (/\bcover\s*note\b/i.test(text) && !/\bpol[il1]cy\s*(?:no|number)/i.test(text)) {
    return labeledValue(text, /cover\s*note\s*(?:no\.?|number)/gi, {
      accept: isPolicyNumberCandidate,
    }).replace(/\s+/g, '');
  }
  return '';
}

function pickPolicyHolder(text) {
  const labeled = labeledValue(
    text,
    /(?:name\s*(?:&\s*address\s*)?of\s*(?:the\s*)?(?:insured|owner)|insured\s*\/?\s*owner|insured\s*name|name\s*of\s*(?:the\s*)?insured|policy\s*holder(?:\s*name)?|policyholder|proposer(?:\s*name)?|applicant(?:\s*name)?|customer(?:\s*name)?|registered\s*owner|vehicle\s*owner|owner\s*name|(?:^|\n)\s*insured\s*[:\-])/gi,
    {
      reject: (v) => isJunkPolicyHolder(v) || INSURER_HINT.test(v),
      accept: (v) => !isJunkPolicyHolder(v) && /[A-Za-z]{3,}/.test(v) && !/\d{5,}/.test(v) && !INSURER_HINT.test(v),
    },
  );
  if (labeled) {
    return stripHonorific(labeled.replace(/\b(?:address|vehicle|policy)\b.*$/i, '').trim());
  }
  const semantic = findLabeledValue(text, {
    labels: [
      /name\s*(?:&\s*address\s*)?of\s*(?:the\s*)?(?:insured|owner)/i,
      /insured\s*name|policy\s*holder|proposer|registered\s*owner/i,
    ],
    reject: (v) => isJunkPolicyHolder(v) || INSURER_HINT.test(v),
    accept: (v) => !isJunkPolicyHolder(v) && /[A-Za-z]{3,}/.test(v) && !/\d{5,}/.test(v) && !INSURER_HINT.test(v),
    maxLinesAfter: 6,
  });
  if (semantic?.value) {
    return stripHonorific(semantic.value.replace(/\b(?:address|vehicle|policy)\b.*$/i, '').trim());
  }
  return '';
}

function pickInsurer(text) {
  const lines = String(text || '')
    .split(/\n/)
    .map((l) => cleanInsurerName(cleanLine(l)))
    .filter(Boolean);
  const branded = lines.find(
    (l) =>
      INSURER_HINT.test(l) &&
      /insurance|lombard|ergo|allianz|assurance|limited|ltd|gic|company|underwrit/i.test(l) &&
      !isJunkInsuranceVendor(l) &&
      !/motor\s*company|tvs\s*motor|hero\s*moto|dealer|ombudsman/i.test(l) &&
      !/^insurance\s*policy$/i.test(l) &&
      !/\bISO\b/i.test(l) &&
      l.split(/\s+/).length >= 2,
  );
  if (branded) return branded;

  const labeled = labeledValue(
    text,
    /(?:^|\n)\s*(?:insurance\s*(?:company|provider)(?:\s*name)?|insurer(?:\s*name)?|issuing\s*(?:company|insurer)|issued\s*by|underwritten\s*by|underwriter|risk\s*carrier|carrier|company)\b/gi,
    {
      reject: (v) =>
        isJunkInsuranceVendor(cleanInsurerName(v)) ||
        /^insurance\s*policy$/i.test(v) ||
        /^(?:limited|ltd|company|general)$/i.test(v),
      accept: (v) => {
        const cleaned = cleanInsurerName(v);
        return (
          !isJunkInsuranceVendor(cleaned) &&
          /[A-Za-z]{4,}/.test(cleaned) &&
          !/motor\s*company|tvs\s*motor|hero\s*moto|dealer/i.test(cleaned)
        );
      },
    },
  );
  if (labeled) return cleanInsurerName(labeled);
  return '';
}

function extractInsuranceRegistration(text) {
  const labeled = findLabeledValue(text, {
    labels: [
      /reg(?:istration|n)?\.?\s*(?:no\.?|number|n[o°]|mark)/i,
      /vehicle\s*(?:reg(?:istration)?\s*)?(?:no\.?|number)/i,
      /registration\s*mark/i,
      /rto\s*registration|rc\s*no\.?/i,
    ],
    accept: (v) => isIndianPlateToken(v),
    maxLinesAfter: 5,
  });
  if (labeled?.value) return compactPlate(labeled.value);

  const plates = findIndianPlates(text);
  if (plates.length === 1) return plates[0].plate;
  return '';
}

function extractInsuranceMakeModel(text) {
  const labeled = findLabeledValue(text, {
    labels: [
      /make\s*\/\s*model/i,
      /make\s*and\s*model/i,
      /vehicle\s*(?:make|model)/i,
      /(?:^|\n)\s*make\s*(?:\/\s*model)?/i,
    ],
    accept: (v) => /[A-Za-z]{2,}/.test(v) && v.length <= 60 && !/chassis|engine|policy|insured/i.test(v),
    reject: (v) => /^(?:make|model|vehicle)$/i.test(v),
    maxLinesAfter: 3,
  });
  const raw = labeled?.value || '';
  if (!raw) return { make: '', model: '' };
  const mm = raw.match(/^(tvs|honda|hero|bajaj|yamaha|suzuki|royal\s*enfield|ktm|mahindra|tata|maruti(?:\s*suzuki)?|hyundai|kia|toyota|ather|ola)\b/i);
  if (!mm) {
    const parts = raw.split(/\s+/).filter(Boolean);
    return { make: '', model: parts.slice(0, 3).join(' ').slice(0, 40) };
  }
  let make = mm[1].replace(/\s+/g, ' ');
  if (/^tvs$/i.test(make)) make = 'TVS';
  else if (/royal\s*enfield/i.test(make)) make = 'Royal Enfield';
  else make = make.charAt(0).toUpperCase() + make.slice(1).toLowerCase();
  const rest = raw.slice(mm[0].length).trim();
  const model = rest.split(/\s+/)[0] ? rest.split(/\s+/)[0].charAt(0).toUpperCase() + rest.split(/\s+/)[0].slice(1).toLowerCase() : '';
  return { make, model };
}

export function extractInsuranceFields(blob = '') {
  const text = String(blob || '');
  const empty = {
    insurer: '',
    policyHolder: '',
    policyNumber: '',
    policyStartDate: null,
    policyExpiryDate: null,
    odExpiry: null,
    tpExpiry: null,
    chassisNumber: '',
    engineNumber: '',
    registration: '',
    vehicleMake: '',
    vehicleModel: '',
    idv: null,
    premium: null,
    coverageType: '',
    pucExpiry: null,
    coverages: [],
  };
  if (!text.trim()) return empty;

  const insurer = pickInsurer(text);
  const policyHolder = pickPolicyHolder(text);
  const policyNumber = pickPolicyNumber(text);

  const chassisNumber = sanitizeIdentityToken(extractChassisRaw(text));
  const engineNumber = sanitizeIdentityToken(extractEngineRaw(text, chassisNumber));
  const dates = extractInsurancePolicyDates(text);
  const addOns = extractAddOns(text);
  const ncb = extractNcb(text);
  const deductibles = extractDeductibles(text);

  // PUC expiry only from an explicitly labeled PUC expiry — never from insurance period dates.
  const pucExpiry = (() => {
    if (!/\bpuc\b/i.test(text)) return null;
    const labeled = capture(text, [
      /\bpuc\s*(?:expiry|exp(?:ires)?|valid\s*(?:till|until|upto|to))\s*[:\-#]?\s*(\d{1,2}[\s\/\-O0-9.]{4,16}\d{2,4}|\d{4}-\d{2}-\d{2})/i,
      /\b(?:expiry|exp(?:ires)?|valid\s*(?:till|until|upto))\s*(?:of\s*)?puc\s*[:\-#]?\s*(\d{1,2}[\s\/\-O0-9.]{4,16}\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    ]);
    return labeled ? parseLooseDate(labeled) : null;
  })();

  const registrationLabeled = capture(text, [
    /(?:reg(?:istration|n)?\.?\s*(?:no\.?|number|n[o°]|mark)|vehicle\s*(?:reg(?:istration)?\s*)?(?:no\.?|number)|registration\s*mark(?:\s*no\.?)?|rto\s*registration|rc\s*no\.?)\s*[:\-#]?\s*([A-Z]{2}\s*-?\s*\d{1,2}\s*-?\s*[A-Z]{1,3}\s*-?\s*\d{4}|\d{2}\s*-?\s*BH\s*-?\s*\d{4}\s*-?\s*[A-Z]{1,2})/i,
  ]);
  const registration = compactPlate(registrationLabeled) || extractInsuranceRegistration(text);
  const { make: vehicleMake, model: vehicleModel } = extractInsuranceMakeModel(text);

  const idv = parseMoney(
    capture(text, [
      /(?:insured'?s?\s*declared\s*value|vehicle\s*idv|\bidv\b)(?:\s*\([^)]*\))?\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
      /(?<!(?:cpa|pa|personal\s*accident)\s+)(?:sum\s*insured)\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]{4,12}(?:\.\d{1,2})?)/i,
    ]),
  );
  const premium = parseMoney(
    capture(text, [
      /(?:gross\s*premium|total\s*premium(?:\s*\([A-Z+\s]+\))?|net\s*premium|premium\s*payable)\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
      /(?:premium)\s*[:\-#]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]{3,10}(?:\.\d{1,2})?)/i,
    ]),
  );

  const coverageType = normalizeCoverageType(text);
  const coverages = extractCoverageEntries([], text);
  for (const addon of addOns) {
    const key = coverageKey(addon.name);
    if (key && !coverages.some((c) => coverageKey(c.name) === key)) coverages.push(addon);
  }

  const canon = toCanonicalInsuranceFields({
    insurer,
    policyHolder: isJunkPolicyHolder(policyHolder) ? '' : policyHolder,
    policyNumber,
    policyStartDate: dates.policyStartDate,
    policyExpiryDate: dates.policyExpiryDate,
    overallStartDate: dates.overallStartDate || dates.policyStartDate,
    overallExpiryDate: dates.overallExpiryDate || dates.policyExpiryDate,
    odStartDate: dates.odStartDate || null,
    odExpiryDate: dates.odExpiryDate || dates.odExpiry || null,
    odExpiry: dates.odExpiry || dates.odExpiryDate || null,
    tpStartDate: dates.tpStartDate || null,
    tpExpiryDate: dates.tpExpiryDate || dates.tpExpiry || null,
    tpExpiry: dates.tpExpiry || dates.tpExpiryDate || null,
    chassisNumber,
    engineNumber,
    coverageType,
    fieldProvenance: dates.fieldProvenance || {},
  });

  return {
    insurer: canon.insurer,
    policyHolder: canon.policyHolder,
    policyNumber: canon.policyNumber,
    policyStartDate: canon.policyStartDate,
    policyExpiryDate: canon.policyExpiryDate,
    overallStartDate: dates.overallStartDate || canon.policyStartDate,
    overallExpiryDate: dates.overallExpiryDate || canon.policyExpiryDate,
    odStart: canon.odStart,
    odStartDate: canon.odStart,
    odExpiryDate: canon.odExpiry,
    odExpiry: canon.odExpiry,
    tpStart: canon.tpStart,
    tpStartDate: canon.tpStart,
    tpExpiryDate: canon.tpExpiry,
    tpExpiry: canon.tpExpiry,
    chassisNumber: canon.chassisNumber || chassisNumber,
    engineNumber: canon.engineNumber || engineNumber,
    registration: registration || '',
    vehicleMake,
    vehicleModel,
    idv,
    premium,
    coverageType: canon.coverageType,
    coverageTypeLabel: canon.coverageTypeLabel,
    pucExpiry,
    coverages,
    addOns: coverages,
    ncb,
    deductibles,
    fieldProvenance: dates.fieldProvenance || {},
    normalizedInsurance: buildCanonicalInsuranceObject({
      insurer: canon.insurer,
      policyHolder: canon.policyHolder,
      policyNumber: canon.policyNumber,
      policyStartDate: canon.policyStartDate,
      policyExpiryDate: canon.policyExpiryDate,
      odStartDate: canon.odStart,
      odExpiryDate: canon.odExpiry,
      tpStartDate: canon.tpStart,
      tpExpiryDate: canon.tpExpiry,
      chassisNumber: canon.chassisNumber || chassisNumber,
      engineNumber: canon.engineNumber || engineNumber,
      registration: registration || '',
      vehicleMake,
      vehicleModel,
      idv,
      premium,
      coverageType: canon.coverageType,
      pucExpiry,
      fieldProvenance: dates.fieldProvenance || {},
    }),
  };
}

const COVERAGE_NAME_RE =
  /\b(?:pa\s*cover(?:\s*for\s*(?:owner(?:\s*driver)?|unnamed\s*passenger)?)?|personal\s*accident(?:\s*cover)?|compulsory\s*pa|cpa(?:\s*cover)?|geographical\s*area(?:\s*extension)?|own\s*damage|third[\s\-]?party|zero\s*dep(?:reciation)?|engine\s*protect(?:or|ion)?|consumables?|road[\s\-]?side\s*assistance|ncb\s*protect|add[\s\-]?on)\b/i;

const VEHICLE_MODEL_RE =
  /\b(?:tvs|hero|honda|bajaj|yamaha|suzuki|royal\s*enfield|ktm|ather|ola|ronin|splendor|activa|apache|pulsar|access|jupiter|ntorq|raider)\b/i;

export function isInsuranceCoverageName(name = '') {
  const n = String(name || '').trim();
  if (!n || n.length > 80) return false;
  if (VEHICLE_MODEL_RE.test(n) && !COVERAGE_NAME_RE.test(n)) return false;
  return COVERAGE_NAME_RE.test(n);
}

export function isInsuredVehicleLine(name = '') {
  const n = String(name || '').trim();
  if (!n) return false;
  if (isInsuranceCoverageName(n)) return false;
  return VEHICLE_MODEL_RE.test(n);
}

function coverageKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractCoverageEntries(items = [], blob = '') {
  const out = [];
  const seen = new Set();
  const push = (name, amount) => {
    const label = String(name || '').replace(/\s+/g, ' ').trim();
    if (!label || !isInsuranceCoverageName(label)) return;
    const key = coverageKey(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const n = amount == null || amount === '' ? null : Number(amount);
    out.push({ name: label, amount: Number.isFinite(n) && n > 0 ? n : null });
  };

  for (const it of items || []) {
    push(it?.name || it?.productName || '', it?.amount ?? it?.lineTotal ?? null);
  }

  const named = [
    /PA\s*Cover(?:\s*for\s*Owner(?:\s*Driver)?)?/gi,
    /Geographical\s*Area(?:\s*Extension)?/gi,
    /Personal\s*Accident(?:\s*Cover)?/gi,
    /Zero\s*Dep(?:reciation)?/gi,
    /Engine\s*Protect(?:or|ion)?/gi,
    /Road[\s\-]?side\s*Assistance/gi,
    /NCB\s*Protect/gi,
  ];
  const text = String(blob || '');
  for (const re of named) {
    let m = re.exec(text);
    while (m) {
      push(m[0], null);
      m = re.exec(text);
    }
  }
  return out;
}

/**
 * One insurance scan → one policy record. Coverage/add-on rows are not products.
 */
export function groupInsurancePolicyRecord(data = {}, blob = '') {
  const coverages = extractCoverageEntries(data.items, blob);
  const policyTitle =
    (data.insurer && !isJunkInsuranceVendor(data.insurer) ? String(data.insurer).trim() : '') ||
    'Insurance Policy';

  data.coverages = coverages;
  data.insuranceFields = {
    ...(data.insuranceFields && typeof data.insuranceFields === 'object' ? data.insuranceFields : {}),
    coverages,
  };
  data.items = [];
  data.itemCount = 0;
  if (!data.productName || isInsuredVehicleLine(data.productName) || isInsuranceCoverageName(data.productName)) {
    data.productName = policyTitle;
  }
  data.isVehicleInvoice = false;
  data.requiresVehicleLink = true;
  return data;
}

export function emptyInsuranceFields() {
  return extractInsuranceFields('');
}

/**
 * Overlay insurance fields onto pipeline invoice data. Fill labeled values only.
 * Never invent chassis/engine. Never copy a suffix into a reconstructed VIN.
 * Never copy purchase date, seller, or price from a previous vehicle invoice.
 */
export function applyInsuranceOcrToInvoice(data = {}, blob = '') {
  const extracted = extractInsuranceFields(blob);

  data.invoiceDate = null;
  data.purchaseDate = null;
  data.purchase_date = null;
  data.imei = '';

  if (extracted.insurer && !isJunkInsuranceVendor(extracted.insurer)) {
    data.insurer = extracted.insurer;
  } else if (isJunkInsuranceVendor(data.insurer) || /^insurance\s*policy$/i.test(String(data.insurer || ''))) {
    data.insurer = '';
  }
  data.shopName = data.insurer && !isJunkInsuranceVendor(data.insurer) ? data.insurer : '';
  data.sellerName = data.shopName || '';
  data.vendor = data.shopName || '';
  if (extracted.policyHolder) {
    data.policyHolder = extracted.policyHolder;
    data.customerName = extracted.policyHolder;
    data.buyerName = extracted.policyHolder;
  } else if (isJunkPolicyHolder(data.customerName) || isJunkPolicyHolder(data.policyHolder)) {
    data.policyHolder = '';
    data.customerName = '';
    data.buyerName = '';
  }
  if (extracted.policyNumber) {
    data.policyNumber = extracted.policyNumber;
    data.invoiceNumber = extracted.policyNumber;
  }
  if (extracted.policyStartDate || extracted.overallStartDate) {
    data.insuranceStart = extracted.policyStartDate || extracted.overallStartDate;
    data.policyStartDate = data.insuranceStart;
    data.overallStartDate = extracted.overallStartDate || data.insuranceStart;
  }
  if (extracted.policyExpiryDate || extracted.overallExpiryDate) {
    data.insuranceExpiry = extracted.policyExpiryDate || extracted.overallExpiryDate;
    data.policyExpiryDate = data.insuranceExpiry;
    data.overallExpiryDate = extracted.overallExpiryDate || data.insuranceExpiry;
  } else if (!data.insuranceExpiry && data.policyExpiryDate) {
    data.insuranceExpiry = data.policyExpiryDate;
  }
  if (extracted.odStartDate) {
    data.odStartDate = extracted.odStartDate;
    data.odStart = extracted.odStartDate;
  }
  if (extracted.odExpiryDate || extracted.odExpiry) {
    data.odExpiryDate = extracted.odExpiryDate || extracted.odExpiry;
    data.odExpiry = data.odExpiryDate;
    data.odInsuranceExpiry = data.odExpiryDate;
  }
  if (extracted.tpStartDate) {
    data.tpStartDate = extracted.tpStartDate;
    data.tpStart = extracted.tpStartDate;
  }
  if (extracted.tpExpiryDate || extracted.tpExpiry) {
    data.tpExpiryDate = extracted.tpExpiryDate || extracted.tpExpiry;
    data.tpExpiry = data.tpExpiryDate;
    data.tpInsuranceExpiry = data.tpExpiryDate;
  }
  data.chassisNumber = preferStoredIdentity(extracted.chassisNumber, data.chassisNumber);
  data.engineNumber = preferStoredEngine(extracted.engineNumber, data.engineNumber);
  if (extracted.registration && !String(data.registration || '').trim()) {
    data.registration = extracted.registration;
  }
  if (extracted.vehicleMake) {
    data.brandName = data.brandName || extracted.vehicleMake;
    data.vehicleMake = extracted.vehicleMake;
  }
  if (extracted.vehicleModel) {
    data.model = data.model || extracted.vehicleModel;
    data.vehicleModel = extracted.vehicleModel;
  }
  if (extracted.vehicleMake || extracted.vehicleModel) {
    const mm = [extracted.vehicleMake, extracted.vehicleModel].filter(Boolean).join(' ').trim();
    if (mm && (!data.productName || /^insurance/i.test(String(data.productName)))) {
      data.productName = mm;
    }
  }
  if (extracted.idv != null) data.idv = extracted.idv;
  if (extracted.premium != null) {
    data.premium = extracted.premium;
    data.annualInsurancePremium = extracted.premium;
    data.totalAmount = extracted.premium;
  } else {
    data.totalAmount = null;
  }
  if (extracted.coverageType) data.coverageType = extracted.coverageType;
  // Insurance policies must not carry invented / linked PUC dates.
  data.pucExpiry = extracted.pucExpiry || null;
  if (!extracted.pucExpiry) data.pucExpiry = null;

  data.documentType = 'insurance';
  data.documentKind = 'insurance';
  data.documentLabel = data.documentLabel || 'Insurance';
  data.requiresVehicleLink = true;
  data.isVehicleInvoice = false;
  data.warrantyExpiry = null;
  data.warrantyPeriodMonths = null;
  data.warrantyText = null;
  data.insuranceFields = extracted;
  groupInsurancePolicyRecord(data, blob);

  return { data, extracted };
}

export function isInsuranceOcrDocument(data = {}, blob = '') {
  const text = String(blob || data.rawText || '');
  // Workshop / service billing structure must not be treated as insurance
  if (preferServiceBillOverInsurance(text)) return false;
  const arbEarly = resolveInsuranceVsService(text, data);
  if (arbEarly.treatAsService) return false;

  const kind = String(data.documentKind || data.documentType || data.vaultType || '').toLowerCase();
  if (kind.includes('insurance')) {
    if (hasExclusiveInsuranceSignals(text)) return true;
    const arb = resolveInsuranceVsService(text, data);
    return arb.treatAsInsurance;
  }
  if (!isInsuranceText(text)) return false;
  const arb = resolveInsuranceVsService(text, data);
  return arb.treatAsInsurance;
}

export default {
  extractInsuranceFields,
  extractInsurancePolicyDates,
  applyInsuranceOcrToInvoice,
  isInsuranceOcrDocument,
  emptyInsuranceFields,
  isJunkInsuranceVendor,
  isJunkPolicyHolder,
  isPlausibleInsuranceEngine,
  groupInsurancePolicyRecord,
  isInsuranceCoverageName,
};
