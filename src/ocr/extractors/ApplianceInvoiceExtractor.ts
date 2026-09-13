/**
 * Asset Doctor — Dedicated Appliance Invoice Extractor
 * Real extraction logic for ACs, fridges, washing machines, and appliances.
 */

import { RealApplianceExtractor } from '../../services/ocr/extractors/RealApplianceExtractor';
import { createVerifiedField, createNotFoundField } from '../core/OcrEvidence';
import { type SalesInvoiceFields } from './SalesInvoiceExtractor';

export class ApplianceInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    const ap = RealApplianceExtractor.extract(rawText);

    return {
      sellerName: ap.sellerName ? createVerifiedField(ap.sellerName, 0.95, ap.sellerName) : createNotFoundField(),
      sellerGstin: ap.sellerGstin ? createVerifiedField(ap.sellerGstin, 0.99, ap.sellerGstin) : createNotFoundField(),
      buyerName: ap.buyerName ? createVerifiedField(ap.buyerName, 0.95, ap.buyerName) : createNotFoundField(),
      invoiceNumber: ap.invoiceNumber ? createVerifiedField(ap.invoiceNumber, 0.98, ap.invoiceNumber) : createNotFoundField(),
      invoiceDate: ap.invoiceDate ? createVerifiedField(ap.invoiceDate, 0.98, ap.invoiceDate) : createNotFoundField(),
      productName: ap.productName ? createVerifiedField(ap.productName, 0.95, ap.productName) : createNotFoundField(),
      brand: ap.brand ? createVerifiedField(ap.brand, 0.92, ap.brand) : createNotFoundField(),
      model: ap.model ? createVerifiedField(ap.model, 0.95, ap.model) : createNotFoundField(),
      serialNumber: ap.serialNumber ? createVerifiedField(ap.serialNumber, 0.97, ap.serialNumber) : createNotFoundField(),
      imei: createNotFoundField(),
      quantity: createVerifiedField(1, 0.95, '1'),
      unitPrice: ap.subtotal != null ? createVerifiedField(ap.subtotal, 0.95, String(ap.subtotal)) : createNotFoundField(),
      taxAmount: ap.taxAmount != null ? createVerifiedField(ap.taxAmount, 0.95, String(ap.taxAmount)) : createNotFoundField(),
      totalAmount: ap.totalAmount != null ? createVerifiedField(ap.totalAmount, 0.99, String(ap.totalAmount)) : createNotFoundField(),
      warrantyMonths: ap.warrantyMonths != null ? createVerifiedField(ap.warrantyMonths, 0.95, `${ap.warrantyMonths} months`) : createNotFoundField(),
      warrantyExpiryDate: createNotFoundField(),
    };
  }
}
