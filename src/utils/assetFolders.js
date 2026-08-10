/**
 * Four primary Asset Doctor vault buckets.
 */

export const FOLDER_META = {
  vehicle: {
    id: 'vehicle',
    title: 'Vehicles',
    subtitle: 'Same plate = one sleeve · RC, PUC, insurance, service',
    iconKey: 'vehicle',
    accent: '#0D9488',
    countLabel: 'Saved',
    foundLabel: 'vehicles found',
  },
  electronics: {
    id: 'electronics',
    title: 'Electronics & Appliances',
    subtitle: 'Invoice, warranty cards and AMC',
    iconKey: 'electronics',
    accent: '#0891B2',
    countLabel: 'Verified',
    foundLabel: 'items found',
  },
  property: {
    id: 'property',
    title: 'Digital Bills & Utility Subscriptions',
    subtitle: 'Electricity, broadband, OTTs and utility invoices',
    iconKey: 'digital',
    accent: '#D97706',
    countLabel: 'Saved',
    foundLabel: 'bills found',
  },
  personal: {
    id: 'personal',
    title: 'Personal & Legal',
    subtitle: 'Policies, warranties, guarantees and legal records',
    iconKey: 'personal',
    accent: '#6366F1',
    countLabel: 'Protected',
    foundLabel: 'records found',
  },
};

const VEHICLE_IDS = new Set(['bike', 'car', 'scooter', 'vehicle', 'motorcycle', 'vehicle_parts']);
const ELECTRONICS_IDS = new Set([
  'ac',
  'tv',
  'fridge',
  'washer',
  'electronics',
  'appliance',
  'laptop',
  'phone',
  'mobile',
  'gadget',
  'washing_machine',
  'tablet',
  'microwave',
  'geyser',
  'accessory',
]);
/** Legacy property ids + new digital / utility ids */
const PROPERTY_IDS = new Set([
  'property',
  'rent_agreement',
  'home_insurance',
  'home',
  'utility_bill',
  'digital_subscription',
  'electricity_bill',
  'broadband',
]);
const PERSONAL_IDS = new Set([
  'insurance_policy',
  'legal_document',
  'guarantee',
  'personal',
  'other',
]);

/**
 * Map an asset into one of the four primary vault buckets.
 * @param {object} asset
 * @returns {'vehicle'|'electronics'|'property'|'personal'}
 */
export function getAssetFolderType(asset) {
  const id = String(asset?.categoryId || '').toLowerCase();
  const cat = String(asset?.category || asset?.categoryLabel || '').toLowerCase();
  if (VEHICLE_IDS.has(id) || cat.includes('vehicle') || cat.includes('bike') || cat.includes('car')) {
    return 'vehicle';
  }
  if (
    ELECTRONICS_IDS.has(id) ||
    cat.includes('electronic') ||
    cat.includes('appliance') ||
    cat.includes('gadget')
  ) {
    return 'electronics';
  }
  if (
    PROPERTY_IDS.has(id) ||
    cat.includes('property') ||
    cat.includes('rent agreement') ||
    cat.includes('home insurance') ||
    cat.includes('utility') ||
    cat.includes('subscription') ||
    cat.includes('broadband') ||
    cat.includes('electricity') ||
    cat.includes('digital bill')
  ) {
    return 'property';
  }
  if (
    PERSONAL_IDS.has(id) ||
    cat.includes('personal') ||
    cat.includes('legal') ||
    cat.includes('policy') ||
    cat.includes('guarantee')
  ) {
    return 'personal';
  }
  return 'personal';
}

export function filterAssetsByFolder(assets = [], folderType) {
  return assets.filter((a) => getAssetFolderType(a) === folderType);
}

export function countAssetsByFolder(assets = []) {
  return {
    vehicle: filterAssetsByFolder(assets, 'vehicle').length,
    electronics: filterAssetsByFolder(assets, 'electronics').length,
    property: filterAssetsByFolder(assets, 'property').length,
    personal: filterAssetsByFolder(assets, 'personal').length,
  };
}

export function calcNetWorth(assets = []) {
  const totals = { all: 0, vehicle: 0, electronics: 0, property: 0, personal: 0 };
  for (const a of assets) {
    const v = Number(a.value) || 0;
    const folder = getAssetFolderType(a);
    totals.all += v;
    totals[folder] += v;
  }
  return totals;
}

export function getAssetStatusLine(asset) {
  const folder = getAssetFolderType(asset);
  if (folder === 'vehicle') {
    const parts = [];
    if (asset.pucExpiry) parts.push('PUC on file');
    if (asset.insuranceExpiry) parts.push('Insurance on file');
    return parts.join(' · ') || 'Vehicle docs';
  }
  if (asset.warrantyExpiry) return 'Warranty tracked';
  return asset.storeName || asset.store || asset.categoryLabel || 'On file';
}
