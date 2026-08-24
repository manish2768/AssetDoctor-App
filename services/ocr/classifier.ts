/**
 * Universal Document Classifier
 * Pre-classifies Indian Automotive & Appliance Documents with confidence scoring.
 */

import type { UniversalDocumentType, ClassificationResult } from './types.ts';

interface DocumentPatternRule {
  type: UniversalDocumentType;
  subtype: string;
  strongKeywords: RegExp[];
  contextKeywords: RegExp[];
  negativeKeywords?: RegExp[];
  weight: number;
}

const DOCUMENT_RULES: DocumentPatternRule[] = [
  // 1. PUC CERTIFICATE
  {
    type: 'PUC_CERTIFICATE',
    subtype: 'Pollution Under Control Certificate',
    strongKeywords: [
      /pollution\s*under\s*control/i,
      /p\.?u\.?c\.?\s*certificate/i,
      /emission\s*test\s*certificate/i,
      /form\s*59/i
    ],
    contextKeywords: [
      /carbon\s*monoxide/i,
      /hydro\s*carbon/i,
      /smoke\s*density/i,
      /valid\s*till|valid\s*up\s*to/i,
      /puc\s*code/i,
      /testing\s*centre|center/i
    ],
    weight: 1.5
  },

  // 2. RC / REGISTRATION CERTIFICATE
  {
    type: 'RC_CERTIFICATE',
    subtype: 'Vehicle Registration Certificate',
    strongKeywords: [
      /certificate\s*of\s*registration/i,
      /form\s*23/i,
      /form\s*24/i,
      /motor\s*vehicle\s*department/i,
      /transport\s*department/i,
      /vahan\s*citizen\s*services/i
    ],
    contextKeywords: [
      /chassis\s*no|chassis\s*number/i,
      /engine\s*no|engine\s*number/i,
      /maker\s*class|maker'?s\s*name/i,
      /seating\s*cap|unladen\s*wt/i,
      /cubic\s*cap|wheel\s*base/i,
      /registering\s*authority/i,
      /owner\s*name|son\s*of|daughter\s*of/i
    ],
    negativeKeywords: [
      /premium\s*summary/i,
      /odometer\s*reading.*labour/i
    ],
    weight: 1.4
  },

  // 3. INSURANCE POLICY & RENEWAL
  {
    type: 'INSURANCE_POLICY',
    subtype: 'Motor Insurance Policy Schedule',
    strongKeywords: [
      /certificate\s*of\s*insurance/i,
      /policy\s*schedule/i,
      /motor\s*package\s*policy/i,
      /commercial\s*vehicle\s*package/i,
      /private\s*car\s*package/i,
      /two\s*wheeler\s*package/i,
      /icici\s*lombard/i,
      /bajaj\s*allianz/i,
      /hdfc\s*ergo/i,
      /tata\s*aig/i,
      /new\s*india\s*assurance/i,
      /united\s*india\s*insurance/i,
      /digit\s*insurance/i,
      /acko\s*general/i
    ],
    contextKeywords: [
      /insured\s*declared\s*value|idv/i,
      /own\s*damage\s*premium/i,
      /third\s*party\s*liability/i,
      /no\s*claim\s*bonus|ncb/i,
      /policy\s*number|policy\s*no/i,
      /period\s*of\s*insurance/i,
      /geographical\s*area/i
    ],
    weight: 1.3
  },
  {
    type: 'INSURANCE_RENEWAL',
    subtype: 'Motor Insurance Policy Renewal',
    strongKeywords: [
      /renewal\s*policy\s*schedule/i,
      /policy\s*renewal\s*notice/i,
      /endorsement\s*schedule/i,
      /previous\s*policy\s*no/i
    ],
    contextKeywords: [
      /renewed\s*from/i,
      /renewal\s*discount/i,
      /ncb\s*retained/i
    ],
    weight: 1.2
  },

  // 4. SERVICE INVOICE & REPAIR BILL
  {
    type: 'SERVICE_INVOICE',
    subtype: 'Periodic Service & Maintenance Invoice',
    strongKeywords: [
      /tax\s*invoice/i,
      /retail\s*invoice/i,
      /service\s*invoice/i,
      /cash\s*memo.*service/i,
      /job\s*card/i,
      /service\s*bill/i,
      /workshop\s*invoice/i
    ],
    contextKeywords: [
      /odometer|odo\s*reading|kms|current\s*km|running\s*km/i,
      /labour\s*charges|labor\s*charges/i,
      /engine\s*oil|oil\s*filter|spark\s*plug|brake\s*pad/i,
      /periodic\s*maintenance|general\s*service/i,
      /advisor|technician|ro\s*number|sa\s*name/i,
      /workshop|service\s*center|motors/i
    ],
    negativeKeywords: [
      /insured\s*declared\s*value/i,
      /certificate\s*of\s*registration/i
    ],
    weight: 1.3
  },
  {
    type: 'REPAIR_BILL',
    subtype: 'Accident & Bodyshop Repair Bill',
    strongKeywords: [
      /bodyshop\s*invoice/i,
      /accident\s*repair\s*estimate/i,
      /repair\s*order/i,
      /denting.*painting/i
    ],
    contextKeywords: [
      /panel\s*replacement/i,
      /bumper\s*repair/i,
      /insurance\s*claim\s*deductible/i,
      /surveyor\s*name/i
    ],
    weight: 1.2
  },

  // 5. EXTENDED WARRANTY & AMC
  {
    type: 'EXTENDED_WARRANTY',
    subtype: 'Extended Warranty Certificate',
    strongKeywords: [
      /extended\s*warranty/i,
      /shield\s*of\s*trust/i,
      /ew\s*certificate/i,
      /additional\s*warranty\s*coverage/i
    ],
    contextKeywords: [
      /warranty\s*period.*years/i,
      /kms\s*coverage/i,
      /policy\s*coverage\s*terms/i
    ],
    weight: 1.2
  },
  {
    type: 'AMC_CONTRACT',
    subtype: 'Annual Maintenance Contract',
    strongKeywords: [
      /annual\s*maintenance\s*contract/i,
      /amc\s*agreement/i,
      /service\s*package\s*contract/i,
      /scheduled\s*maintenance\s*plan/i
    ],
    contextKeywords: [
      /free\s*services\s*included/i,
      /oil\s*change\s*vouchers/i,
      /contract\s*tenure/i
    ],
    weight: 1.2
  },

  // 6. APPLIANCE INVOICE & APPLIANCE WARRANTY
  {
    type: 'APPLIANCE_INVOICE',
    subtype: 'Electronics & Home Appliance Invoice',
    strongKeywords: [
      /refrigerator|fridge/i,
      /air\s*conditioner|split\s*ac|inverter\s*ac/i,
      /smart\s*tv|oled\s*tv|qled\s*tv|led\s*tv/i,
      /washing\s*machine|front\s*load|top\s*load/i,
      /microwave\s*oven/i,
      /laptop|macbook|notebook/i,
      /croma|reliance\s*digital|vijay\s*sales/i,
      /flipkart\s*india|amazon\s*seller/i
    ],
    contextKeywords: [
      /serial\s*number|sn:|s\/n/i,
      /hsn\s*code/i,
      /brand\s*warranty/i,
      /delivery\s*address/i
    ],
    negativeKeywords: [
      /chassis\s*no/i,
      /odometer/i,
      /vehicle\s*registration/i
    ],
    weight: 1.2
  },
  {
    type: 'APPLIANCE_WARRANTY',
    subtype: 'Home Appliance Warranty Card',
    strongKeywords: [
      /compressor\s*warranty/i,
      /motor\s*warranty/i,
      /panel\s*warranty/i,
      /appliance\s*warranty\s*card/i
    ],
    contextKeywords: [
      /10\s*years\s*warranty/i,
      /inverter\s*compressor/i,
      /customer\s*care\s*toll\s*free/i
    ],
    weight: 1.1
  },

  // 7. VEHICLE PURCHASE INVOICE
  {
    type: 'PURCHASE_INVOICE',
    subtype: 'Vehicle Sale & Purchase Invoice',
    strongKeywords: [
      /vehicle\s*sale\s*invoice/i,
      /ex-showroom\s*price/i,
      /booking\s*receipt.*vehicle/i,
      /delivery\s*challan/i
    ],
    contextKeywords: [
      /road\s*tax|rto\s*charges/i,
      /hypothecation\s*charges/i,
      /fastag\s*charges/i,
      /chassis\s*number/i
    ],
    weight: 1.1
  },

  // 8. WARRANTY DOCUMENT (General)
  {
    type: 'WARRANTY_DOCUMENT',
    subtype: 'Manufacturer Standard Warranty',
    strongKeywords: [
      /warranty\s*card/i,
      /warranty\s*certificate/i,
      /terms\s*of\s*warranty/i,
      /standard\s*warranty\s*handbook/i
    ],
    contextKeywords: [
      /warranty\s*period/i,
      /defect\s*liability/i,
      /authorized\s*service\s*centre/i
    ],
    weight: 1.0
  }
];

export class DocumentClassifier {
  /**
   * Classifies raw OCR text into one of the 13 universal document categories.
   */
  public static classify(rawText: string): ClassificationResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        documentType: 'UNKNOWN',
        documentSubtype: 'Empty or Unreadable Document',
        confidence: 0,
        matchedKeywords: [],
        isLowConfidence: true
      };
    }

    const text = rawText.replace(/\s+/g, ' ');
    let bestMatch: ClassificationResult = {
      documentType: 'GENERIC_DOCUMENT',
      documentSubtype: 'Generic Document or Unclassified Receipt',
      confidence: 0.5,
      matchedKeywords: [],
      isLowConfidence: true
    };
    let maxScore = 0;

    for (const rule of DOCUMENT_RULES) {
      let score = 0;
      const matched: string[] = [];

      // Check negative keywords
      if (rule.negativeKeywords) {
        const hasNegative = rule.negativeKeywords.some(nk => nk.test(text));
        if (hasNegative) {
          score -= 30;
        }
      }

      // Strong keywords (heavy weight)
      for (const kw of rule.strongKeywords) {
        if (kw.test(text)) {
          score += 35 * rule.weight;
          matched.push(kw.source);
        }
      }

      // Context keywords
      for (const kw of rule.contextKeywords) {
        if (kw.test(text)) {
          score += 15 * rule.weight;
          matched.push(kw.source);
        }
      }

      if (score > maxScore) {
        maxScore = score;
        // Normalize score to confidence between 0.50 and 0.99
        let conf = 0.5 + Math.min(score / 120, 0.49);
        conf = Math.round(conf * 100) / 100;

        bestMatch = {
          documentType: rule.type,
          documentSubtype: rule.subtype,
          confidence: conf,
          matchedKeywords: matched,
          isLowConfidence: conf < 0.70
        };
      }
    }

    // High confidence threshold check
    if (maxScore < 30) {
      return {
        documentType: 'GENERIC_DOCUMENT',
        documentSubtype: 'Unrecognized Document Structure',
        confidence: 0.45,
        matchedKeywords: [],
        isLowConfidence: true
      };
    }

    return bestMatch;
  }
}
