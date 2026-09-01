/**
 * Cross-Document Entity Linking Engine
 * Automatically detects and links multiple documents (RC, Insurance, PUC, Service Bill)
 * to the SAME existing asset without creating duplicates.
 */

import type {
  UniversalExtractedData,
  EntityLinkResult,
  EntityLinkCandidate
} from './types.ts';
import type { Asset } from '../../src/types.ts';
import { ServiceExtractor } from './extractors/serviceExtractor.ts';

export class EntityLinker {
  /**
   * Matches an extracted document against the customer's existing assets.
   */
  public static linkDocumentToAsset(
    extractedData: UniversalExtractedData,
    existingAssets: Asset[]
  ): EntityLinkResult {
    if (!existingAssets || existingAssets.length === 0) {
      return {
        matchedAssetId: null,
        confidence: 0,
        matchType: 'NO_MATCH',
        isAutoLinked: false,
        notes: 'No existing customer assets found in vault.',
        candidates: []
      };
    }

    // Extract search keys from document data
    const s = extractedData.serviceData as any;
    const ins = extractedData.insuranceData as any;
    const puc = extractedData.pucData as any;
    const rc = extractedData.rcData as any;
    const p = extractedData.purchaseData as any;

    const docReg = s?.registration?.value ||
                   s?.vehicleRegistration?.value ||
                   ins?.vehicleRegistration?.value ||
                   ins?.registration?.value ||
                   puc?.registration?.value ||
                   puc?.registrationNumber?.value ||
                   rc?.registration?.value ||
                   rc?.registrationNumber?.value ||
                   p?.registration?.value ||
                   p?.vehicleRegistration?.value;

    const docVin = s?.vinOrChassis?.value ||
                   s?.chassisNumber?.value ||
                   ins?.vinOrChassis?.value ||
                   ins?.chassisNumber?.value ||
                   rc?.chassisNumber?.value ||
                   rc?.vinOrChassis?.value;

    const docEngine = s?.engineNumber?.value ||
                      ins?.engineNumber?.value ||
                      rc?.engineNumber?.value;

    const docSerial = extractedData.purchaseData?.serialNumber?.value ||
                      extractedData.electronicsData?.serialNumber?.value ||
                      extractedData.warrantyData?.serialNumber?.value ||
                      extractedData.applianceData?.serialNumber?.value;

    const docImei = extractedData.electronicsData?.imei?.value;

    const docBrand = extractedData.purchaseData?.brand?.value ||
                     extractedData.electronicsData?.brand?.value ||
                     extractedData.warrantyData?.brand?.value ||
                     extractedData.applianceData?.brand?.value ||
                     extractedData.rcData?.maker?.value ||
                     extractedData.serviceData?.vehicleMake?.value;

    const docModel = extractedData.purchaseData?.model?.value ||
                     extractedData.electronicsData?.model?.value ||
                     extractedData.electronicsData?.productName?.value ||
                     extractedData.purchaseData?.assetName?.value ||
                     extractedData.applianceData?.model?.value ||
                     extractedData.serviceData?.vehicleModel?.value ||
                     extractedData.insuranceData?.vehicleModel?.value ||
                     extractedData.rcData?.model?.value;

    const normDocReg = docReg ? ServiceExtractor.normalizeRegistration(docReg) : null;
    const cleanDocVin = docVin ? String(docVin).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
    const cleanDocEngine = docEngine ? String(docEngine).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
    const cleanDocSerial = docSerial ? String(docSerial).toUpperCase().trim() : null;
    const cleanDocImei = docImei ? String(docImei).replace(/\D/g, '') : null;

    const candidates: EntityLinkCandidate[] = [];

    const finishExact = (
      hits: EntityLinkCandidate[],
      matchType: EntityLinkResult['matchType'],
      confidence: number,
      notesSingle: (hit: EntityLinkCandidate) => string,
      notesMany: string,
    ): EntityLinkResult | null => {
      if (hits.length === 1) {
        const hit = hits[0];
        return {
          matchedAssetId: hit.assetId,
          confidence,
          matchType,
          isAutoLinked: true,
          notes: notesSingle(hit),
          candidates: hits,
        };
      }
      if (hits.length > 1) {
        return {
          matchedAssetId: null,
          confidence,
          matchType,
          isAutoLinked: false,
          notes: notesMany,
          candidates: hits,
        };
      }
      return null;
    };

    // Priority 1: Exact Registration Number — collect ALL hits (never pick at random)
    if (normDocReg) {
      const hits: EntityLinkCandidate[] = [];
      for (const asset of existingAssets) {
        const assetReg = asset.registration ? ServiceExtractor.normalizeRegistration(asset.registration) : null;
        if (assetReg && normDocReg === assetReg) {
          const assetId = asset.id || (asset as any).assetId;
          const assetName = asset.name || (asset as any).assetName || 'Vehicle';
          hits.push({
            assetId,
            assetName,
            matchScore: 100,
            matchedFields: ['registration'],
            isExactMatch: true,
            status: 'EXACT_MATCH',
          });
        }
      }
      const exact = finishExact(
        hits,
        'EXACT_REGISTRATION',
        0.99,
        (hit) => `Exact registration match (${normDocReg}) -> Linked to asset "${hit.assetName}" (${hit.assetId})`,
        `Multiple vault assets share registration ${normDocReg}. Confirm which entry to attach — auto-link blocked.`,
      );
      if (exact) return exact;
    }

    // Priority 2: Exact Chassis / VIN Number (min 10 chars)
    if (cleanDocVin && cleanDocVin.length >= 8) {
      const hits: EntityLinkCandidate[] = [];
      for (const asset of existingAssets) {
        const assetVin = String((asset as any).vinNumber || (asset as any).chassisNumber || (asset as any).vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (assetVin && assetVin.length >= 8 && cleanDocVin === assetVin) {
          const assetId = asset.id || (asset as any).assetId;
          const assetName = asset.name || (asset as any).assetName || 'Vehicle';
          hits.push({
            assetId,
            assetName,
            matchScore: 98,
            matchedFields: ['chassisNumber'],
            isExactMatch: true,
            status: 'EXACT_MATCH',
          });
        }
      }
      const exact = finishExact(
        hits,
        'EXACT_VIN',
        0.98,
        (hit) => `Exact chassis/VIN match (${cleanDocVin}) -> Linked to asset "${hit.assetName}" (${hit.assetId})`,
        `Multiple vault assets share chassis ${cleanDocVin}. Confirm which entry to attach — auto-link blocked.`,
      );
      if (exact) return exact;
    }

    // Priority 3: Exact Engine Number (min 6 chars)
    if (cleanDocEngine && cleanDocEngine.length >= 6) {
      const hits: EntityLinkCandidate[] = [];
      for (const asset of existingAssets) {
        const assetEngine = String((asset as any).engineNumber || (asset as any).engineNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (assetEngine && assetEngine.length >= 6 && cleanDocEngine === assetEngine) {
          const assetId = asset.id || (asset as any).assetId;
          const assetName = asset.name || (asset as any).assetName || 'Vehicle';
          hits.push({
            assetId,
            assetName,
            matchScore: 95,
            matchedFields: ['engineNumber'],
            isExactMatch: true,
            status: 'EXACT_MATCH',
          });
        }
      }
      const exact = finishExact(
        hits,
        'EXACT_ENGINE',
        0.96,
        (hit) => `Exact engine number match (${cleanDocEngine}) -> Linked to asset "${hit.assetName}" (${hit.assetId})`,
        `Multiple vault assets share engine ${cleanDocEngine}. Confirm which entry to attach — auto-link blocked.`,
      );
      if (exact) return exact;
    }

    // Priority 4: Exact Serial Number (min 5 chars)
    if (cleanDocSerial && cleanDocSerial.length >= 5 && !/^(?:n\/a|na|nil|null|undefined|none)$/i.test(cleanDocSerial)) {
      const hits: EntityLinkCandidate[] = [];
      for (const asset of existingAssets) {
        const assetSerial = String(asset.serialNumber || (asset as any).serial || '').toUpperCase().trim();
        if (assetSerial && assetSerial.length >= 5 && cleanDocSerial === assetSerial) {
          const assetId = asset.id || (asset as any).assetId;
          const assetName = asset.name || (asset as any).assetName || 'Asset';
          hits.push({
            assetId,
            assetName,
            matchScore: 95,
            matchedFields: ['serialNumber'],
            isExactMatch: true,
            status: 'EXACT_MATCH',
          });
        }
      }
      const exact = finishExact(
        hits,
        'EXACT_SERIAL',
        0.95,
        (hit) => `Exact serial number match (${cleanDocSerial}) -> Linked to asset "${hit.assetName}" (${hit.assetId})`,
        `Multiple vault assets share serial ${cleanDocSerial}. Confirm which entry to attach — auto-link blocked.`,
      );
      if (exact) return exact;
    }

    // Priority 5: Exact IMEI (15 digits)
    if (cleanDocImei && cleanDocImei.length === 15) {
      const hits: EntityLinkCandidate[] = [];
      for (const asset of existingAssets) {
        const assetImei = String((asset as any).imei || '').replace(/\D/g, '');
        if (assetImei && assetImei.length === 15 && cleanDocImei === assetImei) {
          const assetId = asset.id || (asset as any).assetId;
          const assetName = asset.name || (asset as any).assetName || 'Device';
          hits.push({
            assetId,
            assetName,
            matchScore: 97,
            matchedFields: ['imei'],
            isExactMatch: true,
            status: 'EXACT_MATCH',
          });
        }
      }
      const exact = finishExact(
        hits,
        'EXACT_IMEI',
        0.97,
        (hit) => `Exact IMEI match (${cleanDocImei}) -> Linked to asset "${hit.assetName}" (${hit.assetId})`,
        `Multiple vault assets share IMEI ${cleanDocImei}. Confirm which entry to attach — auto-link blocked.`,
      );
      if (exact) return exact;
    }

    // Priority 6: Strong Asset Name + Manufacturer Match (Fuzzy)
    for (const asset of existingAssets) {
      const assetName = (asset.name || (asset as any).assetName || '').toLowerCase();
      const assetBrand = (asset.brand || (asset as any).brandName || '').toLowerCase();
      const matchedFields: string[] = [];
      let score = 0;

      if (docBrand && assetBrand && (assetBrand.includes(docBrand.toLowerCase()) || docBrand.toLowerCase().includes(assetBrand))) {
        score += 35;
        matchedFields.push('brand');
      }

      if (docModel && assetName && docModel.length >= 3) {
        const normModel = docModel.toLowerCase().trim();
        if (assetName.includes(normModel) || normModel.includes(assetName)) {
          score += 45;
          matchedFields.push('model');
        }
      }

      if (score >= 40) {
        const assetId = asset.id || (asset as any).assetId;
        candidates.push({
          assetId,
          assetName: asset.name || (asset as any).assetName || 'Asset',
          matchScore: score,
          matchedFields,
          isExactMatch: false,
          status: 'POSSIBLE_MATCH',
        });
      }
    }

    candidates.sort((a, b) => b.matchScore - a.matchScore);

    if (candidates.length > 0) {
      const top = candidates[0];
      return {
        matchedAssetId: top.assetId,
        confidence: top.matchScore / 100,
        matchType: 'FUZZY_NAME',
        isAutoLinked: false,
        notes: `Possible match on ${top.matchedFields.join(', ')} -> Review before linking to "${top.assetName}"`,
        candidates,
      };
    }

    // Priority 7: No Match / User confirmation needed
    return {
      matchedAssetId: null,
      confidence: 0,
      matchType: 'NO_MATCH',
      isAutoLinked: false,
      notes: 'No matching asset found. New asset creation suggested.',
      candidates: [],
    };
  }
}
