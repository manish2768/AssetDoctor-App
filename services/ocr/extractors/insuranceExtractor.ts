/**
 * Motor Insurance Policy & Renewal Extractor
 * Extracts insurer, policy dates, IDV, premium, NCB, zero depreciation, and policyholder details.
 */

import type { InsurancePolicyData, InsurancePolicyType, ExtractedField, VerificationConfidenceTier, FieldStatus } from '../types.ts';
import { ServiceExtractor, createField } from './serviceExtractor.ts';
import {
  extractLabeledChassis,
  extractLabeledEngine,
  extractLabeledRegistration,
  isForbiddenFinancialToken,
  parseSafeAmount,
} from '../fieldSafety.ts';

export class InsuranceExtractor {
  public static extract(rawText: string): InsurancePolicyData {
    const data: InsurancePolicyData = {};

    // 1. INSURER NAME
    const insurers = [
      'ICICI Lombard General Insurance',
      'HDFC ERGO General Insurance',
      'Bajaj Allianz General Insurance',
      'Tata AIG General Insurance',
      'The New India Assurance Co Ltd',
      'United India Insurance Company',
      'National Insurance Company',
      'The Oriental Insurance Company',
      'Go Digit General Insurance',
      'Acko General Insurance',
      'SBI General Insurance',
      'Reliance General Insurance',
      'Kotak Mahindra General Insurance',
      'Cholamandalam MS General Insurance',
      'Future Generali India Insurance',
      'Royal Sundaram General Insurance'
    ];

    for (const ins of insurers) {
      const regex = new RegExp(ins.split(' ')[0] + '\\s*' + (ins.split(' ')[1] || ''), 'i');
      if (regex.test(rawText)) {
        data.insurerName = createField(ins, 0.98, ins, 'Insurer Registry Match');
        break;
      }
    }

    // 2. POLICY NUMBER
    const polMatch = rawText.match(/(?:Policy\s*No|Policy\s*Number)[:\s\.\-]*([A-Za-z0-9\/\-]{8,35})/i);
    if (polMatch) {
      data.policyNumber = createField(polMatch[1].trim(), 0.97, polMatch[0], 'Policy Number Regex');
    }

    // 3. POLICY TYPE & ADD-ONS
    let pType: InsurancePolicyType | null = null;
    if (/zero\s*dep|nil\s*depreciation|bumper\s*to\s*bumper/i.test(rawText)) {
      pType = 'ZERO_DEPRECIATION';
      data.zeroDepCover = createField(true, 0.95, 'Zero Depreciation Add-on detected', 'Zero Dep Match');
    } else if (/stand-?alone\s*own\s*damage|own\s*damage\s*only/i.test(rawText)) {
      pType = 'OWN_DAMAGE';
    } else if (/third\s*party\s*only|act\s*only/i.test(rawText)) {
      pType = 'THIRD_PARTY';
    } else if (/package\s*policy|comprehensive/i.test(rawText)) {
      pType = 'COMPREHENSIVE';
    }
    if (pType) {
      data.policyType = createField(pType, 0.92, pType, 'Policy Type Detection');
    }

    const addOns: string[] = [];
    if (/zero\s*dep|nil\s*dep/i.test(rawText)) addOns.push('Zero Depreciation');
    if (/engine\s*protect|engine\s*guard/i.test(rawText)) addOns.push('Engine Protector');
    if (/roadside\s*assistance|rsa/i.test(rawText)) addOns.push('24x7 Roadside Assistance');
    if (/key\s*replacement/i.test(rawText)) addOns.push('Key Replacement');
    if (/consumables\s*cover/i.test(rawText)) addOns.push('Consumables Cover');
    if (/tyre\s*protect/i.test(rawText)) addOns.push('Tyre Secure');
    if (/return\s*to\s*invoice|rti/i.test(rawText)) addOns.push('Return to Invoice');

    if (addOns.length > 0) {
      data.addOnCovers = createField(addOns, 0.90, addOns.join(', '), 'Add-on Detection');
    }

    // 4. VEHICLE MAKE & MODEL
    const vMakeModelMatch = rawText.match(/(?:Vehicle\s*Make\s*(?:&|and)?\s*Model|Make\s*(?:&|and)?\s*Model|Vehicle\s*Description)[:\s\.\-]*([A-Za-z0-9\s\-_]{3,45})/i);
    if (vMakeModelMatch) {
      const vStr = vMakeModelMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (vStr.length >= 3 && !/policy|schedule|motor|insurance|reg|chassis/i.test(vStr)) {
        data.vehicleModel = createField(vStr, 0.94, vMakeModelMatch[0], 'Vehicle Model');
        const makeMatch = rawText.match(/(?:Vehicle\s*Make|Manufacturer|Make)[:\s.\-]*([^\n\r]+)/i);
        if (makeMatch) data.vehicleMake = createField(makeMatch[1].trim(), 0.92, makeMatch[0], 'Vehicle Make');
      }
    }

    // 5. VEHICLE REGISTRATION & VIN & ENGINE
    const labelledReg = extractLabeledRegistration(rawText);
    if (labelledReg.value) {
      data.vehicleRegistration = createField(
        labelledReg.value,
        labelledReg.valid ? 0.97 : 0.62,
        labelledReg.evidence,
        'Registration Parser',
      );
      data.vehicleRegistration.validationResult = labelledReg.valid ? 'PASS' : 'FAIL';
      if (!labelledReg.valid) {
        data.vehicleRegistration.status = 'NEEDS_REVIEW';
        data.vehicleRegistration.tier = 'NEEDS_REVIEW';
      }
    }

    const chassis = extractLabeledChassis(rawText);
    if (chassis) {
      data.vinOrChassis = createField(chassis, 0.98, chassis, 'VIN Parser');
    }

    const engine = extractLabeledEngine(rawText);
    if (engine) {
      data.engineNumber = createField(engine, 0.94, engine, 'Engine Number Parser');
    }

    // 5. POLICY DATES (Start & Expiry)
    const datePat = '(?:\\d{1,2}[\\s\\/\\-\\.]+[A-Za-z]{3,9}[\\s\\/\\-\\.]+\\d{2,4}|\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})';
    const periodRegex = new RegExp(`(?:Period\\s*of\\s*Insurance|Policy\\s*Period)[:\\s\\.\\-]*from\\s*(${datePat})\\s*(?:to|till|-)\\s*(${datePat})`, 'i');
    const periodMatch = rawText.match(periodRegex);
    if (periodMatch) {
      const sDate = ServiceExtractor.normalizeDate(periodMatch[1]);
      const eDate = ServiceExtractor.normalizeDate(periodMatch[2]);
      if (sDate) data.policyStartDate = createField(sDate, 0.96, periodMatch[1], 'Policy Start Date');
      if (eDate) data.policyExpiryDate = createField(eDate, 0.97, periodMatch[2], 'Policy Expiry Date');
    } else {
      // Individual date search
      const expRegex = new RegExp(`(?:Expiry\\s*Date|Valid\\s*Till|End\\s*Date|Due\\s*Date)[:\\s\\.\\-]*(${datePat})`, 'i');
      const expMatch = rawText.match(expRegex);
      if (expMatch) {
        const norm = ServiceExtractor.normalizeDate(expMatch[1]);
        if (norm) data.policyExpiryDate = createField(norm, 0.92, expMatch[0], 'Expiry Date');
      }
    }

    // 6. IDV (Insured Declared Value)
    const idvMatch = rawText.match(/(?:Insured\s*Declared\s*Value|Total\s*IDV|Vehicle\s*IDV|\bIDV\b)[^\d\n]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]{4,8}(?:\.[0-9]{2})?)/i);
    if (idvMatch) {
      const idv = parseSafeAmount(idvMatch[1]);
      if (idv != null && idv > 1000 && !isForbiddenFinancialToken(idv)) {
        data.idvAmount = createField(idv, 0.95, idvMatch[0], 'IDV Extractor');
      }
    }

    const premMatch = rawText.match(/(?:Total\s*Premium|Final\s*Premium|Gross\s*Premium|Net\s*Premium|Total\s*Payable)[^\d\n]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]{3,7}(?:\.[0-9]{2})?)/i);
    if (premMatch) {
      const prem = parseSafeAmount(premMatch[1]);
      if (prem != null && prem > 100 && !isForbiddenFinancialToken(prem)) {
        data.premiumAmount = createField(prem, 0.94, premMatch[0], 'Premium Extractor');
      }
    }

    const ncbMatch = rawText.match(/(?:No\s*Claim\s*Bonus(?:\s*\(NCB\))?|NCB)[:\s\.\-₹Rs\(\)]*([0-9]{1,2})\s*%/i);
    if (ncbMatch) {
      const ncb = parseInt(ncbMatch[1], 10);
      if (ncb >= 0 && ncb <= 50) {
        data.ncbPercentage = createField(ncb, 0.96, ncbMatch[0], 'NCB Extractor');
      }
    }

    // 8. INSURED NAME
    const nameMatch = rawText.match(/(?:Name\s*of\s*Insured|Insured\s*Name|Policy\s*Holder|Proposer\s*Name)[:\s\.\-]*([A-Z\s\.\-]{3,35})/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name.length > 2 && !/policy|schedule|motor|insurance/i.test(name)) {
        data.insuredName = createField(name, 0.92, nameMatch[0], 'Insured Name');
      }
    }

    return data;
  }
}
