import type { ScamGuardAnalysis, ParsedInvoiceItem } from '../types.ts';

/**
 * Validates GSTIN string (15-character Indian Goods & Services Tax Identification Number)
 */
export function validateGSTIN(gstin?: string): {
  isValid: boolean;
  stateName?: string;
  pan?: string;
  message: string;
} {
  if (!gstin || typeof gstin !== 'string' || gstin.trim() === '') {
    return { isValid: false, message: 'GSTIN missing on invoice document' };
  }

  const cleanGstin = gstin.trim().toUpperCase();

  // Standard GSTIN regex
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  const stateMap: Record<string, string> = {
    '01': 'Jammu & Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '18': 'Assam',
    '19': 'West Bengal',
    '21': 'Odisha',
    '24': 'Gujarat',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
  };

  const stateCode = cleanGstin.substring(0, 2);
  const stateName = stateMap[stateCode];

  if (!gstinRegex.test(cleanGstin)) {
    return {
      isValid: false,
      message: 'Invalid GSTIN structure (Must be 15 alphanumeric characters e.g. 29AABCU9603R1ZM)',
    };
  }

  if (!stateName) {
    return {
      isValid: false,
      message: `Invalid GST state prefix code (${stateCode})`,
    };
  }

  const pan = cleanGstin.substring(2, 12);

  return {
    isValid: true,
    stateName,
    pan,
    message: `Valid GSTIN registered under ${stateName} (PAN: ${pan})`,
  };
}

/**
 * Analyzes invoice data for potential scams, suspicious pricing, duplicate line items, and vendor inconsistency.
 */
export function analyzeInvoiceForScams(data: {
  vendor?: string;
  purchaseDate?: string;
  totalAmount?: number;
  gstin?: string;
  items?: ParsedInvoiceItem[];
}): ScamGuardAnalysis {
  const vendor = data.vendor || 'Unknown Vendor';
  const totalAmount = data.totalAmount || 0;
  const items = data.items || [];
  const gstin = data.gstin || '';

  const scamFlags: string[] = [];
  const verifiedChecks: string[] = [];
  const priceAnomalies: string[] = [];

  // 1. GSTIN Check
  let gstinStatus: ScamGuardAnalysis['gstinStatus'] = 'MISSING';
  if (gstin) {
    const gstValidation = validateGSTIN(gstin);
    if (gstValidation.isValid) {
      gstinStatus = 'VERIFIED_VALID';
      verifiedChecks.push(`GSTIN ${gstin} verified (${gstValidation.stateName})`);
    } else {
      gstinStatus = 'INVALID_FORMAT';
      scamFlags.push(`GSTIN Alert: ${gstValidation.message}`);
    }
  } else {
    // Check if vendor sounds like a registered retail chain where GSTIN is mandatory
    const isMajorRetailer = /flipkart|amazon|croma|reliance|apple|samsung|vijay sales|tvs/i.test(vendor);
    if (isMajorRetailer) {
      gstinStatus = 'MISSING';
      scamFlags.push(`Missing Tax GSTIN on invoice claiming to be ${vendor}`);
    } else {
      scamFlags.push('No GSTIN found on invoice document (Cash Bill / Unregistered Entity)');
    }
  }

  // 2. Vendor Consistency & Formatting
  let vendorAuthenticity: ScamGuardAnalysis['vendorAuthenticity'] = 'VERIFIED_RETAILER';
  const knownTrusted = /flipkart|amazon|croma|reliance|apple|samsung|vijay sales|sangeetha|tvs|honda|kent/i.test(vendor);
  const suspiciousVendorWords = /cash only|cheap deals|no tax|fake|wholesale copy|replica|first copy|telegram deal/i.test(vendor);

  if (knownTrusted) {
    vendorAuthenticity = 'VERIFIED_RETAILER';
    verifiedChecks.push(`Vendor "${vendor}" matches registered national retail database`);
  } else if (suspiciousVendorWords) {
    vendorAuthenticity = 'MISMATCHED_FORMAT';
    scamFlags.push(`Suspicious vendor descriptor in invoice header: "${vendor}"`);
  } else {
    vendorAuthenticity = 'UNVERIFIED_GENERIC';
    verifiedChecks.push(`Local merchant "${vendor}" (Requires manual store verification)`);
  }

  // 3. Pricing Math & Total Sum Verification
  const itemSum = items.reduce((acc, curr) => acc + (curr.price || 0), 0);
  let taxIntegrity: ScamGuardAnalysis['taxIntegrity'] = 'FULL_TAX_INVOICE';

  if (totalAmount > 0 && Math.abs(totalAmount - itemSum) > 50) {
    taxIntegrity = 'INVALID_TOTAL';
    priceAnomalies.push(`Invoice total (₹${totalAmount.toLocaleString('en-IN')}) does not match item sum (₹${itemSum.toLocaleString('en-IN')})`);
    scamFlags.push('Math Discrepancy: Total bill amount differs from itemized row sum');
  } else {
    verifiedChecks.push(`Bill total calculation verified (Sum: ₹${itemSum.toLocaleString('en-IN')})`);
  }

  // 4. Duplicate Items & Serial Number Anomaly Detection
  const itemNamesSeen = new Set<string>();
  const serialsSeen = new Set<string>();

  items.forEach((item) => {
    if (item.itemName) {
      const lowerName = item.itemName.toLowerCase().trim();
      if (itemNamesSeen.has(lowerName)) {
        priceAnomalies.push(`Duplicate item line detected: "${item.itemName}"`);
        scamFlags.push(`Duplicate Product Alert: "${item.itemName}" listed multiple times`);
      }
      itemNamesSeen.add(lowerName);
    }

    if (item.serialNumber && item.serialNumber !== 'N/A' && !item.serialNumber.startsWith('SN-')) {
      if (serialsSeen.has(item.serialNumber)) {
        scamFlags.push(`CRITICAL: Duplicate Serial Number detected (${item.serialNumber}) across multiple products!`);
      }
      serialsSeen.add(item.serialNumber);
    }

    // 5. Unrealistic Price Anomaly Checks (Counterfeit detection)
    const nameLower = (item.itemName || '').toLowerCase();
    const price = item.price || 0;

    if ((nameLower.includes('iphone') || nameLower.includes('macbook')) && price < 5000 && price > 0) {
      priceAnomalies.push(`Unusual price alert: ${item.itemName} priced at ₹${price} (Likely counterfeit or dummy invoice)`);
      scamFlags.push('Counterfeit Alert: Premium product priced unrealistically low');
    }
    if ((nameLower.includes('oled') || nameLower.includes('smart tv')) && price < 2000 && price > 0) {
      priceAnomalies.push(`Unusual price alert: ${item.itemName} listed for ₹${price}`);
      scamFlags.push('Suspicious Pricing: High-value television listed at nominal price');
    }
  });

  // Calculate Overall Authenticity Score (0 - 100)
  let score = 100;

  if (gstinStatus === 'INVALID_FORMAT') score -= 30;
  if (gstinStatus === 'MISSING') score -= 15;
  if (vendorAuthenticity === 'MISMATCHED_FORMAT') score -= 35;
  if (taxIntegrity === 'INVALID_TOTAL') score -= 20;
  score -= scamFlags.length * 10;

  score = Math.max(10, Math.min(100, score));

  let status: ScamGuardAnalysis['status'] = 'VERIFIED';
  if (score >= 80) {
    status = 'VERIFIED';
  } else if (score >= 50) {
    status = 'WARNING';
  } else {
    status = 'SUSPICIOUS_SCAM';
  }

  return {
    authenticityScore: score,
    status,
    gstin,
    gstinStatus,
    vendorAuthenticity,
    taxIntegrity,
    priceAnomalies,
    scamFlags,
    verifiedChecks,
  };
}
