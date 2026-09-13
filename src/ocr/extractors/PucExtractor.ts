import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface PucCertificateFields {
  certificateNumber: ExtractedField<string | null>;
  vehicleRegistration: ExtractedField<string | null>;
  issueDate: ExtractedField<string | null>;
  expiryDate: ExtractedField<string | null>;
  fuelType?: ExtractedField<string | null>;
  testingCenterName?: ExtractedField<string | null>;
  issuingAuthority?: ExtractedField<string | null>;
  coValue?: ExtractedField<string | null>;
  hcValue?: ExtractedField<string | null>;
  co2Value?: ExtractedField<string | null>;
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
    const issueMatch = text.match(/(?:DATE\s*OF\s*ISSUE|ISSUE\s*DATE|TEST\s*DATE)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[1-3][0-9])/i);
    if (issueMatch) {
      const normIss = OcrFieldNormalizer.normalizeDate(issueMatch[1]);
      if (normIss) issueDate = createVerifiedField(normIss, 0.98, issueMatch[0]);
    }

    let expiryDate = createNotFoundField<string | null>();
    const expMatch = text.match(/(?:VALID\s*UPTO|EXPIRY\s*DATE|VALID\s*TILL)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[1-3][0-9])/i);
    if (expMatch) {
      const normExp = OcrFieldNormalizer.normalizeDate(expMatch[1]);
      if (normExp) expiryDate = createVerifiedField(normExp, 0.98, expMatch[0]);
    }

    let fuelType: ExtractedField<string | null> = createNotFoundField();
    const fuelMatch = text.match(/(?:FUEL(?:\s*TYPE)?|FUEL\s*USED)[:\s\-]*([A-Za-z]+)\b/i) || text.match(/\b(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)\b/i);
    if (fuelMatch) {
      fuelType = createVerifiedField(fuelMatch[1].trim(), 0.95, fuelMatch[0]);
    }

    let testingCenterName: ExtractedField<string | null> = createNotFoundField();
    const testCenterMatch = text.match(/(?:TESTING\s*CENTRE(?:\s*NAME)?|TESTING\s*CENTER(?:\s*NAME)?|ISSUING\s*AUTHORITY|CENTRE\s*NAME)[:\s\-]+([A-Za-z0-9\s,.\-&]+?)(?:\r?\n|$)/i);
    if (testCenterMatch) {
      testingCenterName = createVerifiedField(testCenterMatch[1].trim(), 0.95, testCenterMatch[0]);
    }

    let coValue: ExtractedField<string | null> = createNotFoundField();
    const coMatch = text.match(/(?:\bCO\b|\bCARBON\s*MONOXIDE\b)[:\s\-]*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
    if (coMatch) coValue = createVerifiedField(coMatch[1], 0.95, coMatch[0]);

    let hcValue: ExtractedField<string | null> = createNotFoundField();
    const hcMatch = text.match(/(?:\bHC\b|\bHYDROCARBONS?\b)[:\s\-]*([0-9]+(?:\.[0-9]+)?)\s*(?:PPM)?/i);
    if (hcMatch) hcValue = createVerifiedField(hcMatch[1], 0.95, hcMatch[0]);

    let co2Value: ExtractedField<string | null> = createNotFoundField();
    const co2Match = text.match(/(?:\bCO2\b|\bCARBON\s*DIOXIDE\b)[:\s\-]*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
    if (co2Match) co2Value = createVerifiedField(co2Match[1], 0.95, co2Match[0]);

    let emissionResult = createNotFoundField<string | null>();
    if (/\b(?:PASSED|PASS|SATISFACTORY|WITHIN\s*LIMITS)\b/i.test(text)) {
      emissionResult = createVerifiedField('PASS', 0.99, 'PASSED');
    }

    return {
      certificateNumber,
      vehicleRegistration,
      issueDate,
      expiryDate,
      fuelType,
      testingCenterName,
      issuingAuthority: testingCenterName,
      coValue,
      hcValue,
      co2Value,
      emissionResult
    };
  }
}
