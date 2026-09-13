/**
 * Asset Doctor — Master Documents Vault Screen
 *
 * Secure vault layout for asset documents:
 * - Filter chips (Invoice, Insurance, RC, PUC, Warranty, Service, Other)
 * - Search by document name or asset
 * - Document upload via camera / gallery / PDF
 * - Direct emergency & WhatsApp document sharing
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { ShareService } from '../../services/share/ShareService';
import { CloudVisionOcrService } from '../../services/ocr/CloudVisionOcrService';
import { runSweetBillChecker } from '../../services/SweetBillChecker';
import { isDuplicateBill, saveParsedBillDraft } from '../../utils/billParser';
import { DOCUMENT_TYPES } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { openLogin } from '../../navigation/authGate';
import { openReviewInvoice, openScanInvoice } from '../../navigation/navActions';
import { AssetDoctorProtectedBadge } from '../../components/trust/AssetDoctorProtectedBadge';
import { resolveProtectionBadgeState } from '../../trust/protectionStatus';
import {
  IconButton,
  PremiumIcon,
  SearchBar,
  FilterChip,
  EmptyState,
} from '../../design-system';
import {
  DocumentRow,
  PrimaryButton,
  SecondaryButton,
} from '../../components/design-system';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';

const FOLDER_ORDER = [
  'bill',
  'insurance',
  'puc',
  'warranty',
  'rc',
  'vehicle_service',
  'service_coupon',
  'electricity_bill',
  'other',
];

function folderLabel(typeId) {
  if (typeId === 'vehicle_service' || typeId === 'service') return 'Service Bill';
  if (typeId === 'electricity_bill') return 'Electricity Bill';
  return DOCUMENT_TYPES.find((d) => d.id === typeId)?.label || typeId || 'Other Doc';
}

export function DocumentsVaultScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const assetId = route?.params?.assetId;
  const { user } = useAuth();
  const { assets, getAsset } = useAssets();
  const ui = useUiFeedback();

  const asset = assetId ? getAsset(assetId) : null;
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user?.uid || !assetId) return undefined;
    return DocumentVaultService.listenToDocuments(user.uid, assetId, setDocs);
  }, [user?.uid, assetId]);

  const filteredDocs = useMemo(() => {
    let list = docs || [];
    if (selectedType !== 'all') {
      list = list.filter((d) => d.type === selectedType);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((d) =>
        (d.label || d.type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [docs, selectedType, query]);

  const sections = useMemo(() => {
    const byType = {};
    for (const doc of filteredDocs) {
      const t = doc.type || 'other';
      if (!byType[t]) byType[t] = [];
      byType[t].push(doc);
    }
    const ordered = [
      ...FOLDER_ORDER.filter((id) => byType[id]?.length),
      ...Object.keys(byType).filter((id) => !FOLDER_ORDER.includes(id)),
    ];
    return ordered.map((type) => ({
      type,
      title: folderLabel(type),
      data: byType[type],
    }));
  }, [filteredDocs]);

  const pickAndUpload = async () => {
    Haptics.tap();
    if (!user?.uid) {
      openLogin(navigation);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      ui.info('Permission needed', 'Allow photo library access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    const uploadType = selectedType === 'all' ? 'bill' : selectedType;

    if (uploadType === 'bill') {
      setBusy(true);
      try {
        const ocr = await CloudVisionOcrService.recognizeInvoice(uri);
        if (!ocr.success) {
          ui.info('OCR notice', ocr.error || 'Saved directly to vault.');
          await DocumentVaultService.uploadDocument(user.uid, assetId, {
            localPath: uri,
            type: uploadType,
          });
          return;
        }

        const sweetBill = ocr.sweetBill || {};
        const dup = await isDuplicateBill(sweetBill);
        const audit = await runSweetBillChecker(ocr.data);
        if (dup.isDuplicate) {
          audit.isDuplicate = true;
          audit.canSave = false;
          audit.duplicateMessage = 'Duplicate bill detected in vault.';
        }
        const invoicePayload = {
          ...ocr.data,
          needsManualReview: Boolean(ocr.data?.needsManualReview || ocr.needsManualReview),
        };
        await saveParsedBillDraft(sweetBill, {
          imageUri: uri,
          invoice: invoicePayload,
          engine: ocr.engine,
        });

        openReviewInvoice({
          imageUri: uri,
          invoice: invoicePayload,
          audit,
          engine: ocr.engine,
          energyHints: ocr.energyHints,
          sweetBill,
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    const upload = await DocumentVaultService.uploadDocument(user.uid, assetId, {
      localPath: uri,
      type: uploadType,
    });
    setBusy(false);
    if (!upload.success) {
      ui.error('Upload failed', upload.error);
    } else {
      ui.success('Uploaded', 'Document saved to vault.');
    }
  };

  const onWhatsAppShare = async () => {
    if (!asset) return;
    setBusy(true);
    const result = ShareService.isEmergencyShareEligible(asset)
      ? await ShareService.shareEmergencyBundle({ asset, documents: docs })
      : await ShareService.quickShareDocuments({ asset, documents: docs });
    setBusy(false);
    if (!result.success) ui.error('Share', result.error || 'Could not share documents');
  };

  // If no assetId passed, display global Document Vault asset picker
  if (!assetId) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
          <IconButton
            icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
            label="Back"
            onPress={() => navigation.goBack()}
            variant="surface"
            size={44}
          />
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={[TYPE.h2, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
              Documents Vault
            </Text>
            <Text style={[TYPE.micro, { color: colors.textMuted }]}>Select an asset</Text>
          </View>
        </View>

        <FlatList
          data={assets || []}
          keyExtractor={(item) => item.assetId || item.id}
          contentContainerStyle={{ padding: SPACING.md, gap: 10 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                Haptics.tap();
                navigation.navigate('DocumentsVault', { assetId: item.assetId || item.id });
              }}
              style={[styles.assetPickerCard, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.bodyStrong, { color: colors.text }]}>{item.assetName || item.name}</Text>
                <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {item.registration || item.category || 'Asset'}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>→</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="document"
              title="No assets in vault"
              message="Add an asset to store invoices, warranties and policies."
              ctaLabel="+ Add Asset"
              onCta={() => navigation.navigate('AddAsset')}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={() => navigation.goBack()}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[TYPE.h3, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            {asset?.assetName || 'Documents'}
          </Text>
          <Text style={[TYPE.micro, { color: colors.textMuted }]}>
            {docs.length} Document{docs.length === 1 ? '' : 's'} on file
          </Text>
        </View>
        <IconButton
          icon={<PremiumIcon name="share" size={18} color={colors.primary} />}
          label="Share"
          onPress={onWhatsAppShare}
          variant="accent"
          size={44}
        />
      </View>

      <View style={styles.filterSection}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search documents..."
          style={{ marginHorizontal: SPACING.md, marginBottom: 8 }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 8 }}>
          {['all', 'bill', 'insurance', 'warranty', 'puc', 'rc', 'vehicle_service'].map((t) => (
            <FilterChip
              key={t}
              label={t === 'all' ? 'All' : folderLabel(t)}
              selected={selectedType === t}
              onPress={() => {
                Haptics.select();
                setSelectedType(t);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id || String(Math.random())}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.background }]}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <DocumentRow
            documentType={folderLabel(item.type)}
            assetName={item.label || asset?.assetName || 'Document'}
            identifier={item.identifier || ''}
            dateText={item.createdAt ? String(item.createdAt).slice(0, 10) : ''}
            verified={!item.needsReview}
            onPress={() => {
              if (item.downloadUrl || item.storagePath) {
                ui.info('Document', `Viewing ${item.label || item.type}`);
              }
            }}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }}
        ListEmptyComponent={
          busy ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <EmptyState
              icon="document"
              title="No documents found"
              message="Upload invoices, warranty cards, insurance policies, or PUC certificates."
              ctaLabel="+ Upload Document"
              onCta={pickAndUpload}
            />
          )
        }
      />

      {/* Floating Action Button */}
      <View style={[styles.fabWrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}>
        <PrimaryButton
          title="+ Upload to Vault"
          onPress={pickAndUpload}
          loading={busy}
          style={styles.fabBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  filterSection: {
    marginBottom: SPACING.xs,
  },
  sectionHeaderWrap: {
    paddingVertical: SPACING.xs,
    marginTop: SPACING.sm,
  },
  assetPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  fabWrap: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
  },
  fabBtn: {
    borderRadius: RADIUS.lg,
  },
});
