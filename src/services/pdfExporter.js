/**
 * Asset Passport PDF exporter — single-page clean document via expo-print.
 * Share via expo-sharing (preferred) or WhatsApp / system sheet.
 */

import { Linking, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import { BRAND } from '../theme/branding';
import { formatINR } from '../utils/format';
import { formatDateIN } from '../utils/dates';
import { getAssetFolderType } from '../utils/assetFolders';
import { Haptics } from './haptics';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(value) {
  const s = String(value ?? '').trim();
  return s || '—';
}

async function loadLogoDataUri() {
  try {
    const asset = Asset.fromModule(require('../../assets/logo-brand.png'));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return '';
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch {
    return '';
  }
}

/**
 * Build passport HTML for one asset.
 * @param {{ asset: object, owner?: { name?: string, phone?: string, email?: string }, seller?: { name?: string, phone?: string } }} opts
 */
export async function buildAssetPassportHtml({ asset, owner = {}, seller = {} } = {}) {
  const folder = getAssetFolderType(asset);
  const isVehicle = folder === 'vehicle';
  const logoSrc = await loadLogoDataUri();
  const meta = asset?.invoiceMeta || {};

  const ownerName = owner.name || meta.customerName || asset?.ownerName || '';
  const ownerPhone = owner.phone || meta.customerPhone || asset?.ownerPhone || '';
  const sellerName =
    seller.name || asset?.storeName || meta.shopName || asset?.brandName || '';
  const sellerPhone =
    seller.phone || asset?.supportPhone || meta.shopPhone || '';

  const imei = asset?.imei || meta.imei || '';
  const serial = asset?.serialNumber || meta.serialNumber || '';
  const chassis = asset?.chassisNumber || '';
  const registration = asset?.registration || '';

  const techRows = isVehicle
    ? `
      <tr><th>Chassis / VIN</th><td>${escapeHtml(dash(chassis))}</td></tr>
      <tr><th>Registration No</th><td>${escapeHtml(dash(registration))}</td></tr>
    `
    : `
      <tr><th>IMEI / Serial No</th><td>${escapeHtml(dash(imei || serial))}</td></tr>
      ${serial && imei ? `<tr><th>Serial No</th><td>${escapeHtml(dash(serial))}</td></tr>` : ''}
    `;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 32px;
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
    }
    .sheet {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      min-height: 780px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 22px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
    }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: #fff;
      object-fit: contain;
    }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: 0.2px; }
    .doc-title { font-size: 12px; opacity: 0.85; margin-top: 2px; font-weight: 600; }
    .body { padding: 22px; }
    .asset-name { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; }
    .grid { display: flex; gap: 14px; margin-bottom: 16px; }
    .card {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 10px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #64748b;
    }
    .card p { margin: 3px 0; font-size: 13px; font-weight: 600; }
    .muted { color: #64748b; font-weight: 500; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td {
      text-align: left;
      padding: 9px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    th {
      width: 38%;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    td { font-weight: 700; color: #0f172a; }
    .section-title {
      margin: 18px 0 8px;
      font-size: 11px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #0f766e;
      font-weight: 800;
    }
    .value-pill {
      display: inline-block;
      margin-top: 12px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
    }
    .footer {
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Asset Doctor" />` : ''}
      <div>
        <div class="brand">${escapeHtml(BRAND.name)}</div>
        <div class="doc-title">Asset Passport · Official Vault Record</div>
      </div>
    </div>
    <div class="body">
      <h1 class="asset-name">${escapeHtml(dash(asset?.assetName))}</h1>
      <div class="meta">
        ${escapeHtml(dash(asset?.categoryLabel || asset?.category))}
        · Generated ${escapeHtml(new Date().toLocaleDateString('en-IN'))}
      </div>

      <div class="grid">
        <div class="card">
          <h3>Owner Details</h3>
          <p>${escapeHtml(dash(ownerName))}</p>
          <p class="muted">Mobile: ${escapeHtml(dash(ownerPhone))}</p>
        </div>
        <div class="card">
          <h3>Seller Info</h3>
          <p>${escapeHtml(dash(sellerName))}</p>
          <p class="muted">Contact: ${escapeHtml(dash(sellerPhone))}</p>
        </div>
      </div>

      <div class="section-title">Technical Identifiers</div>
      <table>${techRows}</table>

      <div class="section-title">Dates &amp; Validity</div>
      <table>
        <tr><th>Purchase Date</th><td>${escapeHtml(dash(formatDateIN(asset?.purchaseDate)))}</td></tr>
        <tr><th>Warranty Expiry</th><td>${escapeHtml(dash(formatDateIN(asset?.warrantyExpiry)))}</td></tr>
        <tr><th>Insurance Expiry</th><td>${escapeHtml(dash(formatDateIN(asset?.insuranceExpiry)))}</td></tr>
        <tr><th>PUC Expiry</th><td>${escapeHtml(dash(formatDateIN(asset?.pucExpiry)))}</td></tr>
        <tr><th>Next Service</th><td>${escapeHtml(dash(formatDateIN(asset?.nextServiceDue)))}</td></tr>
      </table>

      <div class="value-pill">Purchase · ${escapeHtml(formatINR(asset?.value))} · Current approx · see note</div>

      <div class="footer">
        ${escapeHtml(BRAND.tagline)} · ${escapeHtml(BRAND.footer)}
        <br/>
        Note: Current valuation is an automated approximation based on standard depreciation rules. Actual market value may vary based on physical condition, usage, and local market demand.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Create a single-page Asset Passport PDF file.
 * @returns {Promise<{ success: boolean, uri?: string, error?: string }>}
 */
export async function createAssetPassportPdf({ asset, owner, seller } = {}) {
  try {
    if (!asset) throw new Error('Asset is required');
    const html = await buildAssetPassportHtml({ asset, owner, seller });
    const file = await Print.printToFileAsync({ html, base64: false });
    const dest = `${FileSystem.cacheDirectory}asset-passport-${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: file.uri, to: dest });
    return { success: true, uri: dest };
  } catch (error) {
    return { success: false, error: error?.message || 'Could not create passport PDF' };
  }
}

async function shareWithExpoSharing(uri, dialogTitle) {
  try {
    // Optional peer dep — project may install expo-sharing later
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Sharing = require('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle,
        UTI: 'com.adobe.pdf',
      });
      return true;
    }
  } catch {
    /* not installed */
  }
  return false;
}

async function shareWithNativeModule(uri, { title, message, filename }) {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const ShareRN = require('react-native-share').default;
  await ShareRN.open({
    url: Platform.OS === 'ios' ? uri : `file://${uri.replace(/^file:\/\//, '')}`,
    type: 'application/pdf',
    title,
    message,
    filename,
    failOnCancel: false,
    social: undefined,
  });
}

/**
 * One-tap share Asset Passport PDF (WhatsApp preferred when available).
 */
export async function shareAssetPassportPdf({
  asset,
  owner,
  seller,
  preferWhatsApp = true,
} = {}) {
  Haptics.tap();
  try {
    const created = await createAssetPassportPdf({ asset, owner, seller });
    if (!created.success) throw new Error(created.error);

    const title = `${BRAND.name} · Asset Passport`;
    const message = `${BRAND.name} Asset Passport — ${asset?.assetName || 'Asset'}`;
    const filename = `${String(asset?.assetName || 'asset')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 40)}-passport`;

    if (preferWhatsApp) {
      try {
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        const ShareRN = require('react-native-share').default;
        if (ShareRN.Social?.WHATSAPP) {
          await ShareRN.shareSingle({
            url: created.uri,
            type: 'application/pdf',
            filename,
            title,
            message,
            social: ShareRN.Social.WHATSAPP,
            failOnCancel: false,
          });
          Haptics.success();
          return { success: true, uri: created.uri, via: 'whatsapp' };
        }
      } catch {
        /* fall through */
      }
    }

    const viaExpo = await shareWithExpoSharing(created.uri, title);
    if (viaExpo) {
      Haptics.success();
      return { success: true, uri: created.uri, via: 'expo-sharing' };
    }

    await shareWithNativeModule(created.uri, { title, message, filename });
    Haptics.success();
    return { success: true, uri: created.uri, via: 'share_sheet' };
  } catch (error) {
    Haptics.error();
    return { success: false, error: error?.message || 'Share failed' };
  }
}

/** Open WhatsApp with a text caption (no file) — fallback helper */
export async function sharePassportCaptionToWhatsApp({ asset, phone } = {}) {
  const text = `${BRAND.name} Asset Passport\n${asset?.assetName || 'Asset'}\n${formatINR(
    asset?.value,
  )}\n${BRAND.tagline}`;
  const digits = String(phone || '').replace(/\D/g, '');
  const url = digits
    ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?text=${encodeURIComponent(text)}`;
  const can = await Linking.canOpenURL(url);
  if (!can) return { success: false, error: 'WhatsApp not available' };
  await Linking.openURL(url);
  return { success: true, via: 'whatsapp_text' };
}

export const PdfExporter = {
  buildAssetPassportHtml,
  createAssetPassportPdf,
  shareAssetPassportPdf,
  sharePassportCaptionToWhatsApp,
};

export default PdfExporter;
