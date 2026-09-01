/**
 * Map pipeline extraction → ReviewAsset invoice.
 * Schema-driven. Never copies previous asset values into OCR fields.
 */

import type {
  UniversalOcrDocumentResult,
  CanonicalDocumentFields,
  ExtractedField,
  DocumentLineItem,
} from './types.ts';
import { familyFromDocumentType, allowedFieldKeys, type ReviewFamily } from './reviewSchema.ts';
import { isForbiddenFinancialToken } from './fieldSafety.ts';

function fv(field: any): any {
  if (field == null) return null;
  if (typeof field === 'object' && 'value' in field) return field.value == null ? null : field.value;
  return field;
}

function stampFieldMeta(invoice: Record<string, any>, key: string, field: any) {
  if (!field || typeof field !== 'object') return;
  invoice.fieldConfidence = invoice.fieldConfidence || {};
  invoice.sourceType = invoice.sourceType || {};
  invoice.evidence = invoice.evidence || {};
  invoice.extractionMethod = invoice.extractionMethod || {};
  invoice.fieldStatuses = invoice.fieldStatuses || {};
  invoice.fieldEvidence = invoice.fieldEvidence || {};
  if (field.confidence != null) invoice.fieldConfidence[key] = field.confidence;
  invoice.sourceType[key] = field.provenance || field.sourceType || 'OCR_DOCUMENT';
  if (field.evidence || field.rawText) invoice.evidence[key] = field.evidence || field.rawText;
  if (field.extractionMethod) invoice.extractionMethod[key] = field.extractionMethod;
  invoice.fieldStatuses[key] = field.status || field.tier || (fv(field) == null ? 'NOT_FOUND' : 'NEEDS_REVIEW');
  invoice.fieldEvidence[key] = {
    field: key,
    value: fv(field),
    confidence: field.confidence ?? 0,
    sourceText: field.sourceText || field.evidence || null,
    sourceBoundingBox: field.sourceBoundingBox || field.boundingBox || null,
    page: field.page ?? field.boundingBox?.page ?? null,
    evidenceType: field.evidenceType || (field.evidence ? 'contextual_text' : 'none'),
    validationStatus: field.status || (fv(field) == null ? 'NOT_FOUND' : 'NEEDS_REVIEW'),
    validationResult: field.validationResult || 'UNVALIDATED',
    partialIdentifier: Boolean(field.partialIdentifier),
    conflictCandidates: field.conflictCandidates || undefined,
  };
}

export function buildReviewInvoice(result: UniversalOcrDocumentResult): Record<string, any> {
  const ext = result.extractedData || {};
  const docType = result.classification?.documentType || 'GENERIC_DOCUMENT';
  const s = ext.serviceData;
  const ins = ext.insuranceData;
  const puc = ext.pucData;
  const rc = ext.rcData;
  const p = ext.purchaseData;
  const a = ext.applianceData;
  const e = ext.electronicsData;
  const w = ext.warrantyData;

  const imei = fv(e?.imei);
  const productName =
    fv(e?.productName) ||
    fv(s?.vehicleModel) ||
    fv(ins?.vehicleModel) ||
    fv(p?.assetName) ||
    fv(a?.productName) ||
    fv(a?.brand) ||
    fv(w?.productName) ||
    fv(rc?.model) ||
    '';

  const family: ReviewFamily = familyFromDocumentType(docType, {
    imei: imei || '',
    productName: productName || '',
  });
  const allowed = allowedFieldKeys(family);

  const invoice: Record<string, any> = {
    scanSessionId: result.scanSessionId || null,
    documentId: result.documentId,
    classifiedDocumentType: docType,
    geminiDocumentType: docType,
    documentType: family,
    documentKind: family,
    scanDocumentType: family === 'insurance' ? 'insurance' : family === 'puc' ? 'puc' : family === 'rc' ? 'rc' : family === 'service' ? 'service' : 'bill',
    documentLabel: result.classification?.documentSubtype || docType,
    classification: {
      ...result.classification,
      type: docType,
      subtype: result.classification?.documentSubtype,
      evidence: result.classification?.evidence || result.classification?.matchedKeywords,
    },
    reviewFamily: family,
    universalOcr: {
      documentId: result.documentId,
      scanSessionId: result.scanSessionId,
      classification: result.classification,
      metrics: result.metrics,
      reviewReasons: result.reviewReasons,
    },
    serviceData: s || null,
    insuranceData: ins || null,
    purchaseData: p || e || null,
    electronicsData: e || null,
    fieldConfidence: {},
    sourceType: {},
    evidence: {},
    extractionMethod: {},
    fieldStatuses: {},
    fieldEvidence: {},
    ocrExtract: {},
    items: [],
    itemCount: 0,
    needsManualReview: Boolean(result.requiresReview),
    confidence: Math.round((result.classification?.confidence || 0) * 100),
    assetMatch: result.entityLink
      ? {
          matchedAssetId: result.entityLink.matchedAssetId,
          matchType: result.entityLink.matchType,
          isAutoLinked: result.entityLink.isAutoLinked,
          confidence: result.entityLink.confidence,
          notes: result.entityLink.notes,
          candidates: result.entityLink.candidates,
        }
      : null,
    predictions: [],
  };

  for (const key of allowed) {
    invoice.fieldStatuses[key] = 'NOT_FOUND';
    invoice.fieldEvidence[key] = {
      field: key,
      value: null,
      confidence: 0,
      sourceText: null,
      sourceBoundingBox: null,
      page: null,
      evidenceType: 'none',
      validationStatus: 'NOT_FOUND',
      validationResult: 'UNVALIDATED',
    };
  }

  const NUMERIC_OR_NULLABLE_KEYS = new Set([
    'odometerKm',
    'nextServiceOdometerKm',
    'labourCharges',
    'partsTotal',
    'taxAmount',
    'totalAmount',
    'idv',
    'idvAmount',
    'premium',
    'odometerReading',
    'nextServiceDue',
    'pucExpiry',
    'insuranceExpiry',
    'warrantyExpiry',
  ]);

  const put = (key: string, field: any, extraKeys: string[] = []) => {
    if (!allowed.has(key)) return;
    const value = fv(field);
    if (value == null) {
      invoice[key] = NUMERIC_OR_NULLABLE_KEYS.has(key) ? null : '';
    } else if (NUMERIC_OR_NULLABLE_KEYS.has(key) && isForbiddenFinancialToken(value)) {
      invoice[key] = null;
    } else {
      invoice[key] = value;
    }
    stampFieldMeta(invoice, key, field);
    for (const ek of extraKeys) {
      if (allowed.has(ek) && invoice[ek] == null) invoice[ek] = invoice[key];
    }
  };

  if (family === 'service' && s) {
    put('shopName', s.workshopName);
    put('shopGstin', s.gstin);
    put('invoiceNumber', s.invoiceNumber);
    put('invoiceDate', s.invoiceDate || s.serviceDate);
    put('productName', s.vehicleModel);
    put('registration', s.vehicleRegistration);
    put('chassisNumber', s.vinOrChassis);
    put('engineNumber', s.engineNumber);
    put('odometerKm', s.odometerKm);
    put('nextServiceOdometerKm', s.nextServiceOdometerKm);
    put('nextServiceDue', (s as any).nextServiceDate);
    put('labourCharges', s.labourCharges);
    put('partsTotal', s.partsTotal);
    put('taxAmount', s.taxAmount);
    put('totalAmount', s.totalAmount);
    put('customerName', s.customerName);
    put('customerPhone', s.customerPhone);
    invoice.workshopName = invoice.shopName;
    invoice.odometerReading = invoice.odometerKm ?? null;
  } else if (family === 'insurance' && ins) {
    put('shopName', ins.insurerName);
    put('invoiceNumber', ins.policyNumber);
    put('policyStartDate', ins.policyStartDate);
    put('insuranceExpiry', ins.policyExpiryDate);
    put('productName', ins.vehicleModel);
    put('registration', ins.vehicleRegistration);
    put('chassisNumber', ins.vinOrChassis);
    put('engineNumber', ins.engineNumber);
    put('idv', ins.idvAmount);
    put('totalAmount', ins.premiumAmount);
    put('customerName', ins.insuredName);
    invoice.insurerName = invoice.shopName;
    invoice.policyNumber = invoice.invoiceNumber;
    invoice.premium = invoice.totalAmount;
    invoice.idvAmount = invoice.idv;
  } else if (family === 'puc' && puc) {
    put('invoiceNumber', puc.certificateNumber);
    put('invoiceDate', puc.issueDate);
    put('pucExpiry', puc.expiryDate);
    put('registration', puc.registrationNumber);
    put('productName', puc.vehicleType);
  } else if (family === 'rc' && rc) {
    put('invoiceNumber', rc.registrationNumber);
    put('invoiceDate', rc.registrationDate);
    put('productName', rc.model || rc.maker);
    put('registration', rc.registrationNumber);
    put('chassisNumber', rc.chassisNumber);
    put('engineNumber', rc.engineNumber);
    put('customerName', rc.ownerName);
  } else if (family === 'electronics' && e) {
    put('shopName', e.sellerName);
    put('shopGstin', e.gstin);
    put('invoiceNumber', e.invoiceNumber);
    put('invoiceDate', e.invoiceDate);
    put('productName', e.productName || e.model);
    put('brand', e.brand);
    put('serialNumber', e.serialNumber);
    put('imei', e.imei);
    put('customerName', e.buyerName);
    put('taxAmount', e.taxAmount);
    put('totalAmount', e.totalAmount || e.purchasePrice);
    put('warrantyPeriodMonths', e.warrantyMonths);
    put('warrantyExpiry', e.warrantyExpiry);
  } else if (family === 'appliance' && a) {
    put('shopName', a.sellerName);
    put('invoiceNumber', a.invoiceNumber);
    put('invoiceDate', a.purchaseDate);
    put('productName', a.productName || a.brand);
    put('brand', a.brand);
    put('serialNumber', a.serialNumber);
    put('taxAmount', null);
    put('totalAmount', a.purchasePrice);
    put('warrantyPeriodMonths', a.warrantyMonths);
    put('warrantyExpiry', a.warrantyExpiryDate);
  } else if (family === 'warranty' && w) {
    put('shopName', w.sellerName || w.brand);
    put('invoiceNumber', w.warrantyNumber);
    put('productName', w.productName);
    put('serialNumber', w.serialNumber);
    put('invoiceDate', w.warrantyStartDate);
    put('warrantyExpiry', w.warrantyEndDate);
    put('totalAmount', (w as any).totalAmount || (w as any).finalAmount || (w as any).purchasePrice);
    put('customerName', w.customerName);
  } else if (p) {
    put('shopName', p.sellerName);
    put('invoiceNumber', p.invoiceNumber);
    put('invoiceDate', p.invoiceDate);
    put('productName', p.assetName || p.model);
    put('brand', p.brand);
    put('serialNumber', p.serialNumber);
    put('customerName', p.buyerName);
    put('taxAmount', p.taxAmount);
    put('totalAmount', p.finalAmount || p.purchasePrice);
    put('warrantyPeriodMonths', p.warrantyMonths);
    put('warrantyExpiry', p.warrantyEndDate);
    if (family === 'vehicle_purchase') {
      put('registration', p.vehicleRegistration);
      put('chassisNumber', p.vinOrChassis);
      put('engineNumber', p.engineNumber);
      put('shopGstin', p.gstin);
    }
  }

  // Hard null vehicle/service fields when schema forbids them
  if (family === 'electronics' || family === 'appliance' || family === 'generic' || family === 'warranty') {
    invoice.registration = family === 'generic' ? invoice.registration || '' : '';
    invoice.chassisNumber = '';
    invoice.engineNumber = '';
    invoice.odometerKm = null;
    invoice.odometerReading = null;
    invoice.nextServiceOdometerKm = null;
    invoice.nextServiceDue = null;
    invoice.pucExpiry = null;
    invoice.labourCharges = null;
    invoice.partsTotal = null;
    invoice.isVehicleInvoice = false;
    invoice.purchaseCategory = family === 'appliance' ? 'Home Appliances' : 'Electronics';
    invoice.smartCategory = family === 'appliance' ? 'HOME_APPLIANCES' : 'GADGETS';
  } else if (family === 'service' || family === 'vehicle_purchase' || family === 'insurance' || family === 'puc' || family === 'rc') {
    invoice.isVehicleInvoice = family === 'vehicle_purchase' || family === 'service';
    invoice.purchaseCategory = 'Vehicles';
    invoice.requiresVehicleLink = family === 'insurance' || family === 'puc' || family === 'rc';
  }

  invoice.ocrExtract = {
    document_type: docType,
    asset_name: invoice.productName || '',
    vendor_dealer_name: invoice.shopName || '',
    owner_buyer_name: invoice.customerName || '',
    invoice_or_policy_no: invoice.invoiceNumber || '',
    purchase_or_issue_date: invoice.invoiceDate || '',
    total_amount: invoice.totalAmount ?? null,
    chassis_or_frame_no: invoice.chassisNumber || '',
    engine_number: invoice.engineNumber || '',
    vehicle_registration_number: invoice.registration || '',
    serial_number: invoice.serialNumber || '',
    imei: invoice.imei || '',
    expiry_date: invoice.insuranceExpiry || invoice.pucExpiry || invoice.warrantyExpiry || '',
  };

  return invoice;
}

export function buildCanonicalFields(
  extractedData: UniversalOcrDocumentResult['extractedData'],
  docType: string,
): CanonicalDocumentFields {
  const emptyStrField = (raw = 'Not found on document'): ExtractedField<string> => ({
    value: null,
    normalizedValue: null,
    confidence: 0,
    rawText: raw,
    tier: 'NOT_FOUND',
    status: 'NOT_FOUND',
    sourceType: 'OCR_DOCUMENT',
    provenance: 'OCR_DOCUMENT',
  });

  const emptyNumField = (raw = 'Not found on document'): ExtractedField<number> => ({
    value: null,
    normalizedValue: null,
    confidence: 0,
    rawText: raw,
    tier: 'NOT_FOUND',
    status: 'NOT_FOUND',
    sourceType: 'OCR_DOCUMENT',
    provenance: 'OCR_DOCUMENT',
  });

  const s = extractedData.serviceData;
  const ins = extractedData.insuranceData;
  const puc = extractedData.pucData;
  const rc = extractedData.rcData;
  const p = extractedData.purchaseData;
  const a = extractedData.applianceData;
  const e = extractedData.electronicsData;
  const w = extractedData.warrantyData;

  const family = familyFromDocumentType(docType, {
    imei: e?.imei?.value || '',
    productName: e?.productName?.value || s?.vehicleModel?.value || '',
  });

  const fields: CanonicalDocumentFields = {
    documentNumber: emptyStrField(),
    documentDate: emptyStrField(),
    vendorName: emptyStrField(),
    vendorGSTIN: emptyStrField(),
    assetName: emptyStrField(),
    registrationNumber: emptyStrField(),
    serialNumber: emptyStrField(),
    imei: emptyStrField(),
    chassisNumber: emptyStrField(),
    engineNumber: emptyStrField(),
    odometerKm: emptyNumField(),
    nextServiceOdometerKm: emptyNumField(),
    nextServiceDate: emptyStrField(),
    policyStartDate: emptyStrField(),
    policyExpiryDate: emptyStrField(),
    warrantyExpiryDate: emptyStrField(),
    totalAmount: emptyNumField(),
    taxAmount: emptyNumField(),
    premium: emptyNumField(),
    idv: emptyNumField(),
    customerName: emptyStrField(),
    customerPhone: emptyStrField(),
  };

  if (family === 'service' && s) {
    if (s.invoiceNumber) fields.documentNumber = s.invoiceNumber;
    if (s.invoiceDate || s.serviceDate) fields.documentDate = s.invoiceDate || s.serviceDate!;
    if (s.workshopName) fields.vendorName = s.workshopName;
    if (s.gstin) fields.vendorGSTIN = s.gstin;
    if (s.vehicleModel) fields.assetName = s.vehicleModel;
    if (s.vehicleRegistration) fields.registrationNumber = s.vehicleRegistration;
    if (s.vinOrChassis) fields.chassisNumber = s.vinOrChassis;
    if (s.engineNumber) fields.engineNumber = s.engineNumber;
    if (s.odometerKm) fields.odometerKm = s.odometerKm;
    if (s.nextServiceOdometerKm) fields.nextServiceOdometerKm = s.nextServiceOdometerKm;
    if ((s as any).nextServiceDate) fields.nextServiceDate = (s as any).nextServiceDate;
    if (s.taxAmount) fields.taxAmount = s.taxAmount;
    if (s.totalAmount) fields.totalAmount = s.totalAmount;
    if (s.customerName) fields.customerName = s.customerName;
    if (s.customerPhone) fields.customerPhone = s.customerPhone;
  } else if (family === 'insurance' && ins) {
    if (ins.policyNumber) fields.documentNumber = ins.policyNumber;
    if (ins.policyStartDate) fields.policyStartDate = ins.policyStartDate;
    if (ins.policyExpiryDate) fields.policyExpiryDate = ins.policyExpiryDate;
    if (ins.insurerName) fields.vendorName = ins.insurerName;
    if (ins.vehicleModel) fields.assetName = ins.vehicleModel;
    if (ins.vehicleRegistration) fields.registrationNumber = ins.vehicleRegistration;
    if (ins.vinOrChassis) fields.chassisNumber = ins.vinOrChassis;
    if (ins.engineNumber) fields.engineNumber = ins.engineNumber;
    if (ins.idvAmount) fields.idv = ins.idvAmount;
    if (ins.premiumAmount) {
      fields.premium = ins.premiumAmount;
      fields.totalAmount = ins.premiumAmount;
    }
    if (ins.insuredName) fields.customerName = ins.insuredName;
  } else if (family === 'puc' && puc) {
    if (puc.certificateNumber) fields.documentNumber = puc.certificateNumber;
    if (puc.issueDate) fields.documentDate = puc.issueDate;
    if (puc.expiryDate) fields.policyExpiryDate = puc.expiryDate;
    if (puc.registrationNumber) fields.registrationNumber = puc.registrationNumber;
    if (puc.vehicleType) fields.assetName = puc.vehicleType;
    if (puc.testingCenterName) fields.vendorName = puc.testingCenterName;
  } else if (family === 'rc' && rc) {
    if (rc.registrationNumber) {
      fields.documentNumber = rc.registrationNumber;
      fields.registrationNumber = rc.registrationNumber;
    }
    if (rc.registrationDate) fields.documentDate = rc.registrationDate;
    if (rc.model || rc.maker) fields.assetName = rc.model || rc.maker!;
    if (rc.chassisNumber) fields.chassisNumber = rc.chassisNumber;
    if (rc.engineNumber) fields.engineNumber = rc.engineNumber;
    if (rc.ownerName) fields.customerName = rc.ownerName;
  } else if (family === 'electronics' && e) {
    if (e.invoiceNumber) fields.documentNumber = e.invoiceNumber;
    if (e.invoiceDate) fields.documentDate = e.invoiceDate;
    if (e.sellerName) fields.vendorName = e.sellerName;
    if (e.gstin) fields.vendorGSTIN = e.gstin;
    if (e.productName || e.model) fields.assetName = e.productName || e.model!;
    if (e.serialNumber) fields.serialNumber = e.serialNumber;
    if (e.imei) fields.imei = e.imei;
    if (e.taxAmount) fields.taxAmount = e.taxAmount;
    if (e.totalAmount || e.purchasePrice) fields.totalAmount = e.totalAmount || e.purchasePrice!;
    if (e.warrantyExpiry) fields.warrantyExpiryDate = e.warrantyExpiry;
    if (e.buyerName) fields.customerName = e.buyerName;
  } else if (family === 'appliance' && a) {
    if (a.invoiceNumber) fields.documentNumber = a.invoiceNumber;
    if (a.purchaseDate) fields.documentDate = a.purchaseDate;
    if (a.sellerName) fields.vendorName = a.sellerName;
    if (a.brand || a.model) fields.assetName = a.brand || a.model!;
    if (a.serialNumber) fields.serialNumber = a.serialNumber;
    if (a.purchasePrice) fields.totalAmount = a.purchasePrice;
    if (a.warrantyExpiryDate) fields.warrantyExpiryDate = a.warrantyExpiryDate;
  } else if (family === 'warranty' && w) {
    if (w.warrantyNumber) fields.documentNumber = w.warrantyNumber;
    if (w.warrantyStartDate) fields.documentDate = w.warrantyStartDate;
    if (w.warrantyEndDate) fields.warrantyExpiryDate = w.warrantyEndDate;
    if (w.sellerName || w.brand) fields.vendorName = w.sellerName || w.brand!;
    if (w.productName) fields.assetName = w.productName;
    if (w.serialNumber) fields.serialNumber = w.serialNumber;
    if (w.customerName) fields.customerName = w.customerName;
  } else if (p) {
    if (p.invoiceNumber) fields.documentNumber = p.invoiceNumber;
    if (p.invoiceDate) fields.documentDate = p.invoiceDate;
    if (p.sellerName) fields.vendorName = p.sellerName;
    if (p.assetName || p.model) fields.assetName = p.assetName || p.model!;
    if (p.serialNumber) fields.serialNumber = p.serialNumber;
    if (p.taxAmount) fields.taxAmount = p.taxAmount;
    if (p.finalAmount || p.purchasePrice) fields.totalAmount = p.finalAmount || p.purchasePrice!;
    if (p.warrantyEndDate) fields.warrantyExpiryDate = p.warrantyEndDate;
    if (p.buyerName) fields.customerName = p.buyerName;
    if (family === 'vehicle_purchase' && p.vehicleRegistration) {
      fields.registrationNumber = p.vehicleRegistration;
    }
    if (family === 'vehicle_purchase' && p.vinOrChassis) {
      fields.chassisNumber = p.vinOrChassis;
    }
    if (family === 'vehicle_purchase' && p.engineNumber) {
      fields.engineNumber = p.engineNumber;
    }
  }

  return fields;
}

export function buildProvenanceMap(fields: CanonicalDocumentFields): Record<string, any> {
  const prov: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === 'object' && 'provenance' in v) {
      prov[k] = (v as any).provenance || (v as any).sourceType || 'OCR_DOCUMENT';
    }
  }
  return prov;
}

export function buildDocumentLineItems(invoice: Record<string, any>): DocumentLineItem[] {
  if (Array.isArray(invoice.items) && invoice.items.length > 0) {
    return invoice.items.map((it: any) => ({
      name: it.name || it.itemName || 'Line item',
      quantity: Number(it.quantity || it.qty) || 1,
      rate: Number(it.rate || it.price) || (Number(it.amount) || undefined),
      amount: Number(it.amount || it.price) || undefined,
      serialNumber: it.serialNumber || it.serial || undefined,
      hsn: it.hsn || it.hsnCode || undefined,
      category: it.category || it.smartCategory || undefined,
      isFee: Boolean(it.isFee),
    }));
  }
  return [];
}
