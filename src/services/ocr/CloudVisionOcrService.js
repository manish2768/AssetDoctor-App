/**
 * Cloud Vision OCR client — prefers authenticated Cloud Function in production,
 * then optional client Vision key (dev only), then ML Kit.
 */

import auth from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';

import { ENV } from '../../config/env';
import { Haptics } from '../haptics/triggerHaptic';
import { scanInvoiceImage } from '../ocrService';
import { parseInvoiceText } from './InvoiceOcrParser';
import { emptyInvoiceData } from './invoiceSchema';
import { parseBillData } from '../../utils/billParser';
import { extractApplianceEnergyFromText } from '../../utils/powerCost';
import { preferPurchaseTotal, isTaxIdentifierText } from './invoiceAmountGuard';
import { allowClientLlmKeys } from '../security/clientSecretPolicy';
import { isJunkVendorOrName } from './ocrFieldHeuristics';
import { recordRawOcr, recordExtraction, recordFinalMapping, resetOcrTrail } from './ocrDebugTrail';
import { scoreFieldConfidences } from './fieldConfidence';

const DEFAULT_VISION_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

function visionUrl() {
  return process.env.EXPO_PUBLIC_OCR_VISION_URL || ENV.ocrVisionUrl || DEFAULT_VISION_URL;
}

function mergeParsedFields(invoiceData, sweetBill) {
  const next = { ...invoiceData };
  if (!next.shopGstin && sweetBill.gstin) next.shopGstin = sweetBill.gstin;
  if (!next.invoiceDate && sweetBill.invoiceDate) next.invoiceDate = sweetBill.invoiceDate;
  if ((next.totalAmount == null || next.totalAmount <= 0) && sweetBill.totalAmount > 0) {
    next.totalAmount = sweetBill.totalAmount;
  }
  if (!next.warrantyExpiry && sweetBill.expiryDate) next.warrantyExpiry = sweetBill.expiryDate;
  if (next.warrantyPeriodMonths == null && sweetBill.warrantyPeriodMonths != null) {
    next.warrantyPeriodMonths = sweetBill.warrantyPeriodMonths;
  }

  // Prefer reconciled / fewer items (strict parser wins over noisy merge)
  const invCount = next.items?.length || 0;
  const sweetCount = sweetBill.items?.length || 0;
  if ((!invCount && sweetCount) || (sweetCount > 0 && sweetCount < invCount)) {
    next.items = sweetBill.items;
    next.itemCount = sweetBill.itemCount;
    next.itemsSubtotal = sweetBill.itemsSubtotal;
  }
  if (!next.itemCount && next.items?.length) next.itemCount = next.items.length;
  if (next.itemsSubtotal == null && sweetBill.itemsSubtotal != null) {
    next.itemsSubtotal = sweetBill.itemsSubtotal;
  }

  // Prefer Net/Grand Total already on invoice; never let a smaller tax-table /
  // itemsSubtotal (e.g. 63246) overwrite a larger purchase total (e.g. 135500).
  if (next.totalAmount == null || next.totalAmount <= 0) {
    if (next.subtotal != null && next.subtotal > 0) {
      const tax = next.taxAmount != null ? Number(next.taxAmount) : 0;
      next.totalAmount = Math.round((Number(next.subtotal) + tax) * 100) / 100;
    } else if (next.itemsSubtotal != null && next.itemsSubtotal > 0) {
      next.totalAmount = next.itemsSubtotal;
    }
  } else if (
    next.itemsSubtotal != null &&
    Number(next.itemsSubtotal) > 0 &&
    Number(next.totalAmount) > 0 &&
    Number(next.itemsSubtotal) < Number(next.totalAmount) * 0.85
  ) {
    // Keep labeled Net/Grand Total; itemsSubtotal is likely a tax-table fragment
  }

  if (/invoice|bill\s*(?:no|number)|number\s*#|^date$/i.test(String(next.productName || ''))) {
    next.productName = next.items?.[0]?.name || '';
  }
  // Never carry demo / ghost vehicle plates into review
  if (/^MH12AB1234$/i.test(String(next.registration || '').replace(/\s+/g, ''))) {
    next.registration = '';
  }
  if (!Array.isArray(next.items)) next.items = [];
  next.itemCount = next.items.length || next.itemCount || 0;
  return next;
}

export class CloudVisionOcrService {
  static async recognizeInvoice(imageUri, options = {}) {
    Haptics.tap();
    if (!imageUri) {
      return {
        success: false,
        data: emptyInvoiceData(),
        sweetBill: parseBillData(''),
        error: 'No image provided',
      };
    }

    const precomputedBase64 =
      typeof options?.base64 === 'string' && options.base64.length > 0
        ? options.base64
        : null;

    let rawText = '';
    let engine = 'none';
    let cloudError = null;

    // 1) Authenticated Cloud Function (Vision secret stays server-side)
    try {
      const proxy = await this.recognizeTextViaCloudFunction(imageUri, precomputedBase64);
      if (proxy.success && proxy.text) {
        rawText = proxy.text;
        engine = 'cloud-vision-function';
      } else {
        cloudError = proxy.error;
      }
    } catch (error) {
      cloudError = error?.message || 'Cloud Function OCR failed';
    }

    // 2) Client Vision key — development / explicit opt-in only
    if (!rawText && allowClientLlmKeys()) {
      try {
        const direct = await this.recognizeTextViaApiKey(imageUri, precomputedBase64);
        if (direct.success && direct.text) {
          rawText = direct.text;
          engine = 'cloud-vision-api-key';
          cloudError = null;
        } else if (!cloudError) {
          cloudError = direct.error;
        }
      } catch (error) {
        if (!cloudError) cloudError = error?.message || 'Cloud Vision API key call failed';
      }
    }

    // 3) On-device ML Kit
    if (!rawText) {
      const local = await this.recognizeTextViaMlKit(imageUri);
      if (local.success && local.text) {
        rawText = local.text;
        engine = 'mlkit-fallback';
      } else if (!cloudError) {
        cloudError = local.error;
      }
    }

    if (!rawText) {
      Haptics.error();
      return {
        success: false,
        data: emptyInvoiceData(),
        sweetBill: parseBillData(''),
        engine,
        error: cloudError || 'Could not read text from this invoice.',
      };
    }

    try {
      resetOcrTrail();
      recordRawOcr(rawText, engine);
    } catch {
      /* debug optional */
    }

    const parsed = parseInvoiceText(rawText);
    const sweetBill = parseBillData(rawText);
    let data = mergeParsedFields(parsed.data, sweetBill);
    const energyHints = extractApplianceEnergyFromText(rawText);

    // Gemini + keyword classification — Insurance keywords beat Invoice
    let gemini = null;
    try {
      const {
        extractAssetWithGemini,
        DOC_CLASS,
        DOC_TYPE_LABELS,
      } = require('../gemini/geminiService');
      const {
        classifyDocumentTypeFromKeywords,
      } = require('./ocrFieldHeuristics');
      const keywordClass = classifyDocumentTypeFromKeywords(rawText);
      const enhanced = await extractAssetWithGemini(rawText, {
        serialHint: data.serialNumber || data.chassisNumber || data.registration || '',
        expectedDocumentType:
          keywordClass?.document_type || data.documentType || data.documentKind || '',
        imageBase64: precomputedBase64 || undefined,
        imageMimeType: 'image/jpeg',
      });
      if (enhanced.success && enhanced.data) {
        gemini = enhanced.data;
        try {
          const { cleanAndValidateOCR } = require('./cleanAndValidateOCR');
          const cleaned = cleanAndValidateOCR(gemini);
          if (cleaned) gemini = { ...gemini, ...cleaned };
        } catch {
          /* optional */
        }
        if (enhanced.confidence != null) data.confidence = enhanced.confidence;
        if (enhanced.needsManualReview != null) {
          data.needsManualReview = enhanced.needsManualReview;
        }
        const docType = gemini.document_type || gemini.documentType;
        const vaultType = gemini.vaultType || keywordClass?.vaultType || 'bill';

        data.documentType = vaultType;
        data.documentKind = vaultType;
        data.geminiDocumentType = docType;
        data.scanDocumentType = vaultType;
        data.documentLabel =
          gemini.documentLabel ||
          keywordClass?.label ||
          DOC_TYPE_LABELS[docType] ||
          data.documentLabel;
        data.classifiedDocumentType = docType;

        if (gemini.asset_name || gemini.item_name || gemini.assetName || gemini.itemName) {
          const geminiProduct = String(
            gemini.asset_name || gemini.item_name || gemini.assetName || gemini.itemName,
          ).trim();
          const parserProduct = String(data.productName || '').trim();
          if (
            geminiProduct &&
            !isTaxIdentifierText(geminiProduct) &&
            !isJunkVendorOrName(geminiProduct)
          ) {
            // Prefer Gemini only when parser empty or clearly weaker
            if (!parserProduct || parserProduct.length < 4 || isJunkVendorOrName(parserProduct)) {
              data.productName = geminiProduct;
            } else if (
              geminiProduct.length >= parserProduct.length * 0.6 &&
              !/^(?:hsn|sac|cin)/i.test(geminiProduct)
            ) {
              data.productName = geminiProduct;
            }
          }
        }
        if (
          gemini.vendor_dealer_name ||
          gemini.vendor_name ||
          gemini.vendorName ||
          gemini.vendor ||
          gemini.vendorDealerName ||
          gemini.shopName
        ) {
          const geminiShop = String(
            gemini.vendor_dealer_name ||
              gemini.vendor_name ||
              gemini.vendorName ||
              gemini.vendor ||
              gemini.vendorDealerName ||
              gemini.shopName,
          ).trim();
          if (
            geminiShop &&
            !isTaxIdentifierText(geminiShop) &&
            !isJunkVendorOrName(geminiShop)
          ) {
            data.shopName = geminiShop;
          } else if (
            isTaxIdentifierText(data.shopName) ||
            isJunkVendorOrName(data.shopName)
          ) {
            data.shopName = '';
          }
        }
        if (
          gemini.owner_buyer_name ||
          gemini.buyer_name ||
          gemini.buyerName ||
          gemini.ownerName ||
          gemini.customerName
        ) {
          data.customerName = String(
            gemini.owner_buyer_name ||
              gemini.buyer_name ||
              gemini.buyerName ||
              gemini.ownerName ||
              gemini.customerName,
          ).trim();
        }
        if (
          gemini.invoice_or_policy_no ||
          gemini.invoice_number ||
          gemini.invoiceNumber
        ) {
          data.invoiceNumber = String(
            gemini.invoice_or_policy_no || gemini.invoice_number || gemini.invoiceNumber,
          ).trim();
        }
        if (
          gemini.purchase_or_issue_date ||
          gemini.purchase_date ||
          gemini.invoiceDate
        ) {
          data.invoiceDate = String(
            gemini.purchase_or_issue_date || gemini.purchase_date || gemini.invoiceDate,
          ).trim();
        }
        data.scannedData = {
          item_name: data.productName || '',
          total_amount:
            gemini.total_amount != null && Number(gemini.total_amount) > 0
              ? Number(gemini.total_amount)
              : data.totalAmount ?? null,
          vendor_name: data.shopName || '',
          buyer_name: data.customerName || '',
          purchase_date: data.invoiceDate || '',
          invoice_number: data.invoiceNumber || '',
          category: gemini.category || data.purchaseCategory || '',
        };
        data.itemName = data.productName || '';
        data.vendor = data.shopName || '';
        data.buyerName = data.customerName || '';
        data.purchaseDate = data.invoiceDate || '';
        data.price = data.scannedData.total_amount;
        if (gemini.registration) data.registration = String(gemini.registration).trim();
        if (gemini.vehicle_registration_number && !data.registration) {
          data.registration = String(gemini.vehicle_registration_number).trim();
        }
        if (gemini.registration_number && !data.registration) {
          data.registration = String(gemini.registration_number).trim();
        }
        if (gemini.chassis_or_frame_no || gemini.chassisNumber) {
          data.chassisNumber = String(
            gemini.chassis_or_frame_no || gemini.chassisNumber,
          ).trim();
        }
        if (gemini.engine_number || gemini.engineNumber) {
          data.engineNumber = String(gemini.engine_number || gemini.engineNumber).trim();
        }
        if (gemini.serialNumber || gemini.serial_number || gemini.imei) {
          data.serialNumber = String(
            gemini.serialNumber || gemini.serial_number || gemini.imei,
          ).trim();
          data.imei = data.serialNumber;
        }
        if (gemini.category) data.geminiCategory = gemini.category;
        if (gemini.reminderText || gemini.whatsappReminderText) {
          data.reminderText = gemini.reminderText || gemini.whatsappReminderText;
          data.whatsappReminderText = data.reminderText;
        }

        // Structured extract snapshot for Firestore (always non-null strings)
        data.ocrExtract = {
          document_type: docType,
          asset_name: data.productName || '',
          category: gemini.category || '',
          vendor_dealer_name: data.shopName || '',
          owner_buyer_name: data.customerName || '',
          invoice_or_policy_no: data.invoiceNumber || '',
          purchase_or_issue_date: data.invoiceDate || '',
          total_amount: null,
          chassis_or_frame_no: data.chassisNumber || '',
          engine_number: data.engineNumber || '',
          vehicle_registration_number: data.registration || '',
          serial_number: data.serialNumber || '',
          expiry_date: '',
        };

        if (docType === DOC_CLASS.REGISTRATION_CERTIFICATE) {
          data.purchaseCategory = 'Vehicles';
          data.isVehicleInvoice = false;
          data.requiresVehicleLink = true;
          data.totalAmount = null;
          data.warrantyExpiry = null;
          data.ocrExtract.total_amount = null;
          data.ocrExtract.expiry_date = gemini.expiry_date || gemini.fitnessExpiryDate || '';
          if (gemini.fitnessExpiryDate) data.fitnessExpiryDate = gemini.fitnessExpiryDate;
        } else if (docType === DOC_CLASS.INSURANCE_POLICY) {
          data.purchaseCategory = 'Vehicles';
          data.requiresVehicleLink = true;
          data.warrantyExpiry = null;
          if (gemini.total_amount != null && Number(gemini.total_amount) > 0) {
            data.totalAmount = Number(gemini.total_amount);
          } else {
            data.totalAmount = null;
          }
          const expiry = String(gemini.expiry_date || gemini.insuranceExpiry || '').trim();
          if (expiry) data.insuranceExpiry = expiry;
          data.ocrExtract.total_amount = data.totalAmount;
          data.ocrExtract.expiry_date = data.insuranceExpiry || '';
          data.ocrExtract.category = 'Insurance';
          data.ocrExtract.vehicle_registration_number = data.registration || '';
          // Ensure review inputs hydrate even if productName empty
          if (!data.productName) {
            data.productName = data.shopName
              ? `${data.shopName} Policy`
              : 'Insurance Policy';
            data.ocrExtract.asset_name = data.productName;
          }
        } else if (docType === DOC_CLASS.PUC_CERTIFICATE) {
          data.purchaseCategory = 'Vehicles';
          data.requiresVehicleLink = true;
          data.totalAmount = null;
          data.warrantyExpiry = null;
          if (gemini.expiry_date || gemini.pucExpiry) {
            data.pucExpiry = gemini.expiry_date || gemini.pucExpiry;
          }
          data.ocrExtract.total_amount = null;
          data.ocrExtract.expiry_date = data.pucExpiry || '';
          data.ocrExtract.category = 'Vehicle';
          data.ocrExtract.vehicle_registration_number = data.registration || '';
        } else if (docType === DOC_CLASS.TAX_INVOICE) {
          const geminiTotal =
            gemini.total_amount != null ? Number(gemini.total_amount) : null;
          const parserTotal = Number(data.totalAmount) || 0;
          // NEVER prefer glued tax (183043) over parser Grand Total (23999)
          const resolved = preferPurchaseTotal(parserTotal, geminiTotal);
          if (resolved != null && resolved > 0) {
            data.totalAmount = resolved;
          }
          try {
            recordExtraction({
              parserTotal,
              geminiTotal,
              finalPrice: data.totalAmount,
              productName: data.productName,
              shopName: data.shopName,
              confidence: enhanced.confidence,
            });
          } catch {
            /* optional */
          }
          if (gemini.calculatedExpiryDate || gemini.expiry_date) {
            data.warrantyExpiry =
              data.warrantyExpiry ||
              gemini.calculatedExpiryDate ||
              gemini.expiry_date ||
              null;
          }
          if (gemini.warrantyMonths != null) {
            data.warrantyPeriodMonths = gemini.warrantyMonths;
          }
          if (gemini.starRating != null) data.starRating = gemini.starRating;
          if (gemini.estimatedMonthlyUnits != null) {
            data.estimatedMonthlyUnits = gemini.estimatedMonthlyUnits;
          }
          if (gemini.estimatedMonthlyBillCost != null) {
            data.estimatedMonthlyBillCost = gemini.estimatedMonthlyBillCost;
          }
          if (gemini.category === 'Vehicle' || /vehicle/i.test(String(gemini.category || ''))) {
            data.purchaseCategory = 'Vehicles';
            data.isVehicleInvoice = Boolean(data.chassisNumber || data.engineNumber);
          }
          data.ocrExtract.total_amount = data.totalAmount;
          data.ocrExtract.expiry_date = data.warrantyExpiry || gemini.expiry_date || '';
          data.ocrExtract.serial_number = data.serialNumber || '';
          if (energyHints && gemini.estimatedMonthlyUnits != null) {
            energyHints.estimatedMonthlyUnits = gemini.estimatedMonthlyUnits;
            energyHints.estimatedMonthlyBillCost = gemini.estimatedMonthlyBillCost;
          }
        } else {
          const geminiTotal =
            gemini.total_amount != null ? Number(gemini.total_amount) : null;
          const parserTotal = Number(data.totalAmount) || 0;
          const resolved = preferPurchaseTotal(parserTotal, geminiTotal);
          if (resolved != null && resolved > 0) {
            data.totalAmount = resolved;
          }
          if (gemini.expiry_date && !data.warrantyExpiry) {
            data.warrantyExpiry = gemini.expiry_date;
          }
          data.ocrExtract.total_amount = data.totalAmount;
          data.ocrExtract.expiry_date = gemini.expiry_date || '';
          data.ocrExtract.serial_number = data.serialNumber || '';
        }
      }
    } catch (err) {
      console.warn('[OCR] Gemini enhance skipped', err?.message || err);
    }

    try {
      const { mapFieldsForDocumentType } = require('./documentFieldMapper');
      mapFieldsForDocumentType(data, {
        documentKind: data.documentKind || data.documentType,
        vaultType: data.documentType,
        label: data.documentLabel,
      });
    } catch {
      /* optional */
    }

    try {
      if (isTaxIdentifierText(data.shopName) || isJunkVendorOrName(data.shopName)) {
        data.shopName = '';
      }
      const fc = scoreFieldConfidences(data);
      data.fieldConfidence = fc.fields;
      data.fieldConfidenceReasons = fc.reasons;
      data.lowConfidenceFields = fc.lowFields;
      if (fc.overall > 0 && (data.confidence == null || data.confidence <= 0)) {
        data.confidence = Math.round(fc.overall * 100);
      }
      if (fc.lowFields.includes('productName') || fc.lowFields.includes('price')) {
        data.needsManualReview = true;
      }
      recordFinalMapping({
        finalPrice: data.totalAmount,
        productName: data.productName,
        shopName: data.shopName,
        confidence: data.confidence,
        fieldConfidence: fc.fields,
        rawTextSample: rawText,
      });
    } catch {
      /* optional */
    }

    Haptics.success();
    return {
      success: true,
      data,
      sweetBill,
      confidence: data.confidence ?? parsed.confidence,
      needsManualReview: Boolean(data.needsManualReview),
      energyHints,
      gemini,
      rawText,
      engine: gemini ? `${engine}+gemini-1.5-flash` : engine,
      cloudError: engine === 'mlkit-fallback' ? cloudError : null,
    };
  }

  static async recognizeTextViaApiKey(imageUri, precomputedBase64 = null) {
    const base64 =
      precomputedBase64 ||
      (await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    return scanInvoiceImage(base64);
  }

  static async recognizeTextViaCloudFunction(imageUri, precomputedBase64 = null) {
    const base64 =
      precomputedBase64 ||
      (await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    const trimmed = base64.length > 4_500_000 ? base64.slice(0, 4_500_000) : base64;

    const user = auth().currentUser;
    const headers = { 'Content-Type': 'application/json' };
    if (user) {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(visionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: trimmed }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return {
          success: false,
          error: json?.error || `Cloud Vision HTTP ${res.status}`,
        };
      }
      return { success: true, text: String(json.text || '') };
    } finally {
      clearTimeout(timer);
    }
  }

  static async recognizeTextViaMlKit(imageUri) {
    try {
      // eslint-disable-next-line global-require
      const module = require('@react-native-ml-kit/text-recognition');
      const recognizer = module?.default || module;
      const result = await recognizer.recognize(imageUri);
      return { success: true, text: result?.text || '' };
    } catch (error) {
      const missingNative =
        /cannot find module|native module|null|undefined/i.test(String(error?.message || error));
      return {
        success: false,
        needsNative: missingNative,
        error: missingNative
          ? 'On-device OCR unavailable in this build.'
          : error?.message || 'ML Kit OCR failed',
      };
    }
  }
}

export default CloudVisionOcrService;
