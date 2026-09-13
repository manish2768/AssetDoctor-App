/**
 * Asset Doctor — Dedicated Service Invoice Extractor
 * Real extraction logic for vehicle maintenance, repair, and job cards.
 */

import { RealVehicleServiceExtractor } from '../../services/ocr/extractors/RealVehicleServiceExtractor';
import { createVerifiedField, createNotFoundField, type ExtractedField } from '../core/OcrEvidence';

export interface ServiceInvoiceFields {
  workshopName: ExtractedField<string | null>;
  vehicleRegistration: ExtractedField<string | null>;
  vehicleModel: ExtractedField<string | null>;
  chassisNumber: ExtractedField<string | null>;
  engineNumber: ExtractedField<string | null>;
  currentOdometerKm: ExtractedField<number | null>;
  nextServiceOdometerKm: ExtractedField<number | null>;
  nextServiceDate: ExtractedField<string | null>;
  invoiceNumber: ExtractedField<string | null>;
  invoiceDate: ExtractedField<string | null>;
  labourCharges: ExtractedField<number | null>;
  partsTotal: ExtractedField<number | null>;
  totalAmount: ExtractedField<number | null>;
}

export class ServiceInvoiceExtractor {
  public static extract(rawText: string): ServiceInvoiceFields {
    const s = RealVehicleServiceExtractor.extract(rawText);

    return {
      workshopName: s.workshopName ? createVerifiedField(s.workshopName, 0.95, s.workshopName) : createNotFoundField(),
      vehicleRegistration: s.registration ? createVerifiedField(s.registration, 0.98, s.registration) : createNotFoundField(),
      vehicleModel: s.vehicleModel ? createVerifiedField(s.vehicleModel, 0.95, s.vehicleModel) : createNotFoundField(),
      chassisNumber: s.chassisNumber ? createVerifiedField(s.chassisNumber, 0.98, s.chassisNumber) : createNotFoundField(),
      engineNumber: s.engineNumber ? createVerifiedField(s.engineNumber, 0.97, s.engineNumber) : createNotFoundField(),
      currentOdometerKm: s.odometerKm != null ? createVerifiedField(s.odometerKm, 0.98, `${s.odometerKm} km`) : createNotFoundField(),
      nextServiceOdometerKm: s.nextServiceOdometerKm != null ? createVerifiedField(s.nextServiceOdometerKm, 0.95, `${s.nextServiceOdometerKm} km`) : createNotFoundField(),
      nextServiceDate: s.nextServiceDate ? createVerifiedField(s.nextServiceDate, 0.95, s.nextServiceDate) : createNotFoundField(),
      invoiceNumber: s.invoiceNumber ? createVerifiedField(s.invoiceNumber, 0.96, s.invoiceNumber) : createNotFoundField(),
      invoiceDate: s.invoiceDate ? createVerifiedField(s.invoiceDate, 0.96, s.invoiceDate) : createNotFoundField(),
      labourCharges: s.labourCharges != null ? createVerifiedField(s.labourCharges, 0.92, String(s.labourCharges)) : createNotFoundField(),
      partsTotal: s.partsTotal != null ? createVerifiedField(s.partsTotal, 0.92, String(s.partsTotal)) : createNotFoundField(),
      totalAmount: s.totalAmount != null ? createVerifiedField(s.totalAmount, 0.98, String(s.totalAmount)) : createNotFoundField(),
    };
  }
}
