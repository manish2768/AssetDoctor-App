import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface RcCertificateFields {
  vehicleRegistration: ExtractedField<string | null>;
  ownerName: ExtractedField<string | null>;
  chassisNumber: ExtractedField<string | null>;
  engineNumber: ExtractedField<string | null>;
  vehicleModel: ExtractedField<string | null>;
  registrationDate: ExtractedField<string | null>;
  fitnessExpiryDate: ExtractedField<string | null>;
  fuelType: ExtractedField<string | null>;
}

export class RcExtractor {
  public static extract(rawText: string): RcCertificateFields {
    const text = rawText || '';

    let vehicleRegistration = createNotFoundField<string | null>();
    const regMatch = text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const normReg = OcrFieldNormalizer.normalizeRegistration(regMatch[1]);
      if (normReg) vehicleRegistration = createVerifiedField(normReg, 0.99, regMatch[0]);
    }

    let ownerName = createNotFoundField<string | null>();
    const ownerMatch = text.match(/(?:OWNER\s*NAME|NAME\s*OF\s*OWNER)[:\s\-]*([A-Za-z\s\.]+)/i);
    if (ownerMatch) ownerName = createVerifiedField(ownerMatch[1].trim(), 0.95, ownerMatch[0]);

    let chassisNumber = createNotFoundField<string | null>();
    const chassisMatch = text.match(/(?:CHASSIS\s*(?:NO|NUMBER)?|VIN)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})/i);
    if (chassisMatch) chassisNumber = createVerifiedField(chassisMatch[1].toUpperCase(), 0.99, chassisMatch[0]);

    let engineNumber = createNotFoundField<string | null>();
    const engineMatch = text.match(/(?:ENGINE\s*(?:NO|NUMBER)?|MOTOR\s*NO)[:\s\-]*([A-Z0-9]{6,18})/i);
    if (engineMatch) engineNumber = createVerifiedField(engineMatch[1].toUpperCase(), 0.98, engineMatch[0]);

    let vehicleModel = createNotFoundField<string | null>();
    const modelMatch = text.match(/(?:MAKER\s*&?\s*MODEL|MODEL|CLASS)[:\s\-]*([A-Za-z0-9\s\-]+)/i);
    if (modelMatch) vehicleModel = createVerifiedField(modelMatch[1].trim(), 0.95, modelMatch[0]);

    let registrationDate = createNotFoundField<string | null>();
    let fitnessExpiryDate = createNotFoundField<string | null>();

    const fitMatch = text.match(/(?:FITNESS\s*(?:UPTO|VALID\s*UPTO)|EXPIRY\s*DATE)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-4][0-9])/i);
    if (fitMatch) {
      const norm = OcrFieldNormalizer.normalizeDate(fitMatch[1]);
      if (norm) fitnessExpiryDate = createVerifiedField(norm, 0.98, fitMatch[0]);
    }

    let fuelType = createNotFoundField<string | null>();
    const fuelMatch = text.match(/\b(PETROL|DIESEL|ELECTRIC|EV|CNG|HYBRID)\b/i);
    if (fuelMatch) fuelType = createVerifiedField(fuelMatch[1].toUpperCase(), 0.98, fuelMatch[0]);

    return {
      vehicleRegistration,
      ownerName,
      chassisNumber,
      engineNumber,
      vehicleModel,
      registrationDate,
      fitnessExpiryDate,
      fuelType
    };
  }
}
