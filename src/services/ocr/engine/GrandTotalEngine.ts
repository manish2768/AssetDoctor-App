/**
 * Asset Doctor — Robust Grand Total & Financial Breakdown Engine
 *
 * Implements financial extraction and mathematical consistency verification:
 * - Gathers candidates from explicit grand total anchors
 * - Distinguishes grand total from unit prices, line item amounts, quantities, HSN codes, and IMEIs
 * - Extracts subtotal, CGST, SGST, IGST, cess, discounts, labour, and parts
 * - Applies mathematical cross-validation: Subtotal + Taxes - Discounts ≈ Grand Total
 */

import { CrossFieldValidator } from './CrossFieldValidator';

export interface FinancialBreakdown {
  grandTotal: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  discount: number | null;
  labourCharges: number | null;
  partsTotal: number | null;
  exShowroomPrice: number | null;
  confidence: number;
  validatedByArithmetic: boolean;
  rawEvidence: string;
}

export class GrandTotalEngine {
  /**
   * Parses and mathematically validates all financial figures from OCR text.
   */
  public static extractFinancials(rawText: string): FinancialBreakdown {
    const text = rawText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    let subtotal: number | null = null;
    let cgst: number | null = null;
    let sgst: number | null = null;
    let igst: number | null = null;
    let taxAmount: number | null = null;
    let discount: number | null = null;
    let labourCharges: number | null = null;
    let partsTotal: number | null = null;
    let exShowroomPrice: number | null = null;

    // 1. Extract tax components
    const cgstMatch = text.match(/(?:CGST|C-GST)(?:\s*@\s*[0-9.]+%)?[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (cgstMatch) cgst = this.parseAmount(cgstMatch[1]);

    const sgstMatch = text.match(/(?:SGST|S-GST)(?:\s*@\s*[0-9.]+%)?[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (sgstMatch) sgst = this.parseAmount(sgstMatch[1]);

    const igstMatch = text.match(/(?:IGST|I-GST)(?:\s*@\s*[0-9.]+%)?[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (igstMatch) igst = this.parseAmount(igstMatch[1]);

    if (cgst != null && sgst != null) {
      taxAmount = Math.round((cgst + sgst) * 100) / 100;
    } else if (igst != null) {
      taxAmount = igst;
    } else {
      const taxMatch = text.match(/(?:TOTAL\s*TAX|TAX\s*AMOUNT|GST\s*TOTAL|TOTAL\s*GST|GST\s*@\s*[0-9.]+%|TAX|GST)[:\s\-]+(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
      if (taxMatch) taxAmount = this.parseAmount(taxMatch[1]);
    }

    // 2. Extract subtotal & specific components
    const subtotalMatch = text.match(/(?:SUB\s*TOTAL|TAXABLE\s*VALUE|TAXABLE\s*AMOUNT|NET\s*TAXABLE)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (subtotalMatch) subtotal = this.parseAmount(subtotalMatch[1]);

    const labourMatch = text.match(/(?:LABOUR\s*(?:CHARGES?|AMOUNT|TOTAL)?|LABOR\s*(?:CHARGES?|AMOUNT|TOTAL)?|SERVICE\s*CHARGES?)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (labourMatch) labourCharges = this.parseAmount(labourMatch[1]);

    const partsMatch = text.match(/(?:PARTS\s*(?:SUBTOTAL|TOTAL|AMOUNT)?|SPARES\s*(?:TOTAL|AMOUNT)?|MATERIAL\s*CHARGES?)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (partsMatch) partsTotal = this.parseAmount(partsMatch[1]);

    const exShowroomMatch = text.match(/(?:EX[\s\-]SHOWROOM\s*(?:PRICE)?|EX[\s\-]FACTORY)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (exShowroomMatch) exShowroomPrice = this.parseAmount(exShowroomMatch[1]);

    const discountMatch = text.match(/(?:DISCOUNT|SCHEME\s*DISCOUNT|REBATE)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (discountMatch) discount = this.parseAmount(discountMatch[1]);

    // 3. Find Grand Total candidates
    const candidates: Array<{ amount: number; confidence: number; evidence: string }> = [];

    // Pattern A: Strict Grand Total Anchor
    const grandTotalRegexes = [
      /(?:GRAND\s*TOTAL|FINAL\s*TOTAL|TOTAL\s*AMOUNT|NET\s*TOTAL|AMOUNT\s*PAID|TOTAL\s*PAID|PAID\s*AMOUNT|NET\s*PAID|NET\s*PAYABLE|AMOUNT\s*PAYABLE|INVOICE\s*TOTAL|BILL\s*TOTAL|BILL\s*AMOUNT|TOTAL\s*DUE|BALANCE\s*DUE|TOTAL\s*VALUE|TOTAL\s*INVOICE\s*VALUE|PAYABLE)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?<!SUB\s*|TAXABLE\s*)(?:TOTAL|NET\s*AMOUNT)(?!\s*QUANTITY|\s*QTY|\s*HSN|\s*ITEMS?|\s*TAX)[:\s\-]*(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?:TOTAL|AMOUNT|PRICE|PURCHASE\s*PRICE|COST)[:\s\-]+(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
    ];

    for (const rx of grandTotalRegexes) {
      let match: RegExpExecArray | null;
      while ((match = rx.exec(text)) !== null) {
        const amt = this.parseAmount(match[1]);
        if (amt && amt > 0 && !this.isDisallowedAmount(amt, text)) {
          // Subtotal should not be treated as grand total if different from net
          if (subtotal != null && amt === subtotal && /SUB/i.test(match[0])) {
            continue;
          }
          const isExplicit = /GRAND|NET\s*TOTAL|NET\s*PAYABLE|AMOUNT\s*PAYABLE|INVOICE\s*TOTAL|FINAL\s*TOTAL/i.test(match[0]);
          candidates.push({
            amount: amt,
            confidence: isExplicit ? 0.96 : 0.82,
            evidence: match[0],
          });
        }
      }
    }

    // 4. Mathematical cross-validation boost
    let bestCandidate: { amount: number; confidence: number; evidence: string } | null = null;
    let validatedByArithmetic = false;

    for (const c of candidates) {
      // Check Subtotal + Taxes - Discounts ≈ Total
      if (subtotal != null) {
        const arith = CrossFieldValidator.validateFinancialArithmetic(subtotal, taxAmount || 0, discount, c.amount);
        if (arith.matches) {
          c.confidence = 0.99;
          validatedByArithmetic = true;
          bestCandidate = c;
          break;
        }
      }

      // Check Parts + Labour + Taxes ≈ Total
      if (partsTotal != null || labourCharges != null) {
        const base = (partsTotal || 0) + (labourCharges || 0);
        const taxes = taxAmount || 0;
        const arith = CrossFieldValidator.validateFinancialArithmetic(base, taxes, discount, c.amount);
        if (arith.matches) {
          c.confidence = 0.99;
          validatedByArithmetic = true;
          bestCandidate = c;
          break;
        }
      }
    }

    if (!bestCandidate && candidates.length > 0) {
      // Sort by confidence descending, then by amount (preferring plausible non-zero total)
      candidates.sort((a, b) => b.confidence - a.confidence);
      bestCandidate = candidates[0];
    }

    return {
      grandTotal: bestCandidate?.amount ?? null,
      subtotal,
      taxAmount,
      cgst,
      sgst,
      igst,
      discount,
      labourCharges,
      partsTotal,
      exShowroomPrice,
      confidence: bestCandidate?.confidence ?? 0,
      validatedByArithmetic,
      rawEvidence: bestCandidate?.evidence || '',
    };
  }

  /**
   * Helper to parse Indian currency strings e.g. "1,80,900.00" -> 180900
   */
  public static parseAmount(str: string): number | null {
    if (!str) return null;
    const clean = str.replace(/[^0-9.]/g, '');
    const val = parseFloat(clean);
    return Number.isFinite(val) ? Math.round(val * 100) / 100 : null;
  }

  /**
   * Guard preventing phone numbers, PIN codes, HSN codes, and IMEIs from being parsed as amounts.
   */
  private static isDisallowedAmount(amt: number, fullText: string): boolean {
    const intVal = Math.round(amt);
    const s = String(intVal);

    // Guard: 15-digit number is an IMEI or serial
    if (s.length === 15) return true;

    // Guard: 10-digit number starting with 6-9 is an Indian mobile phone number
    if (s.length === 10 && /^[6-9]/.test(s)) return true;

    // Guard: HSN codes (e.g. 8517, 8711, 8415, 8418) appearing in table columns
    if ([8517, 8711, 8415, 8418, 8450, 8528].includes(intVal)) {
      if (new RegExp(`HSN[\\s:]*${intVal}|\\b${intVal}\\b.*(?:8517|8711)`, 'i').test(fullText)) {
        return true;
      }
    }

    // Guard: Common postal PIN code
    if (s.length === 6 && /^[1-9][0-9]{5}$/.test(s)) {
      if (new RegExp(`PIN(?:\\s*CODE)?[:\\s]*${s}|Lucknow\\s*[-—]?\\s*${s}|Delhi\\s*[-—]?\\s*${s}`, 'i').test(fullText)) {
        return true;
      }
    }

    return false;
  }
}
