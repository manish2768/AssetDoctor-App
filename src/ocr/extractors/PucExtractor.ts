import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface PucCertificateFields {
  certificateNumber: ExtractedField<string | null>;
  vehicleRegistration: ExtractedField<string | null>;
  issueDate: ExtractedField<string | null>;
  expiryDate: ExtractedField<string | null>;
  emissionResult: ExtractedField<string | null>;
}

export class PucExtractor {
  public static extract(rawText: string): PucCertificateFields {
    const text = rawText || '';

    let certificateNumber = createNotFoundField<string | null>();
    const certMatch = text.match(/(?:CERTIFICATE\s*(?:NO|NUMBER)|PUC\s*NO)[:\s\-]*([A-Z0-9\-\/]+)/i);
    if (certMatch) certificateNumber = createVerifiedField(certMatch[1].trim(), 0.98, certMatch[0]);

    let vehicleRegistration = createNotFoundField<string | null>();
    const regMatch = text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const normReg = OcrFieldNormalizer.normalizeRegistration(regMatch[1]);
      if (normReg) vehicleRegistration = createVerifiedField(normReg, 0.98, regMatch[0]);
    }

    let issueDate = createNotFoundField<string | null>();
    let expiryDate = createNotFoundField<string | null>();

    const expMatch = text.match(/(?:VALID\s*UPTO|EXPIRY\s*DATE|VALID\s*TILL)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i);
    if (expMatch) {
      const normExp = OcrFieldNormalizer.normalizeDate(expMatch[1]);
      if (normExp) expiryDate = createVerifiedField(normExp, 0.98, expMatch[0]);
    }

    let emissionResult = createNotFoundField<string | null>();
    if (/\b(?:PASSED|PASS|SATISFACTORY|WITHIN\s*LIMITS)\b/i.test(text)) {
      emissionResult = createVerifiedField('PASS', 0.99, 'PASSED');
    }

    return {
      certificateNumber,
      vehicleRegistration,
      issueDate,
      expiryDate,
      emissionResult
    };
  }
}
