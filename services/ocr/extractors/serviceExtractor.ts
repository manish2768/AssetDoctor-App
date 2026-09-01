/**
 * Service Invoice & Repair Bill Extractor
 * Extracts workshop, customer, vehicle, odometer, and financial breakdown with confidence scoring.
 * Strict zero-hallucination policy: unobserved fields return null with status NOT_FOUND.
 */

import type { ServiceInvoiceData, ExtractedField, VerificationConfidenceTier, FieldStatus, OdometerCandidate } from '../types.ts';
import {
  extractLabeledChassisResult,
  extractLabeledEngineResult,
  extractLabeledGrandTotal,
  extractLabeledRegistration,
  extractLabeledTaxAmountWithEvidence,
  isForbiddenFinancialToken,
  isIdentifierMoneyDigits,
  normalizeIndianRegistration,
} from '../fieldSafety.ts';

export function createField<T>(
  value: T | null,
  confidence: number,
  rawText: string,
  sourceLabel?: string,
  extractionMethod?: string,
  flag?: string
): ExtractedField<T> {
  const rounded = Math.round(confidence * 100) / 100;
  let status: FieldStatus = 'NOT_FOUND';
  let tier: VerificationConfidenceTier = 'NOT_FOUND';

  if (value !== null && value !== undefined && value !== '') {
    if (rounded >= 0.85) {
      status = 'VERIFIED';
      tier = 'VERIFIED';
    } else if (rounded >= 0.70) {
      status = 'HIGH_CONFIDENCE';
      tier = 'HIGH_CONFIDENCE';
    } else {
      status = 'NEEDS_REVIEW';
      tier = 'NEEDS_REVIEW';
    }
  }

  const resolved = value === '' ? null : value;
  const method = extractionMethod || 'semantic_regex';
  const evidenceType: ExtractedField<T>['evidenceType'] = /header/i.test(method) || /header/i.test(sourceLabel || '')
    ? 'document_header'
    : /table/i.test(method) || /line_item/i.test(method)
      ? 'table_cell'
      : /label|labeled|context|regex|parser/i.test(method) || Boolean(sourceLabel)
        ? 'explicit_label'
        : 'contextual_text';
  return {
    value: resolved,
    normalizedValue: resolved,
    confidence: resolved === null || resolved === undefined ? 0 : rounded,
    rawText: rawText || (resolved === null ? 'Not found on document' : String(resolved)),
    sourceText: resolved === null ? null : rawText || null,
    sourceLabel,
    tier,
    status,
    sourceType: 'OCR_DOCUMENT',
    provenance: 'OCR_DOCUMENT',
    evidence: rawText || undefined,
    extractionMethod: method,
    sourceBoundingBox: null,
    page: resolved === null ? null : 1,
    evidenceType: resolved === null ? 'none' : evidenceType,
    flag,
    validationResult: 'UNVALIDATED',
  };
}

export class ServiceExtractor {
  /**
   * Normalizes Indian date string to YYYY-MM-DD
   */
  public static normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const clean = dateStr.trim();

    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
      let day = dmy[1].padStart(2, '0');
      let month = dmy[2].padStart(2, '0');
      let year = dmy[3];
      if (year.length === 2) year = `20${year}`;
      const normalized = `${year}-${month}-${day}`;
      return this.isValidDate(normalized) ? normalized : null;
    }

    // Match YYYY-MM-DD
    const ymd = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      const normalized = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
      return this.isValidDate(normalized) ? normalized : null;
    }

    // Match textual date: 14-Jul-2025 / 20 Aug 2024 / 20 August 2024
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const textMatch = clean.match(/(\d{1,2})[\s\/\-\.]+([A-Za-z]{3,9})[\s\/\-\.]+(\d{4})/i);
    if (textMatch) {
      const day = textMatch[1].padStart(2, '0');
      const mStr = textMatch[2].substring(0, 3).toLowerCase();
      const month = months[mStr];
      const year = textMatch[3];
      if (month) {
        const normalized = `${year}-${month}-${day}`;
        return this.isValidDate(normalized) ? normalized : null;
      }
    }

    return null;
  }

  public static isValidDate(isoDate: string): boolean {
    const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /**
   * Normalizes Indian Vehicle Registration Number (e.g. UP 32 QU 2187 -> UP32QU2187)
   * Never returns a GSTIN, IMEI, or phone-shaped token.
   */
  public static normalizeRegistration(reg: string): string | null {
    return normalizeIndianRegistration(reg);
  }

  /**
   * Main parsing method for Service Invoices and Repair Bills
   */
  public static extract(rawText: string): ServiceInvoiceData {
    const data: ServiceInvoiceData = {};
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. WORKSHOP NAME & GSTIN
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      if (/(pv|pvt|ltd|motors|automobiles|services|garage|auto|service\s*station|center|legends)/i.test(line) &&
          !/invoice|bill|receipt|tax|date|customer|reg/i.test(line)) {
        data.workshopName = createField(line, 0.94, line, 'Header Inspection', 'header_search');
        break;
      }
    }

    const gstinMatch = rawText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      data.gstin = createField(gstinMatch[1].toUpperCase(), 0.98, gstinMatch[0], 'GSTIN', 'gstin_regex');
    }

    // 2. VEHICLE MODEL / MAKE
    const vehiclePatterns = [
      /(?:Model|Vehicle\s*Model|Vehicle\s*Name|Item|Description)[:\s\.\-]*([^\n\r]+)/i,
      /\b(TVS\s+RONIN[^\n\r]*|BAJAJ\s+PULSAR[^\n\r]*|HERO\s+SPLENDOR[^\n\r]*|ROYAL\s+ENFIELD[^\n\r]*|HONDA\s+ACTIVA[^\n\r]*)\b/i
    ];
    for (const vp of vehiclePatterns) {
      const vm = rawText.match(vp);
      if (vm) {
        const candidate = vm[1].replace(/[\n\r]+/g, ' ').trim();
        if (candidate.length >= 3 && !/invoice|total|tax|date|customer|amount|parts|labour/i.test(candidate)) {
          data.vehicleModel = createField(candidate, 0.92, vm[0], 'Vehicle Model', 'model_regex');
          break;
        }
      }
    }

    // 3. VEHICLE REGISTRATION — labelled only (never GSTIN / random plate-shaped token)
    const labelledReg = extractLabeledRegistration(rawText);
    if (labelledReg.value) {
      data.vehicleRegistration = createField(
        labelledReg.value,
        labelledReg.valid ? 0.96 : 0.62,
        labelledReg.evidence,
        'Registration Regex',
        'registration_regex',
        labelledReg.valid ? undefined : 'NEEDS_REVIEW',
      );
      data.vehicleRegistration.validationResult = labelledReg.valid ? 'PASS' : 'FAIL';
      if (!labelledReg.valid) {
        data.vehicleRegistration.status = 'NEEDS_REVIEW';
        data.vehicleRegistration.tier = 'NEEDS_REVIEW';
      }
    }

    // 4. INVOICE NUMBER & DATES
    const invMatch = rawText.match(/(?:Invoice\s*No|Bill\s*No|Cash\s*Memo\s*No|Invoice\s*#)[:\s\.\-]*([A-Za-z0-9\/\-_]+)/i);
    if (invMatch) {
      const invVal = invMatch[1].trim();
      if (!/^(?:no|date|total|tax)$/i.test(invVal)) {
        data.invoiceNumber = createField(invVal, 0.93, invMatch[0], 'Invoice Number', 'invoice_no_regex');
      }
    }

    const dateMatch = rawText.match(/(?:Invoice\s*Date|Bill\s*Date|Service\s*Date|Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}[\s\/\-\.]+[A-Za-z]{3,9}[\s\/\-\.]+\d{4})/i);
    if (dateMatch) {
      const normDate = this.normalizeDate(dateMatch[1]);
      if (normDate) {
        data.invoiceDate = createField(normDate, 0.94, dateMatch[0], 'Invoice Date', 'date_regex');
        data.serviceDate = createField(normDate, 0.92, dateMatch[0], 'Service Date', 'date_regex');
      }
    }

    // 5. ODOMETER EXTRACTION (Strict Semantic Proximity + Comprehensive Negative Filtering)
    const odoCandidates: OdometerCandidate[] = [];
    const nextServiceCandidates: OdometerCandidate[] = [];

    // Next service regex to strictly isolate upcoming targets from current odometer
    const nextServiceRe = /(?:Next\s*(?:Service(?:\s*Due)?(?:\s*At)?|Due|Interval|Visit)|Service\s*Due(?:\s*At)?|Next\s*Service\s*KM|Due\s*at|Upcoming\s*Service)[^\d\n]*((?:\d{1,3}(?:,\d{3})+|\d{3,7}))\s*(?:KM|KMS)?/i;
    const nextMatch = rawText.match(nextServiceRe);
    if (nextMatch) {
      const valStr = nextMatch[1].replace(/,/g, '');
      const val = parseInt(valStr, 10);
      if (val >= 50 && val <= 999999) {
        nextServiceCandidates.push({
          value: val,
          sourceText: nextMatch[0].trim(),
          context: 'next_service_due',
          confidence: 0.95,
          extractionMethod: 'contextual_regex'
        });
      }
    }

    const highPriorityOdoPatterns = [
      { re: /(?:Odometer(?:\s*Reading)?|Current\s*KM|Current\s*KMs|Vehicle\s*KM|KM\s*Reading|Meter\s*Reading|\bOdo\b|Mileage|Current\s*Mileage|Kilometer\s*Reading|KM\s*at\s*service)[^\d\n]*((?:\d{1,3}(?:,\d{3})+|\d{3,7}))\s*(?:KM|KMS)?\b/gi, weight: 0.98, label: 'High Priority Context' },
      { re: /(?:In\s*KM|Opening\s*KM|Running\s*KM)[^\d\n]*((?:\d{1,3}(?:,\d{3})+|\d{3,7}))/gi, weight: 0.85, label: 'In KM Reading' }
    ];

    for (const pat of highPriorityOdoPatterns) {
      pat.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.re.exec(rawText))) {
        const valStr = m[1].replace(/,/g, '');
        const val = parseInt(valStr, 10);
        const matchText = m[0];

        // Strict Negative Filtering
        const isYear = val >= 1990 && val <= 2035;
        const isPhone = valStr.length === 10 && /^[6-9]/.test(valStr);
        const isPostal = valStr.length === 6 && /^[1-8]/.test(valStr);
        const isNearMoney = /[₹]|rs\.?\s*\d|inr\s*\d/i.test(matchText) || /\b(?:total|tax|gst|cgst|sgst|igst|rate|price|amount|subtotal|labour|parts)\b/i.test(matchText);
        const isNearGst = /\b(?:gstin|hsn|sac)\b/i.test(matchText);
        const isNextService = /(?:next\s*service|due\s*at|service\s*interval|upcoming)/i.test(matchText);

        if (val >= 10 && val <= 999999 && !isPhone && !isPostal && !isNearMoney && !isNearGst && !isNextService && !isIdentifierMoneyDigits(valStr) && !isForbiddenFinancialToken(val)) {
          odoCandidates.push({
            value: val,
            sourceText: matchText.trim(),
            context: 'odometer',
            confidence: isYear ? 0.70 : pat.weight,
            extractionMethod: 'contextual_regex'
          });
        }
      }
    }

    if (odoCandidates.length > 0) {
      // Do not silently choose between equally plausible current readings.
      odoCandidates.sort((a, b) => b.confidence - a.confidence);
      const distinct = Array.from(new Map(odoCandidates.map((candidate) => [candidate.value, candidate])).values());
      const chosen = distinct[0];
      const similarlyLikely = distinct.filter((candidate) => Math.abs(candidate.confidence - chosen.confidence) <= 0.05);
      if (similarlyLikely.length > 1) {
        const conflict = createField<number>(null, 0, similarlyLikely.map((candidate) => candidate.sourceText).join(' | '), 'Odometer Reading', 'candidate_conflict', 'MULTIPLE_ODOMETER_CANDIDATES');
        conflict.status = 'CONFLICT';
        conflict.tier = 'NEEDS_REVIEW';
        conflict.validationResult = 'FAIL';
        conflict.validationReason = 'MULTIPLE_ODOMETER_CANDIDATES';
        conflict.conflictCandidates = similarlyLikely.map((candidate) => ({ value: candidate.value, sourceText: candidate.sourceText, confidence: candidate.confidence }));
        data.odometerKm = conflict;
      } else {
        data.odometerKm = createField(chosen.value, chosen.confidence, chosen.sourceText, 'Odometer Reading', chosen.extractionMethod);
      }
    }

    if (nextServiceCandidates.length > 0) {
      const chosenNext = nextServiceCandidates[0];
      data.nextServiceOdometerKm = createField(chosenNext.value, chosenNext.confidence, chosenNext.sourceText, 'Next Service Due KM', chosenNext.extractionMethod);
    }

    const nextDateMatch = rawText.match(/(?:Next\s*Service\s*Date|Next\s*Due\s*Date)[:\s.\-]*(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3,9})[\/\-.]\d{2,4})/i);
    if (nextDateMatch) {
      const norm = this.normalizeDate(nextDateMatch[1]);
      if (norm) {
        (data as any).nextServiceDate = createField(norm, 0.92, nextDateMatch[0], 'Next Service Date', 'date_regex');
      }
    }

    // 6. CUSTOMER NAME & PHONE
    const custMatch = rawText.match(/(?:Customer\s*Name|Cust\s*Name|Customer|Owner\s*Name|Owner|Client|Bill\s*To)[:\s\.\-]*([A-Za-z\s\.\-]{3,35})/i);
    if (custMatch) {
      const name = custMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (name.length > 2 && !/invoice|cash|memo|tax|date|reg|total|parts|labour/i.test(name)) {
        data.customerName = createField(name, 0.91, custMatch[0], 'Customer Name', 'customer_regex');
      }
    }

    const phoneMatch = rawText.match(/(?:Mobile|Phone|Contact|Cell|Tel)[:\s\.\-]*([6-9][0-9]{9})/i) ||
                       rawText.match(/\b([6-9][0-9]{4}\s*[0-9]{5})\b/);
    if (phoneMatch) {
      data.customerPhone = createField(phoneMatch[1].replace(/\s+/g, ''), 0.95, phoneMatch[0], 'Customer Phone', 'phone_regex');
    }

    // 7. CHASSIS / VIN & ENGINE NUMBER
    const chassis = extractLabeledChassisResult(rawText);
    if (chassis.value) {
      data.vinOrChassis = createField(chassis.value, chassis.partialIdentifier ? 0.54 : 0.96, chassis.evidence, 'Chassis Number', 'vin_regex');
      data.vinOrChassis.partialIdentifier = chassis.partialIdentifier;
      if (chassis.partialIdentifier) {
        data.vinOrChassis.status = 'NEEDS_REVIEW';
        data.vinOrChassis.tier = 'NEEDS_REVIEW';
        data.vinOrChassis.validationResult = 'UNVALIDATED';
        data.vinOrChassis.validationReason = 'PARTIAL_IDENTIFIER_ONLY';
      }
    }

    const engine = extractLabeledEngineResult(rawText);
    if (engine.value) {
      data.engineNumber = createField(engine.value, engine.partialIdentifier ? 0.54 : 0.93, engine.evidence, 'Engine Number', 'engine_regex');
      data.engineNumber.partialIdentifier = engine.partialIdentifier;
      if (engine.partialIdentifier) {
        data.engineNumber.status = 'NEEDS_REVIEW';
        data.engineNumber.tier = 'NEEDS_REVIEW';
        data.engineNumber.validationResult = 'UNVALIDATED';
        data.engineNumber.validationReason = 'PARTIAL_IDENTIFIER_ONLY';
      }
    }

    // 8. FINANCIAL BREAKDOWN — labelled totals only; never IMEI / phone / GSTIN / plate
    const labeledTotal = extractLabeledGrandTotal(rawText);
    if (labeledTotal.amount != null && labeledTotal.amount > 0) {
      data.totalAmount = createField(
        labeledTotal.amount,
        0.96,
        labeledTotal.evidence,
        'Total Amount',
        'labeled_grand_total',
      );
      data.totalAmount.validationResult = 'PASS';
    }

    const labourMatch = rawText.match(/(?:Labou?r\s*(?:Total|Charges|Amount)|Labou?r)[^\d\n]*((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{2})?)/i);
    if (labourMatch) {
      const amt = parseFloat(labourMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && !isForbiddenFinancialToken(amt) && !isIdentifierMoneyDigits(labourMatch[1])) {
        data.labourCharges = createField(amt, 0.90, labourMatch[0], 'Labour Charges', 'labour_regex');
      }
    }

    const partsMatch = rawText.match(/(?:Parts\s*(?:Total|Amount)|Material\s*Total|Spares\s*Amount)[^\d\n]*((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{2})?)/i);
    if (partsMatch) {
      const amt = parseFloat(partsMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && !isForbiddenFinancialToken(amt) && !isIdentifierMoneyDigits(partsMatch[1])) {
        data.partsTotal = createField(amt, 0.90, partsMatch[0], 'Parts Total', 'parts_regex');
      }
    }

    const tax = extractLabeledTaxAmountWithEvidence(rawText);
    if (tax.amount != null) {
      data.taxAmount = createField(tax.amount, 0.88, tax.evidence, 'Tax Amount', 'tax_regex');
    }

    return data;
  }
}
