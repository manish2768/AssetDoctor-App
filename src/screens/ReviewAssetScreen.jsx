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
  Alert,
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
import {
  buildCategoryMetadata,
  SMART_CATEGORIES,
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
import { pickPrimaryItem } from '../utils/billLineItems';
import { InvoiceOfflineCache } from '../services/ocr/InvoiceOfflineCache';
import { goHomeDashboard } from '../navigation/navActions';
import { persistScannedImage } from '../services/vault/VaultInvoiceUpload';
import { formatINRExact } from '../utils/format';
import { ASSET_CATEGORY_OPTIONS } from '../theme/branding';
import { enrichItemWithCategory } from '../services/ocr/categoryClassifier';
import {
  isVehicleAttachDocument,
  listVehicleAssets,
  findAssetByChassis,
} from '../utils/vehicleFolder';
import { getExpiryTone } from '../utils/warrantyStatus';
import { formatDateIN } from '../utils/dates';
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

export function ReviewAssetScreen({ navigation, route }) {
  const { createAsset, assets } = useAssets();
  const { user } = useAuth();
  const initialInvoice = route?.params?.invoice || {};
  const initialAudit = route?.params?.audit || null;
  const imageUri = route?.params?.imageUri || '';
  const scanId = route?.params?.scanId || '';
  const energyHints = route?.params?.energyHints || {};

  const items = Array.isArray(initialInvoice.items) ? initialInvoice.items : [];
  const defaultSelected = pickPrimaryItem(items)?.index || items[0]?.index || 1;

  const [invoice, setInvoice] = useState(() => sanitizeInvoice(initialInvoice));
  const [audit, setAudit] = useState(initialAudit);
  const [saving, setSaving] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(defaultSelected);
  const [saveAllItems, setSaveAllItems] = useState(false);
  const [openCheck, setOpenCheck] = useState(true);
  const [openItems, setOpenItems] = useState(items.length > 0);
  const [openMore, setOpenMore] = useState(false);
  const [linkAssetId, setLinkAssetId] = useState(null);
  const auditTimer = useRef(null);

  const docKind = String(
    invoice.documentKind || invoice.documentType || invoice.scanDocumentType || 'bill',
  ).toLowerCase();
  const isAttachDoc = isVehicleAttachDocument(docKind) || Boolean(invoice.requiresVehicleLink);
  const gstOk = audit?.gstStatus === 'verified';
  // Never hard-disable Save — duplicate / total issues show alerts instead
  const canSave = true;
  const itemList = Array.isArray(invoice.items) ? invoice.items : [];
  const itemCount = Number(invoice.itemCount) || itemList.length;
  const totalOk =
    isAttachDoc ||
    (invoice.totalAmount != null &&
      Number.isFinite(Number(invoice.totalAmount)) &&
      Number(invoice.totalAmount) > 0);
  const showVehicleReg =
    invoice.purchaseCategory === PURCHASE_CATEGORIES.VEHICLES ||
    Boolean(invoice.isVehicleInvoice) ||
    isAttachDoc ||
    itemList.some((i) => i.smartCategory === SMART_CATEGORIES.VEHICLES);
  const vehicleOptions = useMemo(() => listVehicleAssets(assets), [assets]);
  const insuranceTone = getExpiryTone(invoice.insuranceExpiry, { urgentDays: 30 });
  const pucTone = getExpiryTone(invoice.pucExpiry, { urgentDays: 15 });

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
      showVehicleReg ||
      Boolean(invoice.isVehicleInvoice) ||
      isAttachDoc ||
      invoice.purchaseCategory === PURCHASE_CATEGORIES.VEHICLES;
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

    const linked = linkAssetId
      ? vehicleOptions.find((a) => (a.assetId || a.id) === linkAssetId)
      : null;

    return {
      ...form,
      ...energy,
      categoryId,
      category: cat?.group || form.category || 'Vehicles',
      categoryLabel: cat?.label || form.categoryLabel || 'Two Wheeler',
      icon: cat?.icon || form.icon,
      smartCategory,
      trackImei: meta.trackImei,
      trackPucService: meta.trackPucService || trackVehicle,
      seasonalServiceAlerts: meta.seasonalServiceAlerts,
      registration: trackVehicle
        ? String(invoice.registration || linked?.registration || '').trim()
        : '',
      serialNumber: String(invoice.serialNumber || item.serialNumber || '').trim(),
      imei: String(invoice.imei || item.imei || '').replace(/\D/g, '').slice(0, 15),
      chassisNumber: trackVehicle
        ? (() => {
            const ch = String(invoice.chassisNumber || linked?.chassisNumber || '').trim();
            return /^(?:no|n\/a|na|nil)$/i.test(ch) || ch.length < 8 ? '' : ch;
          })()
        : '',
      engineNumber: trackVehicle
        ? (() => {
            const en = String(invoice.engineNumber || linked?.engineNumber || '').trim();
            return /^(?:no|n\/a|na|nil)$/i.test(en) || en.length < 8 ? '' : en;
          })()
        : '',
      pucExpiry: invoice.pucExpiry || null,
      insuranceExpiry: invoice.insuranceExpiry || null,
      warrantyExpiry:
        resolvedDocType === 'insurance' || resolvedDocType === 'puc'
          ? null
          : form.warrantyExpiry || null,
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

  const promptVehicleLink = (vehicles) =>
    new Promise((resolve) => {
      if (!vehicles?.length) {
        Alert.alert(
          'Vehicle required',
          'Pehle vehicle invoice save karein, phir Insurance / PUC / RC scan karein.',
          [{ text: 'OK', onPress: () => resolve(null) }],
        );
        return;
      }
      Alert.alert(
        'Link to vehicle',
        'Insurance / PUC alag asset nahi banega — existing vehicle choose karein:',
        [
          ...vehicles.slice(0, 5).map((v) => ({
            text: `${v.assetName || 'Vehicle'}${v.registration ? ` · ${v.registration}` : ''}`,
            onPress: () => resolve(v.assetId || v.id),
          })),
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ],
      );
    });

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

      let durableImageUri = imageUri;
      if (imageUri && user?.uid) {
        try {
          durableImageUri = await persistScannedImage(imageUri, user.uid);
        } catch {
          durableImageUri = imageUri;
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
        const payload = buildPayloadForItem(
          { ...item, name: item.name || invoice.productName },
          latestAudit,
        );
        // Force merge into known vehicle when re-saving same invoice
        if (chosenLink && !isAttachDoc) {
          payload.linkAssetId = chosenLink;
          payload.isVehicleInvoice = true;
          const linked = vehicleOptions.find((a) => (a.assetId || a.id) === chosenLink);
          if (linked?.registration && !payload.registration) {
            payload.registration = linked.registration;
          }
          if (linked?.chassisNumber && !payload.chassisNumber) {
            const ch = String(linked.chassisNumber).trim();
            if (ch.length >= 8 && !/^(?:no|n\/a|na)$/i.test(ch)) {
              payload.chassisNumber = ch;
            }
          }
        }
        if (chosenLink && isAttachDoc) {
          payload.linkAssetId = chosenLink;
          const linked = vehicleOptions.find((a) => (a.assetId || a.id) === chosenLink);
          if (linked?.registration && !payload.registration) {
            payload.registration = linked.registration;
          }
          if (linked?.chassisNumber && !payload.chassisNumber) {
            payload.chassisNumber = linked.chassisNumber;
          }
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

      if (latestAudit.fingerprint) {
        await rememberInvoiceFingerprint(latestAudit.fingerprint);
      }
      if (!isAttachDoc) {
        await rememberBillFingerprint({
          gstin: invoice.shopGstin,
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
      Alert.alert(
        'Saved',
        isAttachDoc
          ? 'Document vehicle passport mein add ho gaya.'
          : existingMatch || chosenLink
            ? 'Passport updated with your details.'
            : finalTargets.length > 1
              ? `${finalTargets.length} items saved.`
              : 'Saved to vault.',
        [
          {
            text: 'Passport',
            onPress: () => navigation.replace('AssetPassport', { assetId: lastId }),
          },
          {
            text: 'Done',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
              goHomeDashboard();
            },
          },
        ],
      );
    } catch (error) {
      Haptics.error();
      Alert.alert('Save failed', error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    Haptics.tap();
    const latestAudit = await refreshAudit(invoice);
    if (!isAttachDoc && (latestAudit.missingTotal || !totalOk)) {
      Haptics.warning();
      Alert.alert('Bill total required', 'Enter Grand Total before saving (e.g. 135500).');
      return;
    }
    if (!isAttachDoc && !invoice.productName?.trim()) {
      const selected =
        itemList.find((i) => i.index === selectedItemIndex) || pickPrimaryItem(itemList);
      if (!selected?.name) {
        Alert.alert('Product required', 'Add product / asset name before saving.');
        return;
      }
    }
    if (isAttachDoc && !invoice.insuranceExpiry && docKind === 'insurance') {
      Alert.alert(
        'Insurance expiry required',
        'Insurance expiry date (YYYY-MM-DD) daalein — e.g. 2026-07-13',
      );
      return;
    }

    if (!isAttachDoc && latestAudit.isDuplicate) {
      const existing = findExistingForUpdate();
      Haptics.warning();
      Alert.alert(
        'Invoice already saved',
        existing
          ? 'Yeh invoice pehle save ho chuka hai. Abhi jo details aapne bhare hain unse existing passport update karein?'
          : 'Yeh invoice number + GSTIN pehle scan ho chuka hai. Phir bhi save / update karein?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: existing ? 'Update passport' : 'Save anyway',
            onPress: () => persistSave(latestAudit, { allowDuplicate: true }),
          },
        ],
      );
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

  return (
    <Screen style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>CONFIRM & SAVE</Text>
            <Text style={styles.title}>Review bill</Text>
          </View>
        </View>

        <InvoicePostcard
          imageUri={imageUri}
          shopName={invoice.shopName || 'Scanned invoice'}
          totalLabel={
            invoice.totalAmount != null && Number(invoice.totalAmount) > 0
              ? formatINRExact(invoice.totalAmount)
              : ''
          }
        />

        <Section title={`Bill Check · ${checkSummary}`} open={openCheck} onToggle={() => setOpenCheck((v) => !v)}>
          <View style={styles.pillRow}>
            <AuditPill ok={gstOk} label={audit?.gstBadge || (gstOk ? 'GST Verified Store' : 'Local bill')} />
            <AuditPill ok={totalOk} label={totalOk ? 'Total OK' : 'Total missing'} />
            <AuditPill ok={itemCount > 0} label={itemCount > 0 ? `Items (${itemCount})` : 'Items (0)'} />
            <AuditPill ok={!audit?.isDuplicate} label={audit?.isDuplicate ? 'Duplicate' : 'Unique'} />
          </View>
          {audit?.itemsAuditMessage ? (
            <Text style={styles.auditNote}>{audit.itemsAuditMessage}</Text>
          ) : null}
          {audit?.gstMessage ? <Text style={styles.auditNote}>{audit.gstMessage}</Text> : null}
        </Section>

        <GlassCard style={styles.essentials}>
          <Text style={styles.essentialsTitle}>Essentials</Text>
          {isAttachDoc ? (
            <Text style={styles.attachHint}>
              {docKind === 'insurance'
                ? 'Insurance policy — vehicle passport mein merge hogi (alag asset nahi).'
                : docKind === 'puc'
                  ? 'PUC certificate — existing vehicle mein attach hogi.'
                  : 'Yeh document existing vehicle folder mein save hoga.'}
            </Text>
          ) : null}
          {!isAttachDoc ? (
            <GlassInput
              label="Product / brand + model *"
              value={blank(invoice.productName)}
              onChangeText={(t) => patch('productName', t)}
            />
          ) : null}
          {!isAttachDoc ? (
            <GlassInput
              label="Bill total / Grand Total (₹) *"
              value={
                invoice.totalAmount != null && Number.isFinite(Number(invoice.totalAmount))
                  ? String(invoice.totalAmount)
                  : ''
              }
              onChangeText={(t) => patch('totalAmount', parseMoneyInput(t))}
              keyboardType="decimal-pad"
            />
          ) : null}
          <GlassInput
            label="Invoice date (YYYY-MM-DD)"
            value={blank(invoice.invoiceDate)}
            onChangeText={(t) => patch('invoiceDate', t.trim() || null)}
          />
          {(showVehicleReg || isAttachDoc) && vehicleOptions.length ? (
            <View style={styles.linkBlock}>
              <Text style={styles.linkLabel}>Link to vehicle *</Text>
              <View style={styles.linkRow}>
                {vehicleOptions.slice(0, 6).map((v) => {
                  const id = v.assetId || v.id;
                  const on = linkAssetId === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => {
                        Haptics.select();
                        setLinkAssetId(id);
                        if (v.registration) patch('registration', v.registration);
                        if (v.chassisNumber) patch('chassisNumber', v.chassisNumber);
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
          {showVehicleReg || isAttachDoc ? (
            <>
              <GlassInput
                label="Vehicle registration"
                value={blank(invoice.registration)}
                onChangeText={(t) => patch('registration', t.toUpperCase().replace(/\s+/g, ''))}
                autoCapitalize="characters"
                placeholder="Leave blank if not on bill"
              />
              {!isAttachDoc ? (
                <Text style={styles.blockHint}>
                  Purchase invoice pe PUC / Insurance expiry usually nahi hota — alag PUC /
                  Insurance paper scan karein, ya yahan manually daalein.
                </Text>
              ) : null}
              <GlassInput
                label="Insurance expiry (YYYY-MM-DD)"
                value={blank(invoice.insuranceExpiry)}
                onChangeText={(t) => patch('insuranceExpiry', t.trim() || null)}
                placeholder="YYYY-MM-DD"
              />
              {invoice.insuranceExpiry ? (
                <Text style={[styles.expiryHint, { color: insuranceTone.color }]}>
                  Insurance · {formatDateIN(invoice.insuranceExpiry)} · {insuranceTone.label}
                </Text>
              ) : null}
              <GlassInput
                label="PUC expiry (YYYY-MM-DD)"
                value={blank(invoice.pucExpiry)}
                onChangeText={(t) => patch('pucExpiry', t.trim() || null)}
                placeholder="YYYY-MM-DD"
              />
              {invoice.pucExpiry ? (
                <Text style={[styles.expiryHint, { color: pucTone.color }]}>
                  PUC · {formatDateIN(invoice.pucExpiry)} · {pucTone.label}
                </Text>
              ) : null}
            </>
          ) : null}
          {!isAttachDoc ? (
            <GlassInput
              label="Warranty months"
              value={invoice.warrantyPeriodMonths != null ? String(invoice.warrantyPeriodMonths) : ''}
              onChangeText={(t) => {
                const n = t.trim() ? Number(t) : null;
                patch('warrantyPeriodMonths', Number.isFinite(n) ? n : null);
              }}
              keyboardType="number-pad"
            />
          ) : null}
        </GlassCard>

        <Section
          title={`Items (${itemCount})`}
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
            <Text style={styles.hint}>No line items detected — product name above is enough.</Text>
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

        <Section title="More details" open={openMore} onToggle={() => setOpenMore((v) => !v)}>
          <GlassInput label="Shop name" value={blank(invoice.shopName)} onChangeText={(t) => patch('shopName', t)} />
          <GlassInput
            label="Shop GSTIN"
            value={blank(invoice.shopGstin)}
            onChangeText={(t) => patch('shopGstin', t.toUpperCase().trim())}
            autoCapitalize="characters"
          />
          <GlassInput
            label="Invoice number"
            value={blank(invoice.invoiceNumber)}
            onChangeText={(t) => patch('invoiceNumber', t)}
          />
          {showVehicleReg ? (
            <>
              <GlassInput
                label="Vehicle registration / RC No"
                value={blank(invoice.registration)}
                onChangeText={(t) => patch('registration', t.toUpperCase().replace(/\s+/g, ''))}
                autoCapitalize="characters"
                placeholder="Leave blank if not on bill"
              />
              <GlassInput
                label="PUC Expiry (YYYY-MM-DD)"
                value={blank(invoice.pucExpiry)}
                onChangeText={(t) => patch('pucExpiry', t.trim() || null)}
                placeholder="2026-12-31"
              />
              <GlassInput
                label="Next Service Date (YYYY-MM-DD)"
                value={blank(invoice.nextServiceDue)}
                onChangeText={(t) => patch('nextServiceDue', t.trim() || null)}
                placeholder="2026-09-15"
              />
              <GlassInput
                label="Current odometer (km)"
                value={invoice.odometerKm != null ? String(invoice.odometerKm) : ''}
                onChangeText={(t) => {
                  const n = t.trim() ? Number(t.replace(/,/g, '')) : null;
                  patch('odometerKm', Number.isFinite(n) ? n : null);
                }}
                keyboardType="number-pad"
                placeholder="12450"
              />
              <GlassInput
                label="Next service at (km)"
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
                placeholder="15000"
              />
              <GlassInput
                label="Chassis / Frame No"
                value={blank(invoice.chassisNumber)}
                onChangeText={(t) => patch('chassisNumber', t.trim())}
                autoCapitalize="characters"
                placeholder="MD637AN11S2F03328"
              />
              <GlassInput
                label="Engine No"
                value={blank(invoice.engineNumber)}
                onChangeText={(t) => patch('engineNumber', t.trim())}
                autoCapitalize="characters"
                placeholder="BN1FS2302943"
              />
            </>
          ) : null}
          {!showVehicleReg ? (
            <GlassInput
              label="Next Service / AMC Date (YYYY-MM-DD)"
              value={blank(invoice.nextServiceDue)}
              onChangeText={(t) => patch('nextServiceDue', t.trim() || null)}
              placeholder="Optional for appliances"
            />
          ) : null}
          <GlassInput
            label="Serial number"
            value={blank(invoice.serialNumber)}
            onChangeText={(t) => patch('serialNumber', t)}
            placeholder="Leave blank if not on bill"
          />
          <GlassInput
            label="IMEI"
            value={blank(invoice.imei)}
            onChangeText={(t) => patch('imei', t.replace(/\D/g, '').slice(0, 15))}
            keyboardType="number-pad"
            placeholder="Leave blank if not on bill"
          />
          <GlassInput
            label="Tax amount (₹)"
            value={invoice.taxAmount != null ? String(invoice.taxAmount) : ''}
            onChangeText={(t) => patch('taxAmount', parseMoneyInput(t))}
            keyboardType="decimal-pad"
          />
          <GlassInput
            label="Payment mode"
            value={blank(invoice.paymentMode)}
            onChangeText={(t) => patch('paymentMode', t)}
          />
        </Section>

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
        {!totalOk ? <Text style={styles.blockHint}>Enter bill total to save.</Text> : null}
        {audit?.isDuplicate ? (
          <Text style={styles.blockHint}>
            Invoice pehle save ho chuka hai — Save dabao, phir Update passport choose karo.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Ensure no dummy strings leak into controlled inputs */
function sanitizeInvoice(raw = {}) {
  const next = { ...raw };
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
  ];
  for (const key of stringKeys) {
    if (next[key] == null) next[key] = '';
    else next[key] = String(next[key]).trim();
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
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  eyebrow: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
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
  attachHint: {
    color: COLORS.amber,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 16,
  },
  expiryHint: { fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: -4 },
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
  linkChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  linkChipTextOn: { color: '#FF8A97' },
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
  blockHint: {
    color: COLORS.amber,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
    fontSize: 12,
  },
});

export default ReviewAssetScreen;
