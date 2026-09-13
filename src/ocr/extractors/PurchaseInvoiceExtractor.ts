/**
 * Asset Doctor — Dedicated Purchase Invoice Extractor
 * Real extraction logic for vehicle and asset purchase invoices.
 */

import { RealVehiclePurchaseExtractor } from '../../services/ocr/extractors/RealVehiclePurchaseExtractor';
import { createVerifiedField, createNotFoundField, type ExtractedField } from '../core/OcrEvidence';
import { SalesInvoiceExtractor, type SalesInvoiceFields } from './SalesInvoiceExtractor';

export class PurchaseInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    // Check if document has vehicle markers (Chassis, Engine, Ex-Showroom, RTO)
    if (/\b(?:CHASSIS|ENGINE\s*NO|EX[\s\-]SHOWROOM|RTO|REGISTRATION\s*NO)\b/i.test(rawText)) {
      const v = RealVehiclePurchaseExtractor.extract(rawText);
      return {
        sellerName: v.dealerName ? createVerifiedField(v.dealerName, 0.95, v.dealerName) : createNotFoundField(),
        sellerGstin: v.dealerGstin ? createVerifiedField(v.dealerGstin, 0.99, v.dealerGstin) : createNotFoundField(),
        buyerName: v.buyerName ? createVerifiedField(v.buyerName, 0.95, v.buyerName) : createNotFoundField(),
        invoiceNumber: v.invoiceNumber ? createVerifiedField(v.invoiceNumber, 0.98, v.invoiceNumber) : createNotFoundField(),
        invoiceDate: v.invoiceDate ? createVerifiedField(v.invoiceDate, 0.98, v.invoiceDate) : createNotFoundField(),
        productName: v.model ? createVerifiedField(v.model, 0.95, v.model) : createNotFoundField(),
        brand: v.make ? createVerifiedField(v.make, 0.92, v.make) : createNotFoundField(),
        model: v.model ? createVerifiedField(v.model, 0.95, v.model) : createNotFoundField(),
        serialNumber: v.chassisNumber ? createVerifiedField(v.chassisNumber, 0.98, v.chassisNumber) : createNotFoundField(),
        imei: createNotFoundField(),
        quantity: createVerifiedField(1, 0.95, '1'),
        unitPrice: v.exShowroomPrice != null ? createVerifiedField(v.exShowroomPrice, 0.95, String(v.exShowroomPrice)) : createNotFoundField(),
        taxAmount: v.taxAmount != null ? createVerifiedField(v.taxAmount, 0.95, String(v.taxAmount)) : createNotFoundField(),
        totalAmount: v.totalAmount != null ? createVerifiedField(v.totalAmount, 0.98, String(v.totalAmount)) : createNotFoundField(),
        warrantyMonths: createNotFoundField(),
        warrantyExpiryDate: createNotFoundField(),
      };
    }

    // Default to general sales/retail extraction
    return SalesInvoiceExtractor.extract(rawText);
  }
}
