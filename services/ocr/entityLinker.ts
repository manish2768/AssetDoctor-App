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
    const docReg = extractedData.serviceData?.vehicleRegistration?.value ||
                   extractedData.insuranceData?.vehicleRegistration?.value ||
                   extractedData.pucData?.registrationNumber?.value ||
                   extractedData.rcData?.registrationNumber?.value ||
                   extractedData.purchaseData?.vehicleRegistration?.value;

    const docVin = extractedData.serviceData?.vinOrChassis?.value ||
                   extractedData.insuranceData?.vinOrChassis?.value ||
                   extractedData.rcData?.chassisNumber?.value;

    const docEngine = extractedData.serviceData?.engineNumber?.value ||
                      extractedData.insuranceData?.engineNumber?.value ||
                      extractedData.rcData?.engineNumber?.value;

    const docSerial = extractedData.purchaseData?.serialNumber?.value ||
                      extractedData.warrantyData?.serialNumber?.value ||
                      extractedData.applianceData?.serialNumber?.value;

    const docBrand = extractedData.purchaseData?.brand?.value ||
                     extractedData.warrantyData?.brand?.value ||
                     extractedData.applianceData?.brand?.value ||
                     extractedData.rcData?.maker?.value;

    const normDocReg = docReg ? ServiceExtractor.normalizeRegistration(docReg) : null;
    const candidates: EntityLinkCandidate[] = [];

    for (const asset of existingAssets) {
      const matchedFields: string[] = [];
      let score = 0;

      // 1. Check Registration match (Highest Signal)
      const assetReg = asset.registration ? ServiceExtractor.normalizeRegistration(asset.registration) : null;
      if (normDocReg && assetReg && normDocReg === assetReg) {
        score += 80;
        matchedFields.push('registration');
      }

      // 2. Check VIN / Chassis match
      if (docVin && asset.vinNumber && docVin.toUpperCase() === asset.vinNumber.toUpperCase()) {
        score += 80;
        matchedFields.push('vinOrChassis');
      }

      // 3. Check Serial Number match (Appliances)
      if (docSerial && asset.serialNumber && docSerial.toUpperCase() === asset.serialNumber.toUpperCase()) {
        score += 80;
        matchedFields.push('serialNumber');
      }

      // 4. Check Engine Number match
      if (docEngine && asset.engineNumber && docEngine.toUpperCase() === asset.engineNumber.toUpperCase()) {
        score += 40;
        matchedFields.push('engineNumber');
      }

      // 5. Check Brand / Name fuzzy similarity
      if (docBrand && asset.brand && asset.brand.toLowerCase().includes(docBrand.toLowerCase())) {
        score += 15;
        matchedFields.push('brand');
      }

      if (score > 0) {
        candidates.push({
          assetId: asset.id,
          assetName: asset.name,
          matchScore: score,
          matchedFields,
          isExactMatch: score >= 80,
          status: score >= 80 ? 'EXACT_MATCH' : 'POSSIBLE_MATCH'
        });
      }
    }

    // Sort by highest match score
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    if (candidates.length > 0) {
      const top = candidates[0];
      if (top.isExactMatch) {
        let matchType: EntityLinkResult['matchType'] = 'EXACT_REGISTRATION';
        if (top.matchedFields.includes('registration')) matchType = 'EXACT_REGISTRATION';
        else if (top.matchedFields.includes('vinOrChassis')) matchType = 'EXACT_VIN';
        else if (top.matchedFields.includes('serialNumber')) matchType = 'EXACT_SERIAL';

        return {
          matchedAssetId: top.assetId,
          confidence: 0.98,
          matchType,
          isAutoLinked: true,
          notes: `Exact entity match on ${top.matchedFields.join(', ')} -> Linked to asset "${top.assetName}" (${top.assetId})`,
          candidates
        };
      } else {
        return {
          matchedAssetId: top.assetId,
          confidence: 0.65,
          matchType: 'FUZZY_NAME',
          isAutoLinked: false,
          notes: 'Possible asset match — review required before linking',
          candidates
        };
      }
    }

    return {
      matchedAssetId: null,
      confidence: 0,
      matchType: 'NO_MATCH',
      isAutoLinked: false,
      notes: 'No matching asset found. New asset creation suggested.',
      candidates: []
    };
  }
}
