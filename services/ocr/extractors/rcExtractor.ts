/**
 * Vehicle Registration Certificate (RC) Extractor
 * Extracts owner, chassis, engine, maker, cubic capacity, and validity with normalized registration.
 */

import type { RcCertificateData, ExtractedField, VerificationConfidenceTier } from '../types.ts';
import { ServiceExtractor, createField } from './serviceExtractor.ts';

export class RcExtractor {
  public static extract(rawText: string): RcCertificateData {
    const data: RcCertificateData = {};

    // 1. REGISTRATION NUMBER (Normalized e.g. UP 32 AB 1234 -> UP32AB1234)
    const regMatch = rawText.match(/(?:Regn\s*No|Registration\s*(?:No|Number)|Vehicle\s*No)[:\s\.\-]*([A-Z0-9\s\-]{8,14})/i) ||
                     rawText.match(/\b([A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4})\b/i);
    if (regMatch) {
      const norm = ServiceExtractor.normalizeRegistration(regMatch[1]);
      if (norm) {
        data.registrationNumber = createField(norm, 0.99, regMatch[0], 'RC Registration Number');
      }
    }

    // 2. OWNER NAME
    const ownerMatch = rawText.match(/(?:Owner\s*Name|Name\s*of\s*Owner|Registered\s*Owner)[:\s\.\-]*([^\r\n]{3,35})/i);
    if (ownerMatch) {
      const name = ownerMatch[1].split(/[\r\n]/)[0].trim();
      if (name.length > 2 && !/form|certificate|registration|motor|chassis|engine/i.test(name)) {
        data.ownerName = createField(name, 0.94, ownerMatch[0], 'RC Owner Name');
      }
    }

    // 3. CHASSIS / VIN & ENGINE NUMBER
    const chassisMatch = rawText.match(/(?:Chassis\s*No|Chassis\s*Number|VIN)[:\s\.\-]*([A-HJ-NPR-Z0-9]{17}|[A-Z0-9]{12,20})/i);
    if (chassisMatch) {
      data.chassisNumber = createField(chassisMatch[1].toUpperCase(), 0.98, chassisMatch[0], 'RC Chassis Number');
    }

    const engineMatch = rawText.match(/(?:Engine\s*No|Engine\s*Number)[:\s\.\-]*([A-Z0-9]{6,16})/i);
    if (engineMatch) {
      data.engineNumber = createField(engineMatch[1].toUpperCase(), 0.96, engineMatch[0], 'RC Engine Number');
    }

    // 4. MAKER & MODEL
    const makerMatch = rawText.match(/(?:Maker'?s\s*Name|Maker|Manufacturer)[:\s\.\-]*([^\r\n]{3,25})/i);
    if (makerMatch) {
      const cleanMaker = makerMatch[1].split(/[\r\n]/)[0].trim();
      data.maker = createField(cleanMaker, 0.93, makerMatch[0], 'Maker Name');
    }

    const modelMatch = rawText.match(/(?:Model\s*Name|Makers\s*Class|Model)[:\s\.\-]*([^\r\n]{3,30})/i);
    if (modelMatch) {
      const cleanModel = modelMatch[1].split(/[\r\n]/)[0].trim();
      data.model = createField(cleanModel, 0.92, modelMatch[0], 'Vehicle Model');
    }

    // 5. REGISTRATION & VALIDITY DATES
    const regDateMatch = rawText.match(/(?:Regn\s*Date|Date\s*of\s*Registration|Reg\s*Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (regDateMatch) {
      const norm = ServiceExtractor.normalizeDate(regDateMatch[1]);
      if (norm) data.registrationDate = createField(norm, 0.95, regDateMatch[0], 'Registration Date');
    }

    const valDateMatch = rawText.match(/(?:Fitness\s*Upto|Valid\s*Upto|Registration\s*Validity|Valid\s*Till)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (valDateMatch) {
      const norm = ServiceExtractor.normalizeDate(valDateMatch[1]);
      if (norm) data.registrationValidity = createField(norm, 0.96, valDateMatch[0], 'Registration Validity');
    }

    // 6. CUBIC CAPACITY & SEATING CAPACITY
    const ccMatch = rawText.match(/(?:Cubic\s*Cap|CC|Displacement)[:\s\.\-]*([0-9]{2,5})/i);
    if (ccMatch) {
      const cc = parseInt(ccMatch[1], 10);
      if (cc >= 50 && cc <= 8000) {
        data.cubicCapacity = createField(cc, 0.92, ccMatch[0], 'Cubic Capacity (CC)');
      }
    }

    const seatMatch = rawText.match(/(?:Seating\s*Cap|Seats)[:\s\.\-]*([0-9]{1,2})/i);
    if (seatMatch) {
      const seats = parseInt(seatMatch[1], 10);
      if (seats >= 1 && seats <= 100) {
        data.seatingCapacity = createField(seats, 0.90, seatMatch[0], 'Seating Capacity');
      }
    }

    // 7. FINANCIER / HYPOTHECATION
    const finMatch = rawText.match(/(?:Hypothecated\s*to|Financier|HPA)[:\s\.\-]*([A-Za-z\s\.\-]{3,35})/i);
    if (finMatch) {
      data.financier = createField(finMatch[1].trim(), 0.91, finMatch[0], 'Financier');
    }

    return data;
  }
}
