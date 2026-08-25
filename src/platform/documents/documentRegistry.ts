/**
 * Asset Doctor — Universal Document Type Registry
 * Decouples OCR classification and entity extraction from category-specific UI components.
 */

export interface DocumentTypeDefinition {
  typeCode: string;
  displayName: string;
  categoryAffiliation: string[]; // 'VEHICLE', 'ELECTRONICS', 'APPLIANCE', 'ALL'
  description: string;
  expectedFields: string[];
  sampleKeywords: string[];
}

export const DOCUMENT_TYPE_REGISTRY: Record<string, DocumentTypeDefinition> = {
  SERVICE_INVOICE: {
    typeCode: 'SERVICE_INVOICE',
    displayName: 'Automotive & Equipment Service Invoice',
    categoryAffiliation: ['VEHICLE', 'INDUSTRIAL'],
    description: 'Periodic maintenance, oil change, and labor bill from authorized dealership or garage.',
    expectedFields: ['odometerKm', 'serviceDate', 'workshopName', 'invoiceNumber', 'totalAmount', 'replacedParts'],
    sampleKeywords: ['service invoice', 'job card', 'oil filter', 'engine oil', 'periodic maintenance', 'labour charges', 'synthetic oil', 'odometer', 'service bill', 'workshop']
  },
  REPAIR_BILL: {
    typeCode: 'REPAIR_BILL',
    displayName: 'Repair & Part Replacement Bill',
    categoryAffiliation: ['ALL'],
    description: 'Corrective maintenance, screen replacement, compressor repair, or component fix.',
    expectedFields: ['repairDate', 'repairShop', 'invoiceNumber', 'totalAmount', 'partsReplaced'],
    sampleKeywords: ['repair bill', 'tax invoice', 'component replacement', 'labour', 'servicing']
  },
  INSURANCE_POLICY: {
    typeCode: 'INSURANCE_POLICY',
    displayName: 'Insurance Policy Certificate',
    categoryAffiliation: ['VEHICLE', 'BUSINESS', 'HOME'],
    description: 'Comprehensive, third-party, or commercial asset insurance policy schedule.',
    expectedFields: ['policyNumber', 'insurerName', 'policyStartDate', 'policyEndDate', 'premiumAmount', 'idvAmount'],
    sampleKeywords: ['insurance certificate', 'policy schedule', 'idv', 'premium', 'third party', 'comprehensive policy']
  },
  PUC_CERTIFICATE: {
    typeCode: 'PUC_CERTIFICATE',
    displayName: 'Pollution Under Control (PUC) Certificate',
    categoryAffiliation: ['VEHICLE'],
    description: 'Statutory vehicle emission test certificate issued by transport department.',
    expectedFields: ['pucNumber', 'testDate', 'expiryDate', 'vehicleRegistration', 'coValue', 'hcValue'],
    sampleKeywords: ['pollution under control', 'puc certificate', 'emission test', 'valid upto', 'carbon monoxide']
  },
  RC_REGISTRATION: {
    typeCode: 'RC_REGISTRATION',
    displayName: 'Vehicle Registration Certificate (RC)',
    categoryAffiliation: ['VEHICLE'],
    description: 'Official motor vehicle registration card/smart card issued by RTO.',
    expectedFields: ['registrationNumber', 'ownerName', 'chassisNumber', 'engineNumber', 'registrationDate', 'fuelType'],
    sampleKeywords: ['registration certificate', 'form 23', 'chassis no', 'engine no', 'rto', 'motor vehicles act']
  },
  PURCHASE_INVOICE: {
    typeCode: 'PURCHASE_INVOICE',
    displayName: 'Original Purchase / Tax Invoice',
    categoryAffiliation: ['ALL'],
    description: 'Retail invoice, GST tax bill, or e-commerce delivery invoice establishing ownership.',
    expectedFields: ['invoiceNumber', 'invoiceDate', 'sellerName', 'sellerGstin', 'buyerName', 'productName', 'finalAmount', 'serialNumber'],
    sampleKeywords: ['tax invoice', 'cash memo', 'retail invoice', 'gstin', 'billed to', 'hsn code', 'subtotal']
  },
  WARRANTY_DOC: {
    typeCode: 'WARRANTY_DOC',
    displayName: 'Manufacturer Warranty Card / Certificate',
    categoryAffiliation: ['ALL'],
    description: 'OEM warranty terms, standard limited warranty certificate, or guarantee card.',
    expectedFields: ['warrantyNumber', 'providerName', 'startDate', 'durationMonths', 'coveredComponents'],
    sampleKeywords: ['warranty card', 'limited warranty', 'guarantee', 'terms and conditions', 'serial number']
  },
  AMC_CONTRACT: {
    typeCode: 'AMC_CONTRACT',
    displayName: 'Annual Maintenance Contract (AMC)',
    categoryAffiliation: ['APPLIANCE', 'BUSINESS', 'INDUSTRIAL'],
    description: 'Comprehensive or non-comprehensive preventive maintenance agreement.',
    expectedFields: ['contractNumber', 'vendorName', 'startDate', 'endDate', 'annualFee', 'visitsPerYear'],
    sampleKeywords: ['annual maintenance contract', 'amc agreement', 'preventive maintenance visits', 'sla']
  }
};

export class DocumentRegistry {
  public static listDocumentTypes(): DocumentTypeDefinition[] {
    return Object.values(DOCUMENT_TYPE_REGISTRY);
  }

  public static getDefinition(typeCode: string): DocumentTypeDefinition | undefined {
    return DOCUMENT_TYPE_REGISTRY[typeCode];
  }

  public static classifyByText(text: string): { typeCode: string; confidence: number } {
    const norm = text.toLowerCase();
    let bestType = 'PURCHASE_INVOICE';
    let bestScore = 0;

    for (const def of Object.values(DOCUMENT_TYPE_REGISTRY)) {
      let score = 0;
      for (const kw of def.sampleKeywords) {
        if (norm.includes(kw)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestType = def.typeCode;
      }
    }

    const confidence = bestScore > 0 ? Math.min(0.98, 0.50 + bestScore * 0.15) : 0.40;
    return { typeCode: bestType, confidence };
  }
}
