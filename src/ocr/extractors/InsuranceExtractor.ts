import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface InsurancePolicyFields {
  insurerName: ExtractedField<string | null>;
  policyNumber: ExtractedField<string | null>;
  insuredName: ExtractedField<string | null>;
  policyStartDate: ExtractedField<string | null>;
  policyEndDate: ExtractedField<string | null>;
  vehicleRegistration: ExtractedField<string | null>;
  vehicleModel: ExtractedField<string | null>;
  chassisNumber: ExtractedField<string | null>;
  engineNumber: ExtractedField<string | null>;
  idvAmount: ExtractedField<number | null>;
  premiumAmount: ExtractedField<number | null>;
  ncbPercentage: ExtractedField<number | null>;
  coverageType: ExtractedField<string | null>;
}

export class InsuranceExtractor {
  public static extract(rawText: string): InsurancePolicyFields {
    const text = rawText || '';

    let insurerName: ExtractedField<string | null> = createNotFoundField();
    const insurerMatch = text.match(/\b(ICICI\s*LOMBARD(?:\s*GENERAL\s*INSURANCE)?|HDFC\s*ERGO|BAJAJ\s*ALLIANZ|NEW\s*INDIA\s*ASSURANCE|TATA\s*AIG|IFFCO\s*TOKIO|GO\s*DIGIT|UNITED\s*INDIA\s*INSURANCE|NATIONAL\s*INSURANCE|SBI\s*GENERAL|RELIANCE\s*GENERAL|CHOLAMANDALAM\s*MS)\b/i);
    if (insurerMatch) {
      insurerName = createVerifiedField(insurerMatch[1].trim(), 0.98, insurerMatch[0]);
    }

    let policyNumber: ExtractedField<string | null> = createNotFoundField();
    const polMatch = text.match(/(?:POLICY\s*(?:NO|NUMBER|CERTIFICATE\s*NO)?|SCHEDULE\s*NO)[:\s\-]*([A-Z0-9\/\-\.]+)/i);
    if (polMatch) {
      policyNumber = createVerifiedField(polMatch[1].trim(), 0.98, polMatch[0]);
    }

    let insuredName: ExtractedField<string | null> = createNotFoundField();
    const insuredMatch = text.match(/(?:INSURED\s*NAME|NAME\s*OF\s*INSURED|POLICY\s*HOLDER)[:\s\-]*([A-Za-z\s\.]+)/i);
    if (insuredMatch) {
      insuredName = createVerifiedField(insuredMatch[1].trim(), 0.95, insuredMatch[0]);
    }

    let policyStartDate: ExtractedField<string | null> = createNotFoundField();
    let policyEndDate: ExtractedField<string | null> = createNotFoundField();

    const periodMatch = text.match(/(?:FROM|PERIOD\s*OF\s*INSURANCE[:\s\w]*FROM)?\s*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])\s*(?:TO|UNTIL|\-)\s*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i);
    if (periodMatch) {
      const s = OcrFieldNormalizer.normalizeDate(periodMatch[1]);
      const e = OcrFieldNormalizer.normalizeDate(periodMatch[2]);
      if (s) policyStartDate = createVerifiedField(s, 0.98, periodMatch[0]);
      if (e) policyEndDate = createVerifiedField(e, 0.98, periodMatch[0]);
    }

    let vehicleRegistration: ExtractedField<string | null> = createNotFoundField();
    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})/i)
      || text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const normReg = OcrFieldNormalizer.normalizeRegistration(regMatch[1]);
      if (normReg) vehicleRegistration = createVerifiedField(normReg, 0.98, regMatch[0]);
    }

    let vehicleModel: ExtractedField<string | null> = createNotFoundField();
    const modelMatch = text.match(/(?:VEHICLE\s*MAKE\s*&?\s*MODEL|MAKE\s*&?\s*MODEL|MODEL)[:\s\-]*([A-Za-z0-9\s\-]+)/i);
    if (modelMatch) {
      vehicleModel = createVerifiedField(modelMatch[1].trim(), 0.95, modelMatch[0]);
    }

    let chassisNumber: ExtractedField<string | null> = createNotFoundField();
    const chassisMatch = text.match(/(?:CHASSIS\s*(?:NO|NUMBER)?|VIN)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})/i);
    if (chassisMatch) {
      chassisNumber = createVerifiedField(chassisMatch[1].toUpperCase(), 0.98, chassisMatch[0]);
    }

    let engineNumber: ExtractedField<string | null> = createNotFoundField();
    const engineMatch = text.match(/(?:ENGINE\s*(?:NO|NUMBER)?|MOTOR\s*NO)[:\s\-]*([A-Z0-9]{6,18})/i);
    if (engineMatch) {
      engineNumber = createVerifiedField(engineMatch[1].toUpperCase(), 0.97, engineMatch[0]);
    }

    let idvAmount: ExtractedField<number | null> = createNotFoundField();
    const idvMatch = text.match(/(?:INSURED\s*DECLARED\s*VALUE|IDV)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (idvMatch) {
      const amt = OcrFieldNormalizer.normalizeAmount(idvMatch[1]);
      if (amt) idvAmount = createVerifiedField(amt, 0.98, idvMatch[0]);
    }

    let premiumAmount: ExtractedField<number | null> = createNotFoundField();
    const premMatch = text.match(/(?:TOTAL\s*PREMIUM\s*PAYABLE|PREMIUM\s*AMOUNT|NET\s*PREMIUM|GROSS\s*PREMIUM)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (premMatch) {
      const amt = OcrFieldNormalizer.normalizeAmount(premMatch[1]);
      if (amt) premiumAmount = createVerifiedField(amt, 0.98, premMatch[0]);
    }

    let ncbPercentage: ExtractedField<number | null> = createNotFoundField();
    const ncbMatch = text.match(/(?:NO\s*CLAIM\s*BONUS|NCB)[:\s\-]*([0-9]{1,2})\s*%/i);
    if (ncbMatch) {
      ncbPercentage = createVerifiedField(parseInt(ncbMatch[1], 10), 0.95, ncbMatch[0]);
    }

    let coverageType: ExtractedField<string | null> = createNotFoundField();
    if (/\b(?:COMPREHENSIVE|PACKAGE\s*POLICY|OWN\s*DAMAGE|THIRD\s*PARTY|STANDALONE\s*OD)\b/i.test(text)) {
      const cov = text.match(/\b(COMPREHENSIVE|PACKAGE\s*POLICY|OWN\s*DAMAGE|THIRD\s*PARTY|STANDALONE\s*OD)\b/i);
      if (cov) coverageType = createVerifiedField(cov[1].toUpperCase(), 0.95, cov[0]);
    }

    return {
      insurerName,
      policyNumber,
      insuredName,
      policyStartDate,
      policyEndDate,
      vehicleRegistration,
      vehicleModel,
      chassisNumber,
      engineNumber,
      idvAmount,
      premiumAmount,
      ncbPercentage,
      coverageType
    };
  }
}
