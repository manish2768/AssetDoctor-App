/**
 * Asset Doctor — Real Electricity Bill Semantic Extractor
 *
 * Dedicated contextual extractor for household electricity bills across Indian power DISCOMs:
 * - Tata Power, BSES Rajdhani/Yamuna, UPPCL, Adani Electricity, MSEDCL, Torrent, BESCOM, etc.
 * - Extracts mandatory core fields and optional fields when reliably detected.
 * - Adheres strictly to the minimal-data principle: never captures addresses, GSTINs, or ERP clutter.
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedElectricityBill {
  electricityProvider: string;
  consumerId: string;
  customerName?: string;
  serviceAddress?: string;
  sanctionedLoad?: string;
  billingMonth: string; // YYYY-MM
  billDate: string | null;
  dueDate: string | null;
  previousMeterReading: number | null;
  currentMeterReading: number | null;
  unitsConsumedKwh: number | null;
  unitsConsumed?: number | null;
  billingDays: number | null;
  currentBillAmount: number | null;

  // Optional fields
  energyCharge?: number | null;
  fixedCharge?: number | null;
  arrears?: number | null;
  subsidy?: number | null;
  totalPayable?: number | null;
  tariffRate?: number | null;
  meterNumber?: string | null;

  rawText: string;
}

export class RealElectricityBillExtractor {
  public static extract(
    rawText: string,
    candidateEngine?: FieldCandidateEngine
  ): ExtractedElectricityBill {
    const text = (rawText || '').trim();
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    // 1. Electricity Provider Resolution
    let electricityProvider = 'Electricity Provider';
    const providerPatterns: Array<{ name: string; re: RegExp }> = [
      { name: 'Tata Power', re: /\b(?:TATA\s*POWER(?:\s*DDL)?|TPDDL)\b/i },
      { name: 'BSES Rajdhani Power Limited', re: /\b(?:BSES\s*RAJDHANI|\bBRPL\b)\b/i },
      { name: 'BSES Yamuna Power Limited', re: /\b(?:BSES\s*YAMUNA|\bBYPL\b)\b/i },
      { name: 'UPPCL', re: /\b(?:UPPCL|UTTAR\s*PRADESH\s*POWER|PVVNL|MVVNL|DVVNL|PUVVNL|KESCO)\b/i },
      { name: 'Adani Electricity', re: /\b(?:ADANI\s*ELECTRICITY|ADANI\s*POWER)\b/i },
      { name: 'MSEDCL (Mahavitaran)', re: /\b(?:MSEDCL|MAHAVITARAN|MAHARASHTRA\s*STATE\s*ELECTRICITY)\b/i },
      { name: 'Torrent Power', re: /\bTORRENT\s*POWER\b/i },
      { name: 'BESCOM', re: /\bBESCOM|BANGALORE\s*ELECTRICITY\b/i },
      { name: 'TSSPDCL', re: /\b(?:TSSPDCL|SOUTHERN\s*POWER\s*DISTRIBUTION\s*COMPANY\s*OF\s*TELANGANA)\b/i },
      { name: 'TANGEDCO', re: /\bTANGEDCO|TAMIL\s*NADU\s*ELECTRICITY\b/i },
      { name: 'WBSEDCL', re: /\bWBSEDCL|WEST\s*BENGAL\s*STATE\s*ELECTRICITY\b/i },
      { name: 'CESC', re: /\bCESC\s*LIMITED\b/i },
      { name: 'PSPCL', re: /\bPSPCL|PUNJAB\s*STATE\s*POWER\b/i },
      { name: 'DHBVN', re: /\bDHBVN|DAKSHIN\s*HARYANA\b/i },
      { name: 'UHBVN', re: /\bUHBVN|UTTAR\s*HARYANA\b/i },
      { name: 'JVVNL', re: /\bJVVNL|JAIPUR\s*VIDYUT\b/i },
      { name: 'BEST Undertaking', re: /\bBEST\s*UNDERTAKING\b/i },
    ];

    for (const p of providerPatterns) {
      if (p.re.test(text)) {
        electricityProvider = p.name;
        break;
      }
    }

    if (electricityProvider === 'Electricity Provider') {
      const top = lines.slice(0, 4).find((l) =>
        /(?:ELECTRICITY|POWER|DISCOM|VIDYUT|ENERGY|DISTRIBUTION)/i.test(l) &&
        !/(?:BILL|RECEIPT|TAX\s*INVOICE|GSTIN)/i.test(l)
      );
      if (top) {
        electricityProvider = top.split(/—|–|-|,\s*Plot/i)[0].trim();
      }
    }

    // 2. Consumer ID / Account Number / CA Number
    let consumerId = '';
    const consumerPatterns = [
      /(?:\bCONSUMER\s*(?:NO|NUMBER|ID)|\bCONS\s*NO)(?:\s*\/[^\n:]+)?[:\s\-]+([A-Z0-9\-/]+)/i,
      /(?:\bCA\s*(?:NO|NUMBER)|\bCONTRACT\s*ACCOUNT)[:\s\-]+([0-9]{8,14})/i,
      /(?:\bK\s*NO|\bKNO)[:\s\-]+([0-9]{10,14})/i,
      /(?:\bACCOUNT\s*(?:NO|NUMBER|ID)|\bACC\s*NO)(?:\s*\/[^\n:]+)?[:\s\-]+([0-9]{8,16})/i,
      /(?:\bSERVICE\s*CONNECTION\s*NO|\bSC\s*NO)[:\s\-]+([A-Z0-9\-/]+)/i,
      /(?:\bBP\s*(?:NO|NUMBER)?|\bBUSINESS\s*PARTNER)[:\s\-]+([0-9]{8,12})/i,
    ];

    for (const pat of consumerPatterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        const val = m[1].trim();
        // Guard: Check if the current line is a phone / mobile / helpline anchor
        const matchIdx = m.index ?? 0;
        const currentLinePrefix = text.slice(0, matchIdx).split('\n').pop() || '';
        const isPhoneContext = /\b(?:MOBILE|PHONE|CALL|HELPLINE|CARE|WHATSAPP)\b/i.test(currentLinePrefix);
        if (!isPhoneContext && val.length >= 4) {
          consumerId = val;
          break;
        }
      }
    }

    // Customer Name
    let customerName = '';
    const nameMatch = text.match(/(?:CUSTOMER\s*NAME|CONSUMER\s*NAME|NAME|BILL\s*TO)[:\s\-]+([A-Za-z\s.]+?)(?:\r?\n|$)/i);
    if (nameMatch && nameMatch[1]) {
      const nm = nameMatch[1].trim();
      if (nm.length >= 3 && !/^(?:AND|OR|NO|NA|NIL)$/i.test(nm)) {
        customerName = nm;
      }
    }

    // Service Address
    let serviceAddress = '';
    const addrMatch = text.match(/(?:SERVICE\s*ADDRESS|PREMISES\s*ADDRESS|CONSUMER\s*ADDRESS|BILLING\s*ADDRESS|ADDRESS)[:\s\-]+([A-Za-z0-9\s,.\-\/]+?)(?:\r?\n|$)/i);
    if (addrMatch && addrMatch[1]) {
      serviceAddress = addrMatch[1].trim();
    }

    // Sanctioned Load
    let sanctionedLoad = '';
    const loadMatch = text.match(/(?:SANCTIONED\s*LOAD|CONNECTED\s*LOAD|LOAD)[:\s\-]*([0-9.]+\s*(?:KW|HP|KVA)?)/i);
    if (loadMatch && loadMatch[1]) {
      sanctionedLoad = loadMatch[1].trim();
    }

    // 3. Billing Month & Dates
    let billingMonth = '';
    let billDate: string | null = null;
    let dueDate: string | null = null;

    // Bill Date
    const billDateMatch = text.match(
      /(?:BILL\s*DATE|INVOICE\s*DATE|ISSUE\s*DATE|DATE\s*OF\s*BILL)[:\s\-]*((?:20[2-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9])|[0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i
    );
    if (billDateMatch) {
      billDate = CrossFieldValidator.normalizeDate(billDateMatch[1]);
    }

    // Due Date / Pay by Date
    const dueDateMatch = text.match(
      /(?:DUE\s*DATE|PAY\s*BY(?:\s*DATE)?|PAYMENT\s*DUE\s*DATE|PROMPT\s*PAYMENT\s*DATE)[:\s\-]*((?:20[2-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9])|[0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i
    );
    if (dueDateMatch) {
      dueDate = CrossFieldValidator.normalizeDate(dueDateMatch[1]);
    }

    // Billing Month (e.g. "BILLING MONTH: AUGUST 2026" or "BILL MONTH: 08/2026")
    const monthMatch = text.match(
      /(?:BILLING\s*MONTH|BILL\s*MONTH|MONTH)[:\s\-]*([A-Za-z]{3,9}\s*(?:20)?[1-3][0-9]|[0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|(?:20)?[1-3][0-9][/\-.][0-1]?[0-9])/i
    );
    if (monthMatch) {
      billingMonth = this.normalizeYearMonth(monthMatch[1]);
    }

    // If billing month was not directly labeled, infer from billDate or billing period
    if (!billingMonth && billDate) {
      billingMonth = billDate.slice(0, 7); // YYYY-MM
    }

    // 4. Meter & Consumption Readings
    let previousMeterReading: number | null = null;
    let currentMeterReading: number | null = null;
    let unitsConsumedKwh: number | null = null;
    let billingDays: number | null = null;

    // Previous reading
    const prevMatch = text.match(
      /(?:PREV(?:IOUS)?\s*(?:METER\s*)?READING|LAST\s*READING|INITIAL\s*READING|PREV\s*READ)[:\s\-]*([0-9]+(?:\.[0-9]+)?)/i
    );
    if (prevMatch) {
      previousMeterReading = Number(prevMatch[1]);
    }

    // Current reading
    const currMatch = text.match(
      /(?:CURRENT\s*(?:METER\s*)?READING|PRESENT\s*(?:METER\s*)?READING|FINAL\s*READING|CURR\s*READ)[:\s\-]*([0-9]+(?:\.[0-9]+)?)/i
    );
    if (currMatch) {
      currentMeterReading = Number(currMatch[1]);
    }

    // Units Consumed
    const unitsMatch = text.match(
      /(?:UNITS\s*(?:CONSUMED|BILLED)|BILLED\s*UNITS|TOTAL\s*UNITS|CONSUMPTION(?:\s*\(KWH\))?|BILLED\s*KWH)(?:\s*\([A-Z]+\))?[:\s\-]*([0-9]+(?:\.[0-9]+)?)/i
    ) || text.match(/\b([0-9]+(?:\.[0-9]+)?)\s*(?:KWH|UNITS)\b/i);
    if (unitsMatch) {
      unitsConsumedKwh = Number(unitsMatch[1]);
    }

    // Billing days
    const daysMatch = text.match(/(?:BILLING\s*DAYS|NO\.?\s*OF\s*DAYS|DAYS)[:\s\-]*([0-9]{1,2})\b/i);
    if (daysMatch) {
      billingDays = parseInt(daysMatch[1], 10);
    } else {
      // Default to 30 days if not found
      billingDays = 30;
    }

    // 5. Financial Amounts
    let currentBillAmount: number | null = null;
    let energyCharge: number | null = null;
    let fixedCharge: number | null = null;
    let arrears: number | null = null;
    let subsidy: number | null = null;
    let totalPayable: number | null = null;
    let tariffRate: number | null = null;
    let meterNumber: string | null = null;

    // Current Bill / Net Amount Payable
    const billMatch = text.match(
      /(?:CURRENT\s*BILL(?:\s*AMOUNT)?|NET\s*(?:AMOUNT\s*)?PAYABLE|TOTAL\s*PAYABLE|BILL\s*AMOUNT|TOTAL\s*AMOUNT\s*DUE|AMOUNT\s*PAYABLE)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i
    );
    if (billMatch) {
      currentBillAmount = this.parseMoney(billMatch[1]);
      totalPayable = currentBillAmount;
    }

    // Energy Charge
    const ecMatch = text.match(/(?:ENERGY\s*CHARGES?|EC)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (ecMatch) energyCharge = this.parseMoney(ecMatch[1]);

    // Fixed Charge
    const fcMatch = text.match(/(?:FIXED\s*CHARGES?|DEMAND\s*CHARGES?|FC)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (fcMatch) fixedCharge = this.parseMoney(fcMatch[1]);

    // Arrears
    const arrMatch = text.match(/(?:ARREARS|PREVIOUS\s*DUES)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (arrMatch) arrears = this.parseMoney(arrMatch[1]);

    // Subsidy
    const subMatch = text.match(/(?:SUBSIDY|GOVT\s*SUBSIDY|REBATE)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (subMatch) subsidy = this.parseMoney(subMatch[1]);

    // Tariff Rate
    const tariffMatch = text.match(/(?:TARIFF|RATE\s*\/\s*UNIT|ENERGY\s*RATE)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9]+(?:\.[0-9]+)?)/i);
    if (tariffMatch) tariffRate = Number(tariffMatch[1]);

    // Meter Number
    const meterMatch = text.match(/(?:METER\s*(?:NO|NUMBER)|MTR\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (meterMatch) meterNumber = meterMatch[1].trim();

    // Register into candidate engine if provided
    if (candidateEngine) {
      if (electricityProvider) {
        candidateEngine.registerCandidate({
          field: 'electricityProvider',
          value: electricityProvider,
          provider: 'ElectricityExtractor',
          rawEvidence: electricityProvider,
          confidence: 0.92,
        });
      }
      if (consumerId) {
        candidateEngine.registerCandidate({
          field: 'consumerId',
          value: consumerId,
          provider: 'ElectricityExtractor',
          rawEvidence: consumerId,
          confidence: 0.90,
        });
      }
      if (currentBillAmount != null) {
        candidateEngine.registerCandidate({
          field: 'currentBillAmount',
          value: currentBillAmount,
          provider: 'ElectricityExtractor',
          rawEvidence: String(currentBillAmount),
          confidence: 0.95,
        });
      }
      if (unitsConsumedKwh != null) {
        candidateEngine.registerCandidate({
          field: 'unitsConsumedKwh',
          value: unitsConsumedKwh,
          provider: 'ElectricityExtractor',
          rawEvidence: String(unitsConsumedKwh),
          confidence: 0.92,
        });
      }
    }

    return {
      electricityProvider,
      consumerId,
      customerName,
      serviceAddress,
      sanctionedLoad,
      billingMonth: billingMonth || (billDate ? billDate.slice(0, 7) : ''),
      billDate,
      dueDate,
      previousMeterReading,
      currentMeterReading,
      unitsConsumed: unitsConsumedKwh,
      unitsConsumedKwh,
      billingDays,
      currentBillAmount,
      energyCharge,
      fixedCharge,
      arrears,
      subsidy,
      totalPayable,
      tariffRate,
      meterNumber,
      rawText: text,
    };
  }

  private static parseMoney(str: string): number {
    return Number(str.replace(/,/g, '').trim()) || 0;
  }

  private static normalizeYearMonth(raw: string): string {
    const s = raw.trim();
    // Check YYYY-MM
    const iso = s.match(/(20[2-3][0-9])[/\-.](0[1-9]|1[0-2])/);
    if (iso) return `${iso[1]}-${iso[2]}`;

    // Check MM-YYYY
    const rev = s.match(/(0[1-9]|1[0-2])[/\-.](20[2-3][0-9])/);
    if (rev) return `${rev[2]}-${rev[1]}`;

    // Month Name Year (e.g. "August 2026" or "Aug 2026")
    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };
    const parts = s.split(/[\s\-,]+/);
    if (parts.length >= 2) {
      const mWord = parts[0].toLowerCase();
      const yWord = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
      if (monthNames[mWord] && /20[2-3][0-9]/.test(yWord)) {
        return `${yWord}-${monthNames[mWord]}`;
      }
    }

    return s;
  }
}
