import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface WarrantyFields {
  productName: ExtractedField<string | null>;
  serialNumber: ExtractedField<string | null>;
  warrantyPeriodMonths: ExtractedField<number | null>;
  warrantyStartDate: ExtractedField<string | null>;
  warrantyEndDate: ExtractedField<string | null>;
}

export class WarrantyExtractor {
  public static extract(rawText: string): WarrantyFields {
    const text = rawText || '';

    let productName = createNotFoundField<string | null>();
    let serialNumber = createNotFoundField<string | null>();
    let warrantyPeriodMonths = createNotFoundField<number | null>();
    let warrantyStartDate = createNotFoundField<string | null>();
    let warrantyEndDate = createNotFoundField<string | null>();

    const warMatch = text.match(/(?:WARRANTY|VALIDITY)[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR)/i);
    if (warMatch) {
      const num = parseInt(warMatch[1], 10);
      const isYears = /year/i.test(warMatch[0]);
      warrantyPeriodMonths = createVerifiedField(isYears ? num * 12 : num, 0.95, warMatch[0]);
    }

    const expMatch = text.match(/(?:EXPIRY\s*DATE|VALID\s*TILL)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i);
    if (expMatch) {
      const norm = OcrFieldNormalizer.normalizeDate(expMatch[1]);
      if (norm) warrantyEndDate = createVerifiedField(norm, 0.98, expMatch[0]);
    }

    return {
      productName,
      serialNumber,
      warrantyPeriodMonths,
      warrantyStartDate,
      warrantyEndDate
    };
  }
}
