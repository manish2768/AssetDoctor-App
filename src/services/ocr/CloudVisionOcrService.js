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
      });
      if (enhanced.success && enhanced.data) {
        gemini = enhanced.data;
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

        if (gemini.asset_name || gemini.assetName) {
          data.productName = String(gemini.asset_name || gemini.assetName).trim();
        }
        if (gemini.vendor_dealer_name || gemini.vendorDealerName || gemini.shopName) {
          data.shopName = String(
            gemini.vendor_dealer_name || gemini.vendorDealerName || gemini.shopName,
          ).trim();
        }
        if (gemini.owner_buyer_name || gemini.ownerName || gemini.customerName) {
          data.customerName = String(
            gemini.owner_buyer_name || gemini.ownerName || gemini.customerName,
          ).trim();
        }
        if (gemini.invoice_or_policy_no || gemini.invoiceNumber) {
          data.invoiceNumber = String(
            gemini.invoice_or_policy_no || gemini.invoiceNumber,
          ).trim();
        }
        if (gemini.purchase_or_issue_date || gemini.invoiceDate) {
          data.invoiceDate = String(
            gemini.purchase_or_issue_date || gemini.invoiceDate,
          ).trim();
        }
        if (gemini.registration) data.registration = String(gemini.registration).trim();
        if (gemini.vehicle_registration_number && !data.registration) {
          data.registration = String(gemini.vehicle_registration_number).trim();
        }
        if (gemini.chassis_or_frame_no || gemini.chassisNumber) {
          data.chassisNumber = String(
            gemini.chassis_or_frame_no || gemini.chassisNumber,
          ).trim();
        }
        if (gemini.engineNumber) data.engineNumber = String(gemini.engineNumber).trim();
        if (gemini.serialNumber) data.serialNumber = String(gemini.serialNumber).trim();
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
          vehicle_registration_number: data.registration || '',
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
          if (gemini.total_amount != null && !(data.totalAmount > 0)) {
            data.totalAmount = Number(gemini.total_amount);
          }
          if (gemini.calculatedExpiryDate && !data.warrantyExpiry) {
            data.warrantyExpiry = gemini.calculatedExpiryDate;
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
          if (energyHints && gemini.estimatedMonthlyUnits != null) {
            energyHints.estimatedMonthlyUnits = gemini.estimatedMonthlyUnits;
            energyHints.estimatedMonthlyBillCost = gemini.estimatedMonthlyBillCost;
          }
        } else {
          if (gemini.total_amount != null && !(data.totalAmount > 0)) {
            data.totalAmount = Number(gemini.total_amount);
          }
          if (gemini.expiry_date && !data.warrantyExpiry) {
            data.warrantyExpiry = gemini.expiry_date;
          }
          data.ocrExtract.total_amount = data.totalAmount;
          data.ocrExtract.expiry_date = gemini.expiry_date || '';
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
