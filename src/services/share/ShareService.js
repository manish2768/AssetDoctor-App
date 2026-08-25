/**
 * Share Service — catchy Asset Passport + WhatsApp / Instagram export
 */

import { Linking, Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { PDFDocument } from 'pdf-lib';

import { Haptics } from '../haptics/triggerHaptic';
import { BRAND } from '../../theme/branding';
import { formatINR } from '../../utils/format';
import { formatDateIN } from '../../utils/dates';
import { calculateHealthScore } from '../../utils/healthScore';
import { calculateResaleValue } from '../../utils/resaleCalculator';
import { getAssetFolderType } from '../../utils/assetFolders';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildEmergencyHtml(asset, documents) {
  const keyTypes = new Set([
    'rc',
    'puc',
    'insurance',
    'warranty',
    'property_papers',
    'rent_agreement',
    'policy',
    'guarantee',
    'other',
  ]);
  const selected = documents.filter((doc) => keyTypes.has(doc.type));
  const cards = selected.map(
    (doc) => `
      <section class="document">
        <h2>${escapeHtml(doc.label || doc.type || 'Document')}</h2>
        <p class="muted">${
          doc.localCachePath
            ? 'Offline copy included in the following pages.'
            : 'Document securely indexed in Asset Doctor.'
        }</p>
      </section>
    `,
  );

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 26px; }
          body { font-family: Arial, sans-serif; color: #0f172a; }
          header { border-bottom: 3px solid #10b981; padding-bottom: 14px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 24px; }
          h2 { font-size: 16px; margin: 0 0 10px; }
          p { margin: 5px 0; font-size: 12px; }
          .badge { color: #047857; font-weight: 700; }
          .document { page-break-inside: avoid; margin: 20px 0; padding-top: 12px; border-top: 1px solid #cbd5e1; }
          .muted { color: #64748b; }
          footer { margin-top: 24px; color: #64748b; font-size: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <header>
          <h1>Emergency Document Pack</h1>
          <p class="badge">${escapeHtml(BRAND.name)} · ${escapeHtml(asset?.assetName || 'Asset')}</p>
          ${asset?.registration ? `<p>Registration / ID: ${escapeHtml(asset.registration)}</p>` : ''}
          ${asset?.chassisNumber ? `<p>Chassis / VIN: ${escapeHtml(asset.chassisNumber)}</p>` : ''}
          ${asset?.insuranceExpiry ? `<p>Insurance expiry: ${escapeHtml(formatDateIN(asset.insuranceExpiry))}</p>` : ''}
          ${asset?.pucExpiry ? `<p>PUC expiry: ${escapeHtml(formatDateIN(asset.pucExpiry))}</p>` : ''}
        </header>
        ${cards.length ? cards.join('') : '<p>No emergency documents are cached on this device yet.</p>'}
        <footer>${escapeHtml(BRAND.tagline)} · ${escapeHtml(BRAND.footer)}</footer>
      </body>
    </html>
  `;
}

function buildPassportCaption(asset) {
  const health = calculateHealthScore(asset || {});
  const resale = calculateResaleValue({
    purchaseValue: asset?.value,
    purchaseDate: asset?.purchaseDate,
    categoryId: asset?.categoryId,
    category: asset?.category,
    condition: asset?.condition,
  });

  const name = asset?.assetName || 'My Asset';
  const lines = [
    `🩺 ${BRAND.name} · Asset Passport`,
    `━━━━━━━━━━━━━━━━`,
    `✨ ${name}`,
    asset?.registration ? `🔖 Reg / ID: ${asset.registration}` : null,
    asset?.categoryLabel || asset?.category
      ? `📦 ${asset.categoryLabel || asset.category}`
      : null,
    '',
    `💰 Value: ${formatINR(asset?.value)}`,
    `📈 Resale est.: ${formatINR(resale.estimatedResale)}`,
    `❤️ Health: ${health.score}/100 (${health.grade})`,
    asset?.warrantyExpiry ? `🛡️ Warranty → ${formatDateIN(asset.warrantyExpiry)}` : null,
    asset?.insuranceExpiry ? `📄 Insurance → ${formatDateIN(asset.insuranceExpiry)}` : null,
    asset?.pucExpiry ? `🌿 PUC → ${formatDateIN(asset.pucExpiry)}` : null,
    '',
    `“${BRAND.tagline}”`,
    `— ${BRAND.footer}`,
  ];

  return lines.filter((x) => x !== null && x !== undefined).join('\n');
}

async function tryNativeShareModule(imageUri, caption) {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const ShareRN = require('react-native-share').default;
    if (imageUri) {
      await ShareRN.open({
        url: imageUri,
        type: 'image/jpeg',
        message: caption,
        title: `${BRAND.name} Asset Passport`,
      });
      return { success: true, via: 'share_sheet' };
    }
  } catch {
    /* module not linked */
  }
  return null;
}

export class ShareService {
  static isEmergencyShareEligible(asset) {
    return ['vehicle', 'personal'].includes(getAssetFolderType(asset));
  }

  static async createEmergencyPdf({ asset, documents = [] }) {
    const html = await buildEmergencyHtml(asset, documents);
    const summary = await Print.printToFileAsync({ html, base64: true });
    const output = await PDFDocument.load(summary.base64);
    const eligible = documents.filter(
      (doc) => doc.localCachePath && doc.offlineCached !== false,
    );
    let totalBytes = 0;

    for (const document of eligible.slice(0, 8)) {
      const uri = document.localCachePath;
      try {
        // Keep PDF creation inside predictable Android memory bounds.
        // eslint-disable-next-line no-await-in-loop
        const info = await FileSystem.getInfoAsync(uri);
        const size = Number(info.size) || 0;
        if (!info.exists || size > 4 * 1024 * 1024 || totalBytes + size > 16 * 1024 * 1024) {
          continue;
        }
        totalBytes += size;
        // eslint-disable-next-line no-await-in-loop
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (document.mimeType === 'application/pdf' || /\.pdf$/i.test(uri)) {
          // eslint-disable-next-line no-await-in-loop
          const source = await PDFDocument.load(base64);
          // eslint-disable-next-line no-await-in-loop
          const pages = await output.copyPages(source, source.getPageIndices().slice(0, 8));
          pages.forEach((page) => output.addPage(page));
        } else {
          // eslint-disable-next-line no-await-in-loop
          const image = /png/i.test(document.mimeType || uri)
            ? await output.embedPng(base64)
            : await output.embedJpg(base64);
          const page = output.addPage([595, 842]);
          const scaled = image.scaleToFit(539, 786);
          page.drawImage(image, {
            x: (595 - scaled.width) / 2,
            y: (842 - scaled.height) / 2,
            width: scaled.width,
            height: scaled.height,
          });
        }
      } catch {
        // Unsupported/corrupt files remain listed in the summary page.
      }
    }

    const mergedBase64 = await output.saveAsBase64({ dataUri: false });
    const destination = `${FileSystem.cacheDirectory}asset-doctor-emergency-${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(destination, mergedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return destination;
  }

  static async shareEmergencyBundle({ asset, documents = [] }) {
    Haptics.tap();
    try {
      const pdfUri = await this.createEmergencyPdf({ asset, documents });
      // eslint-disable-next-line global-require
      const ShareRN = require('react-native-share').default;
      await ShareRN.open({
        url: pdfUri,
        type: 'application/pdf',
        filename: `${asset?.assetName || 'asset'}-emergency-pack`,
        title: `${asset?.assetName || 'Asset'} Emergency Document Pack`,
        message: `${BRAND.name}: emergency documents for ${asset?.assetName || 'asset'}`,
        failOnCancel: false,
      });
      Haptics.success();
      return { success: true, uri: pdfUri };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Emergency share failed' };
    }
  }

  static async shareDocument({ asset, document }) {
    Haptics.tap();
    try {
      let uri = document?.localCachePath || document?.localPath;
      if (!uri && document?.fileUrl && FileSystem.cacheDirectory) {
        const extension = document.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        const destination = `${FileSystem.cacheDirectory}asset-doctor-share-${Date.now()}.${extension}`;
        const downloaded = await FileSystem.downloadAsync(document.fileUrl, destination);
        uri = downloaded.uri;
      }
      if (!uri) throw new Error('Open this document online once before sharing it.');

      // eslint-disable-next-line global-require
      const ShareRN = require('react-native-share').default;
      await ShareRN.open({
        url: uri,
        type: document?.mimeType || 'application/octet-stream',
        title: `${asset?.assetName || 'Asset'} · ${document?.label || 'Document'}`,
        message: `${BRAND.name}: ${document?.label || 'vault document'} for ${
          asset?.assetName || 'asset'
        }`,
        failOnCancel: false,
      });
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Document share failed' };
    }
  }

  static async shareViaWhatsApp({ phone, message }) {
    Haptics.tap();
    try {
      const text = encodeURIComponent(message || '');
      const digits = String(phone || '').replace(/\D/g, '');
      const url = digits
        ? `whatsapp://send?phone=${digits}&text=${text}`
        : `whatsapp://send?text=${text}`;

      const can = await Linking.canOpenURL(url);
      if (!can) {
        await Share.share({ message: message || '' });
        Haptics.success();
        return { success: true, via: 'system_share' };
      }
      await Linking.openURL(url);
      Haptics.success();
      return { success: true, via: 'whatsapp' };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'WhatsApp share failed' };
    }
  }

  /**
   * Share passport card image + catchy caption (WhatsApp or system sheet).
   */
  static async sharePassportCard({ imageUri, asset, prefer = 'system' }) {
    Haptics.tap();
    const caption = buildPassportCaption(asset);

    try {
      if (prefer === 'whatsapp') {
        // WhatsApp prefers text; attach image via system share when available
        if (imageUri && Platform.OS === 'android') {
          const native = await tryNativeShareModule(imageUri, caption);
          if (native?.success) {
            Haptics.success();
            return native;
          }
          try {
            await Share.share({
              message: caption,
              title: `${asset?.assetName || 'Asset'} Passport`,
              url: imageUri,
            });
            Haptics.success();
            return { success: true, via: 'system_share_with_image' };
          } catch {
            /* fall through to text WhatsApp */
          }
        }
        return this.shareViaWhatsApp({ message: caption });
      }

      if (imageUri) {
        const native = await tryNativeShareModule(imageUri, caption);
        if (native?.success) {
          Haptics.success();
          return native;
        }
        await Share.share({
          message: caption,
          title: `${BRAND.name} Asset Passport`,
          url: imageUri,
        });
      } else {
        await Share.share({ message: caption, title: `${BRAND.name} Asset Passport` });
      }
      Haptics.success();
      return { success: true, via: 'system_share' };
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('cancel')) {
        return { success: false, error: 'Share cancelled' };
      }
      Haptics.error();
      return { success: false, error: error?.message || 'Share failed' };
    }
  }

  static async quickShareDocuments({ asset, documents = [], phone }) {
    const passport = buildPassportCaption(asset);
    const docBlock =
      documents.length > 0
        ? [
            '',
            '📁 Vault documents',
            ...documents.map((d, i) => `${i + 1}. ${d.label || d.type} · securely on file`),
          ]
        : ['', '📁 Docs: open Asset Doctor vault to attach RC / PUC / bills'];

    return this.shareViaWhatsApp({
      phone,
      message: [passport, ...docBlock].join('\n'),
    });
  }

  static buildPassportCaption(asset) {
    return buildPassportCaption(asset);
  }
}

export default ShareService;
