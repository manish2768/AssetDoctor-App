/**
 * Universal OCR Cross-Field & Mathematical Validator
 * Validates dates, Indian registration formats, odometer monotonicity, and financial reconciliation.
 */

import type {
  UniversalExtractedData,
  UniversalDocumentType,
  CrossFieldValidationResult,
  CrossFieldValidationIssue
} from './types.ts';

export class OcrValidator {
  /**
   * Validates extracted fields for consistency, date sequence, and mathematical balance.
   */
  public static validate(
    docType: UniversalDocumentType,
    data: UniversalExtractedData,
    previousVerifiedOdometer?: number
  ): CrossFieldValidationResult {
    const issues: CrossFieldValidationIssue[] = [];

    // 1. VEHICLE REGISTRATION VALIDATION
    const reg = data.serviceData?.vehicleRegistration?.value ||
                data.insuranceData?.vehicleRegistration?.value ||
                data.pucData?.registrationNumber?.value ||
                data.rcData?.registrationNumber?.value;

    if (reg) {
      const regPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
      if (!regPattern.test(reg)) {
        issues.push({
          field: 'vehicleRegistration',
          severity: 'WARNING',
          rule: 'INDIAN_REGISTRATION_FORMAT',
          message: `Registration number "${reg}" does not conform to standard Indian RTO format.`
        });
      }
    }

    // 2. ODOMETER REASONABLENESS & MONOTONICITY
    const odo = data.serviceData?.odometerKm?.value;
    if (odo !== undefined && odo !== null) {
      if (odo < 0 || odo > 999999) {
        issues.push({
          field: 'odometerKm',
          severity: 'ERROR',
          rule: 'ODOMETER_RANGE_CHECK',
          message: `Odometer reading ${odo} KM is out of realistic vehicle range.`
        });
      }

      if (previousVerifiedOdometer && previousVerifiedOdometer > 0) {
        if (odo < previousVerifiedOdometer - 200) {
          issues.push({
            field: 'odometerKm',
            severity: 'WARNING',
            rule: 'ODOMETER_MONOTONICITY',
            message: `Current odometer (${odo} KM) is lower than previous recorded reading (${previousVerifiedOdometer} KM).`
          });
        }
      }
    }

    // 3. INSURANCE DATE SEQUENCE
    if (docType === 'INSURANCE_POLICY' || docType === 'INSURANCE_RENEWAL') {
      const sDate = data.insuranceData?.policyStartDate?.value;
      const eDate = data.insuranceData?.policyExpiryDate?.value;
      if (sDate && eDate) {
        const sTime = new Date(sDate).getTime();
        const eTime = new Date(eDate).getTime();
        if (!isNaN(sTime) && !isNaN(eTime) && eTime <= sTime) {
          issues.push({
            field: 'policyExpiryDate',
            severity: 'ERROR',
            rule: 'DATE_SEQUENCE_CHECK',
            message: `Insurance Expiry Date (${eDate}) must be after Policy Start Date (${sDate}).`
          });
        }
      }
    }

    // 4. PUC DATE SEQUENCE
    if (docType === 'PUC_CERTIFICATE') {
      const iDate = data.pucData?.issueDate?.value;
      const eDate = data.pucData?.expiryDate?.value;
      if (iDate && eDate) {
        const iTime = new Date(iDate).getTime();
        const eTime = new Date(eDate).getTime();
        if (!isNaN(iTime) && !isNaN(eTime) && eTime <= iTime) {
          issues.push({
            field: 'expiryDate',
            severity: 'ERROR',
            rule: 'DATE_SEQUENCE_CHECK',
            message: `PUC Expiry Date (${eDate}) must be after Testing/Issue Date (${iDate}).`
          });
        }
      }
    }

    // 5. WARRANTY DATE SEQUENCE
    if (docType === 'WARRANTY_DOCUMENT' || docType === 'EXTENDED_WARRANTY') {
      const sDate = data.warrantyData?.warrantyStartDate?.value;
      const eDate = data.warrantyData?.warrantyEndDate?.value;
      if (sDate && eDate) {
        const sTime = new Date(sDate).getTime();
        const eTime = new Date(eDate).getTime();
        if (!isNaN(sTime) && !isNaN(eTime) && eTime <= sTime) {
          issues.push({
            field: 'warrantyEndDate',
            severity: 'ERROR',
            rule: 'DATE_SEQUENCE_CHECK',
            message: `Warranty End Date (${eDate}) must be after Warranty Start Date (${sDate}).`
          });
        }
      }
    }

    // 6. FINANCIAL RECONCILIATION
    const total = data.serviceData?.totalAmount?.value || data.purchaseData?.finalAmount?.value;
    const parts = data.serviceData?.partsTotal?.value || 0;
    const labour = data.serviceData?.labourCharges?.value || 0;
    const tax = data.serviceData?.taxAmount?.value || data.purchaseData?.taxAmount?.value || 0;
    const discount = data.serviceData?.discountAmount?.value || data.purchaseData?.discountAmount?.value || 0;

    if (total && (parts > 0 || labour > 0)) {
      const calculatedSum = parts + labour + tax - discount;
      const diff = Math.abs(calculatedSum - total);
      // Allow small tolerance of 5% or Rs. 50
      if (diff > Math.max(50, total * 0.05)) {
        issues.push({
          field: 'totalAmount',
          severity: 'WARNING',
          rule: 'FINANCIAL_RECONCILIATION',
          message: `Total (₹${total}) deviates from line items sum (Parts: ₹${parts} + Labour: ₹${labour} + Tax: ₹${tax} = ₹${calculatedSum}).`
        });
      }
    }

    const hasErrors = issues.some(i => i.severity === 'ERROR');
    const score = Math.max(0.2, 1.0 - (issues.length * 0.15));

    return {
      isValid: !hasErrors,
      score: Math.round(score * 100) / 100,
      issues
    };
  }
}
