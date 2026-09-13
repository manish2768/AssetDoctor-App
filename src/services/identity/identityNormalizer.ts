/**
 * Asset Doctor — Canonical Identity Normalizer
 * Standardizes email, phone numbers (E.164 / Indian mobile format), and 6-digit Indian PIN codes.
 */

/**
 * Normalizes email address:
 * - Trims leading/trailing whitespace
 * - Converts to lower-case
 * - Validates standard email structure
 */
export function normalizeCanonicalEmail(email: any): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '';
  return trimmed;
}

/**
 * Normalizes phone numbers to standard E.164 format:
 * - Strips all non-digit characters except leading '+'
 * - Handles 10-digit Indian numbers: 9876543210 -> +919876543210
 * - Handles leading 0: 09876543210 -> +919876543210
 * - Handles 91 prefix: 919876543210 -> +919876543210
 * - Handles already formatted E.164: +919876543210
 * - Validates valid Indian mobile prefixes (6, 7, 8, 9)
 */
export function normalizeCanonicalPhone(phone: any): string {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '').trim();
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digits)) return '';
    // If it's +91, validate 10 digits
    if (cleaned.startsWith('+91')) {
      const national = cleaned.slice(3);
      if (/^[6-9]\d{9}$/.test(national) || /^\d{10}$/.test(national)) return `+91${national}`;
      return '';
    }
    return cleaned;
  }

  // Handle double zero international prefix e.g. 0091...
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && (cleaned.length === 11 || cleaned.length === 13)) {
    // Handle leading 0 (STD/mobile dial prefix in India, e.g. 09876543210 or 0919876543210)
    cleaned = cleaned.slice(1);
  }

  // 12-digit 91XXXXXXXXXX
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    const national = cleaned.slice(2);
    if (/^[6-9]\d{9}$/.test(national) || /^\d{10}$/.test(national)) {
      return `+91${national}`;
    }
  }

  // 10-digit Indian Mobile
  if (/^[6-9]\d{9}$/.test(cleaned) || /^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Fallback for international without plus if length is standard (7 to 15 digits)
  if (/^\d{7,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return '';
}

/**
 * Validates Indian PIN code:
 * - Must be strictly 6 numeric digits
 * - First digit cannot be 0 (must be 1-9)
 * - Rejects non-numeric, 5-digit, 7-digit, spaces
 */
export function validateIndianPincode(pincode: any): { valid: boolean; pincode: string; error?: string } {
  if (pincode == null) {
    return { valid: false, pincode: '', error: 'PIN Code is required' };
  }
  const clean = String(pincode).trim().replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, pincode: '', error: 'PIN Code is required' };
  }
  if (!/^\d+$/.test(clean)) {
    return { valid: false, pincode: clean, error: 'PIN Code must contain digits only' };
  }
  if (clean.length !== 6) {
    return { valid: false, pincode: clean, error: `PIN Code must be exactly 6 digits (got ${clean.length})` };
  }
  if (clean.startsWith('0')) {
    return { valid: false, pincode: clean, error: 'Invalid Indian PIN Code: cannot start with 0' };
  }
  return { valid: true, pincode: clean };
}

/**
 * Known Indian PIN prefix lookup table for auto-deriving City / State where applicable.
 */
const KNOWN_PIN_PREFIX_MAP: Record<string, { city?: string; state: string; district?: string }> = {
  '11': { city: 'New Delhi', state: 'Delhi', district: 'Delhi' },
  '12': { city: 'Gurugram', state: 'Haryana', district: 'Gurgaon' },
  '13': { city: 'Ambala', state: 'Haryana', district: 'Ambala' },
  '14': { city: 'Ludhiana', state: 'Punjab', district: 'Ludhiana' },
  '15': { city: 'Bhatinda', state: 'Punjab', district: 'Bathinda' },
  '16': { city: 'Chandigarh', state: 'Chandigarh', district: 'Chandigarh' },
  '20': { city: 'Noida', state: 'Uttar Pradesh', district: 'Gautam Buddha Nagar' },
  '21': { city: 'Prayagraj', state: 'Uttar Pradesh', district: 'Prayagraj' },
  '22': { city: 'Lucknow', state: 'Uttar Pradesh', district: 'Lucknow' },
  '23': { city: 'Varanasi', state: 'Uttar Pradesh', district: 'Varanasi' },
  '24': { city: 'Bareilly', state: 'Uttar Pradesh', district: 'Bareilly' },
  '25': { city: 'Meerut', state: 'Uttar Pradesh', district: 'Meerut' },
  '26': { city: 'Aligarh', state: 'Uttar Pradesh', district: 'Aligarh' },
  '27': { city: 'Gorakhpur', state: 'Uttar Pradesh', district: 'Gorakhpur' },
  '28': { city: 'Agra', state: 'Uttar Pradesh', district: 'Agra' },
  '30': { city: 'Jaipur', state: 'Rajasthan', district: 'Jaipur' },
  '31': { city: 'Udaipur', state: 'Rajasthan', district: 'Udaipur' },
  '32': { city: 'Kota', state: 'Rajasthan', district: 'Kota' },
  '33': { city: 'Bikaner', state: 'Rajasthan', district: 'Bikaner' },
  '34': { city: 'Jodhpur', state: 'Rajasthan', district: 'Jodhpur' },
  '36': { city: 'Rajkot', state: 'Gujarat', district: 'Rajkot' },
  '38': { city: 'Ahmedabad', state: 'Gujarat', district: 'Ahmedabad' },
  '39': { city: 'Surat', state: 'Gujarat', district: 'Surat' },
  '40': { city: 'Mumbai', state: 'Maharashtra', district: 'Mumbai' },
  '41': { city: 'Pune', state: 'Maharashtra', district: 'Pune' },
  '42': { city: 'Nashik', state: 'Maharashtra', district: 'Nashik' },
  '43': { city: 'Aurangabad', state: 'Maharashtra', district: 'Chhatrapati Sambhajinagar' },
  '44': { city: 'Nagpur', state: 'Maharashtra', district: 'Nagpur' },
  '45': { city: 'Indore', state: 'Madhya Pradesh', district: 'Indore' },
  '46': { city: 'Bhopal', state: 'Madhya Pradesh', district: 'Bhopal' },
  '47': { city: 'Gwalior', state: 'Madhya Pradesh', district: 'Gwalior' },
  '48': { city: 'Jabalpur', state: 'Madhya Pradesh', district: 'Jabalpur' },
  '49': { city: 'Raipur', state: 'Chhattisgarh', district: 'Raipur' },
  '50': { city: 'Hyderabad', state: 'Telangana', district: 'Hyderabad' },
  '51': { city: 'Tirupati', state: 'Andhra Pradesh', district: 'Tirupati' },
  '52': { city: 'Vijayawada', state: 'Andhra Pradesh', district: 'NTR' },
  '53': { city: 'Visakhapatnam', state: 'Andhra Pradesh', district: 'Visakhapatnam' },
  '56': { city: 'Bengaluru', state: 'Karnataka', district: 'Bengaluru Urban' },
  '57': { city: 'Mangaluru', state: 'Karnataka', district: 'Dakshina Kannada' },
  '58': { city: 'Hubli', state: 'Karnataka', district: 'Dharwad' },
  '59': { city: 'Belagavi', state: 'Karnataka', district: 'Belagavi' },
  '60': { city: 'Chennai', state: 'Tamil Nadu', district: 'Chennai' },
  '62': { city: 'Madurai', state: 'Tamil Nadu', district: 'Madurai' },
  '63': { city: 'Salem', state: 'Tamil Nadu', district: 'Salem' },
  '64': { city: 'Coimbatore', state: 'Tamil Nadu', district: 'Coimbatore' },
  '67': { city: 'Kozhikode', state: 'Kerala', district: 'Kozhikode' },
  '68': { city: 'Kochi', state: 'Kerala', district: 'Ernakulam' },
  '69': { city: 'Thiruvananthapuram', state: 'Kerala', district: 'Thiruvananthapuram' },
  '70': { city: 'Kolkata', state: 'West Bengal', district: 'Kolkata' },
  '71': { city: 'Howrah', state: 'West Bengal', district: 'Howrah' },
  '75': { city: 'Bhubaneswar', state: 'Odisha', district: 'Khordha' },
  '80': { city: 'Patna', state: 'Bihar', district: 'Patna' },
  '83': { city: 'Ranchi', state: 'Jharkhand', district: 'Ranchi' },
  '78': { city: 'Guwahati', state: 'Assam', district: 'Kamrup Metropolitan' },
};

/**
 * Derives State and District/City hints from a 6-digit Indian PIN code.
 */
export function lookupPincode(pincode: string): { city?: string; state?: string; district?: string } | null {
  const check = validateIndianPincode(pincode);
  if (!check.valid) return null;
  const prefix2 = check.pincode.slice(0, 2);
  return KNOWN_PIN_PREFIX_MAP[prefix2] || null;
}
