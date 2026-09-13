/**
 * Asset Doctor — Canonical Vehicle Presentation Resolver
 *
 * Single authoritative source of truth for vehicle visual identity:
 * - Vehicle display name
 * - Formatted registration number
 * - Canonical vehicle type label
 * - Type-specific vector icon & emoji (Car -> car, Bike -> bike, Scooter -> scooter)
 * - Vehicle photo / image URI
 *
 * Strictly prevents hardcoding "bike" or picking icons based on route or screen names.
 */

import { resolveFuelVehicleType } from './fuelMilestone';

export interface VehiclePresentation {
  displayName: string;
  registration: string;
  vehicleType: string;
  vehicleTypeRaw: 'CAR' | 'BIKE' | 'SCOOTER' | 'COMMERCIAL' | 'OTHER';
  icon: 'car' | 'bike' | 'scooter' | 'commercial' | 'vehicle';
  emoji: string;
  photo: string | null;
}

export function getVehiclePresentation(asset: any): VehiclePresentation {
  if (!asset || typeof asset !== 'object') {
    return {
      displayName: 'Vehicle',
      registration: '',
      vehicleType: 'Vehicle',
      vehicleTypeRaw: 'OTHER',
      icon: 'car',
      emoji: '🚗',
      photo: null,
    };
  }

  const rawType = resolveFuelVehicleType(asset);

  const displayName =
    asset.assetName ||
    asset.model ||
    asset.name ||
    (rawType === 'BIKE' ? 'Motorcycle' : rawType === 'CAR' ? 'Car' : 'Vehicle');

  const reg = String(
    asset.registrationNumber ||
    asset.registration ||
    asset.plateNumber ||
    asset.serialNumber ||
    '',
  ).trim().toUpperCase();

  let vehicleType = 'Vehicle';
  let icon: 'car' | 'bike' | 'scooter' | 'commercial' | 'vehicle' = 'car';
  let emoji = '🚗';

  switch (rawType) {
    case 'CAR':
      vehicleType = 'Car';
      icon = 'car';
      emoji = '🚗';
      break;
    case 'BIKE':
      vehicleType = 'Motorcycle';
      icon = 'bike';
      emoji = '🏍️';
      break;
    case 'SCOOTER':
      vehicleType = 'Scooter';
      icon = 'scooter';
      emoji = '🛵';
      break;
    case 'COMMERCIAL':
      vehicleType = 'Commercial';
      icon = 'commercial';
      emoji = '🚚';
      break;
    default:
      vehicleType = 'Vehicle';
      icon = 'car';
      emoji = '🚗';
      break;
  }

  const photo =
    asset.imageUrl ||
    asset.image ||
    asset.photoUri ||
    asset.photo ||
    (Array.isArray(asset.images) && asset.images[0]) ||
    null;

  return {
    displayName,
    registration: reg,
    vehicleType,
    vehicleTypeRaw: rawType as any,
    icon,
    emoji,
    photo,
  };
}

export default getVehiclePresentation;
