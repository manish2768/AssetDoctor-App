/**
 * Asset Doctor — Indian PUC (Pollution Under Control) Extractor
 * Extracts PUC certificate number, vehicle registration, issue date,
 * expiry date, test centre code, and emission test status.
 */

import type { ExtractedField, PucCertificateData } from '../types.ts';
import { ServiceExtractor, createField as baseCreateField } from './serviceExtractor.ts';
import { extractLabeledRegistration } from '../fieldSafety.ts';

function createField<T>(value: T, confidence = 0.95, rawText = ''): ExtractedField<T> {
  return baseCreateField(value, confidence, rawText, 'PUC Matcher', 'puc_pattern_matcher');
}

export class PucExtractor {
  public static extract(rawText: string): PucCertificateData {
    const result: PucCertificateData = {};
    const upper = rawText.toUpperCase();

    // 1. Vehicle Registration Number (Indian Format: UP32QU2187, DL01AB1234, MH02CD5678, etc.)
    const labelledReg = extractLabeledRegistration(rawText);
    const unlabelledRegMatch = labelledReg.value
      ? null
      : rawText.match(/\b([A-Z]{2}\s*[-]?\s*[0-9]{1,2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*[0-9]{4})\b/i);

    if (labelledReg.value) {
      result.registrationNumber = createField(labelledReg.value, labelledReg.valid ? 0.97 : 0.62, labelledReg.evidence);
      result.registrationNumber.validationResult = labelledReg.valid ? 'PASS' : 'FAIL';
    } else if (unlabelledRegMatch) {
      const cleanReg = ServiceExtractor.normalizeRegistration(unlabelledRegMatch[1]);
      if (cleanReg) {
        result.registrationNumber = createField(cleanReg, 0.9, unlabelledRegMatch[0]);
      }
    }

    // 2. PUC Certificate Number (e.g. PUC NO: DL01/2024/987123, PUC/UP32/88719, etc.)
    const pucNumMatch = rawText.match(
      /(?:PUC\s*(?:(?:CERTIFICATE\s*)?(?:NO|NUMBER)|CERTIFICATE|CODE)?|CERTIFICATE\s*NO)[\s.:#-]+([A-Z0-9\/-]{6,25})/i
    );
    if (pucNumMatch) {
      const val = pucNumMatch[1].trim();
      if (val && val !== (result.registrationNumber?.value || '___')) {
        result.certificateNumber = createField(val, 0.94, pucNumMatch[0]);
      }
    }

    // 3. Issue Date & Expiry / Validity Date
    const dateMatches = Array.from(rawText.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g));
    const dates: string[] = [];
    for (const m of dateMatches) {
      const norm = ServiceExtractor.normalizeDate(m[0]);
      if (norm) dates.push(norm);
    }

    // Sort dates chronologically
    const sortedDates = dates.sort();
    if (sortedDates.length >= 2) {
      result.issueDate = createField(sortedDates[0], 0.92, sortedDates[0]);
      result.expiryDate = createField(sortedDates[sortedDates.length - 1], 0.96, sortedDates[sortedDates.length - 1]);
    } else if (sortedDates.length === 1) {
      const d = sortedDates[0];
      const today = new Date().toISOString().split('T')[0];
      if (d > today) {
        result.expiryDate = createField(d, 0.90, d);
      } else {
        result.issueDate = createField(d, 0.90, d);
      }
    }

    // 4. Emission Test Status
    if (upper.includes('PASS') || upper.includes('COMPLIANT') || upper.includes('WITHIN LIMITS')) {
      result.certificateStatus = createField('PASS', 0.98, 'COMPLIANT');
    }

    return result;
  }
}

export function extractPucData(rawText: string): PucCertificateData {
  return PucExtractor.extract(rawText);
}
