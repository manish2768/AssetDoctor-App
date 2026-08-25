/**
 * Product / asset title hygiene — never use addresses, IMEI, or tax tokens as names.
 */

const ADDRESS_LIKE =
  /\b(?:india|uttar\s*pradesh|maharashtra|delhi|karnataka|gujarat|rajasthan|bihar|punjab|haryana|telangana|andhra|tamil\s*nadu|west\s*bengal|lucknow|mumbai|pune|bengaluru|bangalore|hyderabad|chennai|kolkata|noida|gurgaon|gurugram|jaipur|ahmedabad|pin\s*code|pincode|district|tehsil|state|near\s+|opp\.?|opposite|road|nagar|colony|sector|apartment|floor)\b/i;

const PINCODE = /\b[1-9]\d{5}\b/;
const IMEI_ONLY = /^\d{14,17}$/;
const SERIAL_ONLY = /^(?:imei|s\/?n|serial|chassis|vin)[\s:\-#]*[A-Z0-9\-\/]+$/i;
const TAX_TOKEN = /^(?:cgst|sgst|igst|gstin|hsn|sac|taxable|gst)$/i;

const CATEGORY_LABELS = {
  Vehicles: 'Vehicle',
  vehicle: 'Vehicle',
  Electronics: 'Gadget / Phone',
  electronics: 'Gadget / Phone',
  Gadgets: 'Gadget / Phone',
  mobile: 'Gadget / Phone',
  phone: 'Gadget / Phone',
  Property: 'Home Appliance',
  appliance: 'Home Appliance',
  Home: 'Home Appliance',
  Insurance: 'Insurance Policy',
  Other: 'Asset',
  other: 'Asset',
};

export function isAddressLikeText(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (PINCODE.test(s) && ADDRESS_LIKE.test(s)) return true;
  if (ADDRESS_LIKE.test(s) && s.split(/\s+/).length >= 3) return true;
  // Pure city/state lines
  if (/^(?:lucknow|mumbai|delhi|noida|pune|bangalore|bengaluru|hyderabad|chennai|kolkata)\b/i.test(s)) {
    return true;
  }
  return false;
}

export function isImeiOrSerialTitle(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  const digits = s.replace(/\D/g, '');
  if (IMEI_ONLY.test(digits) && digits.length >= 14) return true;
  if (SERIAL_ONLY.test(s)) return true;
  if (/^\d{10,}$/.test(s.replace(/\s/g, ''))) return true;
  if (TAX_TOKEN.test(s)) return true;
  return false;
}

export function looksLikeProductName(value) {
  const s = String(value || '').trim();
  if (!s || s.length < 2 || s.length > 120) return false;
  if (/^product$/i.test(s)) return false;
  if (isAddressLikeText(s)) return false;
  if (isImeiOrSerialTitle(s)) return false;
  if (/original\s+for\s+recipient|computer\s+generated|disclaimer|watermark/i.test(s)) {
    return false;
  }
  if (!/[A-Za-z]{2,}/.test(s)) return false;
  return true;
}

export function categoryFallbackLabel(categoryHint = '', smartCategory = '', purchaseCategory = '') {
  const blob = `${categoryHint} ${smartCategory} ${purchaseCategory}`.toLowerCase();
  if (/insur/.test(blob)) return 'Insurance Policy';
  if (/puc|pollution/.test(blob)) return 'PUC Certificate';
  if (/\brc\b|registration/.test(blob)) return 'RC Book';
  if (/vehicle|bike|car|scooter|motor/.test(blob)) return 'Vehicle';
  if (/phone|mobile|gadget|laptop|electronics|imei/.test(blob)) return 'Gadget / Phone';
  if (/fridge|ac\b|tv\b|washer|appliance|home|property/.test(blob)) return 'Home Appliance';
  for (const [k, label] of Object.entries(CATEGORY_LABELS)) {
    if (blob.includes(String(k).toLowerCase())) return label;
  }
  return 'Scanned Asset';
}

/**
 * Pick best product title from OCR / Gemini / line items.
 */
export function resolveProductName(sources = {}) {
  const candidates = [
    sources.product_name,
    sources.productName,
    sources.asset_name,
    sources.assetName,
    sources.item_name,
    sources.itemName,
    sources.title,
    ...(Array.isArray(sources.items)
      ? [...sources.items]
          .filter((i) => i && !i.isFee && Number(i.amount || 0) >= 0)
          .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
          .map((i) => i.name)
      : []),
  ];

  for (const c of candidates) {
    const s = String(c || '').trim().replace(/\s+/g, ' ');
    if (looksLikeProductName(s)) return s.slice(0, 100);
  }
  return '';
}

/**
 * Final display title for lists / cards — never empty, never raw IMEI.
 */
export function resolveAssetDisplayTitle(asset = {}, opts = {}) {
  const raw =
    opts.rawName ||
    asset.assetName ||
    asset.productName ||
    asset.itemName ||
    asset.name ||
    '';
  let name = String(raw || '').trim().replace(/\s+/g, ' ');

  if (!looksLikeProductName(name) || isImeiOrSerialTitle(name) || isAddressLikeText(name)) {
    name = categoryFallbackLabel(
      asset.categoryLabel || asset.category,
      asset.smartCategory,
      asset.purchaseCategory || asset.categoryId,
    );
  }

  // Strip embedded IMEI from otherwise OK titles
  name = name.replace(/\b\d{15}\b/g, '').replace(/\s+/g, ' ').trim();
  if (!name || isImeiOrSerialTitle(name)) {
    name = categoryFallbackLabel(
      asset.categoryLabel || asset.category,
      asset.smartCategory,
      asset.purchaseCategory || asset.categoryId,
    );
  }
  return name;
}

export default {
  isAddressLikeText,
  isImeiOrSerialTitle,
  looksLikeProductName,
  categoryFallbackLabel,
  resolveProductName,
  resolveAssetDisplayTitle,
};
