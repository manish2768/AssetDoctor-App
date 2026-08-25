/**
 * Add / Edit Asset — same form, mode from route.params.assetId
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAssets } from '../../context/AssetProvider';
import {
  ASSET_CATEGORY_OPTIONS,
  CONDITION_OPTIONS,
  ASSET_STATUS_OPTIONS,
  COLORS,
  DEFAULT_TARIFF_PER_KWH,
} from '../../theme/branding';
import { ASSET_STATUS } from '../../constants/assetStatus';
import { Haptics } from '../../services/haptics';
import { LottieSuccess } from '../../components/LottieSuccess';
import { calculateResaleValue } from '../../utils/resaleCalculator';
import { formatINR, formatINRExact } from '../../utils/format';
import { toVaultValue } from '../../utils/parseMoneyValue';
import { normalizeStoredDate } from '../../utils/dates';
import { lookupBrandHelpline } from '../../constants/brandDirectory';
import {
  defaultWattsForCategory,
  defaultPowerFactorForCategory,
  defaultDailyHoursForCategory,
  getCategoryPowerMeta,
  estimatePowerCost,
} from '../../utils/powerCost';
import { useAuth } from '../../context/AuthProvider';
import { openLogin } from '../../navigation/authGate';
import { OcrService } from '../../services/ocr/OcrService';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { extractRtoCode } from '../../utils/vehicleSpecs';

const CATEGORY_GROUPS = [
  'Vehicles',
  'Electronics & Appliances',
  'Digital Bills & Utility Subscriptions',
  'Personal & Legal',
];

function categoryIdFromOcr(data) {
  const text = `${data?.assetName || ''} ${data?.category || ''}`.toLowerCase();
  if (/scooter/.test(text)) return 'scooter';
  if (/bike|motorcycle|ronin/.test(text)) return 'bike';
  if (/car|vehicle|chassis|vin/.test(text)) return 'car';
  if (/air conditioner|\bac\b/.test(text)) return 'ac';
  if (/\btv\b|television/.test(text)) return 'tv';
  if (/fridge|refrigerator/.test(text)) return 'fridge';
  if (/washing|washer/.test(text)) return 'washing_machine';
  if (/laptop|notebook/.test(text)) return 'laptop';
  if (/phone|mobile|imei/.test(text)) return 'mobile';
  if (/rent|lease/.test(text)) return 'rent_agreement';
  if (/property|deed|house/.test(text)) return 'property';
  if (/insurance policy/.test(text)) return 'insurance_policy';
  if (/legal/.test(text)) return 'legal_document';
  return data?.serialNumber ? 'appliance' : 'other';
}

export function AddAssetScreen({ navigation, route }) {
  const editingId = route?.params?.assetId || null;
  const openScanner = Boolean(route?.params?.openScanner);
  const scanLabel = route?.params?.scanLabel || 'Scan Bill / RC with Camera';
  const { createAsset, updateAsset, getAsset } = useAssets();
  const { isAuthenticated } = useAuth();
  const existing = editingId ? getAsset(editingId) : null;
  const isEdit = Boolean(editingId && existing);
  const bottomPad = useTabSafeBottomPadding({ extra: 24 });

  const resolveInitialCategoryId = () => {
    if (existing?.categoryId) return existing.categoryId;
    const raw = String(route?.params?.categoryId || route?.params?.category || '').trim();
    if (!raw) return 'bike';
    const lower = raw.toLowerCase();
    if (lower === 'appliance' || lower === 'appliances' || lower === 'electronics') {
      return 'appliance';
    }
    if (ASSET_CATEGORY_OPTIONS.some((c) => c.id === lower)) return lower;
    return 'bike';
  };

  const [categoryId, setCategoryId] = useState(resolveInitialCategoryId);
  const [status, setStatus] = useState(existing?.status || ASSET_STATUS.ACTIVE);
  const [assetName, setAssetName] = useState(existing?.assetName || '');
  const [storeName, setStoreName] = useState(existing?.storeName || '');
  const [value, setValue] = useState(existing?.value != null ? String(existing.value) : '');
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchaseDate || '');
  const [warrantyMonths, setWarrantyMonths] = useState(
    existing?.warrantyMonths != null ? String(existing.warrantyMonths) : '12',
  );
  const [registration, setRegistration] = useState(existing?.registration || '');
  const [serialNumber, setSerialNumber] = useState(existing?.serialNumber || '');
  const [chassisNumber, setChassisNumber] = useState(existing?.chassisNumber || '');
  const [rtoCode, setRtoCode] = useState(existing?.rtoCode || '');
  const [fuelNorm, setFuelNorm] = useState(existing?.fuelNorm || '');
  const [warrantyExpiry, setWarrantyExpiry] = useState(existing?.warrantyExpiry || '');
  const [insuranceExpiry, setInsuranceExpiry] = useState(existing?.insuranceExpiry || '');
  const [pucExpiry, setPucExpiry] = useState(existing?.pucExpiry || '');
  const [condition, setCondition] = useState(existing?.condition || 'good');
  const [dailyHours, setDailyHours] = useState(
    existing?.dailyHours != null
      ? String(existing.dailyHours)
      : String(defaultDailyHoursForCategory(existing?.categoryId || 'bike') || 0),
  );
  const [powerWatts, setPowerWatts] = useState(
    existing?.powerWatts != null
      ? String(existing.powerWatts)
      : String(defaultWattsForCategory(existing?.categoryId || 'bike') || 0),
  );
  const [powerFactor, setPowerFactor] = useState(
    existing?.powerFactor != null
      ? String(existing.powerFactor)
      : String(defaultPowerFactorForCategory(existing?.categoryId || 'bike') || 1),
  );
  const [odometerKm, setOdometerKm] = useState(
    existing?.odometerKm != null ? String(existing.odometerKm) : '',
  );
  const [nextServiceOdometerKm, setNextServiceOdometerKm] = useState(
    existing?.nextServiceOdometerKm != null ? String(existing.nextServiceOdometerKm) : '',
  );
  const [nextServiceDue, setNextServiceDue] = useState(existing?.nextServiceDue || '');
  const [brandName, setBrandName] = useState(existing?.brandName || '');
  const [supportPhone, setSupportPhone] = useState(existing?.supportPhone || '');
  const [supportUrl, setSupportUrl] = useState(existing?.supportUrl || '');
  const isVehicleCategory = [
    'bike',
    'car',
    'scooter',
    'vehicle',
    'motorcycle',
    'vehicle_parts',
  ].includes(categoryId);
  const [scanUri, setScanUri] = useState(null);
  const [scanDocumentType, setScanDocumentType] = useState('bill');
  const [scanHint, setScanHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedId, setSavedId] = useState(editingId);

  useEffect(() => {
    if (isEdit) return;
    const raw = String(route?.params?.categoryId || route?.params?.category || '').trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const resolved =
      lower === 'appliance' || lower === 'appliances' || lower === 'electronics'
        ? 'appliance'
        : ASSET_CATEGORY_OPTIONS.some((c) => c.id === lower)
          ? lower
          : null;
    if (resolved) setCategoryId(resolved);
  }, [route?.params?.categoryId, route?.params?.category, isEdit]);

  useEffect(() => {
    if (!existing) return;
    setCategoryId(existing.categoryId || 'bike');
    setStatus(existing.status || ASSET_STATUS.ACTIVE);
    setAssetName(existing.assetName || '');
    setStoreName(existing.storeName || '');
    setValue(existing.value != null ? String(existing.value) : '');
    setPurchaseDate(existing.purchaseDate || '');
    setWarrantyMonths(existing.warrantyMonths != null ? String(existing.warrantyMonths) : '12');
    setRegistration(existing.registration || '');
    setSerialNumber(existing.serialNumber || '');
    setChassisNumber(existing.chassisNumber || '');
    setRtoCode(existing.rtoCode || '');
    setFuelNorm(existing.fuelNorm || '');
    setWarrantyExpiry(existing.warrantyExpiry || '');
    setInsuranceExpiry(existing.insuranceExpiry || '');
    setPucExpiry(existing.pucExpiry || '');
    setNextServiceDue(existing.nextServiceDue || '');
    setCondition(existing.condition || 'good');
    setDailyHours(
      existing.dailyHours != null
        ? String(existing.dailyHours)
        : String(defaultDailyHoursForCategory(existing.categoryId) || 0),
    );
    setPowerWatts(
      existing.powerWatts != null
        ? String(existing.powerWatts)
        : String(defaultWattsForCategory(existing.categoryId) || 0),
    );
    setPowerFactor(
      existing.powerFactor != null
        ? String(existing.powerFactor)
        : String(defaultPowerFactorForCategory(existing.categoryId) || 1),
    );
    setOdometerKm(existing.odometerKm != null ? String(existing.odometerKm) : '');
    setNextServiceOdometerKm(
      existing.nextServiceOdometerKm != null ? String(existing.nextServiceOdometerKm) : '',
    );
    setBrandName(existing.brandName || '');
    setSupportPhone(existing.supportPhone || '');
    setSupportUrl(existing.supportUrl || '');
  }, [existing?.id, existing?.assetId]);

  const runCameraScan = async () => {
    Haptics.tap();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera', 'Allow camera access to scan Bill / RC.');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: true,
      });
      if (shot.canceled || !shot.assets?.[0]?.uri) return;

      const uri = shot.assets[0].uri;
      setScanUri(uri);
      setScanHint('Bill / RC captured — auto-vault on save');
      Haptics.success();

      const ocr = await OcrService.recognizeFromImage(uri);
      if (ocr?.success && ocr.data) {
        if (ocr.data.assetName && !assetName) setAssetName(ocr.data.assetName);
        if (ocr.data.storeName && !storeName) setStoreName(ocr.data.storeName);
        if (ocr.data.purchaseDate && !purchaseDate) setPurchaseDate(ocr.data.purchaseDate);
        if (ocr.data.serialNumber && !serialNumber) setSerialNumber(ocr.data.serialNumber);
        if (ocr.data.chassisNumber && !chassisNumber) setChassisNumber(ocr.data.chassisNumber);
        if (ocr.data.warrantyExpiry && !warrantyExpiry) {
          setWarrantyExpiry(ocr.data.warrantyExpiry);
        }
        if (ocr.data.insuranceExpiry && !insuranceExpiry) {
          setInsuranceExpiry(ocr.data.insuranceExpiry);
        }
        setCategoryId(categoryIdFromOcr(ocr.data));
        const nextCategory = categoryIdFromOcr(ocr.data);
        const meta = getCategoryPowerMeta(nextCategory);
        if (meta.isAppliance) {
          const hints = ocr.energyHints || {};
          if (hints.powerWatts) setPowerWatts(String(hints.powerWatts));
          else setPowerWatts(String(meta.powerWatts || 0));
          if (hints.powerFactor) setPowerFactor(String(hints.powerFactor));
          else setPowerFactor(String(meta.powerFactor || 1));
          setDailyHours((prev) =>
            Number(prev) > 0 ? prev : String(meta.dailyHours || 0),
          );
          setScanHint(
            hints.powerWatts
              ? `Auto-tagged · found ${hints.powerWatts}W on bill — confirm & Save`
              : 'Auto-tagged · appliance energy defaults applied — confirm & Save',
          );
        } else {
          setScanHint('Auto-tagged — confirm every field, then Save to Vault');
        }
      } else if (ocr?.needsNative) {
        setScanHint('Photo attached — fill name & save to auto-vault (OCR optional on device)');
      }
    } catch (e) {
      Alert.alert('Scan', e?.message || 'Could not open camera');
    }
  };

  useEffect(() => {
    if (openScanner && !isEdit) {
      const t = setTimeout(() => {
        runCameraScan();
      }, 350);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openScanner, isEdit]);

  const applianceMeta = getCategoryPowerMeta(categoryId);
  const billPreview = useMemo(() => {
    if (!applianceMeta.isAppliance) return null;
    return estimatePowerCost({
      powerWatts: Number(powerWatts) || applianceMeta.powerWatts,
      hoursUsed: Number(dailyHours) || applianceMeta.dailyHours,
      powerFactor: Number(powerFactor) || applianceMeta.powerFactor,
      tariffPerKwh: DEFAULT_TARIFF_PER_KWH,
    });
  }, [applianceMeta, powerWatts, dailyHours, powerFactor]);

  const applyCategoryPowerDefaults = (nextId) => {
    const meta = getCategoryPowerMeta(nextId);
    setPowerWatts(String(meta.powerWatts || 0));
    setPowerFactor(String(meta.powerFactor || 1));
    setDailyHours(String(meta.dailyHours || 0));
  };

  const previewResale = useMemo(
    () =>
      calculateResaleValue({
        purchaseValue: Number(value) || 0,
        purchaseDate,
        categoryId,
        condition,
      }),
    [value, purchaseDate, categoryId, condition],
  );

  const resolveWarrantyExpiry = () => {
    const override = normalizeStoredDate(warrantyExpiry);
    if (override) return override;
    const months = Number(warrantyMonths);
    const purchaseIso = normalizeStoredDate(purchaseDate);
    if (!purchaseIso || !months) return null;
    const d = new Date(`${purchaseIso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  const buildPayload = () => {
    const cat = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
    const vehicle = [
      'bike',
      'car',
      'scooter',
      'vehicle',
      'motorcycle',
      'vehicle_parts',
    ].includes(categoryId);
    return {
      categoryId,
      category: cat?.group || 'General',
      categoryLabel: cat?.label || categoryId,
      icon: cat?.icon || 'other',
      status,
      assetName,
      storeName,
      value: toVaultValue(value, 0),
      purchaseDate: normalizeStoredDate(purchaseDate),
      registration: vehicle ? registration : '',
      serialNumber,
      chassisNumber: vehicle ? chassisNumber : '',
      rtoCode: vehicle ? rtoCode.trim() || extractRtoCode(registration) || '' : '',
      fuelNorm: vehicle ? fuelNorm.trim() || '' : '',
      warrantyMonths: Number(warrantyMonths) || 0,
      warrantyExpiry: resolveWarrantyExpiry(),
      insuranceExpiry: vehicle ? normalizeStoredDate(insuranceExpiry) : null,
      pucExpiry: vehicle ? normalizeStoredDate(pucExpiry) : null,
      nextServiceDue: normalizeStoredDate(nextServiceDue),
      condition,
      powerWatts: Number(powerWatts) || defaultWattsForCategory(categoryId),
      powerFactor: Number(powerFactor) || defaultPowerFactorForCategory(categoryId) || 1,
      dailyHours: Number(dailyHours) || 0,
      odometerKm: vehicle && odometerKm !== '' ? Number(odometerKm) : null,
      nextServiceOdometerKm:
        vehicle && nextServiceOdometerKm !== '' ? Number(nextServiceOdometerKm) : null,
      scanDocumentType,
      brandName: brandName.trim(),
      supportPhone:
        supportPhone.trim() ||
        lookupBrandHelpline(`${brandName} ${assetName}`)?.phone ||
        '',
      supportUrl: supportUrl.trim(),
    };
  };

  const onSave = async () => {
    Haptics.tap();
    if (!isAuthenticated) {
      openLogin(navigation);
      setError('Sign in required to save this asset.');
      return;
    }
    if (!String(assetName || '').trim()) {
      setError('Asset name is required');
      return;
    }
    setBusy(true);
    setError('');
    const payload = buildPayload();
    const result = isEdit
      ? await updateAsset(editingId, payload, scanUri)
      : await createAsset(payload, scanUri);
    setBusy(false);
    if (!result.success) {
      if (result.queuedOffline) {
        setError('Offline — change queued and will sync when you reconnect.');
        return;
      }
      setError(result.error || 'Save failed');
      return;
    }
    setSavedId(result.id || editingId);
    setShowSuccess(true);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
    >      <Text style={styles.title}>
        {isEdit ? 'Edit Asset' : openScanner ? 'Scan → Auto-Vault' : 'Add Asset'}
      </Text>
      <Text style={styles.sub}>
        {isEdit
          ? 'Update details, warranty & resale inputs'
          : openScanner
            ? 'Scan Bill / RC with Camera — zero typing when possible'
            : 'Bike, Car, Mobile, AC, TV, Fridge & more'}
      </Text>

      <Pressable style={styles.scanBtn} onPress={runCameraScan}>
        <Text style={styles.scanBtnText}>📷 {scanLabel}</Text>
      </Pressable>
      {scanUri ? (
        <View style={styles.scanPreview}>
          <Image source={{ uri: scanUri }} style={styles.scanImage} />
          {scanHint ? <Text style={styles.scanHint}>{scanHint}</Text> : null}
          <Text style={styles.label}>Scanned document type</Text>
          <View style={styles.chips}>
            {[
              { id: 'bill', label: 'Purchase Bill / Invoice' },
              { id: 'rc', label: 'RC Book' },
            ].map((type) => (
              <Pressable
                key={type.id}
                onPress={() => {
                  Haptics.select();
                  setScanDocumentType(type.id);
                }}
                style={[styles.chip, scanDocumentType === type.id && styles.chipOn]}
              >
                <Text style={styles.chipText}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : scanHint ? (
        <Text style={styles.scanHint}>{scanHint}</Text>
      ) : null}

      <Text style={styles.section}>What are you adding?</Text>
      {CATEGORY_GROUPS.map((group) => (
        <View key={group} style={styles.categoryGroup}>
          <Text style={styles.groupLabel}>{group}</Text>
          <View style={styles.chips}>
            {ASSET_CATEGORY_OPTIONS.filter((c) => c.group === group).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  Haptics.select();
                  setCategoryId(c.id);
                  applyCategoryPowerDefaults(c.id);
                }}
                style={[styles.chip, categoryId === c.id && styles.chipOn]}
              >
                <View style={styles.chipInner}>
                  <CategoryIcon
                    name={c.icon || c.id}
                    size={18}
                    color={categoryId === c.id ? COLORS.emerald : COLORS.muted}
                  />
                  <Text style={styles.chipText}>{c.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.section}>Status</Text>
      <View style={styles.chips}>
        {ASSET_STATUS_OPTIONS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => {
              Haptics.select();
              setStatus(s.id);
            }}
            style={[styles.chip, status === s.id && styles.chipOn]}
          >
            <Text style={styles.chipText}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Field label="Asset Name" value={assetName} onChangeText={setAssetName} placeholder="TVS Ronin 225" />
      <Field label="Store / Dealer" value={storeName} onChangeText={setStoreName} />
      <Field
        label="Purchase Date (DD/MM/YYYY or YYYY-MM-DD)"
        value={purchaseDate}
        onChangeText={setPurchaseDate}
        placeholder="24/06/2015"
      />
      <Field label="Price (₹)" value={value} onChangeText={setValue} keyboardType="numeric" />
      <Field label="Warranty (months)" value={warrantyMonths} onChangeText={setWarrantyMonths} keyboardType="numeric" placeholder="12" />
      <Field
        label="Warranty Expiry (optional override)"
        value={warrantyExpiry}
        onChangeText={setWarrantyExpiry}
        placeholder="23/06/2025 or 2025-06-23"
      />
      <Field label="Serial Number" value={serialNumber} onChangeText={setSerialNumber} />
      {isVehicleCategory ? (
        <>
          <Text style={styles.section}>Vehicle details</Text>
          <Field label="Registration / Plate" value={registration} onChangeText={setRegistration} />
          <Field
            label="RTO Code"
            value={rtoCode}
            onChangeText={setRtoCode}
            placeholder={extractRtoCode(registration) || 'MH12'}
          />
          <Field
            label="Fuel Norms"
            value={fuelNorm}
            onChangeText={setFuelNorm}
            placeholder="BS6 / Petrol / CNG"
          />
          <Field label="Chassis / VIN" value={chassisNumber} onChangeText={setChassisNumber} />
          <Field
            label="Insurance Expiry"
            value={insuranceExpiry}
            onChangeText={setInsuranceExpiry}
            placeholder="YYYY-MM-DD"
          />
          <Field label="PUC Expiry" value={pucExpiry} onChangeText={setPucExpiry} placeholder="YYYY-MM-DD" />
          <Field
            label="Next Service Date"
            value={nextServiceDue}
            onChangeText={setNextServiceDue}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Current odometer (km)"
            value={odometerKm}
            onChangeText={setOdometerKm}
            keyboardType="numeric"
            placeholder="12450"
          />
          <Field
            label="Next service at (km)"
            value={nextServiceOdometerKm}
            onChangeText={setNextServiceOdometerKm}
            keyboardType="numeric"
            placeholder="12570"
          />
        </>
      ) : (
        <Field
          label="Next Service / AMC Date (optional)"
          value={nextServiceDue}
          onChangeText={setNextServiceDue}
          placeholder="YYYY-MM-DD"
        />
      )}
      {applianceMeta.isAppliance ? (
        <>
          <Text style={styles.section}>Appliance Energy (bill estimate)</Text>
          <Field
            label="Rated Watts"
            value={powerWatts}
            onChangeText={setPowerWatts}
            keyboardType="numeric"
            placeholder="1500"
          />
          <Field
            label="Power Factor (0.3 – 1.0)"
            value={powerFactor}
            onChangeText={setPowerFactor}
            keyboardType="decimal-pad"
            placeholder="0.85"
          />
          <Field
            label="Daily Hours Used"
            value={dailyHours}
            onChangeText={setDailyHours}
            keyboardType="numeric"
            placeholder="8"
          />
          {billPreview ? (
            <View style={styles.billPreview}>
              <Text style={styles.previewLabel}>Estimated electricity bill</Text>
              <Text style={styles.previewValue}>
                {formatINRExact(billPreview.costInr)} / day
              </Text>
              <Text style={styles.scanHint}>
                ≈ {formatINRExact(billPreview.costInr * 30)} / month · {billPreview.kwh} kWh/day
                {'\n'}
                {billPreview.formula} @ ₹{DEFAULT_TARIFF_PER_KWH}/kWh
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      <Text style={styles.section}>Warranty & Customer Care</Text>
      <Field label="Brand / Manufacturer" value={brandName} onChangeText={setBrandName} />
      <Field
        label="Customer Care Phone"
        value={supportPhone}
        onChangeText={setSupportPhone}
        keyboardType="phone-pad"
        placeholder="1800..."
      />
      <Field
        label="Support Website"
        value={supportUrl}
        onChangeText={setSupportUrl}
        keyboardType="url"
        autoCapitalize="none"
        placeholder="https://..."
      />

      <Text style={styles.section}>Condition</Text>
      <View style={styles.chips}>
        {CONDITION_OPTIONS.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              Haptics.select();
              setCondition(c.id);
            }}
            style={[styles.chip, condition === c.id && styles.chipOn]}
          >
            <Text style={styles.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>Resale estimate</Text>
        <Text style={styles.previewValue}>{formatINR(previewResale.estimatedResale)}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={onSave} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{isEdit ? 'Save Changes' : 'Save to Vault'}</Text>
        )}
      </Pressable>

      <LottieSuccess
        visible={showSuccess}
        title={isEdit ? 'Asset updated!' : 'Asset Doctor Vaulted! 🛡️'}
        subtitle={isEdit ? BRAND.tagline : 'Safely stored in your Cloud Locker'}
        onFinish={() => {
          setShowSuccess(false);
          navigation?.replace?.('AssetPassport', { assetId: savedId });
        }}
      />
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#6B7280" style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  sub: { color: COLORS.muted, marginBottom: 16, marginTop: 4, fontSize: 12 },
  scanBtn: {
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtnText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 14 },
  scanPreview: { marginBottom: 12 },
  scanImage: { width: '100%', height: 160, borderRadius: 14 },
  scanHint: { color: COLORS.emerald, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  section: { color: COLORS.muted, fontSize: 10, fontWeight: '800', marginBottom: 8, marginTop: 8 },
  categoryGroup: { marginBottom: 6 },
  groupLabel: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: 'rgba(59,130,246,0.28)', borderColor: COLORS.neonBlue },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  label: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
  },
  preview: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,245,160,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.35)',
  },
  previewLabel: { color: COLORS.emerald, fontSize: 11, fontWeight: '700' },
  previewValue: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  billPreview: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  primary: {
    marginTop: 16,
    backgroundColor: COLORS.neonBlue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  error: { color: COLORS.rose, marginTop: 10, textAlign: 'center' },
});

export default AddAssetScreen;
