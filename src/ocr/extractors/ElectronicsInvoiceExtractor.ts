/**
 * Asset Doctor — Dedicated Electronics Invoice Extractor
 * Real extraction logic for phones, laptops, and gadgets.
 */

import { RealElectronicsExtractor } from '../../services/ocr/extractors/RealElectronicsExtractor';
import { createVerifiedField, createNotFoundField } from '../core/OcrEvidence';
import { type SalesInvoiceFields } from './SalesInvoiceExtractor';

export class ElectronicsInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    const el = RealElectronicsExtractor.extract(rawText);

    return {
      sellerName: el.sellerName ? createVerifiedField(el.sellerName, 0.95, el.sellerName) : createNotFoundField(),
      sellerGstin: el.sellerGstin ? createVerifiedField(el.sellerGstin, 0.99, el.sellerGstin) : createNotFoundField(),
      buyerName: el.buyerName ? createVerifiedField(el.buyerName, 0.95, el.buyerName) : createNotFoundField(),
      invoiceNumber: el.invoiceNumber ? createVerifiedField(el.invoiceNumber, 0.98, el.invoiceNumber) : createNotFoundField(),
      invoiceDate: el.invoiceDate ? createVerifiedField(el.invoiceDate, 0.98, el.invoiceDate) : createNotFoundField(),
      productName: el.productName ? createVerifiedField(el.productName, 0.95, el.productName) : createNotFoundField(),
      brand: el.brand ? createVerifiedField(el.brand, 0.92, el.brand) : createNotFoundField(),
      model: el.model ? createVerifiedField(el.model, 0.95, el.model) : createNotFoundField(),
      serialNumber: el.serialNumber ? createVerifiedField(el.serialNumber, 0.97, el.serialNumber) : createNotFoundField(),
      imei: el.imei ? createVerifiedField(el.imei, 0.99, el.imei) : createNotFoundField(),
      quantity: createVerifiedField(1, 0.95, '1'),
      unitPrice: el.subtotal != null ? createVerifiedField(el.subtotal, 0.95, String(el.subtotal)) : createNotFoundField(),
      taxAmount: el.taxAmount != null ? createVerifiedField(el.taxAmount, 0.95, String(el.taxAmount)) : createNotFoundField(),
      totalAmount: el.totalAmount != null ? createVerifiedField(el.totalAmount, 0.99, String(el.totalAmount)) : createNotFoundField(),
      warrantyMonths: el.warrantyMonths != null ? createVerifiedField(el.warrantyMonths, 0.95, `${el.warrantyMonths} months`) : createNotFoundField(),
      warrantyExpiryDate: createNotFoundField(),
    };
  }
}
