/**
 * Cloud Vision OCR client — prefers direct Vision API key, then Cloud Function, then ML Kit.
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

  if (next.totalAmount == null || next.totalAmount <= 0) {
    if (next.subtotal != null && next.subtotal > 0) {
      const tax = next.taxAmount != null ? Number(next.taxAmount) : 0;
      next.totalAmount = Math.round((Number(next.subtotal) + tax) * 100) / 100;
    } else if (next.itemsSubtotal != null && next.itemsSubtotal > 0) {
      next.totalAmount = next.itemsSubtotal;
    }
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
  static async recognizeInvoice(imageUri) {
    Haptics.tap();
    if (!imageUri) {
      return {
        success: false,
        data: emptyInvoiceData(),
        sweetBill: parseBillData(''),
        error: 'No image provided',
      };
    }

    let rawText = '';
    let engine = 'none';
    let cloudError = null;

    try {
      const direct = await this.recognizeTextViaApiKey(imageUri);
      if (direct.success && direct.text) {
        rawText = direct.text;
        engine = 'cloud-vision-api-key';
      } else {
        cloudError = direct.error;
      }
    } catch (error) {
      cloudError = error?.message || 'Cloud Vision API key call failed';
    }

    if (!rawText) {
      try {
        const proxy = await this.recognizeTextViaCloudFunction(imageUri);
        if (proxy.success && proxy.text) {
          rawText = proxy.text;
          engine = 'cloud-vision-function';
          cloudError = null;
        } else if (!cloudError) {
          cloudError = proxy.error;
        }
      } catch (error) {
        if (!cloudError) cloudError = error?.message || 'Cloud Function OCR failed';
      }
    }

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

    const parsed = parseInvoiceText(rawText);
    const sweetBill = parseBillData(rawText);
    let data = mergeParsedFields(parsed.data, sweetBill);
    const energyHints = extractApplianceEnergyFromText(rawText);

    // Gemini 1.5 Flash — classify documentType first, then type-specific fields
    let gemini = null;
    try {
      const { extractAssetWithGemini, GEMINI_DOC_TYPES } = require('../gemini/geminiService');
      const enhanced = await extractAssetWithGemini(rawText, {
        serialHint: data.serialNumber || data.chassisNumber || data.registration || '',
        expectedDocumentType: data.documentType || data.documentKind || '',
      });
      if (enhanced.success && enhanced.data) {
        gemini = enhanced.data;
        const docType = gemini.documentType;
        const vaultType = gemini.vaultType || 'bill';

        // Always surface classification so Review / vault pick the right slot
        data.documentType = vaultType;
        data.documentKind = vaultType;
        data.geminiDocumentType = docType;
        data.scanDocumentType = vaultType;

        const modelName = [gemini.brand, gemini.model].filter(Boolean).join(' ').trim();
        if (modelName) data.productName = modelName;
        if (gemini.ownerName) data.customerName = gemini.ownerName;
        if (gemini.registration) data.registration = gemini.registration;
        if (gemini.chassisNumber) data.chassisNumber = gemini.chassisNumber;
        if (gemini.engineNumber) data.engineNumber = gemini.engineNumber;
        if (gemini.serialNumber) data.serialNumber = gemini.serialNumber;
        if (gemini.vehicleClass) data.vehicleClass = gemini.vehicleClass;
        if (gemini.category) data.geminiCategory = gemini.category;
        if (gemini.subCategory) data.geminiSubCategory = gemini.subCategory;
        if (gemini.reminderText || gemini.whatsappReminderText) {
          data.reminderText = gemini.reminderText || gemini.whatsappReminderText;
          data.whatsappReminderText = data.reminderText;
        }

        if (docType === GEMINI_DOC_TYPES.VEHICLE_RC) {
          data.purchaseCategory = 'Vehicles';
          data.isVehicleInvoice = false;
          data.requiresVehicleLink = true;
          data.totalAmount = null;
          data.warrantyExpiry = null;
          if (gemini.registrationDate) data.invoiceDate = gemini.registrationDate;
          if (gemini.fitnessExpiryDate) data.fitnessExpiryDate = gemini.fitnessExpiryDate;
          // RC must never look like a purchase bill
          data.starRating = null;
          data.estimatedMonthlyUnits = null;
          data.estimatedMonthlyBillCost = null;
        } else if (docType === GEMINI_DOC_TYPES.VEHICLE_INSURANCE) {
          data.purchaseCategory = 'Vehicles';
          data.requiresVehicleLink = true;
          data.totalAmount = null;
          data.warrantyExpiry = null;
          if (gemini.policyNumber || gemini.certificateNumber) {
            data.invoiceNumber = gemini.policyNumber || gemini.certificateNumber;
          }
          if (gemini.issueDate) data.invoiceDate = gemini.issueDate;
          if (gemini.insuranceExpiry) data.insuranceExpiry = gemini.insuranceExpiry;
        } else if (docType === GEMINI_DOC_TYPES.VEHICLE_PUC) {
          data.purchaseCategory = 'Vehicles';
          data.requiresVehicleLink = true;
          data.totalAmount = null;
          data.warrantyExpiry = null;
          if (gemini.certificateNumber) data.invoiceNumber = gemini.certificateNumber;
          if (gemini.issueDate) data.invoiceDate = gemini.issueDate;
          if (gemini.pucExpiry) data.pucExpiry = gemini.pucExpiry;
        } else if (docType === GEMINI_DOC_TYPES.PURCHASE_INVOICE) {
          if (gemini.invoiceDate && !data.invoiceDate) data.invoiceDate = gemini.invoiceDate;
          if (gemini.purchaseAmount != null && !(data.totalAmount > 0)) {
            data.totalAmount = gemini.purchaseAmount;
          }
          if (gemini.calculatedExpiryDate && !data.warrantyExpiry) {
            data.warrantyExpiry = gemini.calculatedExpiryDate;
          }
          if (gemini.starRating != null) data.starRating = gemini.starRating;
          if (gemini.estimatedMonthlyUnits != null) {
            data.estimatedMonthlyUnits = gemini.estimatedMonthlyUnits;
          }
          if (gemini.estimatedMonthlyBillCost != null) {
            data.estimatedMonthlyBillCost = gemini.estimatedMonthlyBillCost;
          }
          if (gemini.warrantyMonths != null) {
            data.warrantyPeriodMonths = gemini.warrantyMonths;
          }
          if (gemini.pucExpiry) data.pucExpiry = gemini.pucExpiry;
          if (gemini.insuranceExpiry) data.insuranceExpiry = gemini.insuranceExpiry;
          if (energyHints && gemini.estimatedMonthlyUnits != null) {
            energyHints.estimatedMonthlyUnits = gemini.estimatedMonthlyUnits;
            energyHints.estimatedMonthlyBillCost = gemini.estimatedMonthlyBillCost;
          }
        } else {
          // OTHER — only fill non-destructive fields
          if (gemini.invoiceDate && !data.invoiceDate) data.invoiceDate = gemini.invoiceDate;
          if (gemini.calculatedExpiryDate && !data.warrantyExpiry) {
            data.warrantyExpiry = gemini.calculatedExpiryDate;
          }
        }
      }
    } catch (err) {
      console.warn('[OCR] Gemini enhance skipped', err?.message || err);
    }

    Haptics.success();
    return {
      success: true,
      data,
      sweetBill,
      confidence: parsed.confidence,
      energyHints,
      gemini,
      rawText,
      engine: gemini ? `${engine}+gemini-1.5-flash` : engine,
      cloudError: engine === 'mlkit-fallback' ? cloudError : null,
    };
  }

  static async recognizeTextViaApiKey(imageUri) {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return scanInvoiceImage(base64);
  }

  static async recognizeTextViaCloudFunction(imageUri) {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
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
