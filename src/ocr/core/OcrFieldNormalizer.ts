/**
 * Asset Doctor — Indian OCR Field Normalizer
 * Normalizes dates, vehicle registration numbers, GSTIN, currency, VIN, engine, IMEI, and phone numbers.
 */

export class OcrFieldNormalizer {
  /**
   * Normalizes any Indian date format into standard ISO YYYY-MM-DD
   */
  public static normalizeDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const clean = raw.trim().replace(/[,\.]/g, '');

    // Format: 14/07/2025 or 14-07-2025 or 14.07.2025
    const numMatch = clean.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.](20[2-3][0-9])\b/);
    if (numMatch) {
      const day = numMatch[1].padStart(2, '0');
      const month = numMatch[2].padStart(2, '0');
      const year = numMatch[3];
      if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // Format: 2025/07/14 or 2025-07-14
    const isoMatch = clean.match(/\b(20[2-3][0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])\b/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // Format: 14 Jul 2025 or 14 July 2025
    const monthNames: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };

    const textMatch = clean.match(/\b([0-3]?[0-9])[\s\-\/]+([A-Za-z]{3,9})[\s\-\/]+(20[2-3][0-9])\b/i);
    if (textMatch) {
      const day = textMatch[1].padStart(2, '0');
      const mStr = textMatch[2].toLowerCase();
      const year = textMatch[3];
      const month = monthNames[mStr] || monthNames[mStr.slice(0, 3)];
      if (month && Number(day) >= 1 && Number(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    return null;
  }

  /**
   * Normalizes Indian Vehicle Registration Plate (e.g., UP 32 QU 2187 -> UP32QU2187, DL 01 AB 9988 -> DL01AB9988)
   */
  public static normalizeRegistration(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = compact.match(/([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4})/);
    return match ? match[1] : null;
  }

  /**
   * Normalizes currency string into numeric INR amount (e.g. ₹ 1,35,500.00 -> 135500)
   */
  public static normalizeAmount(raw: string | number | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const clean = String(raw).replace(/[₹RsINR,\s]/gi, '').trim();
    const num = parseFloat(clean);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  /**
   * Normalizes 15-character Indian GSTIN
   */
  public static normalizeGstin(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = clean.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/);
    return match ? match[1] : null;
  }

  /**
   * Normalizes 17-character VIN / Chassis Number
   */
  public static normalizeChassisNumber(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = clean.match(/([A-HJ-NPR-Z0-9]{17})/);
    if (match) return match[1];
    // Fallback: 10 to 18 alphanumeric chars
    const shortMatch = clean.match(/([A-Z0-9]{10,18})/);
    return shortMatch ? shortMatch[1] : null;
  }

  /**
   * Normalizes 15-digit Phone IMEI Number
   */
  public static normalizeImei(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    return digits.length === 15 ? digits : (digits.length >= 14 && digits.length <= 16 ? digits : null);
  }

  /**
   * Normalizes 10-digit Indian Mobile Number
   */
  public static normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return null;
  }

  /**
   * Normalizes Odometer Reading (KM)
   */
  public static normalizeOdometerKm(raw: string | number | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
      return Number.isFinite(raw) && raw >= 0 && raw <= 999999 ? Math.round(raw) : null;
    }
    const clean = String(raw).replace(/[^0-9]/g, '');
    if (!clean) return null;
    const km = parseInt(clean, 10);
    // Reasonable vehicle odometer: 0 to 999,999 KM
    return Number.isFinite(km) && km >= 0 && km <= 999999 ? km : null;
  }
}
