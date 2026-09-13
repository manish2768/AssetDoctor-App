/**
 * Compact invoice review — live Bill Check + blank-safe field mapping.
 * Never invents registration / IMEI / serial — empty until OCR or user fills.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { GlassButton, GlassCard, GlassInput, Screen } from '../components/ui/Glass';
import { Haptics } from '../services/haptics';
import { useAssets } from '../context/AssetProvider';
import { useAuth } from '../context/AuthProvider';
import { invoiceToAssetForm, PURCHASE_CATEGORIES } from '../services/ocr/invoiceSchema';
import { mapScanToExistingAsset, buildServiceHistoryEntry } from '../services/ocr/SmartAssetMapper';
import {
  buildCategoryMetadata,
  SMART_CATEGORIES,
  classifySmartCategory,
  enrichItemWithCategory,
} from '../services/ocr/categoryClassifier';
import { assignEnergyFieldsOnCreate } from '../services/energy/EnergyService';
import {
  runSweetBillChecker,
  rememberInvoiceFingerprint,
  forgetInvoiceFingerprint,
} from '../services/SweetBillChecker';
import { rememberBillFingerprint } from '../utils/billParser';
import { ItemDetailCard } from '../components/ItemDetailCard';
import { InvoicePostcard } from '../components/InvoicePostcard';
import { ShareAssetModal } from '../components/ShareAssetModal';
import { pickPrimaryItem } from '../utils/billLineItems';
import { InvoiceOfflineCache } from '../services/ocr/InvoiceOfflineCache';
import { goHomeDashboard, openRescanInvoice } from '../navigation/navActions';
import { markScanSession, clearScanSession } from '../utils/scanNavGuard';
import { formatINRExact } from '../utils/format';
import { ASSET_CATEGORY_OPTIONS } from '../theme/branding';
import {
  isVehicleAttachDocument,
  listVehicleAssets,
  findAssetByChassis,
} from '../utils/vehicleFolder';
import { VehicleLinkingEngine } from '../services/vehicles/VehicleLinkingEngine';
import { DuplicateProtectionService } from '../services/duplicateProtectionService';
import { matchVehicleForDocument } from '../services/vehicles/VehicleMatchService';
import { getExpiryTone } from '../utils/warrantyStatus';
import { formatDateIN } from '../utils/dates';
import { resolveCanonicalWarrantyExpiry } from '../utils/warrantyDates';
import {
  DOC_CLASS,
  DOC_TYPE_LABELS,
  normalizeDocumentType,
} from '../services/gemini/geminiService';
import { familyFromDocumentType } from '../../services/ocr/reviewSchema';
import { makeMicroThumbnail } from '../utils/makeMicroThumbnail';
import { useUiFeedback } from '../context/UiFeedbackProvider';
import { DocumentIntelligencePanel } from '../components/trust/DocumentIntelligencePanel';
import { applyDocumentIntelligence } from '../../services/intelligence/documentLearning/index.ts';
import { captureReviewLearning } from '../services/intelligence/documentLearningClient';
import { canSaveExtractedInvoice } from '../services/ocr/finalSaveGate';

/** Top-level review buckets requested for confirm UI */
const REVIEW_CATEGORY_CHIPS = [
  { id: SMART_CATEGORIES.VEHICLES, label: 'Vehicle' },
  { id: SMART_CATEGORIES.GADGETS, label: 'Gadget' },
  { id: SMART_CATEGORIES.HOME_APPLIANCES, label: 'Home' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Section({ title, open, onToggle, children }) {
  return (
    <GlassCard style={styles.section}>
      <Pressable
        onPress={() => {
          Haptics.select();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle();
        }}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </GlassCard>
  );
}

function getStatusColor(status) {
  switch (status) {
    case 'VERIFIED':
    case 'USER_VERIFIED':
      return COLORS.emerald || '#10B981';
    case 'HIGH_CONFIDENCE':
      return COLORS.neonBlue || '#3B82F6';
    case 'NEEDS_REVIEW':
    case 'CONFLICT':
      return COLORS.amber || '#F59E0B';
    case 'NOT_FOUND':
    default:
      return COLORS.muted || '#6B7280';
  }
}

function FieldLearningHint({ review, currentValue, onUseCandidate }) {
  if (!review) return null;
  const needs =
    review.needsReview ||
    review.validationState === 'INVALID' ||
    review.validationState === 'SUSPICIOUS';
  if (!needs) return null;
  const candidateVal = review.topCandidate?.value;
  const showCandidate =
    candidateVal != null &&
    String(candidateVal).trim() !== '' &&
    String(candidateVal) !== String(currentValue ?? '');
  return (
    <View style={styles.learnHint}>
      <Text style={styles.learnHintTitle}>Needs Review</Text>
      {review.reason ? <Text style={styles.learnHintText}>{review.reason}</Text> : null}
      {showCandidate ? (
        <>
          <Text style={styles.learnHintText}>Possible candidate: {String(candidateVal)}</Text>
          <View style={styles.learnHintRow}>
            <Pressable onPress={() => onUseCandidate(candidateVal)} style={styles.learnBtn}>
              <Text style={styles.learnBtnText}>Use Candidate</Text>
            </Pressable>
            <View style={styles.learnBtnGhost}>
              <Text style={styles.learnBtnGhostText}>Edit</Text>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }) {
  let label = '— Not found';
  let badgeStyle = styles.badgeNotFound;
  let textStyle = styles.badgeTextNotFound;

  if (status === 'VERIFIED' || status === 'USER_VERIFIED') {
    label = '✓ Verified';
    badgeStyle = styles.badgeVerified;
    textStyle = styles.badgeTextVerified;
  } else if (status === 'HIGH_CONFIDENCE') {
    label = '✓ Auto-filled';
    badgeStyle = styles.badgeVerified;
    textStyle = styles.badgeTextVerified;
  } else if (status === 'CONFLICT') {
    label = '⚠ Conflict';
    badgeStyle = styles.badgeConflict;
    textStyle = styles.badgeTextConflict;
  } else if (status === 'NEEDS_REVIEW' || status === 'NEEDS_VERIFICATION') {
    label = '⚠ Review';
    badgeStyle = styles.badgeReview;
    textStyle = styles.badgeTextReview;
  }

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusBadgeText, textStyle]}>{label}</Text>
    </View>
  );
}

function AuditPill({ ok, label }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillWarn]}>
      <Text style={[styles.pillText, ok ? styles.pillTextOk : styles.pillTextWarn]}>{label}</Text>
    </View>
  );
}

function formatMoney(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function parseMoneyInput(text) {
  const t = String(text || '').trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function blank(value) {
  return value == null ? '' : String(value);
}

/** Defensive route params — never crash if navigation payload is missing/partial. */
function readSafeReviewParams(route) {
  try {
    const params = route?.params && typeof route.params === 'object' ? route.params : {};
    const invoiceCandidate =
      (params.assetData && typeof params.assetData === 'object' ? params.assetData : null) ||
      (params.parsedData && typeof params.parsedData === 'object' ? params.parsedData : null) ||
      (params.invoice && typeof params.invoice === 'object' ? params.invoice : null) ||
      (params.extractedData && typeof params.extractedData === 'object'
        ? params.extractedData
        : null) ||
      {};
    return {
      imageUri: typeof params.imageUri === 'string' ? params.imageUri : '',
      scanId: typeof params.scanId === 'string' ? params.scanId : '',
      engine: typeof params.engine === 'string' ? params.engine : '',
      invoice: invoiceCandidate,
      assetData: invoiceCandidate,
      parsedData: invoiceCandidate,
      extractedData:
        params.extractedData && typeof params.extractedData === 'object'
          ? params.extractedData
          : invoiceCandidate,
      audit: params.audit && typeof params.audit === 'object' ? params.audit : null,
      energyHints:
        params.energyHints && typeof params.energyHints === 'object' ? params.energyHints : {},
      sweetBill:
        params.sweetBill && typeof params.sweetBill === 'object' ? params.sweetBill : {},
      ocrFailed: Boolean(
        (params.ocrFailed || params.hasOcrError) &&
          !invoiceCandidate.productName &&
          !invoiceCandidate.assetName &&
          invoiceCandidate.totalAmount == null &&
          !invoiceCandidate.shopName &&
          !invoiceCandidate.vendor &&
          !invoiceCandidate.invoiceNumber &&
          !(invoiceCandidate.rawOcrText && invoiceCandidate.rawOcrText.length >= 25) &&
          !(invoiceCandidate.rawText && invoiceCandidate.rawText.length >= 25) &&
          !invoiceCandidate.isDocumentReadable,
      ),
      hasOcrError: Boolean(params.hasOcrError && !invoiceCandidate.productName && invoiceCandidate.totalAmount == null),
      needsManualReview: Boolean(params.audit?.manualEntry || invoiceCandidate.needsManualReview),
    };

    const populatedReviewFields = [
      invoiceCandidate.productName,
      invoiceCandidate.shopName,
      invoiceCandidate.totalAmount,
      invoiceCandidate.invoiceNumber,
      invoiceCandidate.invoiceDate,
    ].filter((v) => v != null && v !== '').length;

    console.log(
      `[OCR_TRACE_10_REVIEW] screen=ReviewAsset populatedCount=${populatedReviewFields} productName=${invoiceCandidate.productName || 'none'} totalAmount=${invoiceCandidate.totalAmount ?? 'none'} ocrFailed=${Boolean(params.ocrFailed || params.hasOcrError)}`,
    );

    return result;
  } catch (error) {
    console.error('[ReviewAssetScreen Error]:', error);
    return {
      imageUri: '',
      scanId: '',
      engine: '',
      invoice: {},
      assetData: {},
      parsedData: {},
      extractedData: {},
      audit: null,
      energyHints: {},
      sweetBill: {},
      ocrFailed: true,
      hasOcrError: true,
      needsManualReview: true,
    };
  }
}

export function ReviewAssetScreen({ navigation, route }) {
  const ui = useUiFeedback();
  const { createAsset, assets } = useAssets();
  const { user } = useAuth();
  const safeParams = useMemo(() => readSafeReviewParams(route), [route]);
  const initialInvoice = safeParams.assetData || safeParams.invoice || safeParams.parsedData || {};
  const initialAudit = safeParams.audit || null;
  const imageUri = safeParams.imageUri || '';
  const scanId = safeParams.scanId || '';
  const energyHints = safeParams.energyHints || {};
  const ocrFailed = Boolean(safeParams.ocrFailed || safeParams.hasOcrError);

  const items = Array.isArray(initialInvoice?.items) ? initialInvoice.items : [];
  const defaultSelected = pickPrimaryItem(items)?.index || items[0]?.index || 1;

  // Fail-safe redirect: If an insurance policy reaches ReviewAsset, immediately forward to ReviewInsurance
  useEffect(() => {
    const docType = String(
      initialInvoice?.documentType ||
      initialInvoice?.classifiedDocumentType ||
      route?.params?.documentType ||
      route?.params?.classifiedDocumentType ||
      ''
    ).toUpperCase();

    const isInsurance =
      docType === 'VEHICLE_INSURANCE' ||
      docType === 'INSURANCE' ||
      Boolean(initialInvoice?.policyNumber && (initialInvoice?.insurerName || initialInvoice?.premiumAmount || initialInvoice?.idv));

    if (isInsurance) {
      console.warn('[ReviewAsset] Insurance document redirected from ReviewAsset to ReviewInsurance');
      navigation.replace('ReviewInsurance', route?.params || {});
    }
  }, []);

  const [invoice, setInvoice] = useState(() => {
    try {
      return sanitizeInvoice(initialInvoice);
    } catch (error) {
      console.error('[ReviewAssetScreen Error]:', error);
      return sanitizeInvoice({});
    }
  });
  const originalSnapshotRef = useRef(null);
  const [audit, setAudit] = useState(initialAudit);
  const [saving, setSaving] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(defaultSelected);
  const [saveAllItems, setSaveAllItems] = useState(false);
  const [openCheck, setOpenCheck] = useState(true);
  const [openItems, setOpenItems] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const [linkAssetId, setLinkAssetId] = useState(null);
  const [smartMapHint, setSmartMapHint] = useState(null);
  // Smart auto-map: registration / IMEI / serial / nickname → existing vault asset
  useEffect(() => {
    try {
      if (!invoice || linkAssetId || invoice.needsManualReview) return;
      const mapped = mapScanToExistingAsset(
        {
          ...invoice,
          assetName: invoice.productName,
          registration: invoice.registration,
          imei: invoice.imei,
          serialNumber: invoice.serialNumber,
        },
        assets,
      );
      if (
        mapped?.asset &&
        invoice.assetMatch?.isAutoLinked === true &&
        (mapped.match?.confidence || 0) >= 0.88
      ) {
        const id = mapped.asset.assetId || mapped.asset.id;
        if (id) {
          setLinkAssetId(id);
          setSmartMapHint(mapped.reason || 'Linked to existing asset');
        }
      } else {
        setSmartMapHint(mapped?.reason || null);
      }
    } catch (e) {
      console.warn('[Review] smart map failed:', e?.message || e);
    }
  }, [
    invoice?.registration,
    invoice?.imei,
    invoice?.serialNumber,
    invoice?.productName,
    invoice?.needsManualReview,
    invoice?.assetMatch?.isAutoLinked,
    assets,
    linkAssetId,
  ]);

  const [shareCard, setShareCard] = useState(null);
  const [saveToVaultCopy, setSaveToVaultCopy] = useState(false);
  const auditTimer = useRef(null);
  const manualToastShown = useRef(false);
  const originalReady = useRef(false);

  // Persist review session in scanNavGuard to survive Activity kill
  useEffect(() => {
    markScanSession('ReviewAsset', {
      scanSessionId: scanId || route?.params?.scanSessionId || `scan_${Date.now()}`,
      documentType:
        route?.params?.documentType ||
        route?.params?.classifiedDocumentType ||
        invoice?.classifiedDocumentType ||
        'VEHICLE_PURCHASE_INVOICE',
      reviewRoute: 'ReviewAsset',
      imageUri,
      assetData: invoice,
      invoice,
      audit,
      engine: safeParams.engine,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (originalReady.current) return;
    originalReady.current = true;
    originalSnapshotRef.current = { ...invoice };
    if (invoice?.fieldIntelligence) return;
    try {
      const intel = applyDocumentIntelligence({
        documentType:
          invoice.documentTypeV2 ||
          invoice.document_type ||
          invoice.classifiedDocumentType ||
          invoice.documentKind,
        fields: invoice,
        rawText: invoice.rawText || invoice.ocrText || '',
        applyOverrides: false,
      });
      setInvoice((prev) => ({
        ...prev,
        fieldIntelligence: intel.fieldReviews,
        learningReviewReasons: intel.reviewReasons,
      }));
    } catch {
      /* optional */
    }
  }, [invoice]);

  const rehydrateMountRef = useRef(true);
  useEffect(() => {
    if (rehydrateMountRef.current) {
      rehydrateMountRef.current = false;
      return;
    }
    try {
      const scanned =
        route?.params?.scannedData ||
        route?.params?.parsedData ||
        route?.params?.assetData ||
        route?.params?.invoice ||
        null;
      if (!scanned) return;
      setInvoice(
        sanitizeInvoice({
          ...initialInvoice,
          scannedData: scanned,
          parsedData: scanned,
        }),
      );
      setAudit(initialAudit);
    } catch (error) {
      console.error('[ReviewAssetScreen Error]:', error);
    }
  }, [route?.params]);

  // Toast once when OCR could not auto-fill — stay on Review, never Home
  useEffect(() => {
    if (!ocrFailed || manualToastShown.current) return undefined;
    manualToastShown.current = true;
    const t = setTimeout(() => {
      ui.info('Manual entry', 'Please enter details manually');
    }, 400);
    return () => clearTimeout(t);
  }, [ocrFailed, ui]);

  const docKind = String(
    invoice.documentKind || invoice.documentType || invoice.scanDocumentType || 'bill',
  ).toLowerCase();
  const reviewFamily = familyFromDocumentType(
    invoice.classifiedDocumentType ||
      invoice.classification?.documentType ||
      invoice.geminiDocumentType ||
      invoice.documentKind ||
      invoice.documentType ||
      '',
    { imei: invoice.imei, productName: invoice.productName },
  );
  const isElectronics = reviewFamily === 'electronics';
  const isAppliance = reviewFamily === 'appliance';
  const isGenericPurchase = reviewFamily === 'generic' || reviewFamily === 'warranty';
  const isInsurance =
    reviewFamily === 'insurance' ||
    String(invoice.documentType || '').toUpperCase() === 'INSURANCE' ||
    docKind.includes('insurance');
  const isPuc =
    reviewFamily === 'puc' ||
    String(invoice.documentType || '').toUpperCase() === 'PUC' ||
    docKind.includes('puc');
  const isRc = reviewFamily === 'rc';
  const itemList = (isInsurance || isPuc || isRc)
    ? []
    : Array.isArray(invoice.items) ? invoice.items : [];
  const itemCount = (isInsurance || isPuc || isRc)
    ? 0
    : Number(invoice.itemCount) || itemList.length;
  const isVehicleService =
    reviewFamily === 'service' ||
    String(invoice.documentType || '').toUpperCase() === 'VEHICLE_SERVICE' ||
    docKind.includes('service');
  const isService = isVehicleService;
  const isVehiclePurchase = reviewFamily === 'vehicle_purchase';
  const isAttachDoc =
    isInsurance ||
    isPuc ||
    isVehicleService ||
    isRc ||
    isVehicleAttachDocument(docKind) ||
    Boolean(invoice.requiresVehicleLink && !isElectronics && !isAppliance);
  const totalOk =
    isAttachDoc ||
    (invoice.totalAmount != null &&
      Number.isFinite(Number(invoice.totalAmount)) &&
      Number(invoice.totalAmount) > 0);
  const showVehicleReg =
    !isElectronics &&
    !isAppliance &&
    !isGenericPurchase &&
    (isService ||
      isVehiclePurchase ||
      isAttachDoc ||
      isInsurance ||
      isPuc ||
      isRc);
  const vehicleOptions = useMemo(() => listVehicleAssets(assets), [assets]);

  const vehicleLinkResolution = useMemo(() => {
    if (!isAttachDoc && !isInsurance && !isPuc && !isVehicleService) return null;
    return VehicleLinkingEngine.resolveVehicleLink(
      {
        registrationNumber: invoice.vehicleRegistrationNumber || invoice.registration,
        chassisNumber: invoice.chassisNumber,
        engineNumber: invoice.engineNumber,
        vehicleMake: invoice.vehicleMake || invoice.brand,
        vehicleModel: invoice.vehicleModel || invoice.model,
        ownerName: invoice.customerName,
      },
      assets || [],
    );
  }, [isAttachDoc, isInsurance, isPuc, isVehicleService, invoice, assets]);

  useEffect(() => {
    if (!isAttachDoc) return;
    if (linkAssetId) return;
    if (vehicleLinkResolution?.matchedVehicle) {
      const v = vehicleLinkResolution.matchedVehicle;
      const vId = v.assetId || v.id;
      if (vId) setLinkAssetId(vId);
      return;
    }
    const match = matchVehicleForDocument(assets, invoice);
    if (match.matched) {
      setLinkAssetId(match.matched.assetId || match.matched.id || null);
    }
  }, [assets, invoice, isAttachDoc, linkAssetId, vehicleLinkResolution]);
  const insuranceTone = getExpiryTone(invoice.insuranceExpiry, { urgentDays: 30 });
  const pucTone = getExpiryTone(invoice.pucExpiry, { urgentDays: 15 });
  const classifiedType = normalizeDocumentType(
    invoice.classifiedDocumentType ||
      invoice.geminiDocumentType ||
      invoice.ocrExtract?.document_type ||
      (isAttachDoc && docKind === 'insurance'
        ? DOC_CLASS.INSURANCE_POLICY
        : isAttachDoc && docKind === 'rc'
          ? DOC_CLASS.REGISTRATION_CERTIFICATE
          : isAttachDoc && docKind === 'puc'
            ? DOC_CLASS.PUC_CERTIFICATE
            : DOC_CLASS.TAX_INVOICE),
  );
  const documentTypeBadge =
    {
      electronics: 'Electronics Purchase Invoice',
      appliance: 'Appliance Purchase Invoice',
      service: 'Service Invoice',
      vehicle_purchase: 'Vehicle Purchase Invoice',
      insurance: 'Insurance Policy',
      puc: 'PUC Certificate',
      rc: 'Registration Certificate',
      warranty: 'Warranty Document',
      generic: invoice.documentLabel || 'Purchase Document',
    }[reviewFamily] ||
    DOC_TYPE_LABELS[classifiedType] ||
    invoice.documentLabel ||
    'Document';

  const setItemCategory = (itemIndex, smartCategory) => {
    setInvoice((prev) => {
      const list = Array.isArray(prev.items) ? [...prev.items] : [];
      const idx = list.findIndex((i) => i.index === itemIndex);
      if (idx < 0) return prev;
      const current = list[idx];
      const meta = buildCategoryMetadata(smartCategory, current.name || '');
      list[idx] = { ...current, ...meta, smartCategory };
      const next = { ...prev, items: list, itemCount: list.length };
      // Keep invoice-level purchaseCategory in sync with selected / primary item
      if (itemIndex === selectedItemIndex || list.length === 1) {
        if (smartCategory === SMART_CATEGORIES.VEHICLES) {
          next.purchaseCategory = PURCHASE_CATEGORIES.VEHICLES;
        } else if (
          smartCategory === SMART_CATEGORIES.GADGETS ||
          smartCategory === SMART_CATEGORIES.HOME_APPLIANCES ||
          smartCategory === SMART_CATEGORIES.ACCESSORIES
        ) {
          next.purchaseCategory = PURCHASE_CATEGORIES.ELECTRONICS;
        }
        next.smartCategory = smartCategory;
      }
      return next;
    });
  };

  const setReviewCategory = (smartCategory) => {
    Haptics.select();
    setInvoice((prev) => {
      const meta = buildCategoryMetadata(smartCategory, prev.productName || '');
      const list = Array.isArray(prev.items)
        ? prev.items.map((item) =>
            item.index === selectedItemIndex || prev.items.length === 1
              ? { ...item, ...meta, smartCategory }
              : item,
          )
        : [];
      return {
        ...prev,
        items: list,
        itemCount: list.length,
        smartCategory,
        purchaseCategory:
          smartCategory === SMART_CATEGORIES.VEHICLES
            ? PURCHASE_CATEGORIES.VEHICLES
            : PURCHASE_CATEGORIES.ELECTRONICS,
        isVehicleInvoice: smartCategory === SMART_CATEGORIES.VEHICLES,
      };
    });
  };

  const activeReviewCategory =
    invoice.smartCategory ||
    (showVehicleReg ? SMART_CATEGORIES.VEHICLES : null) ||
    itemList.find((i) => i.index === selectedItemIndex)?.smartCategory ||
    SMART_CATEGORIES.OTHER;

  // Live Bill Check whenever edited invoice changes
  useEffect(() => {
    if (auditTimer.current) clearTimeout(auditTimer.current);
    auditTimer.current = setTimeout(() => {
      runSweetBillChecker(invoice)
        .then((next) => setAudit(next))
        .catch(() => {});
    }, 280);
    return () => {
      if (auditTimer.current) clearTimeout(auditTimer.current);
    };
  }, [invoice]);

  const patch = (key, value) => {
    setInvoice((prev) => {
      const next = { ...prev, [key]: value };
      const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
      next.userConfirmedFields = {
        ...(prev.userConfirmedFields || {}),
        [key]: hasValue,
      };
      next.fieldStatuses = {
        ...(prev.fieldStatuses || {}),
        [key]: hasValue ? 'USER_VERIFIED' : 'NOT_FOUND',
      };
      next.fieldCorrections = {
        ...(prev.fieldCorrections || {}),
        [key]: hasValue
          ? {
              value,
              verificationStatus: 'USER_VERIFIED',
              evidenceType: 'user_verified',
              sourceText: null,
              sourceBoundingBox: null,
              page: null,
            }
          : null,
      };
      next.ocrEvidence = {
        ...(prev.ocrEvidence || {}),
        [key]: prev.fieldEvidence?.[key] || null,
      };
      next.fieldEvidence = {
        ...(prev.fieldEvidence || {}),
        [key]: {
          field: key,
          value: hasValue ? value : null,
          confidence: hasValue ? 1 : 0,
          sourceText: null,
          sourceBoundingBox: null,
          page: null,
          evidenceType: hasValue ? 'user_verified' : 'none',
          validationStatus: hasValue ? 'USER_VERIFIED' : 'NOT_FOUND',
          validationResult: hasValue ? 'PASS' : 'UNVALIDATED',
        },
      };
      if (key === 'items') {
        next.itemCount = Array.isArray(value) ? value.length : 0;
      }
      return next;
    });
  };

  const refreshAudit = async (nextInvoice) => {
    const next = await runSweetBillChecker(nextInvoice);
    setAudit(next);
    return next;
  };

  const buildPayloadForItem = (item, latestAudit) => {
    const forcedVehicle =
      !isElectronics &&
      !isAppliance &&
      (showVehicleReg ||
        Boolean(invoice.isVehicleInvoice) ||
        isAttachDoc ||
        invoice.purchaseCategory === PURCHASE_CATEGORIES.VEHICLES);
    const smartCategory = forcedVehicle
      ? SMART_CATEGORIES.VEHICLES
      : item.smartCategory || invoice.smartCategory || SMART_CATEGORIES.OTHER;
    const meta = buildCategoryMetadata(smartCategory, item.name || invoice.productName || '');
    const form = invoiceToAssetForm(
      {
        ...invoice,
        smartCategory,
        purchaseCategory: forcedVehicle
          ? PURCHASE_CATEGORIES.VEHICLES
          : invoice.purchaseCategory,
        documentType: isAttachDoc ? docKind : invoice.documentType,
        documentKind: isAttachDoc ? docKind : invoice.documentKind,
      },
      { audit: latestAudit, item: { ...item, ...meta } },
    );
    const categoryId = forcedVehicle
      ? meta.categoryId === 'other'
        ? 'bike'
        : meta.categoryId || form.categoryId || 'bike'
      : item.categoryId || meta.categoryId || form.categoryId;
    const cat = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
    const energy = assignEnergyFieldsOnCreate({
      ...form,
      categoryId,
      smartCategory,
      assetName: item.name || invoice.productName,
    });
    const trackVehicle = true && (meta.trackPucService || showVehicleReg || forcedVehicle);
    const resolvedDocType = isAttachDoc
      ? docKind
      : String(form.scanDocumentType || docKind || 'bill').toLowerCase();
    // Canonical warranty expiry = warranty duration + purchase date, recomputed
    // on save so edits to Warranty (Months) / Invoice Date are reflected in the
    // final vault payload. Never guesses when the purchase date is missing.
    const warrantyExpiry =
      resolvedDocType === 'insurance' || resolvedDocType === 'puc'
        ? null
        : resolveCanonicalWarrantyExpiry({
            ...invoice,
            warrantyExpiry: form.warrantyExpiry,
            invoiceMeta: form.invoiceMeta || invoice.invoiceMeta,
          });

    return {
      ...form,
      ...energy,
      categoryId,
      category: cat?.group || form.category || (forcedVehicle ? 'Vehicles' : 'Electronics'),
      categoryLabel: cat?.label || form.categoryLabel || (forcedVehicle ? 'Two Wheeler' : 'Gadget'),
      icon: cat?.icon || form.icon,
      smartCategory,
      trackImei: meta.trackImei,
      trackPucService: meta.trackPucService || trackVehicle,
      seasonalServiceAlerts: meta.seasonalServiceAlerts,
      registration: trackVehicle
        ? String(invoice.registration || '').trim()
        : '',
      serialNumber: String(invoice.serialNumber || item.serialNumber || '').trim(),
      imei: (() => {
        const digits = String(invoice.imei || item.imei || '').replace(/\D/g, '');
        return digits.length === 15 ? digits : '';
      })(),
      chassisNumber: trackVehicle
        ? (() => {
            const ch = String(invoice.chassisNumber || '').trim();
            return /^(?:no|n\/a|na|nil)$/i.test(ch) || ch.length < 8 ? '' : ch;
          })()
        : '',
      engineNumber: trackVehicle
        ? (() => {
            const en = String(invoice.engineNumber || '').trim();
            return /^(?:no|n\/a|na|nil)$/i.test(en) || en.length < 8 ? '' : en;
          })()
        : '',
      pucExpiry: invoice.pucExpiry || null,
      insuranceExpiry: invoice.insuranceExpiry || null,
      warrantyExpiry,
      nextServiceDue:
        trackVehicle || meta.seasonalServiceAlerts ? invoice.nextServiceDue || null : null,
      odometerKm: trackVehicle && invoice.odometerKm != null ? Number(invoice.odometerKm) : null,
      nextServiceOdometerKm:
        trackVehicle && invoice.nextServiceOdometerKm != null
          ? Number(invoice.nextServiceOdometerKm)
          : null,
      scanDocumentType: resolvedDocType === 'vehicle_invoice' ? 'bill' : resolvedDocType || 'bill',
      requiresVehicleLink: isAttachDoc,
      linkAssetId: linkAssetId || null,
      assetName:
        isAttachDoc && linked?.assetName
          ? linked.assetName
          : form.assetName || item.name || invoice.productName || '',
      value: isAttachDoc ? 0 : form.value,
    };
  };

  const promptVehicleLink = async (vehicles) => {
    if (!vehicles?.length) {
      ui.info(
        'Vehicle Required',
        'Please save your vehicle invoice first, then scan Insurance / PUC / RC.',
      );
      return null;
    }
    ui.info(
      'Link to Vehicle',
      'Insurance and PUC attach to your existing vehicle — please select your vehicle from the list above.',
    );
    return null;
  };

  const findExistingForUpdate = () => {
    const byChassis = findAssetByChassis(assets, invoice.chassisNumber);
    if (byChassis) return byChassis;
    const invNo = String(invoice.invoiceNumber || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();
    if (!invNo) return null;
    return (
      assets.find((a) => {
        const metaInv = String(a.invoiceMeta?.invoiceNumber || '')
          .toUpperCase()
          .replace(/\s+/g, '')
          .trim();
        return metaInv && metaInv === invNo;
      }) || null
    );
  };

  const persistSave = async (latestAudit, { allowDuplicate = false } = {}) => {
    setSaving(true);
    try {
      if (allowDuplicate && latestAudit.fingerprint) {
        await forgetInvoiceFingerprint(latestAudit.fingerprint);
      }

      let durableImageUri = null;
      let billThumbDataUrl = null;
      // OCR path: micro-thumb only — never upload full-res scan to Storage
      // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION (was: imageUri && user?.uid)
      if (imageUri) {
        try {
          const thumb = await makeMicroThumbnail(imageUri);
          billThumbDataUrl = thumb?.dataUrl || null;
        } catch {
          billThumbDataUrl = null;
        }
      }

      let chosenLink = linkAssetId;
      const existingMatch = findExistingForUpdate();
      if (!chosenLink && existingMatch && !isAttachDoc) {
        // Same invoice / chassis already in vault — merge fields into that passport
        chosenLink = existingMatch.assetId || existingMatch.id;
        setLinkAssetId(chosenLink);
      }

      if (isAttachDoc && !chosenLink) {
        chosenLink = await promptVehicleLink(vehicleOptions);
        if (!chosenLink && vehicleOptions.length) {
          setSaving(false);
          return;
        }
        if (chosenLink) setLinkAssetId(chosenLink);
      }

      const selected =
        itemList.find((i) => i.index === selectedItemIndex) || pickPrimaryItem(itemList);
      const finalTargets =
        !isAttachDoc && saveAllItems && itemList.length > 1
          ? itemList.filter((item) => !(item.isFee && Number(item.amount) <= 0))
          : [
              pickPrimaryItem(itemList) ||
                selected || {
                  index: 1,
                  name: invoice.productName,
                  qty: 1,
                  rate: invoice.totalAmount,
                  amount: invoice.totalAmount,
                },
            ];

      let lastId = null;
      for (const item of finalTargets) {
        const payload = {
          ...buildPayloadForItem(
            { ...item, name: item.name || invoice.productName },
            latestAudit,
          ),
          ocrDataOnly: true,
          skipBillUpload: true,
          billThumbDataUrl,
          ocrExtract: invoice.ocrExtract || {
            document_type: classifiedType,
            asset_name: invoice.productName || item.name || '',
            category: invoice.geminiCategory || '',
            vendor_dealer_name: invoice.shopName || '',
            owner_buyer_name: invoice.customerName || '',
            invoice_or_policy_no: invoice.invoiceNumber || '',
            purchase_or_issue_date: invoice.invoiceDate || '',
            total_amount: invoice.totalAmount ?? null,
            chassis_or_frame_no: invoice.chassisNumber || '',
            expiry_date: invoice.insuranceExpiry || invoice.warrantyExpiry || '',
          },
          classifiedDocumentType: classifiedType,
          geminiDocumentType: classifiedType,
          ocrVerified: false,
          trustState: canSaveExtractedInvoice(invoice).allowed ? 'CONFIRMED' : 'NEEDS_REVIEW',
        };
        // Force merge into known vehicle when re-saving same invoice
        if (chosenLink && !isAttachDoc) {
          payload.linkAssetId = chosenLink;
        }
        if (chosenLink && isAttachDoc) {
          payload.linkAssetId = chosenLink;
        }
        const result = await createAsset(payload, saveToVaultCopy ? durableImageUri : null);
        if (result?.needsVehicleLink) {
          const picked = await promptVehicleLink(result.vehicles || vehicleOptions);
          if (!picked) throw new Error(result.error || 'Vehicle link required');
          setLinkAssetId(picked);
          const retry = await createAsset(
            {
              ...payload,
              linkAssetId: picked,
              registration:
                payload.registration ||
                vehicleOptions.find((a) => (a.assetId || a.id) === picked)?.registration ||
                '',
            },
            saveToVaultCopy ? durableImageUri : null,
          );
          if (!retry?.success) throw new Error(retry?.error || 'Could not attach document');
          lastId = retry.id;
          continue;
        }
        if (!result?.success) {
          throw new Error(result?.error || `Could not save item: ${item.name}`);
        }
        lastId = result.id;
      }

      try {
        const confirmed = { ...(invoice.userConfirmedFields || {}) };
        [
          'imei',
          'invoiceNumber',
          'registration',
          'chassisNumber',
          'engineNumber',
          'serialNumber',
          'totalAmount',
          'policyNumber',
        ].forEach((key) => {
          if (invoice[key] != null && String(invoice[key]).trim() !== '') confirmed[key] = true;
        });
        captureReviewLearning({
          userId: user?.uid,
          documentType:
            invoice.documentTypeV2 ||
            invoice.document_type ||
            classifiedType ||
            invoice.documentKind,
          original: originalSnapshotRef.current || {},
          corrected: invoice,
          userConfirmedFields: confirmed,
          fieldReviews: invoice.fieldIntelligence,
          vendorHint: invoice.shopName,
          matchedAssetId: chosenLink || lastId || null,
        }).catch(() => {});
      } catch {
        /* learning must never block save */
      }

      if (latestAudit.fingerprint) {
        await rememberInvoiceFingerprint(latestAudit.fingerprint);
      }
      if (!isAttachDoc) {
        await rememberBillFingerprint({
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          invoiceDate: invoice.invoiceDate,
        });
      }
      await InvoiceOfflineCache.saveScan({
        scanId: scanId || undefined,
        userId: user?.uid,
        imageUri,
        invoice,
        audit: { ...latestAudit, savedAssetId: lastId },
        engine: route?.params?.engine,
      });

      Haptics.success();
      const shareName =
        invoice.productName?.trim() ||
        finalTargets?.[0]?.name ||
        pickPrimaryItem(itemList)?.name ||
        'Vaulted asset';
      const sharePrice =
        Number(invoice.totalAmount) > 0
          ? Number(invoice.totalAmount)
          : Number(finalTargets?.[0]?.amount || finalTargets?.[0]?.price) || null;
      setShareCard({
        assetName: shareName,
        price: sharePrice,
        imageUri: imageUri || '',
      });
    } catch (error) {
      Haptics.error();
      ui.error('Save failed', error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    Haptics.tap();

    const currentDocType = isInsurance
      ? 'INSURANCE'
      : isPuc
      ? 'PUC'
      : isVehicleService
      ? 'VEHICLE_SERVICE'
      : 'INVOICE';
    const gate = canSaveExtractedInvoice(invoice, currentDocType);
    if (!gate.allowed) {
      Haptics.warning();
      ui.info('Details required', gate.message || 'Please fill required fields before saving.');
      return;
    }

    // Duplicate check for Vehicle Service
    if (isVehicleService && linkAssetId) {
      const targetVehicle = assets.find((a) => (a.assetId || a.id) === linkAssetId);
      const dup = DuplicateProtectionService.checkVehicleServiceDuplicate(
        invoice.serviceInvoiceNumber || invoice.invoiceNumber,
        invoice.serviceDate || invoice.invoiceDate,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const ok = await ui.confirm({
          title: 'Service Bill Already Recorded',
          message: `${dup.reason}\n\nDo you want to update this service record on the vehicle?`,
          confirmLabel: 'Update Service',
        });
        if (!ok) return;
      }
    }

    // Duplicate check for Insurance
    if (isInsurance && linkAssetId) {
      const targetVehicle = assets.find((a) => (a.assetId || a.id) === linkAssetId);
      const dup = DuplicateProtectionService.checkInsuranceDuplicate(
        invoice.policyNumber || invoice.invoiceNumber,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const ok = await ui.confirm({
          title: 'Insurance Policy Already Recorded',
          message: `${dup.reason}\n\nDo you want to update the policy details on this vehicle?`,
          confirmLabel: 'Update Policy',
        });
        if (!ok) return;
      }
    }

    // Duplicate check for PUC
    if (isPuc && linkAssetId) {
      const targetVehicle = assets.find((a) => (a.assetId || a.id) === linkAssetId);
      const dup = DuplicateProtectionService.checkPucDuplicate(
        invoice.certificateNumber || invoice.invoiceNumber,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const ok = await ui.confirm({
          title: 'PUC Certificate Already Recorded',
          message: `${dup.reason}\n\nDo you want to update the certificate details on this vehicle?`,
          confirmLabel: 'Update Certificate',
        });
        if (!ok) return;
      }
    }

    const latestAudit = await refreshAudit(invoice);

    if (!isAttachDoc && latestAudit.isDuplicate) {
      const existing = findExistingForUpdate();
      Haptics.warning();
      const ok = await ui.confirm({
        title: 'Invoice Already Saved',
        message: existing
          ? 'This invoice was already recorded. Do you want to update the existing asset passport with your reviewed details?'
          : 'An invoice with this number was already saved. Would you like to save anyway?',
        confirmLabel: existing ? 'Update Passport' : 'Save Anyway',
      });
      if (!ok) return;
      await persistSave(latestAudit, { allowDuplicate: true });
      return;
    }

    await persistSave(latestAudit, { allowDuplicate: false });
  };

  const checkSummary = useMemo(() => {
    const bits = [];
    bits.push(totalOk ? `Total ${formatMoney(invoice.totalAmount)}` : 'Total needed');
    if (itemCount > 1) bits.push(`${itemCount} items`);
    if (audit?.isDuplicate) bits.push('Duplicate');
    return bits.join(' · ');
  }, [totalOk, invoice.totalAmount, itemCount, audit?.isDuplicate]);

  const [openDocSec, setOpenDocSec] = useState(true);
  const [openShopSec, setOpenShopSec] = useState(true);
  const [openAssetSec, setOpenAssetSec] = useState(true);
  const [openVehicleSec, setOpenVehicleSec] = useState(Boolean(showVehicleReg || isService || isVehiclePurchase));
  const [openInsuranceSec, setOpenInsuranceSec] = useState(Boolean(isInsurance || isPuc));
  const [openWarrantySec, setOpenWarrantySec] = useState(Boolean(!isInsurance && !isPuc && !isRc && (invoice.warrantyExpiry || !isService)));
  const [openTotalSec, setOpenTotalSec] = useState(true);
  const [openAdvancedSec, setOpenAdvancedSec] = useState(false);
  const [openDebugSec, setOpenDebugSec] = useState(false);

  // Helper for field metadata & confidence
  const getFieldInfo = (fieldName, customValue) => {
    const val = customValue !== undefined ? customValue : invoice[fieldName];
    const hasVal = val !== null && val !== undefined && val !== '';
    const conf =
      invoice.fieldConfidence?.[fieldName] ??
      (hasVal && Number(invoice.confidence) > 0
        ? (Number(invoice.confidence) > 1 ? Number(invoice.confidence) / 100 : Number(invoice.confidence))
        : 0);
    const rounded = Math.round(conf * 100);

    let status = 'NOT_FOUND';
    const storedStatus = invoice.fieldStatuses?.[fieldName]
      ? String(invoice.fieldStatuses[fieldName]).toUpperCase()
      : null;
    if (invoice.userConfirmedFields?.[fieldName]) status = 'USER_VERIFIED';
    else if (storedStatus && storedStatus !== 'NOT_FOUND') status = storedStatus;
    else if (hasVal) {
      if (invoice.fieldDecisions?.[fieldName]?.decision === 'REJECT_CANDIDATE') status = 'NEEDS_REVIEW';
      else if (invoice.fieldDecisions?.[fieldName]?.decision === 'REVIEW_RECOMMENDED') status = 'NEEDS_REVIEW';
      else if (invoice.fieldDecisions?.[fieldName]?.decision === 'MANUAL_ENTRY_REQUIRED') status = 'NEEDS_REVIEW';
      else if (invoice.fieldIntelligence?.[fieldName]?.needsReview) status = 'NEEDS_REVIEW';
      else if (
        invoice.fieldIntelligence?.[fieldName]?.validationState === 'INVALID' ||
        invoice.fieldIntelligence?.[fieldName]?.validationState === 'SUSPICIOUS'
      ) {
        status = 'NEEDS_REVIEW';
      } else if (invoice.fieldDecisions?.[fieldName]?.decision === 'AUTO_ACCEPT') status = 'HIGH_CONFIDENCE';
      else if (conf >= 0.70) status = 'HIGH_CONFIDENCE';
      else status = 'NEEDS_REVIEW';
    } else if (invoice.fieldDecisions?.[fieldName]?.decision === 'NOT_FOUND') {
      status = 'NOT_FOUND';
    }

    return {
      value: hasVal ? val : null,
      confidence: rounded,
      status,
      sourceType: invoice.sourceType?.[fieldName] || 'OCR_DOCUMENT',
      evidence:
        invoice.fieldEvidence?.[fieldName]?.sourceText ||
        invoice.evidence?.[fieldName] ||
        (hasVal ? 'Evidence unavailable' : 'Not found on document'),
      method: invoice.extractionMethod?.[fieldName] || 'semantic_regex',
    };
  };

  const renderVehiclePicker = () => {
    const list = vehicleOptions || [];
    if (list.length === 0) {
      return (
        <View style={styles.noVehicleBox}>
          <Text style={styles.noVehicleText}>No vehicles in your garage yet</Text>
          <Text style={styles.noVehicleHint}>
            This document will be saved in your Vault. Once you add your vehicle invoice, you can link this anytime.
          </Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: SPACING.xs }}>
        {list.map((v) => {
          const vId = v.assetId || v.id;
          const isSelected = linkAssetId === vId;
          const isAutoMatched =
            vehicleLinkResolution?.matchedVehicle &&
            (vehicleLinkResolution.matchedVehicle.assetId || vehicleLinkResolution.matchedVehicle.id) === vId;

          return (
            <Pressable
              key={vId}
              onPress={() => {
                Haptics.select();
                setLinkAssetId(vId);
              }}
              style={[
                styles.vehicleOptionCard,
                isSelected && styles.vehicleOptionCardSelected,
              ]}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.vehicleOptionName, isSelected && styles.vehicleOptionNameSelected]}>
                  {v.name || v.assetName || 'Unnamed Vehicle'}
                </Text>
                <Text style={styles.vehicleOptionReg}>
                  {v.registration || v.chassisNumber || 'No plate registered'}
                </Text>
              </View>
              {isAutoMatched ? (
                <View style={styles.matchedBadge}>
                  <Text style={styles.matchedBadgeText}>AUTO-MATCHED</Text>
                </View>
              ) : isSelected ? (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>SELECTED</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <Screen style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIconEmoji}>
              {ocrFailed ? '⚠️' : (invoice.needsManualReview || safeParams.audit?.manualEntry) ? '📋' : '✅'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {ocrFailed
                ? 'MANUAL ENTRY NEEDED'
                : (invoice.needsManualReview || safeParams.audit?.manualEntry)
                ? 'REVIEW & CONFIRM DETAILS'
                : 'AI ANALYSIS COMPLETE'}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {documentTypeBadge || 'Review document'}
            </Text>
            {ocrFailed ? (
              <Text style={styles.manualBanner}>
                {safeParams.quality?.ok === false
                  ? 'The image quality is too low. Please retake the document photo.'
                  : (invoice.rawOcrText && invoice.rawOcrText.trim().length >= 10) || (invoice.rawText && invoice.rawText.trim().length >= 10)
                  ? "We read the document, but couldn't confidently identify all required fields."
                  : "We couldn't read enough text from this document."}
              </Text>
            ) : Number.isFinite(Number(invoice.confidence)) && Number(invoice.confidence) > 0 ? (
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${Math.max(
                          8,
                          Math.min(
                            100,
                            Math.round(
                              Number(invoice.confidence) <= 1
                                ? Number(invoice.confidence) * 100
                                : Number(invoice.confidence),
                            ),
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.confidenceText}>
                  {Math.round(Number(invoice.confidence) <= 1 ? Number(invoice.confidence) * 100 : Number(invoice.confidence))}%
                  confident
                </Text>
              </View>
            ) : null}
            {smartMapHint ? (
              <Text style={styles.mapBanner}>{smartMapHint}</Text>
            ) : null}
          </View>
        </View>

        <InvoicePostcard
          imageUri={imageUri}
          shopName={invoice.shopName || invoice.vendor || (isInsurance ? invoice.insurer : 'Scanned document')}
          totalLabel={
            invoice.totalAmount != null && Number(invoice.totalAmount) > 0
              ? formatINRExact(invoice.totalAmount)
              : ''
          }
        />

        <DocumentIntelligencePanel
          extracted={invoice}
          documentType={documentTypeBadge || invoice.documentType || invoice.type}
          confidence={invoice.confidence}
          needsReview={invoice.needsManualReview || invoice.needsReview}
          needsManualReview={invoice.needsManualReview}
        />

        {/* 1. INSURANCE DOCUMENT REVIEW CARDS */}
        {isInsurance ? (
          <>
            {/* CARD 1: INSURANCE DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>1. Insurance Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Insurer, policy number & coverage type</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Insurance Company / Insurer *</Text>
                <GlassInput
                  value={blank(invoice.insurerName || invoice.shopName)}
                  onChangeText={(t) => {
                    patch('insurerName', t);
                    patch('shopName', t);
                  }}
                  placeholder="e.g. Tata AIG, HDFC ERGO, ICICI Lombard"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Policy Number *</Text>
                  <GlassInput
                    value={blank(invoice.policyNumber || invoice.invoiceNumber)}
                    onChangeText={(t) => {
                      patch('policyNumber', t);
                      patch('invoiceNumber', t);
                    }}
                    placeholder="e.g. 0159988223"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Policy Type</Text>
                  <GlassInput
                    value={blank(invoice.policyType)}
                    onChangeText={(t) => patch('policyType', t)}
                    placeholder="Comprehensive / Third Party"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 2: VEHICLE DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>2. Vehicle Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Registration, chassis, engine & make/model</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Registration Number</Text>
                  <GlassInput
                    value={blank(invoice.registration || invoice.vehicleRegistrationNumber)}
                    onChangeText={(t) => {
                      const reg = t.toUpperCase().replace(/\s+/g, '');
                      patch('registration', reg);
                      patch('vehicleRegistrationNumber', reg);
                    }}
                    autoCapitalize="characters"
                    placeholder="e.g. KA01AB1234"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Chassis / VIN</Text>
                  <GlassInput
                    value={blank(invoice.chassisNumber)}
                    onChangeText={(t) => patch('chassisNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Chassis No"
                  />
                </View>
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Engine Number</Text>
                  <GlassInput
                    value={blank(invoice.engineNumber)}
                    onChangeText={(t) => patch('engineNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Engine No"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Make / Model</Text>
                  <GlassInput
                    value={blank(
                      invoice.vehicleMake || invoice.brand
                        ? `${invoice.vehicleMake || invoice.brand} ${invoice.vehicleModel || invoice.model || ''}`.trim()
                        : invoice.productName
                    )}
                    onChangeText={(t) => {
                      patch('productName', t);
                      patch('vehicleMake', t);
                    }}
                    placeholder="e.g. TVS Ronin"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 3: POLICY PERIOD & AMOUNT */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>3. Policy Period & Premium</Text>
              <Text style={styles.cleanSectionSubtitle}>Validity dates, IDV and premium paid</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Start Date</Text>
                  <GlassInput
                    value={blank(invoice.policyStartDate || invoice.invoiceDate)}
                    onChangeText={(t) => {
                      patch('policyStartDate', t.trim() || null);
                      patch('invoiceDate', t.trim() || null);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Policy Expiry Date *</Text>
                  <GlassInput
                    value={blank(invoice.policyExpiryDate || invoice.insuranceExpiry)}
                    onChangeText={(t) => {
                      patch('policyExpiryDate', t.trim() || null);
                      patch('insuranceExpiry', t.trim() || null);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>IDV / Insured Value (₹)</Text>
                  <GlassInput
                    value={invoice.idv != null ? String(invoice.idv) : ''}
                    onChangeText={(t) => patch('idv', parseMoneyInput(t))}
                    keyboardType="numeric"
                    placeholder="e.g. 120000"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Premium Paid (₹)</Text>
                  <GlassInput
                    value={
                      invoice.premium != null
                        ? String(invoice.premium)
                        : invoice.totalAmount != null
                        ? String(invoice.totalAmount)
                        : ''
                    }
                    onChangeText={(t) => {
                      const n = parseMoneyInput(t);
                      patch('premium', n);
                      patch('totalAmount', n);
                      patch('purchaseAmount', n);
                    }}
                    keyboardType="numeric"
                    placeholder="e.g. 4500"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 4: VEHICLE PASSPORT LINK */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>4. Link to Vehicle Passport</Text>
              <Text style={styles.cleanSectionSubtitle}>Select which vehicle this policy belongs to</Text>
              {renderVehiclePicker()}
            </GlassCard>
          </>
        ) : isPuc ? (
          <>
            {/* CARD 1: PUC DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>1. PUC Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Certificate number, test date & validity</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Certificate Number *</Text>
                <GlassInput
                  value={blank(invoice.certificateNumber || invoice.invoiceNumber)}
                  onChangeText={(t) => {
                    patch('certificateNumber', t);
                    patch('invoiceNumber', t);
                  }}
                  placeholder="e.g. DL0123456789"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Test Date</Text>
                  <GlassInput
                    value={blank(invoice.testDate || invoice.invoiceDate)}
                    onChangeText={(t) => {
                      patch('testDate', t.trim() || null);
                      patch('invoiceDate', t.trim() || null);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Valid Until / Expiry *</Text>
                  <GlassInput
                    value={blank(invoice.validUntil || invoice.pucExpiry)}
                    onChangeText={(t) => {
                      patch('validUntil', t.trim() || null);
                      patch('pucExpiry', t.trim() || null);
                      patch('pucValidUntil', t.trim() || null);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 2: VEHICLE DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>2. Vehicle Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Registration, chassis, engine & make/model</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Registration Number</Text>
                  <GlassInput
                    value={blank(invoice.registration || invoice.vehicleRegistrationNumber)}
                    onChangeText={(t) => {
                      const reg = t.toUpperCase().replace(/\s+/g, '');
                      patch('registration', reg);
                      patch('vehicleRegistrationNumber', reg);
                    }}
                    autoCapitalize="characters"
                    placeholder="e.g. KA01AB1234"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Chassis Number</Text>
                  <GlassInput
                    value={blank(invoice.chassisNumber)}
                    onChangeText={(t) => patch('chassisNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Chassis No"
                  />
                </View>
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Engine Number</Text>
                  <GlassInput
                    value={blank(invoice.engineNumber)}
                    onChangeText={(t) => patch('engineNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Engine No"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Fuel Type</Text>
                  <GlassInput
                    value={blank(invoice.fuelType)}
                    onChangeText={(t) => patch('fuelType', t)}
                    placeholder="Petrol / Diesel / CNG / EV"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 3: EMISSION & TESTING CENTER */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>3. Emission & Testing Center</Text>
              <Text style={styles.cleanSectionSubtitle}>Emission readings and testing station</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Emission Readings (CO / HC / Smoke)</Text>
                <GlassInput
                  value={blank(invoice.emissionValues)}
                  onChangeText={(t) => patch('emissionValues', t)}
                  placeholder="e.g. CO: 0.12%, HC: 150 ppm"
                />
              </View>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Testing Center / Authority</Text>
                <GlassInput
                  value={blank(invoice.issuingAuthority || invoice.shopName)}
                  onChangeText={(t) => {
                    patch('issuingAuthority', t);
                    patch('shopName', t);
                  }}
                  placeholder="Testing Center / Agency Name"
                />
              </View>
            </GlassCard>

            {/* CARD 4: VEHICLE PASSPORT LINK */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>4. Link to Vehicle Passport</Text>
              <Text style={styles.cleanSectionSubtitle}>Select which vehicle this certificate belongs to</Text>
              {renderVehiclePicker()}
            </GlassCard>
          </>
        ) : isVehicleService ? (
          <>
            {/* CARD 1: SERVICE & WORKSHOP DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>1. Service & Workshop Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Workshop, invoice number & service date</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Dealer / Workshop Name *</Text>
                <GlassInput
                  value={blank(invoice.workshopName || invoice.shopName)}
                  onChangeText={(t) => {
                    patch('workshopName', t);
                    patch('shopName', t);
                  }}
                  placeholder="e.g. Authorized Workshop, Apex Motors"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Service Invoice / Job Card *</Text>
                  <GlassInput
                    value={blank(invoice.serviceInvoiceNumber || invoice.invoiceNumber)}
                    onChangeText={(t) => {
                      patch('serviceInvoiceNumber', t);
                      patch('invoiceNumber', t);
                    }}
                    placeholder="e.g. DL-2024-88910"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Service Date</Text>
                  <GlassInput
                    value={blank(invoice.serviceDate || invoice.invoiceDate)}
                    onChangeText={(t) => {
                      patch('serviceDate', t);
                      patch('invoiceDate', t);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Job Type / Description</Text>
                <GlassInput
                  value={blank(invoice.jobType)}
                  onChangeText={(t) => patch('jobType', t)}
                  placeholder="e.g. Periodic Maintenance / Paid Service"
                />
              </View>
            </GlassCard>

            {/* CARD 2: VEHICLE & ODOMETER */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>2. Vehicle & Odometer</Text>
              <Text style={styles.cleanSectionSubtitle}>Vehicle identifiers & current mileage</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Registration Number</Text>
                  <GlassInput
                    value={blank(invoice.registration || invoice.vehicleRegistrationNumber)}
                    onChangeText={(t) => {
                      const reg = t.toUpperCase().replace(/\s+/g, '');
                      patch('registration', reg);
                      patch('vehicleRegistrationNumber', reg);
                    }}
                    autoCapitalize="characters"
                    placeholder="e.g. KA01AB1234"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Odometer (km)</Text>
                  <GlassInput
                    value={blank(invoice.odometerKm != null ? String(invoice.odometerKm) : '')}
                    onChangeText={(t) => patch('odometerKm', t ? parseInt(t, 10) : null)}
                    keyboardType="numeric"
                    placeholder="e.g. 5240"
                  />
                </View>
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Chassis / Frame Number</Text>
                  <GlassInput
                    value={blank(invoice.chassisNumber)}
                    onChangeText={(t) => patch('chassisNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Chassis No"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Engine Number</Text>
                  <GlassInput
                    value={blank(invoice.engineNumber)}
                    onChangeText={(t) => patch('engineNumber', t.toUpperCase().replace(/\s+/g, ''))}
                    autoCapitalize="characters"
                    placeholder="Engine No"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 3: BILL BREAKDOWN & NEXT SERVICE */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>3. Bill Breakdown & Next Service</Text>
              <Text style={styles.cleanSectionSubtitle}>Charges, grand total & upcoming service</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Parts Amount (₹)</Text>
                  <GlassInput
                    value={blank(invoice.partsAmount != null ? String(invoice.partsAmount) : '')}
                    onChangeText={(t) => patch('partsAmount', t ? parseFloat(t) : null)}
                    keyboardType="numeric"
                    placeholder="0.00"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Labour Amount (₹)</Text>
                  <GlassInput
                    value={blank(invoice.labourAmount != null ? String(invoice.labourAmount) : '')}
                    onChangeText={(t) => patch('labourAmount', t ? parseFloat(t) : null)}
                    keyboardType="numeric"
                    placeholder="0.00"
                  />
                </View>
              </View>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Grand Total (₹) *</Text>
                <GlassInput
                  value={blank(invoice.totalAmount != null ? String(invoice.totalAmount) : '')}
                  onChangeText={(t) => {
                    patch('totalAmount', t);
                    patch('purchaseAmount', t);
                  }}
                  keyboardType="numeric"
                  placeholder="Total bill amount"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Next Service Date</Text>
                  <GlassInput
                    value={blank(invoice.nextServiceDate || invoice.nextServiceDue)}
                    onChangeText={(t) => {
                      patch('nextServiceDate', t);
                      patch('nextServiceDue', t);
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Next Service Odometer (km)</Text>
                  <GlassInput
                    value={blank(invoice.nextServiceKm != null ? String(invoice.nextServiceKm) : '')}
                    onChangeText={(t) => patch('nextServiceKm', t ? parseInt(t, 10) : null)}
                    keyboardType="numeric"
                    placeholder="e.g. 10000"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 4: VEHICLE PASSPORT LINK */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>4. Link to Vehicle Passport</Text>
              <Text style={styles.cleanSectionSubtitle}>Select which vehicle this service history belongs to</Text>
              {renderVehiclePicker()}
            </GlassCard>
          </>
        ) : (
          <>
            {/* CARD 1: ASSET DETAILS */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>1. Asset Details</Text>
              <Text style={styles.cleanSectionSubtitle}>Product name, brand, model & unique identifiers</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Product / Asset Name *</Text>
                <GlassInput
                  value={blank(invoice.productName)}
                  onChangeText={(t) => patch('productName', t)}
                  placeholder="e.g. TVS Ronin or CMF Buds 2 Plus"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Brand / Make</Text>
                  <GlassInput
                    value={blank(invoice.brand || invoice.make)}
                    onChangeText={(t) => {
                      patch('brand', t);
                      patch('make', t);
                    }}
                    placeholder="e.g. TVS, CMF"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Model / Variant</Text>
                  <GlassInput
                    value={blank(invoice.model)}
                    onChangeText={(t) => patch('model', t)}
                    placeholder="e.g. Base Lightning Black"
                  />
                </View>
              </View>

              <View style={styles.cleanFieldItem}>
                <View style={styles.identifierHeaderRow}>
                  <Text style={styles.cleanFieldLabel}>
                    {invoice.identifierType === 'CHASSIS_NUMBER' || isVehiclePurchase || invoice.chassisNumber
                      ? 'Chassis / Frame Number'
                      : invoice.identifierType === 'IMEI' || isElectronics || invoice.imei
                      ? 'IMEI Number'
                      : invoice.identifierType === 'ENGINE_NUMBER' || invoice.engineNumber
                      ? 'Engine Number'
                      : 'Serial / Unique Identifier'}
                  </Text>
                  {invoice.identifierType && invoice.identifierType !== 'UNKNOWN' ? (
                    <View style={styles.cleanTypeBadge}>
                      <Text style={styles.cleanTypeBadgeText}>{invoice.identifierType}</Text>
                    </View>
                  ) : null}
                </View>
                <GlassInput
                  value={blank(
                    invoice.chassisNumber ||
                    invoice.imei ||
                    invoice.serialNumber ||
                    invoice.serialOrIdentifier
                  )}
                  onChangeText={(t) => {
                    const val = t.trim();
                    patch('serialOrIdentifier', val);
                    if (invoice.identifierType === 'CHASSIS_NUMBER' || isVehiclePurchase) {
                      patch('chassisNumber', val.toUpperCase().replace(/\s+/g, ''));
                    } else if (invoice.identifierType === 'IMEI' || isElectronics) {
                      patch('imei', val.replace(/\D/g, '').slice(0, 15));
                    } else {
                      patch('serialNumber', val);
                    }
                  }}
                  placeholder="e.g. MD637AN115ZF03328 or IMEI / Serial No"
                  autoCapitalize="characters"
                />
              </View>
            </GlassCard>

            {/* CARD 2: PURCHASE & WARRANTY */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>2. Purchase & Warranty</Text>
              <Text style={styles.cleanSectionSubtitle}>Purchase date, total price paid & warranty details</Text>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Purchase Date</Text>
                  <GlassInput
                    value={blank(invoice.invoiceDate)}
                    onChangeText={(t) => {
                      patch('invoiceDate', t.trim() || null);
                      if (invoice.warrantyPeriod) {
                        try {
                          const { computeWarrantyExpiry } = require('../services/vlm/ConsumerAssetVlmService');
                          const exp = computeWarrantyExpiry(t.trim(), invoice.warrantyPeriod);
                          if (exp) patch('warrantyExpiry', exp);
                        } catch {}
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Grand Total (₹) *</Text>
                  <GlassInput
                    value={invoice.totalAmount != null ? String(invoice.totalAmount) : ''}
                    onChangeText={(t) => {
                      const n = parseMoneyInput(t);
                      patch('totalAmount', n);
                      patch('purchaseAmount', n);
                    }}
                    keyboardType="numeric"
                    placeholder="Total Paid (e.g. 135500)"
                  />
                </View>
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Warranty Period</Text>
                  <GlassInput
                    value={blank(invoice.warrantyPeriod)}
                    onChangeText={(t) => {
                      patch('warrantyPeriod', t);
                      if (invoice.invoiceDate) {
                        try {
                          const { computeWarrantyExpiry } = require('../services/vlm/ConsumerAssetVlmService');
                          const exp = computeWarrantyExpiry(invoice.invoiceDate, t);
                          if (exp) patch('warrantyExpiry', exp);
                        } catch {}
                      }
                    }}
                    placeholder="e.g. 1 Year, 2 Years"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Warranty Expiry</Text>
                  <GlassInput
                    value={blank(invoice.warrantyExpiry)}
                    onChangeText={(t) => patch('warrantyExpiry', t.trim() || null)}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            </GlassCard>

            {/* CARD 3: DEALER & REFERENCE */}
            <GlassCard style={styles.cleanSectionCard}>
              <Text style={styles.cleanSectionTitle}>3. Dealer & Reference</Text>
              <Text style={styles.cleanSectionSubtitle}>Seller store name, invoice number & buyer info</Text>

              <View style={styles.cleanFieldItem}>
                <Text style={styles.cleanFieldLabel}>Shop / Dealer Name</Text>
                <GlassInput
                  value={blank(invoice.shopName || invoice.vendor)}
                  onChangeText={(t) => {
                    patch('shopName', t);
                    patch('vendor', t);
                  }}
                  placeholder="e.g. ABC Motors or Store Name"
                />
              </View>

              <View style={styles.cleanRowTwoCol}>
                <View style={[styles.cleanFieldItem, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.cleanFieldLabel}>Invoice / Bill Number</Text>
                  <GlassInput
                    value={blank(invoice.invoiceNumber)}
                    onChangeText={(t) => patch('invoiceNumber', t)}
                    placeholder="e.g. 180725130771"
                  />
                </View>
                <View style={[styles.cleanFieldItem, { flex: 1 }]}>
                  <Text style={styles.cleanFieldLabel}>Buyer Name (on bill)</Text>
                  <GlassInput
                    value={blank(invoice.customerName)}
                    onChangeText={(t) => patch('customerName', t)}
                    placeholder="e.g. Customer Name"
                  />
                </View>
              </View>
            </GlassCard>
          </>
        )}

        {/* VAULT STORAGE TOGGLE */}
        <GlassCard style={styles.vaultToggleCard}>
          <Pressable
            onPress={() => {
              Haptics.select();
              setSaveToVaultCopy((prev) => !prev);
            }}
            style={styles.vaultToggleRow}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.vaultToggleTitle}>Save scanned copy to Document Vault</Text>
              <Text style={styles.vaultToggleSubtitle}>
                {saveToVaultCopy
                  ? isInsurance
                    ? '✓ Scanned insurance policy will be stored in your Vehicle Passport vault'
                    : isPuc
                    ? '✓ Scanned PUC certificate will be stored in your Vehicle Passport vault'
                    : isVehicleService
                    ? '✓ Scanned service bill will be stored in your Vehicle Passport vault'
                    : '✓ Scanned bill image will be securely uploaded to your asset vault'
                  : 'Image is only used in-memory for extraction and discarded (saves cloud storage)'}
              </Text>
            </View>
            <View
              style={[
                styles.vaultToggleSwitch,
                saveToVaultCopy ? styles.vaultToggleSwitchOn : styles.vaultToggleSwitchOff,
              ]}
            >
              <View
                style={[
                  styles.vaultToggleKnob,
                  saveToVaultCopy ? styles.vaultToggleKnobOn : styles.vaultToggleKnobOff,
                ]}
              />
            </View>
          </Pressable>
        </GlassCard>

        <GlassButton
          title={
            saveAllItems && itemList.length > 1
              ? `Save ${itemList.length} Items`
              : 'Save to Vault'
          }
          onPress={onSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
        />
        <GlassButton
          title="Cancel / Re-scan"
          onPress={() => {
            Haptics.select();
            openRescanInvoice();
          }}
          variant="ghost"
          disabled={saving}
          style={styles.rescanBtn}
        />
        {audit?.isDuplicate ? (
          <Text style={styles.blockHint}>
            This invoice was already saved — Tap Save to update your asset passport.
          </Text>
        ) : null}
      </ScrollView>

      <ShareAssetModal
        visible={Boolean(shareCard)}
        assetName={shareCard?.assetName || ''}
        price={shareCard?.price}
        onClose={() => {
          setShareCard(null);
          goHomeDashboard();
        }}
        onDone={() => {
          setShareCard(null);
          goHomeDashboard();
        }}
      />

    </Screen>
  );
}

/** Ensure no dummy strings leak into controlled inputs; map clean Gemini OCR JSON. */
function sanitizeInvoice(raw = {}) {
  const next = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  const strictEvidencePayload = Boolean(next.fieldEvidence || next.universalOcr?.classification);
  const extract =
    !strictEvidencePayload && next.ocrExtract && typeof next.ocrExtract === 'object'
      ? next.ocrExtract
      : {};

  // Prefer scannedData / clean schema aliases from Gemini
  const scanned = strictEvidencePayload
    ? {}
    : (next.scannedData && typeof next.scannedData === 'object' ? next.scannedData : null) ||
      (next.parsedData && typeof next.parsedData === 'object' ? next.parsedData : null) ||
      {};

  const pickStr = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return '';
  };
  const pickNum = (...vals) => {
    for (const v of vals) {
      if (v == null || v === '') continue;
      const n = Number(String(v).replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  // Auto-fill Review fields from OCR / scannedData
  next.productName = pickStr(
    next.productName,
    next.itemName,
    next.item_name,
    next.title,
    next.assetName,
    Array.isArray(next.items) && next.items[0] ? next.items[0].name : null,
    Array.isArray(next.lineItems) && next.lineItems[0] ? next.lineItems[0].description : null,
    scanned.item_name,
    scanned.asset_name,
    scanned.itemName,
    extract.asset_name,
    extract.item_name,
  );
  next.shopName = pickStr(
    next.shopName,
    next.vendor,
    next.vendor_name,
    next.vendorName,
    next.sellerName,
    next.seller_name,
    next.merchant,
    next.vendor_dealer_name,
    scanned.vendor_name,
    scanned.vendor,
    scanned.vendor_dealer_name,
    extract.vendor_dealer_name,
    extract.vendor_name,
    extract.vendor,
  );
  next.customerName = pickStr(
    next.customerName,
    next.buyerName,
    next.buyer_name,
    next.owner_buyer_name,
    scanned.buyer_name,
    scanned.owner_buyer_name,
    scanned.buyerName,
    extract.owner_buyer_name,
    extract.buyer_name,
  );
  next.invoiceNumber = pickStr(
    next.invoiceNumber,
    next.invoice_number,
    next.billNumber,
    next.invoice_or_policy_no,
    scanned.invoice_number,
    scanned.invoice_or_policy_no,
    extract.invoice_or_policy_no,
    extract.invoice_number,
  );
  next.invoiceDate = pickStr(
    next.invoiceDate,
    next.purchaseDate,
    next.purchase_date,
    next.purchase_or_issue_date,
    next.date,
    scanned.purchase_date,
    scanned.purchase_or_issue_date,
    extract.purchase_or_issue_date,
    extract.purchase_date,
  );
  const total = pickNum(
    next.totalAmount,
    next.grandTotal,
    next.purchasePrice,
    next.amount,
    next.price,
    next.total_amount,
    scanned.total_amount,
    scanned.totalAmount,
    extract.total_amount,
  );
  if (total != null) next.totalAmount = total;

  next.warrantyMonths = pickNum(
    next.warrantyMonths,
    next.warranty_months,
    scanned.warranty_months,
    scanned.warrantyMonths,
    extract.warranty_months,
  );
  next.warrantyExpiry = pickStr(
    next.warrantyExpiry,
    next.warrantyExpiryDate,
    next.warranty_expiry,
    scanned.warrantyExpiry,
    extract.warranty_expiry,
  );

  const category = pickStr(
    next.category,
    next.smartCategory,
    next.purchaseCategory,
    scanned.category,
    extract.category,
  );
  if (category) {
    next.category = category;
    // Map "Vehicles" → purchaseCategory Vehicles for vault folders
    if (/^vehicles?$/i.test(category)) next.purchaseCategory = 'Vehicles';
    else if (/^gadgets?$/i.test(category)) next.purchaseCategory = 'Gadgets';
    else if (/^home/i.test(category)) next.purchaseCategory = 'Home Appliances';
  }

  // Force Vehicles ONLY for documents with strong vehicle evidence.
  // NEVER default to Vehicle, and NEVER let a loose single keyword (e.g. "car"
  // or "TVS" appearing anywhere) hijack a gadget / appliance / generic invoice.
  const docTypeHint = String(
    next.classifiedDocumentType || next.documentKind || next.reviewFamily || extract.document_type || '',
  ).toUpperCase();
  const productHay = String(next.productName || '');
  const looksElectronics =
    /ELECTRONICS|GADGET|PHONE|APPLIANCE/i.test(docTypeHint) ||
    String(next.imei || '').replace(/\D/g, '').length === 15 ||
    /nothing\s*phone|iphone|smartphone|oneplus|pixel|galaxy|laptop|macbook|ipad|tablet|mobile|earbud|smartwatch|camera/i.test(productHay) ||
    /ac\b|air\s*conditioner|refrigerator|fridge|washing\s*machine|\btv\b|microwave/i.test(productHay);
  const vehicleHay = [
    next.productName,
    next.shopName,
    next.customerName,
    next.invoiceNumber,
    scanned.item_name,
    scanned.vendor_name,
    extract.asset_name,
    extract.vendor_dealer_name,
    Array.isArray(next.items)
      ? next.items.map((it) => it?.name || it?.item_name || '').join(' ')
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  // Only a meaningful vehicle identifier + category-classifier agreement counts.
  const hasVehicleId =
    (String(next.chassisNumber || '').replace(/\s/g, '').length >= 8 &&
      /chassis|frame|vin|engine/i.test(vehicleHay)) ||
    (String(next.engineNumber || '').replace(/\s/g, '').length >= 8 &&
      /engine|chassis/i.test(vehicleHay)) ||
    /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/i.test(
      String(next.registration || '').replace(/[\s-]/g, ''),
    );
  const vehicleForced =
    !strictEvidencePayload &&
    !looksElectronics &&
    hasVehicleId &&
    classifySmartCategory(vehicleHay, {
      chassisNumber: next.chassisNumber,
      engineNumber: next.engineNumber,
      registration: next.registration,
      productName: next.productName,
      documentKind: next.documentKind || next.classifiedDocumentType,
    }) === SMART_CATEGORIES.VEHICLES;
  if (vehicleForced) {
    next.category = 'Vehicles';
    next.purchaseCategory = 'Vehicles';
    next.smartCategory = SMART_CATEGORIES.VEHICLES;
  }
  if (looksElectronics) {
    next.purchaseCategory = 'Electronics';
    next.smartCategory = SMART_CATEGORIES.GADGETS;
    next.isVehicleInvoice = false;
    next.registration = '';
    next.chassisNumber = '';
    next.engineNumber = '';
    next.odometerKm = null;
    next.nextServiceOdometerKm = null;
    next.nextServiceDue = null;
    next.pucExpiry = null;
  }

  if (!next.chassisNumber) {
    next.chassisNumber = pickStr(
      next.chassisNumber,
      scanned.chassis_or_frame_no,
      extract.chassis_or_frame_no,
    );
  }
  if (!next.engineNumber) {
    next.engineNumber = pickStr(next.engineNumber, scanned.engine_number, extract.engine_number);
  }
  if (!next.registration) {
    next.registration = pickStr(
      next.registration,
      scanned.vehicle_registration_number,
      scanned.registration_number,
      extract.vehicle_registration_number,
    );
  }
  if (!next.insuranceExpiry && extract.expiry_date) {
    const doc = String(
      next.classifiedDocumentType || extract.document_type || next.documentKind || '',
    ).toUpperCase();
    if (doc.includes('INSURANCE')) next.insuranceExpiry = extract.expiry_date;
    else if (doc.includes('PUC')) next.pucExpiry = extract.expiry_date;
    else if (!next.warrantyExpiry) next.warrantyExpiry = extract.expiry_date;
  }
  if (extract.document_type && !next.classifiedDocumentType) {
    next.classifiedDocumentType = extract.document_type;
    next.geminiDocumentType = extract.document_type;
  }

  // Mirror clean aliases for any UI reading itemName / vendor / buyerName
  next.itemName = next.productName;
  next.item_name = next.productName;
  next.vendor = next.shopName;
  next.vendor_name = next.shopName;
  next.buyerName = next.customerName;
  next.buyer_name = next.customerName;
  next.purchaseDate = next.invoiceDate;
  next.purchase_date = next.invoiceDate;
  next.price = next.totalAmount;
  if (raw.fieldIntelligence) next.fieldIntelligence = raw.fieldIntelligence;
  if (raw.learningReviewReasons) next.learningReviewReasons = raw.learningReviewReasons;

  const stringKeys = [
    'shopName',
    'invoiceNumber',
    'productName',
    'serialNumber',
    'imei',
    'chassisNumber',
    'engineNumber',
    'registration',
    'customerName',
    'pucExpiry',
    'nextServiceDue',
    'insuranceExpiry',
    'warrantyExpiry',
    'invoiceDate',
    'itemName',
    'vendor',
    'buyerName',
    'purchaseDate',
  ];
  for (const key of stringKeys) {
    if (next[key] == null) next[key] = '';
    else next[key] = String(next[key]).trim();
  }
  if (/^(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2})/.test(next.shopName || '')) {
    next.shopName = extract.vendor_dealer_name || extract.vendor_name || '';
    next.vendor = next.shopName;
    next.vendor_name = next.shopName;
  }
  // Strip classic dummy / OCR-ghost plates if they somehow appear
  if (/^MH12AB1234$/i.test(next.registration)) next.registration = '';
  if (/^(?:n\/a|na|nil|null|undefined|dummy|test|no)$/i.test(next.serialNumber)) next.serialNumber = '';
  if (/^(?:n\/a|na|nil|null|undefined|dummy|test|no)$/i.test(next.imei)) next.imei = '';
  if (/^(?:n\/a|na|nil|null|undefined|dummy|test|no)$/i.test(next.chassisNumber)) {
    next.chassisNumber = '';
  }
  if (/^(?:n\/a|na|nil|null|undefined|dummy|test|no)$/i.test(String(next.engineNumber || ''))) {
    next.engineNumber = '';
  }
  // Purchase invoice OCR must not invent PUC / insurance — clear ghost values under 8 chars junk too
  if (next.chassisNumber && String(next.chassisNumber).replace(/\s/g, '').length < 8) {
    next.chassisNumber = '';
  }
  if (next.engineNumber && String(next.engineNumber).replace(/\s/g, '').length < 8) {
    next.engineNumber = '';
  }
  const docHint = String(
    next.classifiedDocumentType ||
    next.documentKind ||
    next.documentType ||
    next.scanDocumentType ||
    ''
  ).toUpperCase();
  const isAttachOrInsurance =
    docHint.includes('INSURANCE') ||
    docHint.includes('PUC') ||
    docHint.includes('RC') ||
    Boolean(next.isInsurance || next.isPuc || next.isRc);

  if (isAttachOrInsurance) {
    next.items = [];
    next.lineItems = [];
    next.itemCount = 0;
  } else {
    if (!Array.isArray(next.items)) next.items = [];
    next.items = next.items.map((item, i) => {
      const withIndex = { ...item, index: item.index || i + 1 };
      if (withIndex.isFee) return withIndex;
      if (withIndex.smartCategory) return withIndex;
      return enrichItemWithCategory(withIndex, next.productName || '');
    });
    next.itemCount = Number(next.itemCount) || next.items.length;
  }
  return next;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, paddingBottom: 40 },
  cleanSectionCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  cleanSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  cleanSectionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: SPACING.sm,
    marginTop: 2,
  },
  cleanFieldItem: {
    marginTop: SPACING.sm,
  },
  cleanFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cleanRowTwoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  identifierHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cleanTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  cleanTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neonBlue || '#3B82F6',
    letterSpacing: 0.5,
  },
  vaultToggleCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  vaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  vaultToggleSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
    lineHeight: 15,
  },
  vaultToggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  vaultToggleSwitchOn: {
    backgroundColor: COLORS.emerald || '#10B981',
  },
  vaultToggleSwitchOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  vaultToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  vaultToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  vaultToggleKnobOff: {
    alignSelf: 'flex-start',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrow: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,148,136,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.35)',
    marginRight: 12,
  },
  headerIconEmoji: { fontSize: 22 },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  confidenceTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
    marginRight: 8,
  },
  confidenceFill: {
    height: 6,
    borderRadius: 99,
    backgroundColor: COLORS.emerald,
  },
  confidenceText: { color: COLORS.emerald, fontSize: 11, fontWeight: '800' },
  manualBanner: {
    marginTop: 8,
    marginBottom: 4,
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mapBanner: {
    marginTop: 8,
    marginBottom: 4,
    color: COLORS.emerald,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  rapidSummary: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  rapidSummaryHeader: {
    marginBottom: 6,
  },
  rapidSummaryTitle: {
    fontWeight: '900',
    fontSize: 14,
  },
  rapidSummaryMeta: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  rapidChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  rapidChipWarn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rapidChipWarnText: {
    color: COLORS.amber,
    fontSize: 10,
    fontWeight: '800',
  },
  rowTwoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: { marginBottom: 10, paddingVertical: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: COLORS.text, fontWeight: '800', fontSize: 13, flex: 1, paddingRight: 8 },
  chevron: { color: COLORS.muted, fontSize: 14 },
  sectionBody: { marginTop: 8 },
  essentials: { marginBottom: 10 },
  essentialsTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14, marginBottom: 8 },
  docBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(13,148,136,0.14)',
    borderColor: COLORS.emerald,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  docBadgeText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  attachHint: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 16,
  },
  expiryHint: { fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: -4 },
  warrantyComputedRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  warrantyComputedText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.emerald,
    fontWeight: '600',
  },
  warrantyReviewFlag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.amber,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  linkBlock: { marginBottom: 10 },
  linkLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linkChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    maxWidth: '100%',
  },
  linkChipOn: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.16)',
  },
  catChipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(13,148,136,0.16)',
  },
  linkChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  linkChipTextOn: { color: '#FF8A97' },
  catChipTextOn: { color: COLORS.emerald },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  pillOk: {
    backgroundColor: COLORS.successSoft || 'rgba(74,168,154,0.16)',
    borderColor: 'rgba(74,168,154,0.45)',
  },
  pillWarn: {
    backgroundColor: COLORS.warnSoft || 'rgba(212,162,76,0.16)',
    borderColor: 'rgba(212,162,76,0.45)',
  },
  pillText: { fontSize: 10, fontWeight: '800' },
  pillTextOk: { color: COLORS.emerald },
  pillTextWarn: { color: COLORS.amber },
  auditNote: { color: COLORS.muted, fontSize: 11, marginTop: 8, lineHeight: 15 },
  hint: { color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  saveAllToggle: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(91,141,239,0.12)',
  },
  saveAllText: { color: COLORS.neonBlue, fontWeight: '700', fontSize: 12 },
  saveBtn: { marginTop: 6 },
  rescanBtn: { marginTop: 10 },
  fieldItem: { marginBottom: 12 },
  learnHint: {
    marginTop: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  learnHintTitle: { color: '#F59E0B', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  learnHintText: { color: COLORS.muted || '#9CA3AF', fontSize: 11, lineHeight: 16 },
  learnHintRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  learnBtn: {
    borderRadius: 8,
    backgroundColor: 'rgba(13,148,136,0.2)',
    borderWidth: 1,
    borderColor: COLORS.emerald,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  learnBtnText: { color: COLORS.emerald, fontSize: 11, fontWeight: '800' },
  learnBtnGhost: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  learnBtnGhostText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  badgeVerified: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.4)',
  },
  badgeTextVerified: { color: COLORS.emerald || '#10B981' },
  badgeDetected: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.4)',
  },
  badgeTextDetected: { color: COLORS.neonBlue || '#3B82F6' },
  badgeReview: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  badgeTextReview: { color: COLORS.amber || '#F59E0B' },
  badgeConflict: {
    backgroundColor: 'rgba(244,63,94,0.14)',
    borderColor: 'rgba(244,63,94,0.5)',
  },
  badgeTextConflict: { color: COLORS.rose || '#F43F5E' },
  badgeNotFound: {
    backgroundColor: 'rgba(107,114,128,0.08)',
    borderColor: 'rgba(107,114,128,0.25)',
  },
  badgeTextNotFound: { color: COLORS.muted || '#9CA3AF' },
  debugTable: {
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 6,
  },
  debugHeaderRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  debugCellHeader: {
    color: COLORS.neonBlue,
    fontSize: 10,
    fontWeight: '800',
  },
  debugRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  debugRowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  debugCell: {
    color: COLORS.text,
    fontSize: 10,
  },
  blockHint: {
    color: COLORS.amber,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
    fontSize: 12,
  },
  noVehicleBox: {
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
  },
  noVehicleText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noVehicleHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  vehicleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: SPACING.xs,
  },
  vehicleOptionCardSelected: {
    borderColor: COLORS.emerald || '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  vehicleOptionName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  vehicleOptionNameSelected: {
    color: COLORS.emerald || '#10B981',
  },
  vehicleOptionReg: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  matchedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: COLORS.emerald || '#10B981',
  },
  matchedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.emerald || '#10B981',
    letterSpacing: 0.5,
  },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  selectedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
});

export default ReviewAssetScreen;
