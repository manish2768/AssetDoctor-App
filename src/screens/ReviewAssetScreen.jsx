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
import { formatINRExact } from '../utils/format';
import { ASSET_CATEGORY_OPTIONS } from '../theme/branding';
import {
  isVehicleAttachDocument,
  listVehicleAssets,
  findAssetByChassis,
} from '../utils/vehicleFolder';
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
  let label = 'Not found';
  let badgeStyle = styles.badgeNotFound;
  let textStyle = styles.badgeTextNotFound;

  if (status === 'VERIFIED' || status === 'USER_VERIFIED') {
    label = 'Verified';
    badgeStyle = styles.badgeVerified;
    textStyle = styles.badgeTextVerified;
  } else if (status === 'HIGH_CONFIDENCE') {
    label = 'High confidence';
    badgeStyle = styles.badgeVerified;
    textStyle = styles.badgeTextVerified;
  } else if (status === 'CONFLICT') {
    label = 'Conflict';
    badgeStyle = styles.badgeConflict;
    textStyle = styles.badgeTextConflict;
  } else if (status === 'NEEDS_REVIEW' || status === 'NEEDS_VERIFICATION') {
    label = 'Please verify';
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
        params.ocrFailed || params.hasOcrError || params.audit?.manualEntry,
      ),
      hasOcrError: Boolean(params.hasOcrError || params.ocrFailed),
    };
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
  const [openItems, setOpenItems] = useState(items.length > 0);
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
  const auditTimer = useRef(null);
  const manualToastShown = useRef(false);
  const originalReady = useRef(false);

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

  // Re-hydrate when a new scan payload arrives — auto-fill from scannedData / OCR aliases
  useEffect(() => {
    try {
      const scanned =
        route?.params?.scannedData ||
        route?.params?.parsedData ||
        route?.params?.assetData ||
        route?.params?.invoice ||
        initialInvoice ||
        {};
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
      setInvoice(sanitizeInvoice({}));
      setAudit(null);
    }
  }, [initialInvoice, initialAudit, route?.params]);

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
  const gstOk = audit?.gstStatus === 'verified';
  const itemList = Array.isArray(invoice.items) ? invoice.items : [];
  const itemCount = Number(invoice.itemCount) || itemList.length;
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
  const isInsurance = reviewFamily === 'insurance';
  const isPuc = reviewFamily === 'puc';
  const isRc = reviewFamily === 'rc';
  const isService = reviewFamily === 'service';
  const isVehiclePurchase = reviewFamily === 'vehicle_purchase';
  const isAttachDoc =
    isInsurance ||
    isPuc ||
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

  useEffect(() => {
    if (!isAttachDoc) return;
    if (linkAssetId) return;
    const match = matchVehicleForDocument(assets, invoice);
    if (match.matched) {
      setLinkAssetId(match.matched.assetId || match.matched.id || null);
    }
  }, [assets, invoice, isAttachDoc, linkAssetId]);
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
        'Vehicle required',
        'Pehle vehicle invoice save karein, phir Insurance / PUC / RC scan karein.',
      );
      return null;
    }
    ui.info(
      'Link to vehicle',
      'Insurance / PUC alag asset nahi banega — existing vehicle choose karein from the list above.',
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
        const result = await createAsset(payload, durableImageUri);
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
            durableImageUri,
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
          'shopGstin',
          'customerPhone',
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
          gstin: invoice.shopGstin,
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
    const latestAudit = await refreshAudit(invoice);
    const extractionGate = canSaveExtractedInvoice(invoice);
    if (!extractionGate.allowed) {
      Haptics.warning();
      ui.info(
        'Review required',
        extractionGate.message || 'Resolve conflicting or unverified fields before saving.',
      );
      return;
    }
    if (!isAttachDoc && (latestAudit.missingTotal || !totalOk)) {
      Haptics.warning();
      ui.info('Bill total required', 'Enter Grand Total before saving (e.g. 135500).');
      return;
    }
    if (!isAttachDoc && !invoice.productName?.trim()) {
      const selected =
        itemList.find((i) => i.index === selectedItemIndex) || pickPrimaryItem(itemList);
      if (!selected?.name) {
        ui.info('Product required', 'Add product / asset name before saving.');
        return;
      }
    }
    if (isAttachDoc && !invoice.insuranceExpiry && docKind === 'insurance') {
      ui.info(
        'Insurance expiry required',
        'Insurance expiry date (YYYY-MM-DD) daalein — e.g. 2026-07-13',
      );
      return;
    }

    if (!isAttachDoc && latestAudit.isDuplicate) {
      const existing = findExistingForUpdate();
      Haptics.warning();
      const ok = await ui.confirm({
        title: 'Invoice already saved',
        message: existing
          ? 'Yeh invoice pehle save ho chuka hai. Abhi jo details aapne bhare hain unse existing passport update karein?'
          : 'Yeh invoice number + GSTIN pehle scan ho chuka hai. Phir bhi save / update karein?',
        confirmLabel: existing ? 'Update passport' : 'Save anyway',
      });
      if (!ok) return;
      await persistSave(latestAudit, { allowDuplicate: true });
      return;
    }

    await persistSave(latestAudit, { allowDuplicate: false });
  };

  const checkSummary = useMemo(() => {
    const bits = [];
    bits.push(gstOk ? 'GST Verified Store' : 'Local bill');
    bits.push(totalOk ? `Total ${formatMoney(invoice.totalAmount)}` : 'Total needed');
    bits.push(itemCount ? `${itemCount} item(s)` : 'No items');
    if (audit?.isDuplicate) bits.push('Duplicate');
    return bits.join(' · ');
  }, [gstOk, totalOk, invoice.totalAmount, itemCount, audit?.isDuplicate]);

  const [openDocSec, setOpenDocSec] = useState(true);
  const [openVehicleSec, setOpenVehicleSec] = useState(true);
  const [openServiceSec, setOpenServiceSec] = useState(true);
  const [openFinSec, setOpenFinSec] = useState(true);
  const [openIdentitySec, setOpenIdentitySec] = useState(false);
  const [openDatesSec, setOpenDatesSec] = useState(true);
  const [openDebugSec, setOpenDebugSec] = useState(false);

  // Helper for field metadata & confidence
  const getFieldInfo = (fieldName, customValue) => {
    const val = customValue !== undefined ? customValue : invoice[fieldName];
    const hasVal = val !== null && val !== undefined && val !== '';
    const conf =
      invoice.fieldConfidence?.[fieldName] ??
      (hasVal ? (Number(invoice.confidence) > 0 ? Number(invoice.confidence) : 0.92) : 0);
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

  return (
    <Screen style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIconEmoji}>{ocrFailed ? '⚠️' : '✅'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {ocrFailed ? 'MANUAL ENTRY NEEDED' : 'AI ANALYSIS COMPLETE'}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {documentTypeBadge || 'Review document'}
            </Text>
            {ocrFailed ? (
              <Text style={styles.manualBanner}>
                We couldn't read this document. The image may be blurred, dark, or partially cropped.
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

        {/* Rapid review summary — one glance at what still needs a human decision */}
        <View
          style={[
            styles.rapidSummary,
            {
              borderColor:
                gstOk && totalOk && !invoice.needsManualReview
                  ? 'rgba(16,185,129,0.45)'
                  : 'rgba(245,158,11,0.5)',
              backgroundColor:
                gstOk && totalOk && !invoice.needsManualReview
                  ? 'rgba(16,185,129,0.1)'
                  : 'rgba(245,158,11,0.1)',
            },
          ]}
        >
          <View style={styles.rapidSummaryHeader}>
            <Text
              style={[
                styles.rapidSummaryTitle,
                {
                  color:
                    gstOk && totalOk && !invoice.needsManualReview
                      ? COLORS.emerald
                      : COLORS.amber,
                },
              ]}
            >
              {gstOk && totalOk && !invoice.needsManualReview
                ? 'Looks good to save'
                : 'Confirm before saving'}
            </Text>
            <Text style={styles.rapidSummaryMeta}>{checkSummary}</Text>
          </View>
          <View style={styles.rapidChips}>
            {!totalOk ? (
              <View style={styles.rapidChipWarn}>
                <Text style={styles.rapidChipWarnText}>Add Grand Total</Text>
              </View>
            ) : null}
            {!gstOk && !isAttachDoc ? (
              <View style={styles.rapidChipWarn}>
                <Text style={styles.rapidChipWarnText}>GST unverified</Text>
              </View>
            ) : null}
            {invoice.warrantyNeedsReview ? (
              <View style={styles.rapidChipWarn}>
                <Text style={styles.rapidChipWarnText}>Warranty date</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 1. DOCUMENT ESSENTIALS SECTION */}
        <Section
          title="1. Document Details"
          open={openDocSec}
          onToggle={() => setOpenDocSec((v) => !v)}
        >
          {isAttachDoc ? (
            <Text style={styles.attachHint}>
              {isInsurance
                ? 'Insurance policy — vehicle passport mein merge hogi (alag asset nahi).'
                : isPuc
                  ? 'PUC certificate — existing vehicle mein attach hogi.'
                  : 'Yeh document existing vehicle folder mein save hoga.'}
            </Text>
          ) : null}

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>
                {isInsurance ? 'Insurer / Insurance Company' : isService ? 'Workshop / Service Center' : 'Seller / Dealer / Vendor'}
              </Text>
              <StatusBadge status={getFieldInfo('shopName').status} conf={getFieldInfo('shopName').confidence} />
            </View>
            <GlassInput
              value={blank(invoice.shopName)}
              onChangeText={(t) => patch('shopName', t)}
              placeholder="Not found on document"
            />
          </View>

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>
                {isInsurance
                  ? 'Policy Number'
                  : isRc
                    ? 'RC / Certificate No'
                    : isPuc
                      ? 'PUC Certificate No'
                      : 'Invoice Number'}
              </Text>
              <StatusBadge status={getFieldInfo('invoiceNumber').status} conf={getFieldInfo('invoiceNumber').confidence} />
            </View>
              <GlassInput
                value={blank(invoice.invoiceNumber)}
                onChangeText={(t) => patch('invoiceNumber', t)}
                placeholder="Not found on document"
              />
              <FieldLearningHint
                review={invoice.fieldIntelligence?.invoiceNumber}
                currentValue={invoice.invoiceNumber}
                onUseCandidate={(v) => patch('invoiceNumber', v)}
              />
          </View>

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>
                {isInsurance ? 'Policy Issue Date' : isService ? 'Service Date' : 'Invoice / Purchase Date'}
              </Text>
              <StatusBadge status={getFieldInfo('invoiceDate').status} conf={getFieldInfo('invoiceDate').confidence} />
            </View>
            <GlassInput
              value={blank(invoice.invoiceDate)}
              onChangeText={(t) => patch('invoiceDate', t.trim() || null)}
              placeholder="Not found on document"
            />
          </View>

          {!isInsurance && !isPuc && (
            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Shop GSTIN</Text>
                <StatusBadge status={getFieldInfo('shopGstin').status} conf={getFieldInfo('shopGstin').confidence} />
              </View>
              <GlassInput
                value={blank(invoice.shopGstin)}
                onChangeText={(t) => patch('shopGstin', t.toUpperCase().trim())}
                autoCapitalize="characters"
                placeholder="Not found on document"
              />
              <FieldLearningHint
                review={invoice.fieldIntelligence?.shopGstin || invoice.fieldIntelligence?.gstin}
                currentValue={invoice.shopGstin}
                onUseCandidate={(v) => patch('shopGstin', String(v).toUpperCase().trim())}
              />
            </View>
          )}

          {!isAttachDoc ? (
            <View style={styles.linkBlock}>
              <Text style={styles.linkLabel}>Category</Text>
              <View style={styles.linkRow}>
                {REVIEW_CATEGORY_CHIPS.map((chip) => {
                  const on = activeReviewCategory === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setReviewCategory(chip.id)}
                      style={[styles.linkChip, on && styles.catChipOn]}
                    >
                      <Text style={[styles.linkChipText, on && styles.catChipTextOn]}>{chip.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {(showVehicleReg || isAttachDoc) && vehicleOptions.length ? (
            <View style={styles.linkBlock}>
              <Text style={styles.linkLabel}>Link to vehicle *</Text>
              <View style={styles.linkRow}>
                {vehicleOptions.slice(0, 12).map((v) => {
                  const id = v.assetId || v.id;
                  const on = linkAssetId === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        Haptics.select();
                        setLinkAssetId(id);
                      }}
                      style={[styles.linkChip, on && styles.linkChipOn]}
                    >
                      <Text style={[styles.linkChipText, on && styles.linkChipTextOn]} numberOfLines={1}>
                        {v.assetName || 'Vehicle'}
                        {v.registration ? ` · ${v.registration}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Section>

        {/* 2. VEHICLE / ASSET DETAILS SECTION */}
        <Section
          title="2. Vehicle / Asset Details"
          open={openVehicleSec}
          onToggle={() => setOpenVehicleSec((v) => !v)}
        >
          {!isAttachDoc && (
            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Asset / Item Name *</Text>
                <StatusBadge status={getFieldInfo('productName').status} conf={getFieldInfo('productName').confidence} />
              </View>
              <GlassInput
                value={blank(invoice.productName)}
                onChangeText={(t) => patch('productName', t)}
                placeholder="Not found on document"
              />
            </View>
          )}

          {(showVehicleReg || isAttachDoc || isService || isInsurance || isPuc || isRc) && (
            <>
              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Vehicle Registration No</Text>
                  <StatusBadge status={getFieldInfo('registration').status} conf={getFieldInfo('registration').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.registration)}
                  onChangeText={(t) => patch('registration', t.toUpperCase().replace(/\s+/g, ''))}
                  autoCapitalize="characters"
                  placeholder="Not found on document"
                />
                <FieldLearningHint
                  review={invoice.fieldIntelligence?.registration}
                  currentValue={invoice.registration}
                  onUseCandidate={(v) => patch('registration', String(v).toUpperCase().replace(/\s+/g, ''))}
                />
              </View>

              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Chassis / VIN / Frame No</Text>
                  <StatusBadge status={getFieldInfo('chassisNumber').status} conf={getFieldInfo('chassisNumber').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.chassisNumber)}
                  onChangeText={(t) => patch('chassisNumber', t.trim())}
                  autoCapitalize="characters"
                  placeholder="Not found on document"
                />
                <FieldLearningHint
                  review={invoice.fieldIntelligence?.chassisNumber}
                  currentValue={invoice.chassisNumber}
                  onUseCandidate={(v) => patch('chassisNumber', String(v).trim())}
                />
              </View>

              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Engine No</Text>
                  <StatusBadge status={getFieldInfo('engineNumber').status} conf={getFieldInfo('engineNumber').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.engineNumber)}
                  onChangeText={(t) => patch('engineNumber', t.trim())}
                  autoCapitalize="characters"
                  placeholder="Not found on document"
                />
                <FieldLearningHint
                  review={invoice.fieldIntelligence?.engineNumber}
                  currentValue={invoice.engineNumber}
                  onUseCandidate={(v) => patch('engineNumber', String(v).trim())}
                />
              </View>
            </>
          )}

          {!showVehicleReg && !isService && !isInsurance && !isPuc && !isRc && (
            <>
              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Serial Number</Text>
                  <StatusBadge status={getFieldInfo('serialNumber').status} conf={getFieldInfo('serialNumber').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.serialNumber)}
                  onChangeText={(t) => patch('serialNumber', t)}
                  placeholder="Not found on document"
                />
                <FieldLearningHint
                  review={invoice.fieldIntelligence?.serialNumber}
                  currentValue={invoice.serialNumber}
                  onUseCandidate={(v) => patch('serialNumber', v)}
                />
              </View>

              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>IMEI</Text>
                  <StatusBadge status={getFieldInfo('imei').status} conf={getFieldInfo('imei').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.imei)}
                  onChangeText={(t) => patch('imei', t.replace(/\D/g, '').slice(0, 15))}
                  keyboardType="number-pad"
                  placeholder="Not found on document"
                />
                <FieldLearningHint
                  review={invoice.fieldIntelligence?.imei}
                  currentValue={invoice.imei}
                  onUseCandidate={(v) => patch('imei', String(v).replace(/\D/g, '').slice(0, 15))}
                />
              </View>
            </>
          )}
        </Section>

        {/* 3. SERVICE SECTION (SERVICE INVOICE ONLY — STRICTLY GATED) */}
        {isService && (
          <Section
            title="3. Service & Odometer Details"
            open={openServiceSec}
            onToggle={() => setOpenServiceSec((v) => !v)}
          >
            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Current Odometer Reading (KM)</Text>
                <StatusBadge status={getFieldInfo('odometerKm').status} conf={getFieldInfo('odometerKm').confidence} />
              </View>
              <GlassInput
                value={invoice.odometerKm != null ? String(invoice.odometerKm) : ''}
                onChangeText={(t) => {
                  const n = t.trim() ? Number(t.replace(/,/g, '')) : null;
                  patch('odometerKm', Number.isFinite(n) ? n : null);
                }}
                keyboardType="number-pad"
                placeholder="Not found on document"
              />
            </View>

            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Next Service Target (KM) — (If on bill)</Text>
                <StatusBadge
                  status={getFieldInfo('nextServiceOdometerKm').status}
                  conf={getFieldInfo('nextServiceOdometerKm').confidence}
                />
              </View>
              <GlassInput
                value={
                  invoice.nextServiceOdometerKm != null
                    ? String(invoice.nextServiceOdometerKm)
                    : ''
                }
                onChangeText={(t) => {
                  const n = t.trim() ? Number(t.replace(/,/g, '')) : null;
                  patch('nextServiceOdometerKm', Number.isFinite(n) ? n : null);
                }}
                keyboardType="number-pad"
                placeholder="Not found on document"
              />
            </View>

            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Next Service Date — (If on bill)</Text>
                <StatusBadge status={getFieldInfo('nextServiceDue').status} conf={getFieldInfo('nextServiceDue').confidence} />
              </View>
              <GlassInput
                value={blank(invoice.nextServiceDue)}
                onChangeText={(t) => patch('nextServiceDue', t.trim() || null)}
                placeholder="Not found on document"
              />
            </View>
          </Section>
        )}

        {/* 4. FINANCIAL SECTION */}
        <Section
          title="4. Financial Breakdown"
          open={openFinSec}
          onToggle={() => setOpenFinSec((v) => !v)}
        >
          {isInsurance && invoice.idvAmount != null && (
            <View style={styles.fieldItem}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Insured Declared Value (IDV ₹)</Text>
                <StatusBadge status={getFieldInfo('idvAmount').status} conf={getFieldInfo('idvAmount').confidence} />
              </View>
              <GlassInput
                value={String(invoice.idvAmount)}
                onChangeText={(t) => patch('idvAmount', parseMoneyInput(t))}
                keyboardType="decimal-pad"
                placeholder="Not found on document"
              />
            </View>
          )}

          {isService && (
            <>
              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Labour Charges (₹)</Text>
                  <StatusBadge status={getFieldInfo('labourCharges').status} conf={getFieldInfo('labourCharges').confidence} />
                </View>
                <GlassInput
                  value={invoice.labourCharges != null ? String(invoice.labourCharges) : ''}
                  onChangeText={(t) => patch('labourCharges', parseMoneyInput(t))}
                  keyboardType="decimal-pad"
                  placeholder="Not found on document"
                />
              </View>

              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>Parts Total (₹)</Text>
                  <StatusBadge status={getFieldInfo('partsTotal').status} conf={getFieldInfo('partsTotal').confidence} />
                </View>
                <GlassInput
                  value={invoice.partsTotal != null ? String(invoice.partsTotal) : ''}
                  onChangeText={(t) => patch('partsTotal', parseMoneyInput(t))}
                  keyboardType="decimal-pad"
                  placeholder="Not found on document"
                />
              </View>
            </>
          )}

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>Tax / GST Amount (₹)</Text>
              <StatusBadge status={getFieldInfo('taxAmount').status} conf={getFieldInfo('taxAmount').confidence} />
            </View>
            <GlassInput
              value={invoice.taxAmount != null ? String(invoice.taxAmount) : ''}
              onChangeText={(t) => patch('taxAmount', parseMoneyInput(t))}
              keyboardType="decimal-pad"
              placeholder="Not found on document"
            />
          </View>

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>
                {isInsurance ? 'Total Premium Paid (₹) *' : 'Grand Total / Price (₹) *'}
              </Text>
              <StatusBadge status={getFieldInfo('totalAmount').status} conf={getFieldInfo('totalAmount').confidence} />
            </View>
            <GlassInput
              value={
                invoice.totalAmount != null && Number.isFinite(Number(invoice.totalAmount))
                  ? String(invoice.totalAmount)
                  : ''
              }
              onChangeText={(t) => patch('totalAmount', parseMoneyInput(t))}
              keyboardType="decimal-pad"
              placeholder="Not found on document"
            />
            <FieldLearningHint
              review={invoice.fieldIntelligence?.totalAmount}
              currentValue={invoice.totalAmount}
              onUseCandidate={(v) => patch('totalAmount', parseMoneyInput(String(v)))}
            />
          </View>
        </Section>

        {/* 5. IDENTITY SECTION */}
        <Section
          title="5. Identity & Contact"
          open={openIdentitySec}
          onToggle={() => setOpenIdentitySec((v) => !v)}
        >
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>
                {isInsurance ? 'Insured / Policyholder Name' : 'Owner / Buyer / Customer Name'}
              </Text>
              <StatusBadge status={getFieldInfo('customerName').status} conf={getFieldInfo('customerName').confidence} />
            </View>
            <GlassInput
              value={blank(invoice.customerName)}
              onChangeText={(t) => patch('customerName', t)}
              placeholder="Not found on document"
            />
          </View>

          <View style={styles.fieldItem}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>Customer Contact Phone</Text>
              <StatusBadge status={getFieldInfo('customerPhone').status} conf={getFieldInfo('customerPhone').confidence} />
            </View>
            <GlassInput
              value={blank(invoice.customerPhone)}
              onChangeText={(t) => patch('customerPhone', t)}
              keyboardType="phone-pad"
              placeholder="Not found on document"
            />
            <FieldLearningHint
              review={invoice.fieldIntelligence?.customerPhone || invoice.fieldIntelligence?.phone}
              currentValue={invoice.customerPhone}
              onUseCandidate={(v) => patch('customerPhone', v)}
            />
          </View>
        </Section>

        {/* 6. DATES & VALIDITY SECTION */}
        {(isInsurance || isPuc || showVehicleReg || !isAttachDoc) && (
          <Section
            title="6. Validity & Expiry Dates"
            open={openDatesSec}
            onToggle={() => setOpenDatesSec((v) => !v)}
          >
            {isInsurance && (
              <>
                <View style={styles.fieldItem}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>Policy Start Date</Text>
                    <StatusBadge status={getFieldInfo('policyStartDate').status} conf={getFieldInfo('policyStartDate').confidence} />
                  </View>
                  <GlassInput
                    value={blank(invoice.policyStartDate || invoice.insuranceStart)}
                    onChangeText={(t) => patch('policyStartDate', t.trim() || null)}
                    placeholder="Not found on document"
                  />
                </View>

                <View style={styles.fieldItem}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>Policy Expiry Date</Text>
                    <StatusBadge status={getFieldInfo('insuranceExpiry').status} conf={getFieldInfo('insuranceExpiry').confidence} />
                  </View>
                  <GlassInput
                    value={blank(invoice.insuranceExpiry)}
                    onChangeText={(t) => patch('insuranceExpiry', t.trim() || null)}
                    placeholder="Not found on document"
                  />
                  {invoice.insuranceExpiry ? (
                    <Text style={[styles.expiryHint, { color: insuranceTone.color, marginTop: 4 }]}>
                      Insurance · {formatDateIN(invoice.insuranceExpiry)} · {insuranceTone.label}
                    </Text>
                  ) : null}
                </View>
              </>
            )}

            {(isPuc || showVehicleReg) && (
              <View style={styles.fieldItem}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldLabel}>PUC Expiry Date</Text>
                  <StatusBadge status={getFieldInfo('pucExpiry').status} conf={getFieldInfo('pucExpiry').confidence} />
                </View>
                <GlassInput
                  value={blank(invoice.pucExpiry)}
                  onChangeText={(t) => patch('pucExpiry', t.trim() || null)}
                  placeholder="Not found on document"
                />
                {invoice.pucExpiry ? (
                  <Text style={[styles.expiryHint, { color: pucTone.color, marginTop: 4 }]}>
                    PUC · {formatDateIN(invoice.pucExpiry)} · {pucTone.label}
                  </Text>
                ) : null}
              </View>
            )}

            {!isAttachDoc && !isInsurance && !isPuc && (
              <>
                <View style={styles.fieldItem}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>Warranty (Months)</Text>
                    <StatusBadge status={getFieldInfo('warrantyPeriodMonths').status} conf={getFieldInfo('warrantyPeriodMonths').confidence} />
                  </View>
                  <GlassInput
                    value={invoice.warrantyPeriodMonths != null ? String(invoice.warrantyPeriodMonths) : ''}
                    onChangeText={(t) => {
                      const n = t.trim() ? Number(t) : null;
                      patch('warrantyPeriodMonths', Number.isFinite(n) ? n : null);
                    }}
                    keyboardType="number-pad"
                    placeholder="Not found on document"
                  />
                </View>

                <View style={styles.fieldItem}>
                  <View style={styles.fieldHeaderRow}>
                    <Text style={styles.fieldLabel}>Warranty Expiry Date</Text>
                    <StatusBadge status={getFieldInfo('warrantyExpiry').status} conf={getFieldInfo('warrantyExpiry').confidence} />
                  </View>
                  <GlassInput
                    value={blank(invoice.warrantyExpiry || invoice.warrantyEndDate)}
                    onChangeText={(t) => patch('warrantyExpiry', t.trim() || null)}
                    placeholder="Not found on document"
                  />
                  {invoice.warrantyPeriodMonths != null ? (
                    <View style={styles.warrantyComputedRow}>
                      <Text style={styles.warrantyComputedText}>
                        {invoice.warrantyExpiry
                          ? `Warranty runs until ${formatDateIN(invoice.warrantyExpiry)} (${invoice.warrantyPeriodMonths} mo from purchase date).`
                          : `Warranty period (${invoice.warrantyPeriodMonths} mo) found, but no start date — add the purchase date to auto-calculate expiry.`}
                      </Text>
                      {invoice.warrantyNeedsReview ? (
                        <Text style={[styles.warrantyReviewFlag]}>Needs review</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </Section>
        )}

        {/* 7. LINE ITEMS (FOR SERVICE INVOICES OR MULTI-ITEM RECEIPTS) */}
        {!isInsurance && !isPuc && !isRc && (
          <Section
            title={`Line Items (${itemCount})`}
            open={openItems}
            onToggle={() => setOpenItems((v) => !v)}
          >
            {itemList.length ? (
              itemList.map((item) => (
                <ItemDetailCard
                  key={`${item.index}-${item.name}`}
                  title={`${item.index}. ${item.name}`}
                  qty={item.qty}
                  rate={item.rate}
                  amount={item.amount}
                  warrantyExpiry={invoice.warrantyExpiry}
                  pucExpiry={item.trackPucService ? invoice.pucExpiry : null}
                  nextServiceDue={
                    item.trackPucService || item.seasonalServiceAlerts
                      ? invoice.nextServiceDue
                      : null
                  }
                  selected={item.index === selectedItemIndex}
                  smartCategory={item.smartCategory}
                  trackImei={item.trackImei}
                  trackPucService={item.trackPucService}
                  seasonalServiceAlerts={item.seasonalServiceAlerts}
                  showCategoryPicker={!item.isFee}
                  onCategoryChange={(cat) => setItemCategory(item.index, cat)}
                  onPress={() => {
                    Haptics.select();
                    setSelectedItemIndex(item.index);
                    setSaveAllItems(false);
                    if (item.name) patch('productName', item.name);
                  }}
                />
              ))
            ) : (
              <Text style={styles.hint}>No itemized lines detected on bill.</Text>
            )}
            {itemList.length > 1 ? (
              <Pressable
                onPress={() => {
                  Haptics.select();
                  setSaveAllItems((v) => !v);
                }}
                style={styles.saveAllToggle}
              >
                <Text style={styles.saveAllText}>
                  {saveAllItems ? '✓ Save all items separately' : 'Save selected item only'}
                </Text>
              </Pressable>
            ) : null}
          </Section>
        )}

        {typeof __DEV__ !== 'undefined' && __DEV__ ? (
        <Section
          title="Developer Diagnostics"
          open={openDebugSec}
          onToggle={() => setOpenDebugSec((v) => !v)}
        >
          <Text style={styles.hint}>
            OCR Engine {safeParams.engine || invoice.engine || 'unknown'}
            {invoice.fallbackUsed ? ' · Fallback used' : ' · Fallback not used'}
          </Text>
          <View style={styles.debugTable}>
            <View style={styles.debugHeaderRow}>
              <Text style={[styles.debugCellHeader, { flex: 1.2 }]}>Field</Text>
              <Text style={[styles.debugCellHeader, { flex: 1.5 }]}>Value</Text>
              <Text style={[styles.debugCellHeader, { flex: 0.8 }]}>Conf</Text>
              <Text style={[styles.debugCellHeader, { flex: 1 }]}>Status</Text>
              <Text style={[styles.debugCellHeader, { flex: 1 }]}>Source</Text>
            </View>
            {[
              { label: 'Doc Type', info: getFieldInfo('classifiedDocumentType', classifiedType) },
              { label: 'Workshop/Vendor', info: getFieldInfo('shopName') },
              { label: 'Registration', info: getFieldInfo('registration') },
              { label: 'Odometer (KM)', info: getFieldInfo('odometerKm') },
              { label: 'Next Service KM', info: getFieldInfo('nextServiceOdometerKm') },
              { label: 'Chassis / VIN', info: getFieldInfo('chassisNumber') },
              { label: 'Engine No', info: getFieldInfo('engineNumber') },
              { label: 'Invoice / Policy No', info: getFieldInfo('invoiceNumber') },
              { label: 'Issue / Service Date', info: getFieldInfo('invoiceDate') },
              { label: 'Policy Expiry', info: getFieldInfo('insuranceExpiry') },
              { label: 'Grand Total (₹)', info: getFieldInfo('totalAmount') },
            ].map((row, idx) => (
              <View key={idx} style={[styles.debugRow, idx % 2 === 1 && styles.debugRowAlt]}>
                <Text style={[styles.debugCell, { flex: 1.2, fontWeight: '700' }]}>{row.label}</Text>
                <Text style={[styles.debugCell, { flex: 1.5, color: row.info.value ? COLORS.text : COLORS.muted }]}>
                  {row.info.value != null ? String(row.info.value) : 'null'}
                </Text>
                <Text style={[styles.debugCell, { flex: 0.8 }]}>{row.info.confidence}%</Text>
                <Text style={[styles.debugCell, { flex: 1, color: getStatusColor(row.info.status) }]}>
                  {row.info.status}
                </Text>
                <Text style={[styles.debugCell, { flex: 1, fontSize: 9 }]}>{row.info.sourceType}</Text>
              </View>
            ))}
          </View>
        </Section>
        ) : null}

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
        {!totalOk ? <Text style={styles.blockHint}>Enter bill total to save.</Text> : null}
        {audit?.isDuplicate ? (
          <Text style={styles.blockHint}>
            Invoice pehle save ho chuka hai — Save dabao, phir Update passport choose karo.
          </Text>
        ) : null}
      </ScrollView>

      <ShareAssetModal
        visible={Boolean(shareCard)}
        assetName={shareCard?.assetName || ''}
        price={shareCard?.price}
        imageUri={shareCard?.imageUri || ''}
        onClose={() => setShareCard(null)}
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
    next.amount,
    next.price,
    next.total_amount,
    scanned.total_amount,
    scanned.totalAmount,
    extract.total_amount,
  );
  if (total != null) next.totalAmount = total;

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
    'shopGstin',
    'shopPhone',
    'shopAddress',
    'invoiceNumber',
    'productName',
    'serialNumber',
    'imei',
    'chassisNumber',
    'engineNumber',
    'registration',
    'paymentMode',
    'customerName',
    'customerPhone',
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
  if (!Array.isArray(next.items)) next.items = [];
  next.items = next.items.map((item, i) => {
    const withIndex = { ...item, index: item.index || i + 1 };
    if (withIndex.isFee) return withIndex;
    if (withIndex.smartCategory) return withIndex;
    return enrichItemWithCategory(withIndex, next.productName || '');
  });
  next.itemCount = Number(next.itemCount) || next.items.length;
  return next;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, paddingBottom: 40 },
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
});

export default ReviewAssetScreen;
