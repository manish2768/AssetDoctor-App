/**
 * Phase 15 — redacted / synthetic Indian document OCR text.
 * No live customer PII. Identifiers are the project's existing test corpus
 * (TVS Ronin, Nothing Phone Luhn IMEI, ICICI synthetic policy).
 */

export interface RedactedDocumentFixture {
  id: string;
  category: string;
  expectedType: string;
  forbiddenTypes: string[];
  rawText: string;
  /** Fields that must appear on this document. Empty expected = must stay NOT_FOUND. */
  expect: Record<string, string | number | null>;
  /** Poisoned OCR fields that the hardening layer must reject/replace. */
  poisonedFields?: Record<string, string | number>;
}

export const REDACTED_CORPUS: RedactedDocumentFixture[] = [
  {
    id: 'vehicle-purchase-invoice',
    category: 'Vehicle Purchase Invoice',
    expectedType: 'PURCHASE_INVOICE',
    forbiddenTypes: ['INSURANCE_POLICY', 'PUC', 'SERVICE_INVOICE'],
    rawText: `TAX INVOICE
TVS Motor Company Dealer Invoice
Invoice No INV-TVS-88421  Invoice Date 19/05/2024
Customer: REDACTED CUSTOMER
Vehicle: TVS Ronin 225
Registration No: UP32QU2187
Chassis / Frame: MD637AN11S2F03328
Engine No: BN1FS2302943
GSTIN: 09AABCU9603R1ZX
Ex-Showroom  1,49,000
GST 18%  26,820
Grand Total  Rs. 1,75,820`,
    expect: {
      registration: 'UP32QU2187',
      chassisNumber: 'MD637AN11S2F03328',
      engineNumber: 'BN1FS2302943',
      invoiceNumber: 'INV-TVS-88421',
      shopGstin: '09AABCU9603R1ZX',
    },
  },
  {
    id: 'vehicle-service-invoice',
    category: 'Vehicle Service Invoice',
    expectedType: 'SERVICE_INVOICE',
    forbiddenTypes: ['INSURANCE_POLICY', 'ELECTRONICS_INVOICE', 'bill'],
    rawText: `JOB CARD / SERVICE INVOICE
TVS Workshop  Labour charges
Vehicle No UP32QU2187
Chassis MD637AN11S2F03328
Engine BN1FS2302943
Odometer 12450 KM
Service Date 12/01/2026
Invoice Date 12/01/2026
Labour 1850  Parts 420  Grand Total 2270
GSTIN 09AABCU9603R1ZX`,
    expect: {
      registration: 'UP32QU2187',
      chassisNumber: 'MD637AN11S2F03328',
      engineNumber: 'BN1FS2302943',
      odometerKm: 12450,
    },
    poisonedFields: { odometerKm: 2270 },
  },
  {
    id: 'vehicle-insurance-policy',
    category: 'Vehicle Insurance Policy',
    expectedType: 'INSURANCE_POLICY',
    forbiddenTypes: ['SERVICE_INVOICE', 'PUC', 'bill'],
    rawText: `ICICI Lombard General Insurance Company Limited
Policy Certificate cum Schedule
Two Wheeler Package Policy
Policy Number: 3005/2024/09871234
Period of Insurance: From 15-Sep-2024 to 14-Sep-2025
Vehicle Registration No: UP32QU2187
Engine No: BN1FS2302943
Chassis No: MD637AN11S2F03328
Total Premium Payable: Rs. 2,450.00`,
    expect: {
      policyNumber: '3005/2024/09871234',
      registration: 'UP32QU2187',
      engineNumber: 'BN1FS2302943',
    },
  },
  {
    id: 'puc-certificate',
    category: 'PUC Certificate',
    expectedType: 'PUC',
    forbiddenTypes: ['INSURANCE_POLICY', 'PURCHASE_INVOICE'],
    rawText: `POLLUTION UNDER CONTROL CERTIFICATE
PUC Certificate
Vehicle Registration UP32QU2187
Validity of PUC 12/08/2026
Emission test PASSED
Certificate No PUC-UP-22190`,
    expect: {
      registration: 'UP32QU2187',
    },
  },
  {
    id: 'rc-document',
    category: 'RC / Registration document',
    expectedType: 'RC',
    forbiddenTypes: ['PURCHASE_INVOICE', 'SERVICE_INVOICE'],
    rawText: `CERTIFICATE OF REGISTRATION
Form 23  RC Book
Registration No UP32QU2187
Chassis No MD637AN11S2F03328
Engine No BN1FS2302943
Vehicle Class MOTOR CYCLE
RTO LUCKNOW`,
    expect: {
      registration: 'UP32QU2187',
      chassisNumber: 'MD637AN11S2F03328',
      engineNumber: 'BN1FS2302943',
    },
  },
  {
    id: 'electronics-invoice',
    category: 'Electronics Invoice',
    expectedType: 'ELECTRONICS_INVOICE',
    forbiddenTypes: ['SERVICE_INVOICE', 'RC'],
    rawText: `TAX INVOICE  GST Invoice
Croma Retail  GSTIN 27AABCU9603R1ZX
Invoice No CR-2024-55102  Date 03/11/2024
Sony WH-1000XM5 Headphones
Serial Number SN-9981XZ
Qty 1  Unit Price 24990  CGST 12% SGST 12%
Grand Total ₹29,988`,
    expect: {
      serialNumber: 'SN-9981XZ',
      invoiceNumber: 'CR-2024-55102',
      shopGstin: '27AABCU9603R1ZX',
    },
    poisonedFields: { serialNumber: 29988 },
  },
  {
    id: 'mobile-phone-invoice',
    category: 'Mobile Phone Invoice',
    expectedType: 'ELECTRONICS_INVOICE',
    forbiddenTypes: ['SERVICE_INVOICE', 'RC'],
    rawText: `TAX INVOICE
Nothing Phone (2a)
IMEI 490154203237518
Serial NP2A8X91K2
Invoice No NP-INV-1008
Date 08/08/2024
Qty 1  Unit Price 23999
CGST 2160 SGST 2160
Grand Total ₹23,999
GSTIN 09AABCU9603R1ZX`,
    expect: {
      imei: '490154203237518',
      serialNumber: 'NP2A8X91K2',
      invoiceNumber: 'NP-INV-1008',
      shopGstin: '09AABCU9603R1ZX',
    },
    poisonedFields: { imei: '₹23,999' },
  },
  {
    id: 'warranty-card',
    category: 'Warranty Card',
    expectedType: 'WARRANTY',
    forbiddenTypes: ['PURCHASE_INVOICE', 'SERVICE_INVOICE'],
    rawText: `WARRANTY CARD
This warranty certificate covers manufacturing defects
Product: Voltas Inverter AC
Serial VT-AC-1001
Warranty period 12 months
Not a tax invoice`,
    expect: {
      serialNumber: 'VT-AC-1001',
    },
  },
  {
    id: 'appliance-invoice',
    category: 'Home Appliance Invoice',
    expectedType: 'APPLIANCE_INVOICE',
    forbiddenTypes: ['SERVICE_INVOICE', 'RC'],
    rawText: `TAX INVOICE
Voltas Inverter Split AC 1.5 Ton
Serial Number VT-AC-1001
Invoice No VL-8821  Date 02/04/2025
Qty 1  Grand Total ₹44,500
GSTIN 27AABCU9603R1ZX  HSN 8415`,
    expect: {
      serialNumber: 'VT-AC-1001',
      invoiceNumber: 'VL-8821',
      shopGstin: '27AABCU9603R1ZX',
    },
  },
  {
    id: 'gst-retail-invoice',
    category: 'GST / Retail Invoice',
    expectedType: 'PURCHASE_INVOICE',
    forbiddenTypes: ['INSURANCE_POLICY', 'RC'],
    rawText: `TAX INVOICE
Retail Invoice
Invoice No RT-4401  Invoice Date 11/03/2025
Seller: REDACTED KIRANA
GSTIN 09AABCU9603R1ZX
PIN 226001
Subtotal 1000  CGST 90  SGST 90
Grand Total 1180
HSN 1905`,
    expect: {
      invoiceNumber: 'RT-4401',
      shopGstin: '09AABCU9603R1ZX',
    },
    poisonedFields: { invoiceNumber: '11/03/2025' },
  },
  {
    id: 'thermal-bill',
    category: 'Thermal Bill',
    expectedType: 'PURCHASE_INVOICE',
    forbiddenTypes: ['INSURANCE_POLICY'],
    rawText: `CASH MEMO
TEA 40
SAMOSA 30
TOTAL Rs 70
THANK YOU`,
    expect: {},
  },
  {
    id: 'pharmacy-bill',
    category: 'Pharmacy-style retail bill',
    expectedType: 'PURCHASE_INVOICE',
    forbiddenTypes: ['INSURANCE_POLICY', 'RC'],
    rawText: `TAX INVOICE  Retail Invoice
Pharmacy Bill
Invoice No PH-2091
GSTIN 07AABCU9603R1ZX
CGST 6% SGST 6%
HSN 3004
Grand Total 540
PIN 110001`,
    expect: {
      invoiceNumber: 'PH-2091',
      shopGstin: '07AABCU9603R1ZX',
    },
  },
  {
    id: 'poor-quality-garbled',
    category: 'Handwritten/poor-quality document',
    expectedType: 'UNKNOWN_DOCUMENT_STRUCTURE',
    forbiddenTypes: [],
    rawText: `l1ke hndwrtng smudge 23 xx totl ??`,
    expect: {
      imei: null,
      registration: null,
    },
  },
  {
    id: 'multi-page-invoice',
    category: 'Multi-page invoice',
    expectedType: 'PURCHASE_INVOICE',
    forbiddenTypes: ['RC'],
    rawText: `PAGE 1 TAX INVOICE Invoice No MP-3301 GSTIN 09AABCU9603R1ZX
Item Laptop Qty 1
PAGE 2 Grand Total ₹62,000 Terms and conditions continued`,
    expect: {
      invoiceNumber: 'MP-3301',
      shopGstin: '09AABCU9603R1ZX',
    },
  },
  {
    id: 'cropped-low-light',
    category: 'Cropped / rotated / low-light document',
    expectedType: 'UNKNOWN_DOCUMENT_STRUCTURE',
    forbiddenTypes: [],
    rawText: `INVOICE  tot`,
    expect: {
      imei: null,
      shopGstin: null,
    },
  },
];
