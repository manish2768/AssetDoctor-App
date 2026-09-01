/**
 * Smart Auto-Mapping — link scanned bills to existing vault assets.
 * Vehicles → registration | Appliances → nickname/location | Phones/Laptops → IMEI/serial
 * Structured text only — no PDF/image persistence required for mapping.
 */

function norm(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-./]/g, '');
}

function plateKey(value) {
  return norm(value).replace(/[^A-Z0-9]/g, '');
}

function imeiKey(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{15}$/.test(digits) ? digits : '';
}

function serialKey(value) {
  const s = norm(value);
  if (!s || s.length < 5) return '';
  // Reject GSTIN / tax-shaped tokens
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)) return '';
  if (/^(CGST|SGST|IGST|GSTIN|HSN|SAC)$/.test(s)) return '';
  return s;
}

function nicknameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function scoreMatch(kind, confidence) {
  return { kind, confidence };
}

/**
 * Find best vault asset for an OCR invoice / review form payload.
 * @param {object} invoiceOrForm
 * @param {Array<object>} assets
 * @returns {{ asset: object|null, match: { kind: string, confidence: number }|null, reason: string }}
 */
export function mapScanToExistingAsset(invoiceOrForm = {}, assets = []) {
  try {
    const list = (assets || []).filter((a) => a && !a.deletedAt);
    if (!list.length) {
      return { asset: null, match: null, reason: 'No assets in vault yet' };
    }

    const reg = plateKey(
      invoiceOrForm.registration ||
        invoiceOrForm.vehicleRegistration ||
        invoiceOrForm.regNo ||
        '',
    );
    const imei = imeiKey(invoiceOrForm.imei || invoiceOrForm.invoiceMeta?.imei || '');
    const serial = serialKey(
      invoiceOrForm.serialNumber ||
        invoiceOrForm.serial ||
        invoiceOrForm.invoiceMeta?.serialNumber ||
        '',
    );
    const nickname = nicknameKey(
      invoiceOrForm.nickname ||
        invoiceOrForm.locationLabel ||
        invoiceOrForm.roomName ||
        '',
    );
    const product = nicknameKey(invoiceOrForm.productName || invoiceOrForm.assetName || '');

    // 1) Vehicles — registration number
    if (reg.length >= 6) {
      const hit = list.find((a) => plateKey(a.registration) === reg);
      if (hit) {
        return {
          asset: hit,
          match: scoreMatch('vehicle_registration', 0.98),
          reason: `Mapped to vehicle ${hit.registration || hit.assetName}`,
        };
      }
    }

    // 2) Mobiles / laptops — IMEI
    if (imei) {
      const hit = list.find((a) => imeiKey(a.imei) === imei);
      if (hit) {
        return {
          asset: hit,
          match: scoreMatch('imei', 0.97),
          reason: `Mapped by IMEI to ${hit.assetName || 'device'}`,
        };
      }
    }

    // 3) Serial number (non-tax)
    if (serial) {
      const hit = list.find(
        (a) =>
          serialKey(a.serialNumber) === serial ||
          serialKey(a.chassisNumber) === serial ||
          serialKey(a.engineNumber) === serial,
      );
      if (hit) {
        return {
          asset: hit,
          match: scoreMatch('serial', 0.94),
          reason: `Mapped by serial to ${hit.assetName || 'asset'}`,
        };
      }
    }

    // 4) Appliances — custom nickname / location (Bed Room AC)
    if (nickname.length >= 3) {
      const hit = list.find((a) => {
        const keys = [
          a.nickname,
          a.locationLabel,
          a.roomName,
          a.assetName,
          a.name,
        ]
          .map(nicknameKey)
          .filter(Boolean);
        return keys.some((k) => k === nickname || k.includes(nickname) || nickname.includes(k));
      });
      if (hit) {
        return {
          asset: hit,
          match: scoreMatch('nickname_location', 0.72),
          reason: `Possible location/nickname match to ${hit.assetName || hit.nickname} — review required`,
        };
      }
    }

    // Soft product-name overlap is NEVER enough to auto-link (review required only).
    if (product.length >= 4) {
      const hit = list.find((a) => {
        const name = nicknameKey(a.assetName || a.name);
        return name && name === product;
      });
      if (hit) {
        return {
          asset: hit,
          match: scoreMatch('product_name', 0.62),
          reason: `Possible name match: ${hit.assetName} — review required`,
        };
      }
    }

    return { asset: null, match: null, reason: 'No matching asset — will create a new vault entry' };
  } catch (error) {
    return {
      asset: null,
      match: null,
      reason: error?.message || 'Auto-mapping failed',
    };
  }
}

/**
 * Build service / repair history patch for an existing asset from invoice data.
 * @param {object} asset
 * @param {object} invoice
 */
export function buildServiceHistoryEntry(asset, invoice = {}) {
  const amount =
    Number(invoice.totalAmount ?? invoice.value ?? invoice.invoiceMeta?.totalAmount) || 0;
  const items = invoice.items || invoice.invoiceMeta?.items || [];
  const parts = items
    .filter((i) => !i?.isFee)
    .map((i) => i.name)
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: `svc_${Date.now()}`,
    date: invoice.invoiceDate || invoice.purchaseDate || new Date().toISOString().slice(0, 10),
    storeName: invoice.shopName || invoice.storeName || '',
    amount,
    odometerKm: invoice.odometerKm != null ? Number(invoice.odometerKm) : null,
    nextServiceDue: invoice.nextServiceDue || null,
    partsChanged: parts,
    note: parts.length ? `Parts: ${parts.join(', ')}` : 'Service / repair bill scanned',
    linkedAssetId: asset?.assetId || asset?.id || null,
    mapKind: 'ocr_auto',
  };
}

export default {
  mapScanToExistingAsset,
  buildServiceHistoryEntry,
};
