/**
 * Phase 13 — Cross-field compatibility.
 * IMEI ≠ amount, GSTIN ≠ phone, phone ≠ invoice, etc.
 * Never invents missing values.
 */

import { VALIDATION_STATUS, type ValidationStatus } from './types.ts';
import { classifyValueShape } from './valueShape.ts';
import { VALUE_SHAPES } from './types.ts';
import {
  validateAmount,
  validateField,
  validateGSTIN,
  validateIMEI,
  validateInvoiceNumber,
  validatePhone,
  validateVehicleReg,
} from './fieldValidators.ts';
import { normalizeLearningDocumentType } from './valueShape.ts';

export interface CrossFieldIssue {
  fieldName: string;
  status: ValidationStatus;
  reason: string;
  compatible: boolean;
}

const SERVICE_ONLY = new Set(['odometerKm', 'labourCharges', 'nextServiceDue', 'nextServiceOdometerKm']);
const INSURANCE_ONLY = new Set(['policyNumber', 'policyHolder', 'idvAmount', 'coverageType', 'premiumAmount']);

export function crossFieldScore(fieldName: string, value: unknown, allFields: Record<string, unknown> = {}): {
  score: number;
  issues: CrossFieldIssue[];
} {
  const issues: CrossFieldIssue[] = [];
  if (value == null || String(value).trim() === '') {
    return { score: 0.5, issues };
  }
  const key = String(fieldName);
  const shape = classifyValueShape(value);
  const otherAmount = allFields.totalAmount ?? allFields.grandTotal ?? allFields.price;
  const otherImei = allFields.imei;
  const otherPhone = allFields.customerPhone ?? allFields.phone;
  const otherGstin = allFields.shopGstin ?? allFields.gstin;
  const otherInvoice = allFields.invoiceNumber;
  const otherReg = allFields.registration;
  const otherChassis = allFields.chassisNumber;
  const otherEngine = allFields.engineNumber;

  if (key === 'imei') {
    if (shape === VALUE_SHAPES.CURRENCY_AMOUNT || validateAmount(value).status === VALIDATION_STATUS.VALID && String(value).replace(/\D/g, '').length <= 7) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Candidate resembles a monetary amount and does not satisfy the expected IMEI validation.',
        compatible: false,
      });
    }
    if (otherAmount != null && String(otherAmount).replace(/\D/g, '') === String(value).replace(/\D/g, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'IMEI must not equal the total amount.',
        compatible: false,
      });
    }
  }

  if (key === 'totalAmount' || key === 'price' || key === 'taxAmount') {
    if (shape === VALUE_SHAPES.IMEI || validateIMEI(value).status === VALIDATION_STATUS.VALID) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'A product price cannot be an IMEI, serial, or invoice number.',
        compatible: false,
      });
    }
    if (otherImei != null && String(otherImei).replace(/\D/g, '') === String(value).replace(/\D/g, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Total amount collides with IMEI digits.',
        compatible: false,
      });
    }
    const serial = allFields.serialNumber;
    if (serial != null && String(serial).replace(/\D/g, '') === String(value).replace(/\D/g, '') && String(value).replace(/\D/g, '').length >= 8) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Product price cannot equal the serial number.',
        compatible: false,
      });
    }
    if (otherInvoice != null && String(otherInvoice).replace(/\D/g, '') === String(value).replace(/\D/g, '') && String(value).replace(/\D/g, '').length >= 6) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Product price cannot equal the invoice number.',
        compatible: false,
      });
    }
  }

  if (key === 'shopGstin' || key === 'gstin') {
    if (shape === VALUE_SHAPES.PHONE || validatePhone(value).status === VALIDATION_STATUS.VALID) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'GSTIN cannot be a phone number.',
        compatible: false,
      });
    }
  }

  if (key === 'customerPhone' || key === 'phone') {
    if (shape === VALUE_SHAPES.GSTIN || validateGSTIN(value).status === VALIDATION_STATUS.VALID) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Phone cannot be a GSTIN.',
        compatible: false,
      });
    }
    if (otherInvoice != null && String(otherInvoice).replace(/\D/g, '') === String(value).replace(/\D/g, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Phone cannot equal the invoice number.',
        compatible: false,
      });
    }
  }

  if (key === 'invoiceNumber') {
    if (shape === VALUE_SHAPES.PHONE || validatePhone(value).status === VALIDATION_STATUS.VALID) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Invoice number cannot be a phone number.',
        compatible: false,
      });
    }
    if (otherPhone != null && String(otherPhone).replace(/\D/g, '') === String(value).replace(/\D/g, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Invoice number collides with phone.',
        compatible: false,
      });
    }
  }

  if (key === 'serialNumber') {
    if (otherInvoice != null && String(otherInvoice).trim().toUpperCase() === String(value).trim().toUpperCase()) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Invoice number cannot be used as a serial number.',
        compatible: false,
      });
    }
  }

  if (key === 'registration') {
    const reg = validateVehicleReg(value);
    if (reg.status === VALIDATION_STATUS.INVALID) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Value is not a compatible Indian vehicle registration.',
        compatible: false,
      });
    }
  }

  if (key === 'policyNumber') {
    if (otherReg != null && String(otherReg).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Policy number cannot equal the vehicle registration.',
        compatible: false,
      });
    }
    if (otherChassis != null && String(otherChassis).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Policy number cannot equal the chassis number.',
        compatible: false,
      });
    }
    if (otherEngine != null && String(otherEngine).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Policy number cannot equal the engine number.',
        compatible: false,
      });
    }
    if (otherAmount != null && String(otherAmount).replace(/\D/g, '') === String(value).replace(/\D/g, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Policy number cannot equal the premium/amount.',
        compatible: false,
      });
    }
  }

  if (key === 'chassisNumber') {
    if (otherEngine != null && String(otherEngine).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.SUSPICIOUS,
        reason: 'Chassis and engine numbers should not be identical.',
        compatible: false,
      });
    }
    if (otherReg != null && String(otherReg).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Chassis cannot equal the vehicle registration.',
        compatible: false,
      });
    }
  }

  if (key === 'engineNumber') {
    if (otherChassis != null && String(otherChassis).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.SUSPICIOUS,
        reason: 'Engine number should not copy the chassis number.',
        compatible: false,
      });
    }
    if (otherReg != null && String(otherReg).replace(/[^A-Z0-9]/gi, '') === String(value).replace(/[^A-Z0-9]/gi, '')) {
      issues.push({
        fieldName: key,
        status: VALIDATION_STATUS.INVALID,
        reason: 'Engine number cannot equal the vehicle registration.',
        compatible: false,
      });
    }
  }

  const incompatible = issues.filter((i) => !i.compatible);
  const score = incompatible.length === 0 ? 1 : incompatible.some((i) => i.status === VALIDATION_STATUS.INVALID) ? 0 : 0.25;
  return { score, issues };
}

export function documentTypeFieldLeak(documentType: string, fieldName: string, value: unknown): CrossFieldIssue | null {
  if (value == null || String(value).trim() === '') return null;
  const doc = normalizeLearningDocumentType(documentType);
  if (doc === 'SERVICE_INVOICE' && INSURANCE_ONLY.has(fieldName)) {
    return {
      fieldName,
      status: VALIDATION_STATUS.INVALID,
      reason: 'Insurance fields must not leak into a service invoice.',
      compatible: false,
    };
  }
  if (doc === 'INSURANCE_POLICY' && SERVICE_ONLY.has(fieldName)) {
    return {
      fieldName,
      status: VALIDATION_STATUS.INVALID,
      reason: 'Service fields must not leak into an insurance document.',
      compatible: false,
    };
  }
  if ((doc === 'ELECTRONICS_INVOICE' || doc === 'APPLIANCE_INVOICE') && (fieldName === 'registration' || fieldName === 'odometerKm')) {
    return {
      fieldName,
      status: VALIDATION_STATUS.SUSPICIOUS,
      reason: 'Vehicle identity is not expected on this electronics/appliance document.',
      compatible: false,
    };
  }
  return null;
}

export function evaluateCrossFieldDocument(
  documentType: string,
  fields: Record<string, unknown>,
): { issues: CrossFieldIssue[]; needsReviewFields: string[] } {
  const issues: CrossFieldIssue[] = [];
  for (const [fieldName, value] of Object.entries(fields || {})) {
    const leak = documentTypeFieldLeak(documentType, fieldName, value);
    if (leak) issues.push(leak);
    const scored = crossFieldScore(fieldName, value, fields);
    issues.push(...scored.issues);
    const format = validateField(fieldName, value);
    if (
      value != null &&
      String(value).trim() !== '' &&
      (format.status === VALIDATION_STATUS.INVALID || format.status === VALIDATION_STATUS.SUSPICIOUS)
    ) {
      issues.push({
        fieldName,
        status: format.status,
        reason: format.reason || 'Failed deterministic field validation.',
        compatible: false,
      });
    }
  }
  const needsReviewFields = [...new Set(issues.filter((i) => !i.compatible).map((i) => i.fieldName))];
  return { issues, needsReviewFields };
}

export function vehicleRegCompatibleWithContext(opts: {
  registration: unknown;
  documentType?: string;
  matchedAsset?: { registration?: string; category?: string } | null;
}): CrossFieldIssue | null {
  const { registration, documentType, matchedAsset } = opts;
  if (registration == null || String(registration).trim() === '') return null;
  const format = validateVehicleReg(registration);
  if (format.status === VALIDATION_STATUS.INVALID) {
    return {
      fieldName: 'registration',
      status: VALIDATION_STATUS.INVALID,
      reason: 'Registration is not compatible with vehicle/service document expectations.',
      compatible: false,
    };
  }
  const doc = normalizeLearningDocumentType(documentType || '');
  if (matchedAsset?.registration) {
    const a = String(matchedAsset.registration).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const b = String(registration).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (a && b && a !== b) {
      return {
        fieldName: 'registration',
        status: VALIDATION_STATUS.SUSPICIOUS,
        reason: 'Registration does not match the linked vehicle asset.',
        compatible: false,
      };
    }
  }
  if (doc === 'ELECTRONICS_INVOICE' || doc === 'APPLIANCE_INVOICE') {
    return {
      fieldName: 'registration',
      status: VALIDATION_STATUS.SUSPICIOUS,
      reason: 'Vehicle registration is unexpected on this document type.',
      compatible: false,
    };
  }
  return null;
}
