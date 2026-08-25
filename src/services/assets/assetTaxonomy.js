/**
 * Universal Asset Doctor taxonomy — extends flat categoryId without breaking it.
 * EV is powertrain, not a vehicle type.
 */

export const ASSET_CATEGORY = Object.freeze({
  VEHICLE: 'VEHICLE',
  HOME_APPLIANCE: 'HOME_APPLIANCE',
  GADGET: 'GADGET',
  OTHER: 'OTHER',
});

export const VEHICLE_TYPE = Object.freeze({
  CAR: 'CAR',
  BIKE: 'BIKE',
  SCOOTER: 'SCOOTER',
  COMMERCIAL: 'COMMERCIAL',
  OTHER: 'OTHER',
});

export const POWERTRAIN = Object.freeze({
  PETROL: 'PETROL',
  DIESEL: 'DIESEL',
  CNG: 'CNG',
  HYBRID: 'HYBRID',
  ELECTRIC: 'ELECTRIC',
  OTHER: 'OTHER',
});

export const APPLIANCE_TYPE = Object.freeze({
  AC: 'AC',
  REFRIGERATOR: 'REFRIGERATOR',
  WASHING_MACHINE: 'WASHING_MACHINE',
  TV: 'TV',
  MICROWAVE: 'MICROWAVE',
  DISHWASHER: 'DISHWASHER',
  GEYSER: 'GEYSER',
  WATER_PURIFIER: 'WATER_PURIFIER',
  AIR_PURIFIER: 'AIR_PURIFIER',
  AIR_COOLER: 'AIR_COOLER',
  INVERTER: 'INVERTER',
  VACUUM_CLEANER: 'VACUUM_CLEANER',
  FAN: 'FAN',
  KITCHEN_APPLIANCE: 'KITCHEN_APPLIANCE',
  OTHER: 'OTHER',
});

export const GADGET_TYPE = Object.freeze({
  SMARTPHONE: 'SMARTPHONE',
  LAPTOP: 'LAPTOP',
  TABLET: 'TABLET',
  SMARTWATCH: 'SMARTWATCH',
  EARBUDS: 'EARBUDS',
  HEADPHONES: 'HEADPHONES',
  CAMERA: 'CAMERA',
  GAMING_DEVICE: 'GAMING_DEVICE',
  SPEAKER: 'SPEAKER',
  OTHER: 'OTHER',
});

/** Map legacy categoryId → universal classification */
export function classifyFromCategoryId(categoryId = '', assetName = '') {
  const id = String(categoryId || '').toLowerCase();
  const text = `${id} ${assetName}`.toLowerCase();

  if (['car', 'bike', 'scooter', 'ev', 'commercial', 'vehicle', 'motorcycle', 'vehicle_parts'].includes(id)) {
    let vehicleType = VEHICLE_TYPE.OTHER;
    if (id === 'car' || /\bcar\b|suv|sedan|nexon/.test(text)) vehicleType = VEHICLE_TYPE.CAR;
    else if (id === 'bike' || /bike|motorcycle|pulsar|ronin/.test(text)) vehicleType = VEHICLE_TYPE.BIKE;
    else if (id === 'scooter' || /scooter|activa|ola\s*s1/.test(text)) vehicleType = VEHICLE_TYPE.SCOOTER;
    else if (id === 'commercial' || /truck|tempo|commercial/.test(text)) vehicleType = VEHICLE_TYPE.COMMERCIAL;

    let powertrain = POWERTRAIN.OTHER;
    if (id === 'ev' || /\bev\b|electric|battery\s*pack/.test(text)) powertrain = POWERTRAIN.ELECTRIC;
    else if (/ola\s*s|ather|tvs\s*iqube|simple\s*one|ultraviolette/.test(text)) powertrain = POWERTRAIN.ELECTRIC;
    else if (/diesel/.test(text)) powertrain = POWERTRAIN.DIESEL;
    else if (/\bcng\b/.test(text)) powertrain = POWERTRAIN.CNG;
    else if (/hybrid/.test(text)) powertrain = POWERTRAIN.HYBRID;
    else if (/petrol|gasoline/.test(text)) powertrain = POWERTRAIN.PETROL;
    else if (vehicleType !== VEHICLE_TYPE.OTHER) powertrain = POWERTRAIN.PETROL;

    // EV categoryId alone → CAR if name has car cues else OTHER/SCOOTER
    if (id === 'ev' && vehicleType === VEHICLE_TYPE.OTHER) {
      if (/scooter|ola|ather|activa\s*e/.test(text)) vehicleType = VEHICLE_TYPE.SCOOTER;
      else vehicleType = VEHICLE_TYPE.CAR;
    }

    return {
      assetCategory: ASSET_CATEGORY.VEHICLE,
      vehicleType,
      powertrain,
      subcategory: vehicleType,
      assetCodePrefix: vehicleType === VEHICLE_TYPE.BIKE ? 'BK' : vehicleType === VEHICLE_TYPE.SCOOTER ? 'SC' : vehicleType === VEHICLE_TYPE.COMMERCIAL ? 'CV' : 'CR',
    };
  }

  const applianceMap = {
    ac: APPLIANCE_TYPE.AC,
    fridge: APPLIANCE_TYPE.REFRIGERATOR,
    washing_machine: APPLIANCE_TYPE.WASHING_MACHINE,
    washer: APPLIANCE_TYPE.WASHING_MACHINE,
    tv: APPLIANCE_TYPE.TV,
    microwave: APPLIANCE_TYPE.MICROWAVE,
    geyser: APPLIANCE_TYPE.GEYSER,
    dishwasher: APPLIANCE_TYPE.DISHWASHER,
    fan: APPLIANCE_TYPE.FAN,
    cooler: APPLIANCE_TYPE.AIR_COOLER,
    air_cooler: APPLIANCE_TYPE.AIR_COOLER,
    air_purifier: APPLIANCE_TYPE.AIR_PURIFIER,
    water_purifier: APPLIANCE_TYPE.WATER_PURIFIER,
    purifier: APPLIANCE_TYPE.WATER_PURIFIER,
    inverter: APPLIANCE_TYPE.INVERTER,
    appliance: APPLIANCE_TYPE.OTHER,
  };
  // Prefer categoryId / appliance keywords BEFORE gadget name heuristics (avoids "phone" substring leaks)
  if (
    applianceMap[id] ||
    /air[\s\-]?cond|\bac\b|fridge|refrigerator|washer|washing\s*machine|geyser|microwave|\btv\b|dishwasher|water\s*purifier|air\s*purifier|\bfan\b|cooler|inverter/.test(
      text,
    )
  ) {
    let subtype = applianceMap[id] || APPLIANCE_TYPE.OTHER;
    if (/\bac\b|air[\s\-]?cond/.test(text)) subtype = APPLIANCE_TYPE.AC;
    if (/fridge|refrigerator/.test(text)) subtype = APPLIANCE_TYPE.REFRIGERATOR;
    if (/washer|washing\s*machine/.test(text)) subtype = APPLIANCE_TYPE.WASHING_MACHINE;
    if (/geyser|water\s*heater/.test(text)) subtype = APPLIANCE_TYPE.GEYSER;
    if (/dishwasher/.test(text)) subtype = APPLIANCE_TYPE.DISHWASHER;
    if (/microwave/.test(text)) subtype = APPLIANCE_TYPE.MICROWAVE;
    if (/\btv\b|television/.test(text)) subtype = APPLIANCE_TYPE.TV;
    if (/air\s*purifier/.test(text)) subtype = APPLIANCE_TYPE.AIR_PURIFIER;
    if (/water\s*purifier|ro\b|aquaguard/.test(text)) subtype = APPLIANCE_TYPE.WATER_PURIFIER;
    if (/\bfan\b/.test(text)) subtype = APPLIANCE_TYPE.FAN;
    if (/cooler/.test(text)) subtype = APPLIANCE_TYPE.AIR_COOLER;
    if (/inverter/.test(text)) subtype = APPLIANCE_TYPE.INVERTER;
    return {
      assetCategory: ASSET_CATEGORY.HOME_APPLIANCE,
      vehicleType: null,
      powertrain: null,
      subcategory: subtype,
      applianceType: subtype,
      assetCodePrefix: subtype === APPLIANCE_TYPE.AC ? 'AC' : 'AP',
    };
  }

  const gadgetMap = {
    mobile: GADGET_TYPE.SMARTPHONE,
    phone: GADGET_TYPE.SMARTPHONE,
    laptop: GADGET_TYPE.LAPTOP,
    tablet: GADGET_TYPE.TABLET,
    smartwatch: GADGET_TYPE.SMARTWATCH,
    earbuds: GADGET_TYPE.EARBUDS,
    accessory: GADGET_TYPE.OTHER,
  };
  if (gadgetMap[id] || /iphone|smartphone|laptop|macbook|tablet|earbuds|airpods|smart\s*watch/.test(text) || (/\bphone\b/.test(text) && !/headset|earphone/.test(text))) {
    let subtype = gadgetMap[id] || GADGET_TYPE.OTHER;
    if (/phone|iphone|smartphone|mobile/.test(text)) subtype = GADGET_TYPE.SMARTPHONE;
    if (/laptop|macbook|notebook/.test(text)) subtype = GADGET_TYPE.LAPTOP;
    if (/tablet|ipad/.test(text)) subtype = GADGET_TYPE.TABLET;
    if (/earbud|airpod/.test(text)) subtype = GADGET_TYPE.EARBUDS;
    if (/headphone|earphone/.test(text)) subtype = GADGET_TYPE.HEADPHONES;
    if (/watch/.test(text)) subtype = GADGET_TYPE.SMARTWATCH;
    return {
      assetCategory: ASSET_CATEGORY.GADGET,
      vehicleType: null,
      powertrain: null,
      subcategory: subtype,
      gadgetType: subtype,
      assetCodePrefix: subtype === GADGET_TYPE.SMARTPHONE ? 'PH' : subtype === GADGET_TYPE.LAPTOP ? 'LP' : 'GD',
    };
  }

  return {
    assetCategory: ASSET_CATEGORY.OTHER,
    vehicleType: null,
    powertrain: null,
    subcategory: 'OTHER',
    assetCodePrefix: 'AS',
  };
}

export default {
  ASSET_CATEGORY,
  VEHICLE_TYPE,
  POWERTRAIN,
  APPLIANCE_TYPE,
  GADGET_TYPE,
  classifyFromCategoryId,
};
