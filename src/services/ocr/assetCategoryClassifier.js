/**
 * Semantic asset category for scanned purchase documents.
 * Categories: VEHICLE | GADGET | HOME_APPLIANCE | OTHER
 *
 * Separate from documentTypeClassifier (bill / insurance / PUC / RC).
 * IMEI strongly indicates mobile / electronic device — never Vehicle.
 */

export const ASSET_DOC_CATEGORY = Object.freeze({
  VEHICLE: 'VEHICLE',
  GADGET: 'GADGET',
  HOME_APPLIANCE: 'HOME_APPLIANCE',
  OTHER: 'OTHER',
});

const GADGET_RE =
  /\b(?:phone|mobile|handset|smartphone|tablet|ipad|laptop|notebook|macbook|imei|iphone|nothing\s*phone|galaxy|oneplus|realme|xiaomi|redmi|pixel|vivo|oppo|motorola|airpods|earbud|smartwatch|console|camera)\b/i;

const HOME_RE =
  /\b(?:\bac\b|air[\s\-]?conditioner|fridge|refrigerator|television|\btv\b|smart\s*tv|washing\s*machine|washer|microwave|oven|geyser|water\s*heater|dishwasher|cooler|chimney|induction)\b/i;

const VEHICLE_RE =
  /\b(?:bike|motorcycle|scooter|activa|chassis|frame\s*no|engine\s*no|\bvin\b|ex[\s\-]?showroom|hsrp|two[\s\-]?wheeler|four[\s\-]?wheeler|\bcar\b|suv|sedan|pulsar|ronin|splendor|apache|jupiter|ntorq|unicorn|shine|passion|avenger|\btvs\b(?!\s*electronics)|hero\s*moto|bajaj|yamaha|royal\s*enfield|ktm|ather|ola\s*s1|motor\s*vehicle|vehicle\s*invoice|dealer\s*invoice|odometer|odo\s*reading|regn\.?\s*no|reg\.?\s*no|regno|service\s*invoice|job\s*card|\bkms?\b)\b/i;

/**
 * @param {string} blob
 * @param {object} [hints]
 */
export function classifyAssetDocumentCategory(blob = '', hints = {}) {
  const imeiDigits = String(hints.imei || '').replace(/\D/g, '');
  const hasImei = imeiDigits.length >= 14 && imeiDigits.length <= 17;
  const itemText = (hints.items || [])
    .map((i) => `${i?.name || ''} ${i?.productName || ''} ${i?.imei || ''}`)
    .join(' ');
  const hay = [
    blob,
    hints.productName || '',
    itemText,
    hints.geminiCategory || '',
    hasImei ? 'IMEI mobile phone' : '',
  ]
    .join(' ')
    .toLowerCase();

  const reasons = [];
  let gadgetScore = 0;
  let vehicleScore = 0;
  let homeScore = 0;

  if (hasImei) {
    gadgetScore += 8;
    reasons.push('imei_present');
  }
  if (GADGET_RE.test(hay)) {
    gadgetScore += 4;
    reasons.push('gadget_keyword');
  }
  if (/\b\d{2,4}\s*gb\b/i.test(hay) && /phone|mobile|nothing|samsung|apple|oneplus/i.test(hay)) {
    gadgetScore += 3;
    reasons.push('storage_variant');
  }
  if (HOME_RE.test(hay)) {
    homeScore += 4;
    reasons.push('home_appliance_keyword');
  }
  if (VEHICLE_RE.test(hay)) {
    vehicleScore += 3;
    reasons.push('vehicle_keyword');
  }
  if (hints.chassisNumber && String(hints.chassisNumber).replace(/\s/g, '').length >= 8) {
    vehicleScore += 4;
    reasons.push('chassis');
  }
  if (hints.engineNumber && String(hints.engineNumber).replace(/\s/g, '').length >= 8) {
    vehicleScore += 3;
    reasons.push('engine');
  }
  if (
    hints.registration &&
    /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/i.test(
      String(hints.registration).replace(/[\s-]/g, ''),
    )
  ) {
    vehicleScore += 4;
    reasons.push('registration');
  }

  if (hasImei || gadgetScore >= 4) {
    vehicleScore = Math.min(vehicleScore, 1);
    if (hasImei) reasons.push('imei_vetoes_vehicle');
  }

  const gem = String(hints.geminiCategory || '').toLowerCase();
  if (/gadget|electronics|mobile|phone|laptop/.test(gem)) {
    gadgetScore += 2;
    reasons.push('gemini_gadget');
  } else if (/vehicle|bike|car/.test(gem) && !hasImei && gadgetScore < 4) {
    vehicleScore += 2;
    reasons.push('gemini_vehicle');
  } else if (/home|appliance|fridge|tv|ac/.test(gem)) {
    homeScore += 2;
    reasons.push('gemini_home');
  }

  let category = ASSET_DOC_CATEGORY.OTHER;
  let score = 0;
  if (gadgetScore >= homeScore && gadgetScore >= vehicleScore && gadgetScore >= 2) {
    category = ASSET_DOC_CATEGORY.GADGET;
    score = gadgetScore;
  } else if (homeScore >= vehicleScore && homeScore >= 2) {
    category = ASSET_DOC_CATEGORY.HOME_APPLIANCE;
    score = homeScore;
  } else if (vehicleScore >= 2) {
    category = ASSET_DOC_CATEGORY.VEHICLE;
    score = vehicleScore;
  }

  const confidence = Math.min(0.98, 0.4 + score * 0.08);

  return {
    category,
    confidence: Math.round(confidence * 100) / 100,
    reasons,
    isGadget: category === ASSET_DOC_CATEGORY.GADGET,
    isVehicle: category === ASSET_DOC_CATEGORY.VEHICLE,
    isHomeAppliance: category === ASSET_DOC_CATEGORY.HOME_APPLIANCE,
  };
}

export default classifyAssetDocumentCategory;
