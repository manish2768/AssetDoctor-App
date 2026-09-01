/**
 * Universal Document Classifier — classify BEFORE any field extraction.
 * Tax Invoice / Retail Invoice alone is NOT a service bill.
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
  {
    type: 'PUC_CERTIFICATE',
    subtype: 'Pollution Under Control Certificate',
    strongKeywords: [
      /pollution\s*under\s*control/i,
      /p\.?u\.?c\.?\s*(?:certificate|no|number|code)?/i,
      /\bpuc\b/i,
      /emission\s*test(?:\s*certificate)?/i,
      /pollution\s*control/i,
      /form\s*59/i,
    ],
    contextKeywords: [
      /carbon\s*monoxide/i,
      /hydro\s*carbon/i,
      /smoke\s*density/i,
      /valid\s*till|valid\s*up\s*to/i,
      /puc\s*code/i,
      /testing\s*centre|center/i,
    ],
    weight: 1.6,
  },
  {
    type: 'RC_CERTIFICATE',
    subtype: 'Vehicle Registration Certificate',
    strongKeywords: [
      /certificate\s*of\s*registration/i,
      /form\s*23/i,
      /form\s*24/i,
      /motor\s*vehicle\s*department/i,
      /transport\s*department/i,
      /vahan\s*citizen\s*services/i,
    ],
    contextKeywords: [
      /maker\s*class|maker'?s\s*name/i,
      /seating\s*cap|unladen\s*wt/i,
      /cubic\s*cap|wheel\s*base/i,
      /registering\s*authority/i,
      /son\s*of|daughter\s*of/i,
      /registration\s*(?:no|number)|chassis\s*(?:no|number)|engine\s*(?:no|number)|owner\s*name/i,
    ],
    negativeKeywords: [/premium\s*summary/i, /labour/i, /imei/i, /\bpuc\b/i, /pollution/i, /emission/i],
    weight: 1.4,
  },
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
      /acko\s*general/i,
    ],
    contextKeywords: [
      /insured\s*declared\s*value|\bidv\b/i,
      /own\s*damage\s*premium/i,
      /third\s*party\s*liability/i,
      /no\s*claim\s*bonus|\bncb\b/i,
      /policy\s*number|policy\s*no/i,
      /period\s*of\s*insurance/i,
    ],
    negativeKeywords: [/imei/i, /smartphone/i],
    weight: 1.3,
  },
  {
    type: 'INSURANCE_RENEWAL',
    subtype: 'Motor Insurance Policy Renewal',
    strongKeywords: [
      /renewal\s*policy\s*schedule/i,
      /policy\s*renewal\s*notice/i,
      /endorsement\s*schedule/i,
      /previous\s*policy\s*no/i,
    ],
    contextKeywords: [/renewed\s*from/i, /renewal\s*discount/i, /ncb\s*retained/i],
    weight: 1.2,
  },
  {
    type: 'INSURANCE_RECEIPT',
    subtype: 'Insurance Premium Receipt',
    strongKeywords: [
      /insurance\s+premium\s+receipt/i,
      /premium\s+receipt/i,
      /receipt\s+of\s+premium/i,
    ],
    contextKeywords: [/policy\s*(?:number|no)/i, /premium\s*(?:paid|amount)/i, /insurer/i],
    negativeKeywords: [/job\s*card/i, /odometer/i, /imei/i],
    weight: 1.3,
  },
  {
    type: 'SERVICE_INVOICE',
    subtype: 'Periodic Service & Maintenance Invoice',
    strongKeywords: [
      /service\s*invoice/i,
      /job\s*card/i,
      /service\s*bill/i,
      /workshop\s*invoice/i,
      /service\s*estimate/i,
      /service\s*master/i,
      /service\s*care/i,
      /authorised\s*workshop|authorized\s*workshop/i,
      /periodic\s*maintenance|periodic\s*service/i,
      /cash\s*memo.*service/i,
    ],
    contextKeywords: [
      /odometer|odo\s*reading|current\s*km|running\s*km|km\s*reading|vehicle\s*km|opening\s*km/i,
      /labour\s*charges|labor\s*charges/i,
      /engine\s*oil|oil\s*filter|spark\s*plug|brake\s*pad|brake\s*shoes/i,
      /periodic\s*maintenance|general\s*service/i,
      /advisor|technician|ro\s*number|sa\s*name/i,
      /workshop|service\s*center|authorised\s*service|authorized\s*service/i,
      /vehicle\s*(?:no|reg|registration)|regno\.?/i,
      /parts\s*total|labou?r\s*total/i,
    ],
    negativeKeywords: [
      /insured\s*declared\s*value/i,
      /certificate\s*of\s*registration/i,
      /\bimei\b/i,
      /smartphone|nothing\s*phone|iphone|oneplus/i,
    ],
    weight: 1.35,
  },
  {
    type: 'REPAIR_BILL',
    subtype: 'Accident & Bodyshop Repair Bill',
    strongKeywords: [
      /bodyshop\s*invoice/i,
      /accident\s*repair\s*estimate/i,
      /repair\s*order/i,
      /denting.*painting/i,
    ],
    contextKeywords: [
      /panel\s*replacement/i,
      /bumper\s*repair/i,
      /insurance\s*claim\s*deductible/i,
      /surveyor\s*name/i,
    ],
    weight: 1.2,
  },
  {
    type: 'SERVICE_BOOK',
    subtype: 'Vehicle Service Book',
    strongKeywords: [/service\s*book/i, /maintenance\s*booklet/i, /service\s*record\s*book/i],
    contextKeywords: [/service\s*history/i, /odometer|current\s*km/i, /dealer\s*stamp/i],
    negativeKeywords: [/premium\s*receipt/i, /imei/i],
    weight: 1.25,
  },
  {
    type: 'ELECTRONICS_PURCHASE_INVOICE',
    subtype: 'Electronics / Mobile Purchase Invoice',
    strongKeywords: [
      /\bimei\b/i,
      /nothing\s*phone/i,
      /\biphone\b/i,
      /smartphone|smart\s*phone/i,
      /mobile\s*phone/i,
      /\bphone\b/i,
      /\boneplus\b/i,
      /google\s*pixel/i,
      /samsung\s*galaxy/i,
    ],
    contextKeywords: [
      /serial\s*number|s\/n/i,
      /hsn\s*code/i,
      /tax\s*invoice/i,
      /retail\s*invoice/i,
      /charger|earphone|usb.?\s*c/i,
    ],
    negativeKeywords: [/job\s*card/i, /odometer/i, /labour\s*charges/i, /chassis\s*no/i],
    weight: 1.4,
  },
  {
    type: 'APPLIANCE_PURCHASE_INVOICE',
    subtype: 'Home Appliance Invoice',
    strongKeywords: [
      /refrigerator|fridge/i,
      /air\s*conditioner|split\s*ac|inverter\s*ac/i,
      /smart\s*tv|oled\s*tv|qled\s*tv|led\s*tv/i,
      /washing\s*machine|front\s*load|top\s*load/i,
      /microwave\s*oven/i,
      /croma|reliance\s*digital|vijay\s*sales/i,
    ],
    contextKeywords: [/serial\s*(?:no|number)|sn:|s\/n/i, /hsn\s*code/i, /brand\s*warranty/i],
    negativeKeywords: [/chassis\s*no/i, /odometer/i, /\bimei\b/i, /vehicle\s*registration/i],
    weight: 1.25,
  },
  {
    type: 'VEHICLE_PURCHASE_INVOICE',
    subtype: 'Vehicle Sale & Purchase Invoice',
    strongKeywords: [
      /vehicle\s*sale\s*invoice/i,
      /ex-showroom\s*price/i,
      /booking\s*receipt.*vehicle/i,
      /delivery\s*challan/i,
    ],
    contextKeywords: [
      /road\s*tax|rto\s*charges/i,
      /hypothecation\s*charges/i,
      /fastag\s*charges/i,
      /chassis\s*number/i,
    ],
    negativeKeywords: [/labour\s*charges/i, /job\s*card/i, /\bimei\b/i],
    weight: 1.2,
  },
  {
    type: 'EXTENDED_WARRANTY',
    subtype: 'Extended Warranty Certificate',
    strongKeywords: [
      /extended\s*warranty/i,
      /resq\s*care/i,
      /shield\s*of\s*trust/i,
      /ew\s*certificate/i,
      /care\s*protect/i,
    ],
    contextKeywords: [
      /warranty\s*period.*years/i,
      /valid\s*till|valid\s*upto/i,
      /covered\s*product/i,
      /certificate\s*no|warranty\s*no|serial\s*(?:no|number)|start\s*date|end\s*date/i,
    ],
    weight: 1.45,
  },
  {
    type: 'AMC_CONTRACT',
    subtype: 'Annual Maintenance Contract',
    strongKeywords: [/annual\s*maintenance\s*contract/i, /amc\s*agreement/i],
    contextKeywords: [/free\s*services\s*included/i, /contract\s*tenure/i],
    weight: 1.3,
  },
  {
    type: 'APPLIANCE_WARRANTY',
    subtype: 'Home Appliance Warranty Card',
    strongKeywords: [/compressor\s*warranty/i, /motor\s*warranty/i, /appliance\s*warranty\s*card/i],
    contextKeywords: [/10\s*years\s*warranty/i, /inverter\s*compressor/i],
    weight: 1.3,
  },
  {
    type: 'WARRANTY_DOCUMENT',
    subtype: 'Manufacturer Standard Warranty',
    strongKeywords: [/warranty\s*card/i, /warranty\s*certificate/i, /terms\s*of\s*warranty/i, /resq\s*care/i],
    contextKeywords: [
      /warranty\s*period/i,
      /defect\s*liability/i,
      /valid\s*till/i,
      /certificate\s*no|warranty\s*no|serial\s*(?:no|number)|start\s*date|end\s*date/i,
    ],
    weight: 1.4,
  },
  {
    type: 'OTHER_PURCHASE_DOCUMENT',
    subtype: 'Generic Tax / Retail Invoice',
    strongKeywords: [
      /tax\s*invoice/i,
      /retail\s*invoice/i,
      /retail\s*(?:bill|receipt)/i,
      /cash\s*(?:memo|receipt)/i,
      /purchase\s*receipt/i,
    ],
    contextKeywords: [/grand\s*total|total\s*amount/i, /gstin/i, /hsn/i, /receipt\s*(?:no|number)|\bitem\b|\bqty\b/i],
    negativeKeywords: [/job\s*card/i, /odometer/i, /policy\s*schedule/i],
    weight: 0.7,
  },
  {
    type: 'SALES_INVOICE',
    subtype: 'Sales Invoice',
    strongKeywords: [/sales\s*invoice/i, /retail\s*invoice/i],
    contextKeywords: [/grand\s*total|amount\s*payable|gstin|hsn/i, /seller|sold\s*by|buyer|bill\s*to/i],
    negativeKeywords: [/job\s*card|service\s*invoice|policy\s*schedule/i],
    weight: 0.9,
  },
];

function countHits(text: string, patterns: RegExp[]): { scoreBoost: number; matched: string[] } {
  const matched: string[] = [];
  for (const kw of patterns) {
    if (kw.test(text)) matched.push(kw.source);
  }
  return { scoreBoost: matched.length, matched };
}

// Bill / purchase-family document types share compatible extraction schemas
// (purchaseData / applianceData / electronicsData / warrantyData / generic).
// A thin score margin between two of these is harmless: whichever wins still
// yields the same purchase-style review fields (serial / imei / total amount).
const BILL_FAMILY_TYPES = new Set([
  'OTHER_PURCHASE_DOCUMENT',
  'SALES_INVOICE',
  'ELECTRONICS_PURCHASE_INVOICE',
  'APPLIANCE_PURCHASE_INVOICE',
  'VEHICLE_PURCHASE_INVOICE',
  'WARRANTY_DOCUMENT',
  'EXTENDED_WARRANTY',
  'APPLIANCE_WARRANTY',
  'AMC_CONTRACT',
]);

export class DocumentClassifier {
  public static classify(rawText: string): ClassificationResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        documentType: 'UNREADABLE_DOCUMENT',
        documentSubtype: 'Empty or Unreadable Document',
        confidence: 0,
        matchedKeywords: [],
        isLowConfidence: true,
        evidence: [],
      };
    }

    const text = rawText.replace(/\s+/g, ' ');
    let bestMatch: ClassificationResult = {
      documentType: 'UNKNOWN_DOCUMENT',
      documentSubtype: 'Unknown Document',
      confidence: 0,
      matchedKeywords: [],
      isLowConfidence: true,
      evidence: [],
    };
    let maxScore = 0;
    let secondScore = 0;
    let secondBestType = '';

    for (const rule of DOCUMENT_RULES) {
      let score = 0;
      const matched: string[] = [];

      if (rule.negativeKeywords) {
        const neg = countHits(text, rule.negativeKeywords);
        if (neg.scoreBoost > 0) score -= 40 * neg.scoreBoost;
      }

      for (const kw of rule.strongKeywords) {
        if (kw.test(text)) {
          score += 35 * rule.weight;
          matched.push(kw.source);
        }
      }
      for (const kw of rule.contextKeywords) {
        if (kw.test(text)) {
          score += 15 * rule.weight;
          matched.push(kw.source);
        }
      }

      // Composite: labour + vehicle identity is a service bill even if header is TAX INVOICE
      if (rule.type === 'SERVICE_INVOICE') {
        const labour = /labou?r/i.test(text);
        const km = /(?:odometer|current\s*km|km\s*reading|vehicle\s*km|opening\s*km|in\s*km)/i.test(text);
        const veh = /(?:vehicle\s*(?:no|reg)|regno\.?|registration\s*no)/i.test(text);
        const workshop = /(?:workshop|garage|auto\s*repairs|service\s*center|moto)/i.test(text);
        // A service bill MUST show a genuine maintenance signal (labour or odometer).
        // Vehicle registration + a bare "moto" string (e.g. a PUC naming "Motorcycle")
        // alone is NOT enough to outvote the document's true family.
        const signals = [labour, km, veh, workshop].filter(Boolean).length;
        if ((labour || km) && signals >= 2) {
          score += 55;
          matched.push('composite_service_signals');
        }
      }

      if (score > maxScore) {
        secondScore = maxScore;
        secondBestType = bestMatch.documentType;
        maxScore = score;
        let conf = 0.5 + Math.min(score / 120, 0.49);
        conf = Math.round(conf * 100) / 100;
        bestMatch = {
          documentType: rule.type,
          documentSubtype: rule.subtype,
          confidence: conf,
          matchedKeywords: matched,
          isLowConfidence: conf < 0.7,
          evidence: matched.slice(0, 8),
        };
      }
      else if (score > secondScore) {
        secondScore = score;
        secondBestType = rule.type;
      }
    }

    // A single OCR keyword is not enough to select an extraction schema.
    // Require multiple independent signals and a useful margin over the runner-up.
    const sufficientSignals = bestMatch.matchedKeywords.length >= 2;
    // Two competing schema FAMILIES (e.g. service vs insurance vs purchase) are
    // genuinely ambiguous and are rejected. But a thin margin between two
    // bill-family subtypes is harmless — both extract the same purchase fields,
    // so it must NOT force the document into UNKNOWN_DOCUMENT.
    const sameFamilyAmbiguity =
      secondScore > 0 &&
      maxScore - secondScore < 10 &&
      BILL_FAMILY_TYPES.has(bestMatch.documentType) &&
      BILL_FAMILY_TYPES.has(secondBestType);
    const ambiguous = secondScore > 0 && maxScore - secondScore < 10 && !sameFamilyAmbiguity;
    // A generic purchase/receipt document (OTHER_PURCHASE_DOCUMENT) whose strong
    // header keyword is a clear "tax invoice" / "retail invoice" / "cash memo"
    // / "purchase receipt" is a real purchase bill, even if it has few supporting
    // tokens. Other bill-family rules outrank it when they hit more specific
    // product keywords, so relaxing the noise floor for this header type is safe
    // and fixes an over-conservative UNKNOWN for slim-but-real purchase invoices.
    const strongBillHeader =
      bestMatch.documentType === 'OTHER_PURCHASE_DOCUMENT' &&
      /tax\s*invoice|retail\s*(?:invoice|bill|receipt)|cash\s*(?:memo|receipt)|purchase\s*receipt/i.test(text);
    const scoreFloor = strongBillHeader ? 24 : 30;
    const signalsOK = strongBillHeader ? bestMatch.matchedKeywords.length >= 1 : sufficientSignals;
    if (maxScore < scoreFloor || !signalsOK || bestMatch.confidence < 0.7 || ambiguous) {
      const isUnreadable = text.trim().length < 8;
      return {
        documentType: isUnreadable ? 'UNREADABLE_DOCUMENT' : 'UNKNOWN_DOCUMENT',
        documentSubtype: isUnreadable ? 'Unreadable Document' : 'Unknown Document',
        confidence: Math.min(0.49, bestMatch.confidence || 0),
        matchedKeywords: bestMatch.matchedKeywords.slice(0, 8),
        isLowConfidence: true,
        evidence: bestMatch.evidence || [],
      };
    }

    return bestMatch;
  }
}
