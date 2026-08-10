/**
 * In-screen Review & Confirm after bill scan.
 * Shows classified OCR fields; saves structured JSON + micro-thumb only (no full image Storage).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { GlassButton, GlassCard, GlassInput } from './ui/Glass';
import { Haptics } from '../services/haptics';
import { useAssets } from '../context/AssetProvider';
import { useAuth } from '../context/AuthProvider';
import { invoiceToAssetForm, PURCHASE_CATEGORIES } from '../services/ocr/invoiceSchema';
import {
  buildCategoryMetadata,
  SMART_CATEGORIES,
} from '../services/ocr/categoryClassifier';
import { assignEnergyFieldsOnCreate } from '../services/energy/EnergyService';
import { ASSET_CATEGORY_OPTIONS } from '../theme/branding';
import { pickPrimaryItem } from '../utils/billLineItems';
import { formatINRExact } from '../utils/format';
import { goHomeDashboard } from '../navigation/navActions';
import { makeMicroThumbnail } from '../utils/makeMicroThumbnail';
import {
  DOC_CLASS,
  DOC_TYPE_LABELS,
  normalizeDocumentType,
} from '../services/gemini/geminiService';
import {
  matchVehicleForDocument,
  vehicleMatchLabel,
} from '../services/vehicles/VehicleMatchService';
import { AssetService, createAssetId } from '../services/assets/AssetService';

const CATEGORY_CHIPS = [
  { id: SMART_CATEGORIES.VEHICLES, label: 'Vehicle' },
  { id: SMART_CATEGORIES.GADGETS, label: 'Gadget' },
  { id: SMART_CATEGORIES.HOME_APPLIANCES, label: 'Home' },
  { id: 'insurance', label: 'Insurance' },
];

function blank(value) {
  return value == null ? '' : String(value);
}

function parseMoneyInput(text) {
  const t = String(text || '').trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function docTypeFromInvoice(invoice = {}) {
  return normalizeDocumentType(
    invoice.classifiedDocumentType ||
      invoice.geminiDocumentType ||
      invoice.ocrExtract?.document_type ||
      (invoice.documentKind === 'insurance' || invoice.documentType === 'insurance'
        ? DOC_CLASS.INSURANCE_POLICY
        : invoice.documentKind === 'rc' || invoice.documentType === 'rc'
          ? DOC_CLASS.REGISTRATION_CERTIFICATE
          : DOC_CLASS.TAX_INVOICE),
  );
}

function seedFromInvoice(invoice = {}) {
  const primary = pickPrimaryItem(invoice.items) || invoice.items?.[0];
  const docType = docTypeFromInvoice(invoice);
  const extract = invoice.ocrExtract || {};
  let smartCategory =
    invoice.smartCategory ||
    primary?.smartCategory ||
    (invoice.isVehicleInvoice || docType === DOC_CLASS.REGISTRATION_CERTIFICATE
      ? SMART_CATEGORIES.VEHICLES
      : SMART_CATEGORIES.OTHER);
  if (docType === DOC_CLASS.INSURANCE_POLICY || invoice.geminiCategory === 'Insurance') {
    smartCategory = 'insurance';
  } else if (invoice.geminiCategory === 'Gadget') {
    smartCategory = SMART_CATEGORIES.GADGETS;
  } else if (invoice.geminiCategory === 'Home') {
    smartCategory = SMART_CATEGORIES.HOME_APPLIANCES;
  } else if (invoice.geminiCategory === 'Vehicle') {
    smartCategory = SMART_CATEGORIES.VEHICLES;
  }

  const owner = blank(
    extract.owner_buyer_name || invoice.customerName || invoice.ownerName,
  );
  let vendor = blank(
    extract.vendor_dealer_name || invoice.shopName || invoice.vendorDealerName,
  );
  // Never hydrate vendor with a date/time
  if (/^(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2})/.test(vendor)) {
    vendor = blank(extract.vendor_dealer_name);
  }

  const expiry = blank(
    extract.expiry_date ||
      invoice.insuranceExpiry ||
      invoice.pucExpiry ||
      invoice.warrantyExpiry,
  );

  return {
    documentType: docType,
    productName: blank(
      extract.asset_name || invoice.productName || primary?.name,
    ),
    totalAmount:
      extract.total_amount != null && Number.isFinite(Number(extract.total_amount))
        ? Number(extract.total_amount)
        : invoice.totalAmount != null && Number.isFinite(Number(invoice.totalAmount))
          ? Number(invoice.totalAmount)
          : primary?.amount != null
            ? Number(primary.amount)
            : null,
    invoiceDate: blank(
      extract.purchase_or_issue_date || invoice.invoiceDate,
    ),
    invoiceNumber: blank(
      extract.invoice_or_policy_no || invoice.invoiceNumber || invoice.policyNumber,
    ),
    shopName: vendor,
    customerName: owner,
    chassisNumber: blank(
      extract.chassis_or_frame_no || invoice.chassisNumber,
    ),
    expiryDate: expiry,
    registration: blank(
      extract.vehicle_registration_number ||
        invoice.registration ||
        extract.registration_number,
    ),
    smartCategory,
    linkAssetId: null,
  };
}

export function ReviewAssetModal({
  visible,
  imageUri = '',
  invoice: initialInvoice = {},
  audit = null,
  onRescan,
  onDismiss,
}) {
  const insets = useSafeAreaInsets();
  const { createAsset, assets } = useAssets();
  const { user } = useAuth();
  const [form, setForm] = useState(() => seedFromInvoice(initialInvoice));
  const [saving, setSaving] = useState(false);
  const [previewUri, setPreviewUri] = useState(imageUri);
  const [matchInfo, setMatchInfo] = useState({ matched: null, matchBy: null, vehicles: [] });

  useEffect(() => {
    if (visible) {
      const seeded = seedFromInvoice(initialInvoice);
      setForm(seeded);
      setPreviewUri(imageUri);
      const probe = {
        ...initialInvoice,
        registration: seeded.registration,
        chassisNumber: seeded.chassisNumber,
        documentType:
          seeded.documentType === DOC_CLASS.INSURANCE_POLICY
            ? 'insurance'
            : seeded.documentType === DOC_CLASS.REGISTRATION_CERTIFICATE
              ? 'rc'
              : seeded.documentType === DOC_CLASS.PUC_CERTIFICATE
                ? 'puc'
                : initialInvoice.documentType,
        ocrExtract: {
          ...(initialInvoice.ocrExtract || {}),
          vehicle_registration_number: seeded.registration,
          chassis_or_frame_no: seeded.chassisNumber,
        },
      };
      setMatchInfo(matchVehicleForDocument(assets, probe));
      if (imageUri) {
        makeMicroThumbnail(imageUri)
          .then((thumb) => {
            if (thumb?.uri) setPreviewUri(thumb.uri);
          })
          .catch(() => {});
      }
    }
  }, [visible, initialInvoice, imageUri, assets]);

  const docLabel =
    DOC_TYPE_LABELS[form.documentType] ||
    initialInvoice.documentLabel ||
    'Document';

  const isInsurance = form.documentType === DOC_CLASS.INSURANCE_POLICY;
  const isRc = form.documentType === DOC_CLASS.REGISTRATION_CERTIFICATE;
  const isPuc = form.documentType === DOC_CLASS.PUC_CERTIFICATE;
  const isAttachDoc = isInsurance || isRc || isPuc;
  const needsTotal = !isInsurance && !isRc && !isPuc;

  const totalLabel = useMemo(() => {
    if (form.totalAmount == null || !Number.isFinite(Number(form.totalAmount))) return '';
    return formatINRExact(form.totalAmount);
  }, [form.totalAmount]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setCategory = (smartCategory) => {
    Haptics.select();
    patch('smartCategory', smartCategory);
  };

  const rebuildMatch = (nextForm) => {
    const probe = {
      registration: nextForm.registration,
      chassisNumber: nextForm.chassisNumber,
      linkAssetId: nextForm.linkAssetId,
      documentType: isInsurance ? 'insurance' : isRc ? 'rc' : isPuc ? 'puc' : 'bill',
      ocrExtract: {
        vehicle_registration_number: nextForm.registration,
        chassis_or_frame_no: nextForm.chassisNumber,
      },
    };
    setMatchInfo(matchVehicleForDocument(assets, probe));
  };

  const confirmMatchAndSave = (payload) =>
    new Promise((resolve) => {
      const matched = matchInfo.matched;
      if (!isAttachDoc) {
        resolve(true);
        return;
      }
      if (matched || payload.linkAssetId) {
        const label = vehicleMatchLabel(
          matched ||
            matchInfo.vehicles.find((v) => (v.assetId || v.id) === payload.linkAssetId),
        );
        Alert.alert(
          'Vehicle matched',
          `Matched with your existing ${label}. Update document (archive previous & set active)?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Update document', onPress: () => resolve(true) },
          ],
        );
        return;
      }
      if (matchInfo.vehicles?.length) {
        Alert.alert(
          'No automatic match',
          'No vehicle matched this registration/chassis. Attach to a registered vehicle below, or create a new vehicle passport.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Create new vehicle', onPress: () => resolve('create') },
            { text: 'I will pick below', onPress: () => resolve(false) },
          ],
        );
        return;
      }
      Alert.alert(
        'No vehicle in vault',
        'No registered vehicles found. Create a new vehicle passport from this scan?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Create vehicle', onPress: () => resolve('create') },
        ],
      );
    });

  const onSave = async () => {
    Haptics.tap();
    if (!String(form.productName || '').trim()) {
      Alert.alert('Asset name required', 'Enter asset / item name (e.g. TVS RONIN).');
      return;
    }
    if (needsTotal && (form.totalAmount == null || !(Number(form.totalAmount) > 0))) {
      Alert.alert('Total required', 'Enter bill total / price (e.g. 135500).');
      return;
    }
    if (isInsurance && !String(form.expiryDate || '').trim()) {
      Alert.alert('Expiry required', 'Enter insurance / policy expiry (YYYY-MM-DD).');
      return;
    }
    if (isPuc && !String(form.expiryDate || '').trim()) {
      Alert.alert('PUC expiry required', 'Enter PUC validity end date (YYYY-MM-DD).');
      return;
    }

    const decision = await confirmMatchAndSave(form);
    if (!decision) return;

    setSaving(true);
    try {
      const smartCategory =
        form.smartCategory === 'insurance' || isAttachDoc
          ? SMART_CATEGORIES.VEHICLES
          : form.smartCategory && form.smartCategory !== SMART_CATEGORIES.OTHER
            ? form.smartCategory
            : SMART_CATEGORIES.GADGETS;

      const meta = buildCategoryMetadata(smartCategory, form.productName);
      const ocrExtract = {
        document_type: form.documentType,
        asset_name: String(form.productName).trim(),
        category:
          form.smartCategory === 'insurance' || isInsurance
            ? 'Insurance'
            : form.smartCategory === SMART_CATEGORIES.VEHICLES || isAttachDoc
              ? 'Vehicle'
              : form.smartCategory === SMART_CATEGORIES.HOME_APPLIANCES
                ? 'Home'
                : 'Gadget',
        vendor_dealer_name: String(form.shopName || '').trim(),
        owner_buyer_name: String(form.customerName || '').trim(),
        invoice_or_policy_no: String(form.invoiceNumber || '').trim(),
        purchase_or_issue_date: form.invoiceDate?.trim() || null,
        total_amount:
          form.totalAmount != null && Number.isFinite(Number(form.totalAmount))
            ? Number(form.totalAmount)
            : null,
        chassis_or_frame_no: String(form.chassisNumber || '').trim(),
        vehicle_registration_number: String(form.registration || '').trim(),
        expiry_date: form.expiryDate?.trim() || null,
      };

      const scanDocumentType = isInsurance
        ? 'insurance'
        : isRc
          ? 'rc'
          : isPuc
            ? 'puc'
            : 'bill';

      let billThumbDataUrl = null;
      if (imageUri) {
        const thumb = await makeMicroThumbnail(imageUri);
        billThumbDataUrl = thumb?.dataUrl || null;
      }

      // Create vehicle stub first when user chose "create"
      let linkAssetId = form.linkAssetId || matchInfo.matched?.assetId || matchInfo.matched?.id || null;
      if (decision === 'create' && isAttachDoc && user?.uid) {
        const newId = createAssetId();
        const stub = await AssetService.createFromForm(
          user.uid,
          {
            assetId: newId,
            assetName: ocrExtract.asset_name,
            categoryId: 'bike',
            category: 'Vehicles',
            categoryLabel: 'Two Wheeler',
            smartCategory: SMART_CATEGORIES.VEHICLES,
            registration: ocrExtract.vehicle_registration_number,
            chassisNumber: ocrExtract.chassis_or_frame_no,
            storeName: ocrExtract.vendor_dealer_name,
            purchaseDate: ocrExtract.purchase_or_issue_date,
            value: 0,
            ocrDataOnly: true,
            skipBillUpload: true,
            billThumbDataUrl,
            ocrExtract,
            scanDocumentType: 'bill',
            isVehicleInvoice: true,
          },
          null,
        );
        if (!stub?.success) {
          throw new Error(stub?.error || 'Could not create vehicle passport');
        }
        linkAssetId = stub.id || newId;
      }

      const mergedInvoice = {
        ...initialInvoice,
        productName: ocrExtract.asset_name,
        totalAmount: ocrExtract.total_amount,
        invoiceDate: ocrExtract.purchase_or_issue_date,
        invoiceNumber: ocrExtract.invoice_or_policy_no,
        shopName: ocrExtract.vendor_dealer_name,
        customerName: ocrExtract.owner_buyer_name,
        chassisNumber: ocrExtract.chassis_or_frame_no,
        registration: ocrExtract.vehicle_registration_number,
        insuranceExpiry: isInsurance ? ocrExtract.expiry_date : null,
        pucExpiry: isPuc ? ocrExtract.expiry_date : null,
        warrantyExpiry: !isAttachDoc ? ocrExtract.expiry_date : null,
        smartCategory,
        purchaseCategory: PURCHASE_CATEGORIES.VEHICLES,
        isVehicleInvoice: !isAttachDoc && smartCategory === SMART_CATEGORIES.VEHICLES,
        requiresVehicleLink: isAttachDoc,
        documentType: scanDocumentType,
        documentKind: scanDocumentType,
        scanDocumentType,
        classifiedDocumentType: form.documentType,
        geminiDocumentType: form.documentType,
        documentLabel: docLabel,
        ocrExtract,
        linkAssetId,
      };

      const assetForm = invoiceToAssetForm(mergedInvoice, {
        audit,
        item: {
          name: mergedInvoice.productName,
          amount: mergedInvoice.totalAmount,
          ...meta,
          smartCategory,
        },
      });

      const categoryId =
        smartCategory === SMART_CATEGORIES.VEHICLES
          ? meta.categoryId === 'other'
            ? 'bike'
            : meta.categoryId || assetForm.categoryId || 'bike'
          : meta.categoryId || assetForm.categoryId;
      const cat = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
      const energy = assignEnergyFieldsOnCreate({
        ...assetForm,
        categoryId,
        smartCategory,
        assetName: mergedInvoice.productName,
      });

      const payload = {
        ...assetForm,
        ...energy,
        categoryId,
        category: cat?.group || assetForm.category || 'Vehicles',
        categoryLabel: cat?.label || assetForm.categoryLabel || 'Two Wheeler',
        icon: cat?.icon || assetForm.icon,
        smartCategory,
        assetName: mergedInvoice.productName,
        value: ocrExtract.total_amount || 0,
        purchaseDate: mergedInvoice.invoiceDate,
        storeName: mergedInvoice.shopName,
        chassisNumber: mergedInvoice.chassisNumber,
        registration: mergedInvoice.registration,
        insuranceExpiry: mergedInvoice.insuranceExpiry || null,
        pucExpiry: mergedInvoice.pucExpiry || null,
        warrantyExpiry: mergedInvoice.warrantyExpiry || null,
        linkAssetId,
        ocrDataOnly: true,
        skipBillUpload: true,
        billThumbDataUrl,
        ocrExtract,
        classifiedDocumentType: form.documentType,
        geminiDocumentType: form.documentType,
        scanDocumentType,
        documentType: scanDocumentType,
        documentKind: scanDocumentType,
        requiresVehicleLink: isAttachDoc,
        invoiceMeta: {
          ...(assetForm.invoiceMeta || {}),
          invoiceNumber: ocrExtract.invoice_or_policy_no,
          totalAmount: ocrExtract.total_amount,
          invoiceDate: ocrExtract.purchase_or_issue_date,
          ownerBuyerName: ocrExtract.owner_buyer_name,
          vendorDealerName: ocrExtract.vendor_dealer_name,
          classifiedDocumentType: form.documentType,
          documentLabel: docLabel,
          ocrExtract,
        },
      };

      if (isAttachDoc && !linkAssetId) {
        Alert.alert(
          'Select a vehicle',
          'Pick a registered vehicle below, or choose Create new vehicle when prompted.',
        );
        setSaving(false);
        return;
      }

      const result = await createAsset(payload, null);
      if (result?.needsVehicleLink) {
        Alert.alert(
          'Select a vehicle',
          result.error || 'Choose which vehicle this document belongs to.',
        );
        setMatchInfo({
          matched: null,
          matchBy: null,
          vehicles: result.vehicles || matchInfo.vehicles || [],
        });
        setSaving(false);
        return;
      }
      if (!result?.success) {
        throw new Error(result?.error || 'Could not save asset');
      }

      Haptics.success();
      const archivedMsg =
        result.renewed && result.archivedCount
          ? ` Previous ${scanDocumentType.toUpperCase()} archived.`
          : '';
      Alert.alert(
        result.renewed ? 'Document renewed' : 'Saved to Vault',
        result.renewed
          ? `Linked to vehicle passport. Expiry updated & alerts refreshed.${archivedMsg}`
          : 'Structured details saved. Redirecting to Home…',
        [{ text: 'OK', onPress: () => goHomeDashboard() }],
      );
      onDismiss?.();
    } catch (error) {
      Haptics.error();
      Alert.alert('Save failed', error?.message || 'Could not save to vault');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!saving) onRescan?.();
      }}
    >
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>REVIEW & CONFIRM</Text>
          <Text style={styles.title}>Confirm extracted document</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{docLabel}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
          ) : null}

          <GlassCard style={styles.card}>
            {totalLabel ? <Text style={styles.totalBanner}>{totalLabel}</Text> : null}
            <GlassInput
              label="Asset / Item Name *"
              value={form.productName}
              onChangeText={(t) => patch('productName', t)}
              placeholder="e.g. TVS RONIN 1CH BASE LIGHTNING"
            />
            {needsTotal ? (
              <GlassInput
                label="Total Amount / Price (₹) *"
                value={form.totalAmount != null ? String(form.totalAmount) : ''}
                onChangeText={(t) => patch('totalAmount', parseMoneyInput(t))}
                keyboardType="decimal-pad"
                placeholder="e.g. 135500"
              />
            ) : (
              <GlassInput
                label={isInsurance ? 'Premium (₹, optional)' : 'Amount (optional)'}
                value={form.totalAmount != null ? String(form.totalAmount) : ''}
                onChangeText={(t) => patch('totalAmount', parseMoneyInput(t))}
                keyboardType="decimal-pad"
              />
            )}
            <GlassInput
              label="Seller / Dealer / Vendor"
              value={form.shopName}
              onChangeText={(t) => patch('shopName', t)}
              placeholder="e.g. RAFTAAR MOTO LEGENDS / ICICI LOMBARD"
            />
            <GlassInput
              label="Owner / Buyer Name"
              value={form.customerName}
              onChangeText={(t) => patch('customerName', t)}
              placeholder="e.g. NIKLESH KUMAR"
            />
            <GlassInput
              label={isInsurance ? 'Policy Number' : isRc ? 'RC / Certificate No' : 'Invoice Number'}
              value={form.invoiceNumber}
              onChangeText={(t) => patch('invoiceNumber', t)}
              placeholder={isInsurance ? 'Policy no.' : 'e.g. 63246'}
            />
            <GlassInput
              label={isInsurance || isRc ? 'Issue / Registration Date' : 'Purchase Date'}
              value={form.invoiceDate}
              onChangeText={(t) => patch('invoiceDate', t)}
              placeholder="YYYY-MM-DD"
            />
            <GlassInput
              label={
                isInsurance
                  ? 'Policy Expiry *'
                  : isPuc
                    ? 'PUC Expiry *'
                    : 'Expiry / Warranty (optional)'
              }
              value={form.expiryDate}
              onChangeText={(t) => patch('expiryDate', t)}
              placeholder="YYYY-MM-DD"
            />
            <GlassInput
              label="Chassis / Frame No"
              value={form.chassisNumber}
              onChangeText={(t) => {
                const next = { ...form, chassisNumber: t };
                patch('chassisNumber', t);
                rebuildMatch(next);
              }}
              autoCapitalize="characters"
              placeholder="Used to match existing vehicle"
            />
            <GlassInput
              label="Registration Number"
              value={form.registration}
              onChangeText={(t) => {
                const reg = t.toUpperCase().replace(/\s+/g, '');
                const next = { ...form, registration: reg };
                patch('registration', reg);
                rebuildMatch(next);
              }}
              autoCapitalize="characters"
              placeholder="e.g. UP32XX1234"
            />

            {isAttachDoc ? (
              <View style={styles.matchBox}>
                <Text style={styles.matchTitle}>
                  {matchInfo.matched
                    ? `Matched: ${vehicleMatchLabel(matchInfo.matched)}`
                    : 'No automatic vehicle match'}
                </Text>
                <Text style={styles.matchSub}>
                  {matchInfo.matched
                    ? 'Saving will archive the previous document and set this one ACTIVE_CURRENT.'
                    : 'Pick a vehicle below or create a new passport on Save.'}
                </Text>
                <View style={styles.chipRow}>
                  {(matchInfo.vehicles || []).slice(0, 8).map((v) => {
                    const id = v.assetId || v.id;
                    const on = form.linkAssetId === id || matchInfo.matched?.assetId === id || matchInfo.matched?.id === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => {
                          Haptics.select();
                          const next = { ...form, linkAssetId: id };
                          setForm(next);
                          setMatchInfo({
                            matched: v,
                            matchBy: 'link',
                            vehicles: matchInfo.vehicles,
                          });
                        }}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {vehicleMatchLabel(v)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.catLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORY_CHIPS.map((chip) => {
                const on = form.smartCategory === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setCategory(chip.id)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{chip.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          <Text style={styles.hint}>
            Only structured text is saved to your vault — full bill images are not uploaded.
          </Text>

          <GlassButton
            title="Save to Vault"
            onPress={onSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
          />
          <GlassButton
            title="Cancel / Re-scan"
            onPress={() => {
              Haptics.select();
              onRescan?.();
            }}
            variant="ghost"
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: 8 },
  eyebrow: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,148,136,0.14)',
    borderColor: COLORS.emerald,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: 8 },
  preview: {
    width: '100%',
    height: 120,
    borderRadius: RADIUS.md,
    marginBottom: 12,
    backgroundColor: COLORS.bgDeep,
  },
  card: { marginBottom: 12 },
  totalBanner: {
    color: COLORS.emerald,
    fontWeight: '900',
    fontSize: 20,
    marginBottom: 10,
  },
  catLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.03)',
  },
  chipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: 'rgba(13,148,136,0.14)',
  },
  chipText: { color: COLORS.muted, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: COLORS.emerald },
  matchBox: {
    marginBottom: 12,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.35)',
    backgroundColor: 'rgba(13,148,136,0.08)',
  },
  matchTitle: { color: COLORS.text, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  matchSub: { color: COLORS.muted, fontSize: 12, lineHeight: 16, marginBottom: 10 },
  hint: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    textAlign: 'center',
  },
  saveBtn: { marginBottom: 10 },
});

export default ReviewAssetModal;
