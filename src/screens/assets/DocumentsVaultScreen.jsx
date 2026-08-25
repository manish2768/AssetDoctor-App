import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { EmptyState } from '../../components/ui/DesignSystem';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { ShareService } from '../../services/share/ShareService';
import { CloudVisionOcrService } from '../../services/ocr/CloudVisionOcrService';
import { runSweetBillChecker } from '../../services/SweetBillChecker';
import {
  isDuplicateBill,
  saveParsedBillDraft,
} from '../../utils/billParser';
import { DOCUMENT_TYPES, COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { openLogin } from '../../navigation/authGate';
import { openReviewInvoice } from '../../navigation/navActions';
import { vaultCopyForAsset } from '../../design-system/assetIntelligenceSchema';

const FOLDER_ORDER = [
  'bill',
  'insurance',
  'puc',
  'warranty',
  'rc',
  'service_coupon',
  'amc',
  'property_papers',
  'rent_agreement',
  'policy',
  'guarantee',
  'other',
];

function folderLabel(typeId) {
  return DOCUMENT_TYPES.find((d) => d.id === typeId)?.label || typeId || 'Other Doc';
}

function folderIcon(typeId) {
  return DOCUMENT_TYPES.find((d) => d.id === typeId)?.icon || '📁';
}

function resolveDocStatus(item) {
  if (item.needsReview) return { label: 'Needs Review', icon: '⚠️', tone: 'warning' };
  if (item.verified || item.fieldStatus === 'verified') {
    return { label: 'Verified', icon: '✓', tone: 'success' };
  }
  if (item.pendingSync) return { label: 'Pending Sync', icon: '↻', tone: 'muted' };
  if (item.offlineCached) return { label: 'Offline', icon: '📴', tone: 'muted' };
  if (item.processing) return { label: 'Processing', icon: '⏳', tone: 'info' };
  if (item.expired) return { label: 'Expired', icon: '⏰', tone: 'danger' };
  if (item.status === 'pending' || item.fieldStatus === 'pending') {
    return { label: 'Pending', icon: '…', tone: 'muted' };
  }
  return { label: 'Pending', icon: '…', tone: 'muted' };
}

function formatDocDate(item) {
  const raw = item.createdAt || item.uploadedAt;
  if (!raw) return null;
  return String(raw).slice(0, 10);
}

export function DocumentsVaultScreen({ route, navigation }) {
  const assetId = route?.params?.assetId;
  const { user } = useAuth();
  const { getAsset } = useAssets();
  const ui = useUiFeedback();
  const asset = getAsset(assetId);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selectedType, setSelectedType] = useState('bill');

  useEffect(() => {
    if (!user?.uid || !assetId) return undefined;
    return DocumentVaultService.listenToDocuments(user.uid, assetId, setDocs);
  }, [user?.uid, assetId]);

  const sections = useMemo(() => {
    const byType = {};
    for (const doc of docs || []) {
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
      title: `${folderIcon(type)} ${folderLabel(type)}`,
      data: byType[type],
    }));
  }, [docs]);

  if (!assetId) {
    return (
      <View style={[styles.root, { justifyContent: 'center' }]}>
        <Text style={styles.empty}>Select an asset from Documents to manage its vault.</Text>
        <Pressable onPress={() => navigation?.goBack?.()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

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

    // Bill / invoice photos → Cloud Vision OCR + Sweet Bill review before vault save
    if (selectedType === 'bill') {
      setBusy(true);
      try {
        const ocr = await CloudVisionOcrService.recognizeInvoice(uri);
        if (!ocr.success) {
          ui.info('OCR failed', ocr.error || 'Could not read this bill. Uploading without parse.');
          const upload = await DocumentVaultService.uploadDocument(user.uid, assetId, {
            localPath: uri,
            type: selectedType,
          });
          if (!upload.success) {
            if (upload.queuedOffline) {
              ui.info('Saved offline', upload.error);
            } else {
              ui.error('Upload failed', upload.error);
            }
          }
          return;
        }

        const sweetBill = ocr.sweetBill || {};
        const dup = await isDuplicateBill(sweetBill);
        const audit = await runSweetBillChecker(ocr.data);
        if (dup.isDuplicate) {
          audit.isDuplicate = true;
          audit.canSave = false;
          audit.duplicateMessage =
            'Duplicate bill detected (GSTIN + Total + Date already scanned).';
        }
        await saveParsedBillDraft(sweetBill, {
          imageUri: uri,
          invoice: ocr.data,
          engine: ocr.engine,
        });

        openReviewInvoice({
          imageUri: uri,
          invoice: {
            ...ocr.data,
            shopGstin: ocr.data.shopGstin || sweetBill.gstin || '',
            invoiceDate: ocr.data.invoiceDate || sweetBill.invoiceDate,
            totalAmount: ocr.data.totalAmount ?? sweetBill.totalAmount,
            warrantyExpiry: ocr.data.warrantyExpiry || sweetBill.expiryDate,
          },
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
      type: selectedType,
    });
    setBusy(false);
    if (!upload.success) {
      if (upload.queuedOffline) {
        ui.info('Saved offline', upload.error);
      } else {
        ui.error('Upload failed', upload.error);
      }
    }
  };

  const pickPdfAndUpload = async () => {
    Haptics.tap();
    if (!user?.uid) {
      openLogin(navigation);
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setBusy(true);
    const file = result.assets[0];
    const upload = await DocumentVaultService.uploadDocument(user.uid, assetId, {
      localPath: file.uri,
      type: selectedType,
      label: file.name || undefined,
      mimeType: file.mimeType || 'application/pdf',
    });
    setBusy(false);
    if (!upload.success) {
      if (upload.queuedOffline) {
        ui.info('Saved offline', upload.error);
      } else {
        ui.error('Upload failed', upload.error);
      }
    }
  };

  const onWhatsAppShare = async () => {
    setBusy(true);
    const result = ShareService.isEmergencyShareEligible(asset)
      ? await ShareService.shareEmergencyBundle({ asset, documents: docs })
      : await ShareService.quickShareDocuments({ asset, documents: docs });
    setBusy(false);
    if (!result.success) ui.error('Share', result.error || 'Could not share documents');
  };

  const onDelete = async (doc) => {
    const ok = await ui.confirm({
      title: 'Delete document?',
      message: doc.label || doc.type,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await DocumentVaultService.deleteDocument(
      user.uid,
      assetId,
      doc.docId || doc.id,
      doc.storagePath,
    );
  };

  const vaultCopy = vaultCopyForAsset(asset || {});

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Documents Vault</Text>
      <Text style={styles.sub}>{vaultCopy.subtitle}</Text>

      <View style={styles.chips}>
        {DOCUMENT_TYPES.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.select();
              setSelectedType(t.id);
            }}
            style={[styles.chip, selectedType === t.id && styles.chipOn]}
          >
            <Text style={styles.chipText}>
              {t.icon} {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={pickAndUpload} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>
            {selectedType === 'bill' ? 'Scan Bill (AI OCR)' : 'Upload Selected Type'}
          </Text>
        )}
      </Pressable>
      {busy && selectedType === 'bill' ? (
        <Text style={styles.ocrHint}>AI Processing Invoice & Verifying GST...</Text>
      ) : null}

      <Pressable style={styles.pdf} onPress={pickPdfAndUpload} disabled={busy}>
        <Text style={styles.primaryText}>Add PDF Document</Text>
      </Pressable>

      <Pressable style={styles.whatsapp} onPress={onWhatsAppShare}>
        <Text style={styles.primaryText}>
          {ShareService.isEmergencyShareEligible(asset)
            ? 'Emergency Share · Offline PDF'
            : 'Share Vault Documents'}
        </Text>
      </Pressable>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id || item.docId}
        contentContainerStyle={{ paddingVertical: 16 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="📄"
            title="Keep your important documents in one secure place."
            message={vaultCopy.subtitle}
            ctaLabel={selectedType === 'bill' ? 'Scan Bill (AI OCR)' : 'Upload Selected Type'}
            onCta={pickAndUpload}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const status = resolveDocStatus(item);
          const docDate = formatDocDate(item);
          const typeLabel = folderLabel(item.type);
          const assetLabel = asset?.nickname || asset?.assetName || 'This asset';
          return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle}>{item.label || typeLabel}</Text>
              <Text style={styles.docMeta} numberOfLines={1}>
                {folderIcon(item.type)} {typeLabel} · {assetLabel}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, styles[`status_${status.tone}`]]}>
                  <Text style={styles.statusIcon}>{status.icon}</Text>
                  <Text style={styles.statusText}>{status.label}</Text>
                </View>
                {docDate ? <Text style={styles.docDate}>{docDate}</Text> : null}
                {item.expiryDate ? (
                  <Text style={styles.docDate}>Exp {String(item.expiryDate).slice(0, 10)}</Text>
                ) : null}
              </View>
            </View>
            <Pressable
              style={styles.docWa}
              onPress={async () => {
                Haptics.tap();
                const result = await ShareService.shareDocument({
                  asset,
                  document: item,
                });
                if (!result.success) ui.error('Share document', result.error);
              }}
            >
              <Text style={styles.docWaText}>💬</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(item)}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
          );
        }}
      />

      <Pressable onPress={() => navigation?.navigate?.('AssetPassport', { assetId })}>
        <Text style={styles.link}>Open Asset Passport →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, padding: 20 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  sub: { color: COLORS.muted, marginTop: 4, marginBottom: 14, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: 'rgba(79,70,229,0.3)', borderColor: COLORS.indigo },
  chipText: { color: COLORS.text, fontSize: 11, fontWeight: '600' },
  primary: {
    backgroundColor: COLORS.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  whatsapp: {
    marginTop: 10,
    backgroundColor: '#128C7E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pdf: {
    marginTop: 10,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800' },
  ocrHint: {
    color: COLORS.emerald,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 8,
  },
  docTitle: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  docMeta: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  status_success: { borderColor: 'rgba(16,185,129,0.45)', backgroundColor: 'rgba(16,185,129,0.12)' },
  status_warning: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.12)' },
  status_info: { borderColor: 'rgba(59,130,246,0.45)', backgroundColor: 'rgba(59,130,246,0.12)' },
  status_danger: { borderColor: 'rgba(244,63,94,0.45)', backgroundColor: 'rgba(244,63,94,0.12)' },
  status_muted: { borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  statusIcon: { fontSize: 10, fontWeight: '800' },
  statusText: { color: COLORS.text, fontSize: 10, fontWeight: '700' },
  docDate: { color: COLORS.muted, fontSize: 10, fontWeight: '600' },
  docWa: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#128C7E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docWaText: { fontSize: 14 },
  delete: { color: COLORS.rose, fontWeight: '700', fontSize: 12 },
  empty: { color: COLORS.muted, textAlign: 'center', marginTop: 24 },
  link: { color: '#A5B4FC', textAlign: 'center', fontWeight: '700', marginBottom: 12 },
});

export default DocumentsVaultScreen;
