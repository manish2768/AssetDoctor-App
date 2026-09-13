/**
 * Smart Core — Memory Engine
 *
 * Pillar 2: Contextual Memory & Existing Asset Knowledge.
 *
 * Rules:
 * 1. Leverages the customer's existing trusted assets, service records, and meter readings.
 * 2. Pre-fills missing or complementary data ONLY from verified customer history.
 * 3. Never presents remembered data as "extracted from current document" — explicitly tags as EXISTING_TRUSTED_DATA.
 * 4. Resolves candidate assets using strict priority and multi-factor corroboration.
 */

import { FieldProvenance, ProvenanceTaggedField, TrustEngine } from './TrustEngine';
import { resolveCanonicalAssetId } from '../services/assets/assetIdentity';
import { normalizeRegistration, normalizeChassis } from '../utils/vehicleFolder';

export interface MemoryMatchQuery {
  registration?: string;
  chassisNumber?: string;
  engineNumber?: string;
  serialNumber?: string;
  imei?: string;
  consumerId?: string;
  meterNumber?: string;
  brand?: string;
  model?: string;
}

export interface MemoryResolutionResult {
  matchedAsset: any | null;
  confidence: number;
  matchType:
    | 'EXACT_REGISTRATION'
    | 'EXACT_CHASSIS'
    | 'EXACT_ENGINE'
    | 'EXACT_SERIAL_IMEI'
    | 'CORROBORATED_SUFFIX'
    | 'ELECTRICITY_ACCOUNT'
    | 'NONE';
  canonicalAssetId: string | null;
  provenance: FieldProvenance;
  reason: string;
}

export interface TrustedReadingSuggestion {
  value: number | string | null;
  sourceDate?: string;
  sourceDocId?: string;
  provenance: FieldProvenance;
  label: string;
}

export class MemoryEngine {
  /**
   * Resolve an existing asset from the user's vault based on document identifiers.
   */
  public static resolveExistingAsset(
    query: MemoryMatchQuery,
    assets: any[] = [],
  ): MemoryResolutionResult {
    if (!Array.isArray(assets) || assets.length === 0) {
      return {
        matchedAsset: null,
        confidence: 0,
        matchType: 'NONE',
        canonicalAssetId: null,
        provenance: 'UNKNOWN',
        reason: 'User vault contains no assets.',
      };
    }

    const normReg = normalizeRegistration(query.registration);
    const normChassis = normalizeChassis(query.chassisNumber);
    const normEngine = normalizeChassis(query.engineNumber);
    const normSerial = (query.serialNumber || '').trim().toUpperCase();
    const normImei = (query.imei || '').trim().replace(/[^0-9]/g, '');
    const normConsumerId = (query.consumerId || '').trim();

    // 1. EXACT REGISTRATION MATCH
    if (normReg && normReg.length >= 6) {
      const match = assets.find((a) => {
        const aReg = normalizeRegistration(a.registration || a.registrationNumber);
        return aReg && aReg === normReg;
      });
      if (match) {
        return {
          matchedAsset: match,
          confidence: 1.0,
          matchType: 'EXACT_REGISTRATION',
          canonicalAssetId: resolveCanonicalAssetId(match),
          provenance: 'EXISTING_TRUSTED_DATA',
          reason: `Exact vehicle registration plate match: ${normReg}`,
        };
      }
    }

    // 2. EXACT CHASSIS / VIN MATCH (>= 8 chars)
    if (normChassis && normChassis.length >= 8) {
      const match = assets.find((a) => {
        const aChassis = normalizeChassis(a.chassisNumber || a.vin);
        return aChassis && aChassis === normChassis;
      });
      if (match) {
        return {
          matchedAsset: match,
          confidence: 0.98,
          matchType: 'EXACT_CHASSIS',
          canonicalAssetId: resolveCanonicalAssetId(match),
          provenance: 'EXISTING_TRUSTED_DATA',
          reason: `Exact chassis / VIN match: ${normChassis}`,
        };
      }
    }

    // 3. EXACT ENGINE MATCH (>= 6 chars)
    if (normEngine && normEngine.length >= 6) {
      const match = assets.find((a) => {
        const aEngine = normalizeChassis(a.engineNumber);
        return aEngine && aEngine === normEngine;
      });
      if (match) {
        return {
          matchedAsset: match,
          confidence: 0.95,
          matchType: 'EXACT_ENGINE',
          canonicalAssetId: resolveCanonicalAssetId(match),
          provenance: 'EXISTING_TRUSTED_DATA',
          reason: `Exact engine number match: ${normEngine}`,
        };
      }
    }

    // 4. EXACT SERIAL OR IMEI MATCH
    if ((normSerial && normSerial.length >= 4) || (normImei && normImei.length >= 10)) {
      const match = assets.find((a) => {
        const aSerial = String(a.serialNumber || a.serial || '').trim().toUpperCase();
        const aImei = String(a.imei || '').trim().replace(/[^0-9]/g, '');
        return (
          (normSerial && aSerial && aSerial === normSerial) ||
          (normImei && aImei && aImei === normImei)
        );
      });
      if (match) {
        return {
          matchedAsset: match,
          confidence: 0.99,
          matchType: 'EXACT_SERIAL_IMEI',
          canonicalAssetId: resolveCanonicalAssetId(match),
          provenance: 'EXISTING_TRUSTED_DATA',
          reason: `Exact serial or IMEI match: ${normSerial || normImei}`,
        };
      }
    }

    // 5. CORROBORATED CHASSIS / ENGINE SUFFIX (Last 4-6 digits)
    const chassisSuffix = normChassis && normChassis.length >= 4 ? normChassis.slice(-6) : '';
    const engineSuffix = normEngine && normEngine.length >= 4 ? normEngine.slice(-6) : '';

    if (chassisSuffix || engineSuffix) {
      const candidates = assets.filter((a) => {
        const aChassis = normalizeChassis(a.chassisNumber);
        const aEngine = normalizeChassis(a.engineNumber);
        const cMatch = chassisSuffix && aChassis && aChassis.endsWith(chassisSuffix);
        const eMatch = engineSuffix && aEngine && aEngine.endsWith(engineSuffix);
        return cMatch || eMatch;
      });

      if (candidates.length === 1) {
        const single = candidates[0];
        const queryBrand = (query.brand || '').toLowerCase().trim();
        const aBrand = (single.brand || single.brandName || single.assetName || single.name || '').toLowerCase().trim();
        const queryModel = (query.model || '').toLowerCase().trim();
        const aModel = (single.model || single.assetName || single.name || '').toLowerCase().trim();

        const brandMatches = Boolean(queryBrand && (aBrand.includes(queryBrand) || queryBrand.includes(aBrand)));
        const modelMatches = Boolean(queryModel && (aModel.includes(queryModel) || queryModel.includes(aModel)));

        if (brandMatches || modelMatches || (!queryBrand && !queryModel)) {
          return {
            matchedAsset: single,
            confidence: 0.88,
            matchType: 'CORROBORATED_SUFFIX',
            canonicalAssetId: resolveCanonicalAssetId(single),
            provenance: 'EXISTING_TRUSTED_DATA',
            reason: `Corroborated identifier suffix (${chassisSuffix || engineSuffix}) for ${single.assetName || single.brand || 'Vehicle'}`,
          };
        }
      }
    }

    // 6. ELECTRICITY CONSUMER ID
    if (normConsumerId) {
      const match = assets.find((a) => {
        const cId = String(a.consumerId || a.accountNumber || '').trim();
        return cId && cId === normConsumerId;
      });
      if (match) {
        return {
          matchedAsset: match,
          confidence: 0.95,
          matchType: 'ELECTRICITY_ACCOUNT',
          canonicalAssetId: resolveCanonicalAssetId(match),
          provenance: 'EXISTING_TRUSTED_DATA',
          reason: `Electricity consumer/account ID match: ${normConsumerId}`,
        };
      }
    }

    return {
      matchedAsset: null,
      confidence: 0,
      matchType: 'NONE',
      canonicalAssetId: null,
      provenance: 'UNKNOWN',
      reason: 'No confident match found in existing assets.',
    };
  }

  /**
   * Retrieve previous trusted electricity meter reading from past bills.
   * Never fabricates: if not found, returns null with MISSING provenance.
   */
  public static getLatestMeterReading(
    pastBills: any[] = [],
    consumerId?: string,
  ): TrustedReadingSuggestion {
    if (!Array.isArray(pastBills) || pastBills.length === 0) {
      return {
        value: null,
        provenance: 'MISSING',
        label: 'No prior electricity bills found',
      };
    }

    // Filter by consumerId if provided
    const filtered = consumerId
      ? pastBills.filter((b) => String(b.consumerId || b.accountNumber || '').trim() === consumerId.trim())
      : pastBills;

    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.billDate || a.createdAt || 0).getTime();
      const tb = new Date(b.billDate || b.createdAt || 0).getTime();
      return tb - ta;
    });

    const candidate = sorted.find(
      (b) => b.currentMeterReading != null && Number(b.currentMeterReading) > 0,
    );

    if (candidate) {
      return {
        value: Number(candidate.currentMeterReading),
        sourceDate: candidate.billDate || candidate.createdAt,
        sourceDocId: candidate.id || candidate.billId,
        provenance: 'EXISTING_TRUSTED_DATA',
        label: `Prefilled from previous bill (${candidate.billDate || 'earlier'})`,
      };
    }

    return {
      value: null,
      provenance: 'MISSING',
      label: 'No previous reading recorded',
    };
  }

  /**
   * Retrieve latest recorded odometer reading for a vehicle asset.
   */
  public static getLatestVehicleOdometer(vehicle: any): TrustedReadingSuggestion {
    if (!vehicle || typeof vehicle !== 'object') {
      return {
        value: null,
        provenance: 'MISSING',
        label: 'Vehicle record unavailable',
      };
    }

    const odo = vehicle.odometerKm || vehicle.odometerReading;
    if (odo != null && Number(odo) > 0) {
      return {
        value: Number(odo),
        provenance: 'EXISTING_TRUSTED_DATA',
        label: `Current vehicle passport odometer (${Number(odo).toLocaleString('en-IN')} KM)`,
      };
    }

    return {
      value: null,
      provenance: 'MISSING',
      label: 'No prior odometer recorded',
    };
  }
}
