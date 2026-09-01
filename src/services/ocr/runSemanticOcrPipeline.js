/**
 * Staged OCR pipeline:
 * OCR text → document type → structured fields → line items → validation → category schema
 *
 * Do NOT run all fields through one generic OCR-to-form mapper.
 * Logs every stage under [OCR_PIPELINE] for device logcat.
 */

import { classifyDocumentType } from './documentTypeClassifier';
import {
  classifyDocumentEngine,
  stripInsuranceFieldsFromInvoice,
  PRIMARY_DOC_TYPES,
} from './documentClassificationEngine';
import { resolveInsuranceVsService } from './documentTypeArbitration';
import { classifyAssetDocumentCategory, ASSET_DOC_CATEGORY } from './assetCategoryClassifier';
import { applyCategorySchema, shouldShowVehicleFields } from './categorySchema';
import { createFreshExtraction } from './extractionSession';
import { sanitizeExtractedFields } from './fieldValidators';
import { selectGrandTotal } from './grandTotalSelection';
import { extractStructuredLineItems } from './lineItemExtraction';
import { findInvoiceTableRows } from './invoiceTableRows';
import { reconcileLineItemsWithDocument } from './lineItemReconciliation';
import { extractWarrantyFromDocument } from './warrantyExtraction';
import { applyDocumentFieldPresence } from './documentFieldPresence';
import { isCrumbProductLineAmount } from './invoiceAmountGuard';
import { isVariantOnlyLine, isNonProductRowName, isServiceInstructionLine, cleanVehicleModelName } from './lineItemVariantMerge';
import {
  isValidProductName,
  isSellerCompanyName,
  findPrimaryProductInLines,
  recoverVehicleProductName,
} from './productNameValidation';
import { isBoilerplateFooter } from './invoiceBoilerplate';
import { SMART_CATEGORIES, smartCategoryToCategoryId } from './categoryClassifier';
import { PURCHASE_CATEGORIES, addMonthsIso } from './invoiceSchema';
import { applyInsuranceOcrToInvoice, isInsuranceOcrDocument } from './insuranceOcrExtractor';
import {
  applyServiceBillOcrToInvoice,
  isServiceBillOcrDocument,
} from './serviceBillOcrExtractor';
import {
  applyElectricityBillOcrToInvoice,
  isElectricityBillOcrDocument,
} from './electricityBillOcrExtractor';
import { buildFieldStatusMap } from './fieldStatus';

function pipelineLog(stage, payload) {
  try {
    console.log(
      '[OCR_PIPELINE]',
      stage,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
  } catch {
    console.log('[OCR_PIPELINE]', stage);
  }
}


function preferPrimaryProductItems(items, productName) {
  const list = Array.isArray(items) ? [...items] : [];
  const ADDRESS = /\b(?:road|rd\.?|crossing|street|nagar|colony|sector|avenue|lane|marg|chowk|pin(?:code)?|district|patrakarpuram)\b/i;
  const cleaned = list.filter((it) => {
    const n = String(it?.name || it?.productName || '');
    if (ADDRESS.test(n) && !/\b(?:phone|mobile|laptop|tv|fridge|nothing)\b/i.test(n)) return false;
    return true;
  });
  const product = String(productName || '').trim();
  if (product) {
    cleaned.sort((a, b) => {
      const an = String(a?.name || a?.productName || '');
      const bn = String(b?.name || b?.productName || '');
      const as = an.toLowerCase().includes(product.toLowerCase().slice(0, 12)) ? 1 : 0;
      const bs = bn.toLowerCase().includes(product.toLowerCase().slice(0, 12)) ? 1 : 0;
      return bs - as;
    });
  }
  return cleaned.length ? cleaned : list;
}

function normalizeImeiKeep(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 15) return digits;
  return '';
}

function isJunkLineItem(it) {
  const n = String(it?.name || it?.productName || '').trim();
  if (!n) return true;
  if (isSellerCompanyName(n)) return true;
  if (isBoilerplateFooter(n)) return true;
  if (isServiceInstructionLine(n)) return true;
  if (isVariantOnlyLine(n)) return true;
  if (isNonProductRowName(n)) return true;
  if (/^(?:thank\s*you!?|handling\s*fee)$/i.test(n)) return true;
  if (/^(?:\[?imev|imei|serial|hsn)/i.test(n)) return true;
  if (it?.isFee) return Number(it.amount) <= 0;
  return !isValidProductName(n);
}

function lineItemAmount(it) {
  return Number(it?.amount ?? it?.lineTotal ?? it?.rate ?? it?.unitPrice);
}

function hasCrumbLineAmount(items) {
  return (Array.isArray(items) ? items : []).some((it) => {
    if (it?.isFee) return false;
    const amt = lineItemAmount(it);
    return amt > 0 && isCrumbProductLineAmount(amt);
  });
}

function findProductLineIndex(lines, productName) {
  const needle = String(productName || '').trim().slice(0, 16);
  if (!needle) return -1;
  return lines.findIndex((l) => l.toLowerCase().includes(needle.toLowerCase()));
}

/** Generic OCR typo cleanup for warranty display (not invoice-specific). */
function normalizeWarrantyDisplay(text) {
  return String(text || '')
    .replace(/\bWarrarty\b/gi, 'Warranty')
    .replace(/\bMenufecturing\b/gi, 'Manufacturing')
    .replace(/\bMenufacturing\b/gi, 'Manufacturing')
    .replace(/\bWarraty\b/gi, 'Warranty')
    .trim();
}

function parseLabeledDate(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!m) return null;
  let a = Number(m[1]);
  let b = Number(m[2]);
  let c = Number(m[3]);
  let y;
  let mo;
  let d;
  if (a > 31) {
    y = a;
    mo = b;
    d = c;
  } else {
    d = a;
    mo = b;
    y = c;
  }
  if (y < 100) y += 2000;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function recoverVehicleIdentityFromDocument(data, blob) {
  const text = String(blob || '');
  if (!data.chassisNumber) {
    const md = text.toUpperCase().match(/\b(MD[A-HJ-NPR-Z0-9]{14,16})\b/);
    if (md?.[1]) data.chassisNumber = md[1];
  }
  if (!data.engineNumber) {
    const eng = text.match(
      /\bEngine\s*(?:No\.?|Number)?[\s:\n\-#]*([A-Z]{2,4}[0-9][A-Z0-9]{5,14})\b/i,
    );
    if (eng?.[1] && !/^MD/i.test(eng[1])) data.engineNumber = eng[1].toUpperCase();
  }
  if (!data.registration) {
    const labeled = text.match(
      /(?:Reg(?:istration)?(?:\s*(?:No\.?|Number|Plate))|Regn\.?\s*No\.?|Vehicle\s*(?:No\.?|Number))\s*[:\-#]?\s*([A-Z]{2}\s?-?\s?[0-9]{1,2}\s?-?\s?[A-Z]{1,3}\s?-?\s?[0-9]{4}|[0-9]{2}\s?-?\s?BH\s?-?\s?[0-9]{4}\s?-?\s?[A-Z]{1,2})\b/i,
    );
    if (labeled?.[1]) {
      const plate = labeled[1].toUpperCase().replace(/[\s-]/g, '');
      if (/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(plate) || /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(plate)) {
        data.registration = plate;
      }
    }
  }
}

function recoverLabeledDocumentFields(data, lines, blob) {
  if (!String(data.shopName || '').trim()) {
    for (const line of lines) {
      const sold = String(line).match(/^sold\s*by\s*[:\-]?\s*(.+)$/i);
      if (sold?.[1]) {
        data.shopName = sold[1].replace(/[,.\s]+$/g, '').trim();
        break;
      }
      const dealer = String(line).match(/^dealer\s*[:\-]?\s*(.+)$/i);
      if (dealer?.[1] && !/gst/i.test(dealer[1])) {
        data.shopName = dealer[1].replace(/[,.\s]+$/g, '').trim();
        break;
      }
    }
  }
  if (!data.invoiceDate) {
    const labeled =
      blob.match(
        /(?:Invoice|Bill|Purchase|I[nv]oice)\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      ) ||
      blob.match(
        /(?:Invoice|I[nv]oice)\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-.]?\d{1,2}[\/\-.]?\d{4})/i,
      );
    if (labeled?.[1]) {
      const raw = labeled[1].replace(/^(\d{1,2})[\/\-.]?(\d{2})[\/\-.]?(\d{4})$/, '$1/$2/$3');
      data.invoiceDate = parseLabeledDate(raw.includes('/') ? raw : labeled[1]);
    }
  }
}

function ensureLineItems(data, lines, totalAmount) {
  const corrections = [];
  let items = Array.isArray(data.items) ? [...data.items] : [];
  const before = items.length;
  items = items.filter((it) => !isJunkLineItem(it));
  if (before && items.length !== before) {
    corrections.push({ action: 'dropped_junk_line_items', from: before, to: items.length });
  }

  // A product name and grand total do not prove that a line item exists.
  // Keep only rows that carry their own OCR evidence; never synthesize a row.
  items = items.filter((it) => Boolean(it?.sourceText || it?.evidence || it?.rawText));

  return { items, corrections };
}

/**
 * Run staged semantic understanding on parsed OCR invoice data.
 * @param {string} rawText
 * @param {object} parsedData — output of parseInvoiceText / gemini merge
 * @param {object} [opts]
 */
export function runSemanticOcrPipeline(rawText = '', parsedData = {}, opts = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const blob = lines.join('\n');

  pipelineLog('A_RAW_OCR', {
    chars: blob.length,
    sample: blob.slice(0, 8000),
    lines: lines.slice(0, 120).map((text, i) => `${i + 1}|${text}`),
    engine: opts.engine || '',
  });

  // Fresh session — never merge previous vault asset
  let data = createFreshExtraction(parsedData || {});

  // Parser often seeds seller/legal entity as productName. Recover from raw OCR.
  const recovered = findPrimaryProductInLines(lines);
  if (recovered?.name) {
    if (!data.productName || !isValidProductName(data.productName) || isSellerCompanyName(data.productName)) {
      data.productName = recovered.name;
      if (recovered.variant && !data.variant) data.variant = recovered.variant;
    }
  } else if (data.productName && isSellerCompanyName(data.productName)) {
    data.productName = '';
  }

  pipelineLog('B_STRUCTURED_SEED', {
    productName: data.productName,
    totalAmount: data.totalAmount,
    imei: data.imei,
    itemCount: data.items?.length || 0,
    shopName: data.shopName,
  });

  recoverLabeledDocumentFields(data, lines, blob);
  // Vehicle identity must come from an explicit labeled extractor. Do not
  // recover chassis/engine/registration from unlabeled model-like tokens.

  pipelineLog('B2_LABELED_RECOVERY', {
    shopName: data.shopName,
    invoiceDate: data.invoiceDate,
  });

  // Stage: document type — Classification Engine is authoritative
  const engine = classifyDocumentEngine(blob, {
    productName: data.productName,
    shopName: data.shopName,
    registration: data.registration,
    chassisNumber: data.chassisNumber,
    odometerKm: data.odometerKm,
    labourCost: data.labourCost,
    totalAmount: data.totalAmount,
    items: data.items,
    policyNumber: data.policyNumber,
    premium: data.premium,
    idv: data.idv,
  });
  const docClass = classifyDocumentType(blob, {
    productName: data.productName,
    shopName: data.shopName,
    registration: data.registration,
    chassisNumber: data.chassisNumber,
  });
  const arb = resolveInsuranceVsService(blob, {
    documentKind: engine.legacyDocumentKind || docClass.documentKind,
    documentType: engine.legacyVaultType || docClass.vaultType,
    isServiceInvoice: engine.treatAsService || docClass.isServiceInvoice,
  });

  data.classificationConfidence = engine.confidence;
  data.classificationSignals = engine.signals;
  data.primaryDocumentType = engine.documentType;

  if (engine.documentType === PRIMARY_DOC_TYPES.SERVICE_BILL || arb.treatAsService) {
    data.documentType = 'service_invoice';
    data.documentKind = 'service_invoice';
    data.documentLabel = 'Service Bill';
    data.isServiceInvoice = true;
    stripInsuranceFieldsFromInvoice(data);
  } else if (engine.documentType === PRIMARY_DOC_TYPES.INSURANCE || arb.treatAsInsurance) {
    data.documentType = 'insurance';
    data.documentKind = 'insurance';
    data.documentLabel = engine.label || docClass.label || 'Insurance';
  } else if (engine.documentType === PRIMARY_DOC_TYPES.SALES_INVOICE) {
    data.documentType = 'bill';
    data.documentKind = 'sales_invoice';
    data.documentLabel = 'Sales Invoice';
  } else if (engine.documentType === PRIMARY_DOC_TYPES.RC) {
    data.documentType = 'rc';
    data.documentKind = 'rc';
    data.documentLabel = 'RC';
  } else if (engine.documentType === PRIMARY_DOC_TYPES.PUC) {
    data.documentType = 'puc';
    data.documentKind = 'puc';
    data.documentLabel = 'PUC';
  } else if (engine.documentType === PRIMARY_DOC_TYPES.WARRANTY) {
    data.documentType = 'warranty';
    data.documentKind = 'warranty';
    data.documentLabel = 'Warranty';
  } else if (engine.documentType === PRIMARY_DOC_TYPES.ELECTRICITY_BILL) {
    data.documentType = 'electricity_bill';
    data.documentKind = 'electricity_bill';
    data.documentLabel = 'Electricity Bill';
  } else {
    data.documentType = data.documentType || docClass.vaultType;
    data.documentKind = data.documentKind || docClass.documentKind;
    data.documentLabel = data.documentLabel || docClass.label;
  }

  pipelineLog('C_DOCUMENT_TYPE', {
    primary: engine.documentType,
    confidence: engine.confidence,
    vaultType: data.documentType,
    documentKind: data.documentKind,
    label: data.documentLabel,
    arbitration: arb.reasons,
    serviceScore: arb.serviceScore,
    conflicting: engine.conflictingSignals,
  });

  const serviceSignals =
    engine.treatAsService ||
    arb.treatAsService ||
    data.isServiceInvoice === true ||
    isServiceBillOcrDocument(data, blob) ||
    data.documentKind === 'service_invoice';

  const insuranceDoc =
    !serviceSignals &&
    (engine.treatAsInsurance ||
      arb.treatAsInsurance ||
      (data.documentKind === 'insurance' && isInsuranceOcrDocument(data, blob)));

  const electricitySignals =
    !serviceSignals &&
    !insuranceDoc &&
    (engine.treatAsElectricityBill ||
      engine.documentType === PRIMARY_DOC_TYPES.ELECTRICITY_BILL ||
      data.documentKind === 'electricity_bill' ||
      data.documentType === 'electricity_bill' ||
      isElectricityBillOcrDocument(data, blob));

  if (insuranceDoc) {
    applyInsuranceOcrToInvoice(data, blob);
    pipelineLog('C_INSURANCE_FIELDS', {
      insurer: data.insurer || data.shopName || null,
      policyNumber: data.policyNumber || data.invoiceNumber || null,
    });
  }

  const serviceDoc = !insuranceDoc && !electricitySignals && serviceSignals;
  if (serviceDoc) {
    applyServiceBillOcrToInvoice(data, blob);
    stripInsuranceFieldsFromInvoice(data);
    data.documentType = 'service_invoice';
    data.documentKind = 'service_invoice';
    data.isServiceInvoice = true;
    pipelineLog('C_SERVICE_BILL_FIELDS', {
      registration: data.registration || null,
      serviceDate: data.serviceDate || data.invoiceDate || null,
      odometerKm: data.odometerKm ?? null,
      totalAmount: data.totalAmount ?? null,
    });
  }

  const electricityDoc = !insuranceDoc && !serviceDoc && electricitySignals;
  if (electricityDoc) {
    applyElectricityBillOcrToInvoice(data, blob);
    pipelineLog('C_ELECTRICITY_BILL_FIELDS', {
      consumerNumber: data.consumerNumber || null,
      unitsConsumed: data.unitsConsumed ?? null,
      totalAmount: data.totalAmount ?? null,
      provider: data.provider || data.discom || null,
    });
  }

  // IMEI is accepted only from an explicit IMEI-labeled 15-digit span.
  const explicitImei = blob.match(/\bIMEI(?:\s*(?:No|Number|1|2))?\s*[:#\-]?\s*([0-9\s]{15,20})\b/i);
  const explicitImeiDigits = explicitImei?.[1]?.replace(/\D/g, '') || '';
  data.imei = explicitImeiDigits.length === 15 ? explicitImeiDigits : '';

  // Stage: asset category (VEHICLE | GADGET | …)
  const assetClass = classifyAssetDocumentCategory(blob, {
    productName: data.productName,
    imei: data.imei,
    chassisNumber: data.chassisNumber,
    engineNumber: data.engineNumber,
    registration: data.registration,
    items: data.items,
    geminiCategory: data.geminiCategory || parsedData.geminiCategory,
  });

  pipelineLog('C_ASSET_CATEGORY', {
    DOCUMENT_TYPE: assetClass.category,
    CATEGORY: assetClass.category,
    confidence: assetClass.confidence,
    reasons: assetClass.reasons,
    IMEI: data.imei || null,
  });

  // Stage: grand total (never largest-on-page)
  const primaryLineTotal =
    Array.isArray(data.items) && data.items[0]
      ? data.items[0].amount ?? data.items[0].lineTotal
      : null;
  const totalPick = selectGrandTotal(lines, {
    parserTotal: data.totalAmount,
    geminiTotal: opts.geminiTotal ?? parsedData._geminiTotal,
    lineItemTotal: primaryLineTotal,
    subtotal: data.subtotal,
    taxAmount: data.taxAmount,
  });

  pipelineLog('D_PRICE_CANDIDATES', {
    PRICE_CANDIDATES: totalPick.priceCandidates,
    SELECTED: totalPick.selected,
    REASON: totalPick.reason,
    uncertain: totalPick.uncertain,
    corrections: totalPick.corrections,
  });

  const hasExplicitTotalLabel = /(?:grand\s*tot[ae]l|amount\s*payable|net\s*(?:payable|total|amount)|total\s*(?:amount|invoice\s*value|payable)|invoice\s*total|ex[\s\-]?showroom\s*price)/i.test(blob);
  if (totalPick.selected != null && hasExplicitTotalLabel) {
    data.totalAmount = totalPick.selected;
  } else if (totalPick.selected != null || totalPick.uncertain) {
    data.totalAmount = null;
    data.totalAmountUncertain = true;
    data.needsManualReview = true;
  }

  // Stage: line items + Items(0) fix
  const lineFix = ensureLineItems(data, lines, data.totalAmount);
  data.items = preferPrimaryProductItems(lineFix.items, data.productName).map((it, i) => ({
    ...it,
    index: i + 1,
  }));

  const tableRows = findInvoiceTableRows(lines);
  const reconciled = reconcileLineItemsWithDocument(data.items, {
    totalAmount: data.totalAmount,
    grandTotal: data.totalAmount,
    subtotal: data.subtotal,
    taxAmount: data.taxAmount,
    lines,
  }, tableRows);
  data.items = reconciled.items.map((it, i) => ({ ...it, index: i + 1 }));
  lineFix.corrections.push(...reconciled.corrections);

  // Keep only real merchandise rows in itemCount (fees excluded from primary list)
  const merchandise = data.items.filter(
    (it) =>
      !it.isFee &&
      !isNonProductRowName(it.name || it.productName) &&
      !isServiceInstructionLine(it.name || it.productName) &&
      !isVariantOnlyLine(it.name || it.productName),
  );
  if (merchandise.length) {
    data.items = merchandise.map((it, i) => ({ ...it, index: i + 1 }));
  }

  data.itemCount = data.items.length;
  if (data.items[0]?.name || data.items[0]?.productName) {
    const primaryName = data.items[0].name || data.items[0].productName;
    if (!data.productName || isVariantOnlyLine(data.productName) || data.productName.length < primaryName.length) {
      data.productName = primaryName;
    }
  }
  if (
    data.productName &&
    !isValidProductName(data.productName) &&
    data.items[0]?.name &&
    isValidProductName(data.items[0].name)
  ) {
    data.productName = data.items[0].name;
  }
  if (!data.productName && data.items[0]?.name) {
    data.productName = data.items[0].name;
  }

  const vehicleName = recoverVehicleProductName(data.productName, lines);
  const isVehicleDoc =
    docClass.isVehicleInvoice ||
    assetClass.category === ASSET_DOC_CATEGORY.VEHICLE ||
    data.smartCategory === SMART_CATEGORIES.VEHICLES;
  if (vehicleName || isVehicleDoc) {
    const resolved = vehicleName || recoverVehicleProductName(data.items[0]?.name, lines);
    if (resolved) {
      data.productName = resolved;
      if (data.items[0]) {
        data.items[0].name = resolved;
        data.items[0].productName = resolved;
      }
    }
  } else if (data.productName) {
    const cleaned = cleanVehicleModelName(data.productName);
    if (cleaned && isValidProductName(cleaned)) {
      data.productName = cleaned;
      if (data.items[0]) {
        data.items[0].name = cleaned;
        data.items[0].productName = cleaned;
      }
    }
  }

  if (!data.imei && data.items[0]?.imei) {
    data.imei = normalizeImeiKeep(data.items[0].imei);
  }

  // Contextual warranty (OCR-tolerant — Warrarty / Menufecturing typos)
  // Insurance policies must not inherit manufacturing-warranty dates.
  let warranty = { warrantyMonths: null, warrantyText: null, validationStatus: 'SKIPPED' };
  if (!insuranceDoc) {
    const productIdx = findProductLineIndex(lines, data.productName);
    warranty = extractWarrantyFromDocument(blob, {
      productLineIndex: productIdx,
      productName: data.productName,
    });
    if (warranty.warrantyMonths) {
      if (!data.warrantyPeriodMonths) {
        data.warrantyPeriodMonths = warranty.warrantyMonths;
      }
      data.warrantyText = normalizeWarrantyDisplay(warranty.warrantyText || data.warrantyText || '');
      data.warrantySourceText = warranty.sourceText || warranty.warrantyText || '';
      data.warrantyFieldMeta = {
        value: warranty.warrantyMonths,
        sourceText: warranty.sourceText,
        confidence: warranty.confidence,
        validationStatus: warranty.validationStatus,
        source: warranty.source,
      };
    }
    // Warranty Start = purchase/invoice date; Warranty Expiry = start + duration.
    // Never guess a missing date; if the duration was read but no start date is
    // available, mark the warranty for manual review so the user confirms.
    const startDate =
      data.invoiceDate || data.purchaseDate || (parsedData && parsedData.invoiceDate) || null;
    if (data.warrantyPeriodMonths != null) {
      data.warrantyStart = startDate || null;
      if (startDate) {
        data.warrantyExpiry = addMonthsIso(startDate, data.warrantyPeriodMonths);
      } else if (!data.warrantyExpiry) {
        data.warrantyNeedsReview = true;
      }
    } else if (/warr?[ae]?r?t?[yi]?/i.test(blob)) {
      data.warrantyNeedsReview = true;
    }
  } else {
    data.warrantyExpiry = null;
    data.warrantyPeriodMonths = null;
    data.warrantyText = null;
  }

  pipelineLog('F_WARRANTY', {
    months: data.warrantyPeriodMonths,
    text: data.warrantyText || warranty.warrantyText,
    validationStatus: warranty.validationStatus,
  });

  pipelineLog('F_LINE_ITEMS', {
    ITEMS: data.itemCount,
    PRODUCT: data.productName,
    first: data.items[0]
      ? {
          productName: data.items[0].name || data.items[0].productName,
          qty: data.items[0].qty ?? 1,
          lineTotal: data.items[0].amount,
          imei: data.items[0].imei || '',
        }
      : null,
  });

  // Field sanitization (address ≠ owner, placeholders)
  data = sanitizeExtractedFields(data);

  const presence = applyDocumentFieldPresence(data, lines, blob);
  data = presence.data;
  lineFix.corrections.push(...presence.corrections);

  if (!insuranceDoc && !data.purchaseDate && data.invoiceDate) {
    data.purchaseDate = data.invoiceDate;
  }
  if (!insuranceDoc && !data.sellerName && data.shopName) {
    data.sellerName = data.shopName;
  }

  // Category schema — strip vehicle fields for gadgets
  data = applyCategorySchema(data, assetClass.category);
  data.assetDocCategory = assetClass.category;
  data.showVehicleFields = shouldShowVehicleFields(assetClass.category);
  data.assetCategoryConfidence = assetClass.confidence;
  data.assetCategoryReasons = assetClass.reasons;

  if (assetClass.category === ASSET_DOC_CATEGORY.GADGET) {
    data.smartCategory = SMART_CATEGORIES.GADGETS;
    data.purchaseCategory = PURCHASE_CATEGORIES.ELECTRONICS;
    data.categoryId = smartCategoryToCategoryId(SMART_CATEGORIES.GADGETS, data.productName);
    data.isVehicleInvoice = false;
  } else if (assetClass.category === ASSET_DOC_CATEGORY.HOME_APPLIANCE) {
    data.smartCategory = SMART_CATEGORIES.HOME_APPLIANCES;
    data.purchaseCategory = PURCHASE_CATEGORIES.ELECTRONICS;
    data.categoryId = smartCategoryToCategoryId(
      SMART_CATEGORIES.HOME_APPLIANCES,
      data.productName,
    );
    data.isVehicleInvoice = false;
  } else if (assetClass.category === ASSET_DOC_CATEGORY.VEHICLE) {
    data.smartCategory = SMART_CATEGORIES.VEHICLES;
    data.purchaseCategory = PURCHASE_CATEGORIES.VEHICLES;
    data.categoryId = smartCategoryToCategoryId(SMART_CATEGORIES.VEHICLES, data.productName);
  }

  if (insuranceDoc) {
    applyInsuranceOcrToInvoice(data, blob);
    data.assetDocCategory = ASSET_DOC_CATEGORY.VEHICLE;
    data.showVehicleFields = true;
    data.smartCategory = SMART_CATEGORIES.VEHICLES;
    data.purchaseCategory = PURCHASE_CATEGORIES.VEHICLES;
    data.isVehicleInvoice = false;
    data.requiresVehicleLink = true;
    data.documentType = 'insurance';
    data.documentKind = 'insurance';
  } else if (serviceDoc) {
    applyServiceBillOcrToInvoice(data, blob);
    stripInsuranceFieldsFromInvoice(data);
    data.assetDocCategory = ASSET_DOC_CATEGORY.VEHICLE;
    data.showVehicleFields = true;
    data.smartCategory = SMART_CATEGORIES.VEHICLES;
    data.purchaseCategory = PURCHASE_CATEGORIES.VEHICLES;
    data.isVehicleInvoice = false;
    data.requiresVehicleLink = true;
    data.documentType = 'service_invoice';
    data.documentKind = 'service_invoice';
    data.scanDocumentType = 'service_invoice';
    data.isServiceInvoice = true;
    // Re-assert OCR odometer / service date after any earlier category wipe or date pollution
    if (data.canonicalServiceBill?.service?.odometerReading != null) {
      data.odometerKm = data.canonicalServiceBill.service.odometerReading;
      data.odometerReading = data.odometerKm;
    }
    if (data.canonicalServiceBill?.service?.serviceDate) {
      data.serviceDate = data.canonicalServiceBill.service.serviceDate;
      data.invoiceDate = data.serviceDate;
      data.purchaseDate = data.serviceDate;
    }
    if (data.canonicalServiceBill?.customer?.name && !data.customerName) {
      data.customerName = data.canonicalServiceBill.customer.name;
      data.buyerName = data.customerName;
    }
    if (data.canonicalServiceBill?.service?.invoiceNumber && !data.invoiceNumber) {
      data.invoiceNumber = data.canonicalServiceBill.service.invoiceNumber;
    }
    if (data.canonicalServiceBill?.vehicle?.registrationNumber && !data.registration) {
      data.registration = data.canonicalServiceBill.vehicle.registrationNumber;
    }
  } else if (electricityDoc) {
    applyElectricityBillOcrToInvoice(data, blob);
    data.isVehicleInvoice = false;
    data.requiresVehicleLink = false;
    data.showVehicleFields = false;
    data.documentType = 'electricity_bill';
    data.documentKind = 'electricity_bill';
    data.scanDocumentType = 'electricity_bill';
    data.categoryId = 'electricity_bill';
  }

  const validationCorrections = [
    ...totalPick.corrections,
    ...lineFix.corrections,
    ...(!insuranceDoc && assetClass.category !== ASSET_DOC_CATEGORY.VEHICLE
      ? [{ action: 'cleared_vehicle_fields', category: assetClass.category }]
      : []),
  ];

  pipelineLog('E_FINAL_STRUCTURED', {
    DOCUMENT_TYPE: assetClass.category,
    PRODUCT: data.productName,
    PRICE: data.totalAmount,
    IMEI: data.imei || null,
    CATEGORY: data.smartCategory,
    VEHICLE_FIELDS: data.showVehicleFields,
    ITEMS: data.itemCount,
    owner: data.customerName || null,
    invoiceNumber: data.invoiceNumber || null,
  });

  pipelineLog('G_VALIDATION_CORRECTIONS', validationCorrections);

  data.pipelineMeta = {
    assetDocCategory: assetClass.category,
    documentKind: data.documentKind,
    priceReason: totalPick.reason,
    priceUncertain: totalPick.uncertain,
    priceCandidates: totalPick.priceCandidates,
    corrections: validationCorrections,
  };

  try {
    data.fieldStatus = buildFieldStatusMap(data);
  } catch {
    /* optional */
  }

  return data;
}

export default runSemanticOcrPipeline;
