import type { Asset, AssetCategory, WarrantyStatus } from '../types.ts';

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateWarrantyStatus(
  purchaseDateStr: string,
  warrantyMonths: number
): { expiryDate: string; daysRemaining: number; status: WarrantyStatus } {
  const purchaseDate = new Date(purchaseDateStr);
  if (isNaN(purchaseDate.getTime())) {
    const today = new Date();
    return {
      expiryDate: today.toISOString().split('T')[0],
      daysRemaining: 0,
      status: 'expired',
    };
  }

  const expiryDate = new Date(purchaseDate);
  expiryDate.setMonth(expiryDate.getMonth() + Number(warrantyMonths));

  const today = new Date();
  // Strip time portion for accurate day calculation
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryReset = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate());

  const diffTime = expiryReset.getTime() - todayReset.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: WarrantyStatus;
  if (daysRemaining <= 0) {
    status = 'expired';
  } else if (daysRemaining <= 7) {
    status = 'expiring_soon';
  } else {
    status = 'active';
  }

  const expiryDateFormatted = expiryDate.toISOString().split('T')[0];

  return {
    expiryDate: expiryDateFormatted,
    daysRemaining,
    status,
  };
}

export function calculateExpiryDays(expiryDateStr?: string): {
  daysRemaining: number | null;
  status: 'valid' | 'expiring_soon' | 'expired' | null;
} {
  if (!expiryDateStr) {
    return { daysRemaining: null, status: null };
  }
  const expiry = new Date(expiryDateStr);
  if (isNaN(expiry.getTime())) {
    return { daysRemaining: null, status: null };
  }
  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryReset = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  const diffTime = expiryReset.getTime() - todayReset.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: 'valid' | 'expiring_soon' | 'expired';
  if (daysRemaining <= 0) {
    status = 'expired';
  } else if (daysRemaining <= 7) {
    status = 'expiring_soon';
  } else {
    status = 'valid';
  }

  return { daysRemaining, status };
}

export function generateWhatsAppShareUrl(asset: Asset): string {
  const statusEmoji = asset.status === 'active' ? '🟢 Active' : asset.status === 'expiring_soon' ? '⚠️ Expiring Soon' : '🔴 Expired';
  
  const text = `*AssetDoctor - Asset & Warranty Details* 🛡️\n\n` +
    `📦 *Item:* ${asset.name}\n` +
    `🏷️ *Brand:* ${asset.brand || 'N/A'}\n` +
    `📁 *Category:* ${asset.category}\n` +
    `💰 *Value:* ${formatINR(asset.price)}\n` +
    `📅 *Purchased:* ${asset.purchaseDate}\n` +
    `🛡️ *Warranty Expiry:* ${asset.expiryDate} (${statusEmoji})\n` +
    (asset.maintenanceDueDate ? `🔧 *Next Service/Renewal:* ${asset.maintenanceDueDate} (${asset.maintenanceType || 'Routine Maintenance'})\n` : '') +
    (asset.serialNumber ? `🔢 *Serial No:* ${asset.serialNumber}\n` : '') +
    (asset.vendor ? `🏪 *Merchant:* ${asset.vendor}\n` : '') +
    `\n*Managed with AssetDoctor - Smart Warranty Vault*`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function getBrandServiceHotline(brand?: string, category?: string, name?: string): { phone: string; label: string } {
  const b = (brand || '').toLowerCase();
  const c = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (b.includes('apple') || n.includes('macbook') || n.includes('iphone') || n.includes('ipad')) {
    return { phone: '18001081088', label: 'AppleCare (1800-108-1088)' };
  }
  if (b.includes('samsung') || n.includes('samsung')) {
    return { phone: '180057267864', label: 'Samsung Care (1800-572-67864)' };
  }
  if (b.includes('tvs') || n.includes('ronin') || n.includes('jupiter')) {
    return { phone: '18002587111', label: 'TVS Helpline (1800-258-7111)' };
  }
  if (b.includes('nothing') || b.includes('cmf')) {
    return { phone: '18002021234', label: 'Nothing Support (1800-202-1234)' };
  }
  if (b.includes('daikin') || n.includes('ac') || n.includes('air conditioner')) {
    return { phone: '18001803900', label: 'Daikin AC (1800-180-3900)' };
  }
  if (b.includes('kent') || n.includes('ro') || n.includes('purifier')) {
    return { phone: '9278912345', label: 'Kent RO Support (92789-12345)' };
  }
  if (b.includes('honda') || n.includes('activa') || n.includes('cb350')) {
    return { phone: '18001033434', label: 'Honda Two-Wheelers (1800-103-3434)' };
  }
  if (b.includes('creta') || b.includes('hyundai') || n.includes('car')) {
    return { phone: '18001024645', label: 'Hyundai Care (1800-102-4645)' };
  }
  if (c.includes('vehicle')) {
    return { phone: '18001029001', label: 'Roadside Assistance (1800-102-9001)' };
  }
  if (c.includes('appliance')) {
    return { phone: '18002095555', label: 'Appliance Hotline (1800-209-5555)' };
  }
  return { phone: '18002095555', label: 'Brand Hotline (1800-209-5555)' };
}

/**
 * Calculates current estimated resale value and depreciation metrics based on purchase date and category.
 */
export function calculateResaleValue(asset: {
  price: number;
  purchaseDate: string;
  category: AssetCategory;
}): {
  currentValue: number;
  depreciatedAmount: number;
  retainedPercentage: number;
  annualDepreciationRate: number;
  ageInYears: number;
} {
  const price = asset.price || 0;
  const pDate = new Date(asset.purchaseDate);
  const now = new Date();

  // Category Annual Depreciation Rates
  const rateMap: Record<AssetCategory, number> = {
    Gadgets: 0.25, // Smartphones/Tablets/Laptops ~ 25% per yr
    Electronics: 0.20, // TVs/Audio ~ 20% per yr
    Vehicles: 0.15, // Bikes/Cars ~ 15% per yr
    Appliances: 0.18, // ACs/Fridges ~ 18% per yr
    Home: 0.12, // Furniture/Fixtures ~ 12% per yr
    Other: 0.15,
  };

  const annualRate = rateMap[asset.category] || 0.15;

  let ageInYears = 0;
  if (!isNaN(pDate.getTime())) {
    const diffMs = Math.max(0, now.getTime() - pDate.getTime());
    ageInYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  }

  // Compound annual depreciation: Value = Price * (1 - rate)^years
  // Minimum floor value = 15% of original purchase price
  const minimumFloor = price * 0.15;
  const rawValue = price * Math.pow(1 - annualRate, ageInYears);
  const currentValue = Math.round(Math.max(minimumFloor, rawValue));

  const depreciatedAmount = Math.max(0, price - currentValue);
  const retainedPercentage = price > 0 ? Math.round((currentValue / price) * 100) : 100;

  return {
    currentValue,
    depreciatedAmount,
    retainedPercentage,
    annualDepreciationRate: annualRate * 100,
    ageInYears: Number(ageInYears.toFixed(1)),
  };
}

export const INITIAL_MOCK_ASSETS_RAW = [
  {
    id: 'ast-001',
    name: 'Apple MacBook Pro M3 (16GB RAM, 512GB SSD)',
    brand: 'Apple',
    category: 'Gadgets' as AssetCategory,
    price: 140000,
    purchaseDate: '2025-07-26',
    warrantyMonths: 12,
    serviceDate: '2025-07-26',
    maintenanceDueDate: '2026-07-26',
    maintenanceType: 'AppleCare+ Coverage Check',
    serialNumber: 'C02G801DQ051',
    vendor: 'Imagine Apple Premium Reseller',
    notes: 'Standard 1-year AppleCare Warranty. Covers logic board and Retina display.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    gstin: '29AABCU9603R1ZM',
    scamGuardStatus: 'VERIFIED' as const,
    serviceLogs: [
      {
        id: 'slog-101',
        date: '2025-11-20',
        serviceType: 'Display Cleaning & Thermal Paste Service',
        cost: 1200,
        provider: 'Apple Authorized Service Center',
        replacedParts: 'N/A (Preventative Maintenance)',
        notes: 'Routine dust cleaning & keyboard check. All hardware tests passed.',
      },
    ],
  },
  {
    id: 'ast-002',
    name: 'TVS Ronin 225 TD Dual Tone Motorcycle',
    brand: 'TVS Motors',
    category: 'Vehicles' as AssetCategory,
    price: 172000,
    purchaseDate: '2023-01-15',
    warrantyMonths: 36,
    insuranceExpiryDate: '2026-07-26', // 4 days remaining (expiring soon)
    pucExpiryDate: '2026-07-20', // Expired
    serviceDate: '2025-11-10',
    maintenanceDueDate: '2026-08-15',
    maintenanceType: 'Periodic Bike Service & Oil Change',
    serialNumber: 'ME4KA123456789012',
    vendor: 'TVS Motors Flagship Showroom',
    notes: '3-year standard factory warranty. 5 free services completed. Next engine oil check due.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    gstin: '29AABCT3311E1Z3',
    scamGuardStatus: 'VERIFIED' as const,
    serviceLogs: [
      {
        id: 'slog-201',
        date: '2025-11-10',
        serviceType: 'Annual Paid Service & Synthetic Oil Change',
        cost: 2850,
        provider: 'TVS Authorized Service Station',
        replacedParts: 'Engine Oil Filter, Brake Pads',
        notes: 'Chain lube, oil filter replacement, and clutch cable adjustment completed.',
      },
      {
        id: 'slog-202',
        date: '2024-06-12',
        serviceType: 'Free Service #3 & Spark Plug Replacement',
        cost: 450,
        provider: 'TVS Motors Service Center',
        replacedParts: 'NGK Spark Plug',
        notes: 'Free service coupon applied.',
      },
    ],
  },
  {
    id: 'ast-003',
    name: 'Samsung 55" 4K Ultra HD Smart OLED TV',
    brand: 'Samsung',
    category: 'Electronics' as AssetCategory,
    price: 85000,
    purchaseDate: '2025-05-10',
    warrantyMonths: 24,
    serviceDate: '2025-05-12',
    maintenanceDueDate: '2027-05-10',
    maintenanceType: 'Extended Panel Protection AMC',
    serialNumber: 'SN-SAM-998241',
    vendor: 'Samsung Smart Plaza',
    notes: 'Includes 2-year manufacturer panel & comprehensive main board warranty.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ast-004',
    name: 'Nothing Phone (3a) Lite (128GB, White)',
    brand: 'Nothing',
    category: 'Gadgets' as AssetCategory,
    price: 23999,
    purchaseDate: '2026-02-14',
    warrantyMonths: 12,
    serviceDate: '2026-02-14',
    maintenanceDueDate: '2027-02-14',
    maintenanceType: 'Glyph Interface & Screen Guard Inspection',
    serialNumber: 'NT-PH3A-884102',
    vendor: 'Flipkart Authorized Retail',
    notes: 'Includes Nothing Care Protection & 1-Year Manufacturer Warranty.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ast-005',
    name: 'CMF Buds 2 Plus ANC Wireless Earbuds',
    brand: 'CMF by Nothing',
    category: 'Gadgets' as AssetCategory,
    price: 3299,
    purchaseDate: '2026-03-01',
    warrantyMonths: 12,
    serviceDate: '2026-03-01',
    maintenanceDueDate: '2027-03-01',
    maintenanceType: 'Battery & ANC Firmware Diagnostics',
    serialNumber: 'CMF-BD2P-99120',
    vendor: 'Nothing Official Store',
    notes: '50dB Active Noise Cancellation with Ultra Bass Technology 2.0.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ast-006',
    name: 'Daikin 1.5 Ton 5 Star Inverter Split AC',
    brand: 'Daikin',
    category: 'Appliances' as AssetCategory,
    price: 45500,
    purchaseDate: '2025-07-28',
    warrantyMonths: 12,
    serviceDate: '2025-09-01',
    maintenanceDueDate: '2026-07-28',
    maintenanceType: 'AC Wet Servicing & Gas Pressure Check',
    serialNumber: 'AC-DKN-998241',
    vendor: 'Vijay Sales',
    notes: '10-Year compressor warranty + 2-year PCB warranty. Comprehensive AMC active.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ast-007',
    name: 'Kent Grand Plus Mineral RO Water Purifier',
    brand: 'Kent RO',
    category: 'Appliances' as AssetCategory,
    price: 19500,
    purchaseDate: '2024-09-05',
    warrantyMonths: 12,
    serviceDate: '2025-12-01',
    maintenanceDueDate: '2026-08-05',
    maintenanceType: 'RO Sediment & Carbon Filter Replacement',
    serialNumber: 'RO-KNT-441209',
    vendor: 'Kent Water Service Center',
    notes: '1 Year Free Service + 3 Years Free Service Maintenance contract.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4e?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'ast-008',
    name: 'Honda Activa 6G Scooter DLX',
    brand: 'Honda',
    category: 'Vehicles' as AssetCategory,
    price: 114202,
    purchaseDate: '2023-11-20',
    warrantyMonths: 36,
    insuranceExpiryDate: '2026-07-28', // 6 days remaining (expiring soon)
    pucExpiryDate: '2026-11-20', // Valid
    serviceDate: '2025-10-15',
    maintenanceDueDate: '2026-08-20',
    maintenanceType: 'Scooter Annual Maintenance & Insurance Renewal',
    serialNumber: 'ME4ACTV6G9912083',
    vendor: 'Honda Two-Wheeler Showroom',
    notes: '3-Year Standard Warranty + 3 Years Extended Coverage.',
    receiptImageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
  },
];

export function getProcessedInitialAssets(): Asset[] {
  return INITIAL_MOCK_ASSETS_RAW.map((item) => {
    const { expiryDate, daysRemaining, status } = calculateWarrantyStatus(
      item.purchaseDate,
      item.warrantyMonths
    );
    return {
      ...item,
      expiryDate,
      daysRemaining,
      status,
    };
  });
}
