/**
 * Official India brand helpline directory (toll-free / customer care).
 * Used to auto-assign supportPhone when brand is detected from product name.
 */

/** @typedef {{ brand: string, aliases: string[], phone: string, label?: string, category: 'electronics'|'vehicle' }} BrandHelpline */

/** @type {BrandHelpline[]} */
export const BRAND_HELPLINES = [
  // Electronics
  {
    brand: 'Nothing',
    aliases: ['nothing', 'nothing phone', 'cph'],
    phone: '18003154545',
    label: 'Nothing Support',
    category: 'electronics',
  },
  {
    brand: 'Apple',
    aliases: ['apple', 'iphone', 'ipad', 'macbook', 'airpods'],
    phone: '18001027753',
    label: 'Apple Support India',
    category: 'electronics',
  },
  {
    brand: 'Samsung',
    aliases: ['samsung', 'galaxy'],
    phone: '1800407267864',
    label: 'Samsung Care',
    category: 'electronics',
  },
  {
    brand: 'Xiaomi',
    aliases: ['xiaomi', 'redmi', 'poco', 'mi '],
    phone: '18001036286',
    label: 'Mi / Xiaomi Support',
    category: 'electronics',
  },
  {
    brand: 'OnePlus',
    aliases: ['oneplus', 'one plus'],
    phone: '18001257253',
    label: 'OnePlus Care',
    category: 'electronics',
  },
  {
    brand: 'Realme',
    aliases: ['realme'],
    phone: '18001025685',
    label: 'realme Support',
    category: 'electronics',
  },
  {
    brand: 'Vivo',
    aliases: ['vivo'],
    phone: '18002084488',
    label: 'vivo Care',
    category: 'electronics',
  },
  {
    brand: 'Oppo',
    aliases: ['oppo'],
    phone: '18001032777',
    label: 'OPPO Care',
    category: 'electronics',
  },
  {
    brand: 'Motorola',
    aliases: ['motorola', 'moto '],
    phone: '18001023282',
    label: 'Motorola Support',
    category: 'electronics',
  },
  {
    brand: 'LG',
    aliases: ['lg '],
    phone: '18003159999',
    label: 'LG Customer Care',
    category: 'electronics',
  },
  {
    brand: 'Sony',
    aliases: ['sony'],
    phone: '18001037799',
    label: 'Sony India',
    category: 'electronics',
  },
  // Vehicles
  {
    brand: 'TVS',
    aliases: ['tvs', 'ronin', 'apache', 'jupiter', 'ntorq'],
    phone: '18002587555',
    label: 'TVS Care',
    category: 'vehicle',
  },
  {
    brand: 'Honda',
    aliases: ['honda', 'activa', 'shine', 'unicorn'],
    phone: '18001032323',
    label: 'Honda Motorcycle & Scooter',
    category: 'vehicle',
  },
  {
    brand: 'Hero',
    aliases: ['hero', 'splendor', 'passion', 'hf deluxe'],
    phone: '18002667000',
    label: 'Hero MotoCorp',
    category: 'vehicle',
  },
  {
    brand: 'Bajaj',
    aliases: ['bajaj', 'pulsar', 'dominar', 'chetak'],
    phone: '18002335959',
    label: 'Bajaj Auto',
    category: 'vehicle',
  },
  {
    brand: 'Tata',
    aliases: ['tata', 'nexon', 'punch', 'tiago', 'harrier'],
    phone: '18002098282',
    label: 'Tata Motors',
    category: 'vehicle',
  },
  {
    brand: 'Mahindra',
    aliases: ['mahindra', 'xuv', 'scorpio', 'thar', 'bolero'],
    phone: '18002096006',
    label: 'Mahindra Care',
    category: 'vehicle',
  },
  {
    brand: 'Maruti Suzuki',
    aliases: ['maruti', 'suzuki', 'swift', 'baleno', 'brezza', 'alto'],
    phone: '18001021800',
    label: 'Maruti Suzuki',
    category: 'vehicle',
  },
  {
    brand: 'Hyundai',
    aliases: ['hyundai', 'creta', 'i20', 'venue', 'verna'],
    phone: '1800114645',
    label: 'Hyundai Motor India',
    category: 'vehicle',
  },
  {
    brand: 'Royal Enfield',
    aliases: ['royal enfield', 'enfield', 'classic 350', 'hunter 350', 'meteor'],
    phone: '18002100007',
    label: 'Royal Enfield',
    category: 'vehicle',
  },
];

/**
 * Resolve brand helpline from asset name / brand string.
 * @returns {BrandHelpline|null}
 */
export function lookupBrandHelpline(text = '') {
  const hay = ` ${String(text || '').toLowerCase()} `;
  if (!hay.trim()) return null;
  let best = null;
  let bestLen = 0;
  for (const entry of BRAND_HELPLINES) {
    for (const alias of entry.aliases) {
      const needle = alias.toLowerCase().trim();
      if (!needle) continue;
      if (hay.includes(needle) && needle.length >= bestLen) {
        best = entry;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

/**
 * Prefer saved supportPhone; else brand directory match.
 */
export function resolveSupportContact(asset = {}) {
  const saved = String(asset.supportPhone || '').replace(/\D/g, '');
  if (saved.length >= 8) {
    return {
      phone: saved,
      label: asset.brandName ? `${asset.brandName} Support` : 'Customer Care',
      brand: asset.brandName || '',
      source: 'saved',
    };
  }
  const hit = lookupBrandHelpline(
    `${asset.brandName || ''} ${asset.assetName || ''} ${asset.categoryLabel || ''}`,
  );
  if (!hit) return null;
  return {
    phone: hit.phone,
    label: hit.label || `${hit.brand} Helpline`,
    brand: hit.brand,
    source: 'directory',
  };
}

export default BRAND_HELPLINES;
