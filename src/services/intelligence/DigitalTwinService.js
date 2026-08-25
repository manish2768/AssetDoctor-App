/**
 * DigitalTwinService — Home → Floor → Room persistence via existing Locations.
 * Optional: users are not forced to create a home.
 */

import { LocationService, createLocationId } from '../assets/LocationService';
import { LOCATION_NODE_TYPE, ROOM_TYPE_PRESETS } from './types';
import {
  buildDigitalTwinTree,
  attachAssetsToTwinTree,
  resolveAssetLocationRefs,
  buildLocationPath,
  normalizeLocationNode,
} from './digitalTwinModel';

function stamp(extra = {}) {
  return {
    ...extra,
    updatedAt: new Date().toISOString(),
  };
}

export class DigitalTwinService {
  static ROOM_TYPE_PRESETS = ROOM_TYPE_PRESETS;

  static async listLocations(userId) {
    return LocationService.list(userId);
  }

  static async getTree(userId, assets = []) {
    const locations = await LocationService.list(userId);
    const tree = buildDigitalTwinTree(locations);
    return attachAssetsToTwinTree(tree, assets);
  }

  static async createHome(userId, { name, householdId = null, locationId = null } = {}) {
    const id = locationId || createLocationId();
    const label = String(name || '').trim() || 'Home';
    return LocationService.upsert(userId, {
      locationId: id,
      name: label,
      parentId: null,
      path: label,
      type: LOCATION_NODE_TYPE.HOME,
      homeId: id,
      householdId,
      ownerUid: userId,
      ...stamp({ createdAt: new Date().toISOString() }),
    });
  }

  static async createFloor(userId, { homeId, name, locationId = null } = {}) {
    if (!homeId) throw new Error('homeId required');
    const id = locationId || createLocationId();
    const label = String(name || '').trim() || 'Floor';
    const path = buildLocationPath([/* home name resolved by caller path if needed */ label]);
    return LocationService.upsert(userId, {
      locationId: id,
      name: label,
      parentId: homeId,
      homeId,
      floorId: id,
      path,
      type: LOCATION_NODE_TYPE.FLOOR,
      ownerUid: userId,
      ...stamp({ createdAt: new Date().toISOString() }),
    });
  }

  static async createRoom(
    userId,
    { homeId = null, floorId = null, name, roomType = null, customName = null, locationId = null } = {},
  ) {
    const parentId = floorId || homeId;
    if (!parentId) throw new Error('floorId or homeId required for room');
    const id = locationId || createLocationId();
    const label = String(customName || name || roomType || '').trim() || 'Room';
    return LocationService.upsert(userId, {
      locationId: id,
      name: label,
      customName: customName || null,
      roomType: roomType || null,
      parentId,
      homeId: homeId || null,
      floorId: floorId || null,
      path: label,
      type: LOCATION_NODE_TYPE.ROOM,
      ownerUid: userId,
      ...stamp({ createdAt: new Date().toISOString() }),
    });
  }

  static async renameLocation(userId, locationId, name) {
    if (!locationId) throw new Error('locationId required');
    const label = String(name || '').trim();
    if (!label) throw new Error('name required');
    return LocationService.upsert(userId, {
      locationId,
      name: label,
      path: label,
      ...stamp(),
    });
  }

  /**
   * Move asset to room — updates location refs only; keeps assetId stable.
   */
  static async assignAssetToRoom(userId, assetId, { home, floor, room, locations = [], reason = 'assigned' } = {}) {
    const refs = resolveAssetLocationRefs({ home, floor, room, locations });
    return LocationService.moveAsset(userId, assetId, {
      locationId: refs.locationId,
      locationPath: refs.locationPath,
      homeId: refs.homeId,
      floorId: refs.floorId,
      roomId: refs.roomId,
      reason,
    });
  }

  static normalize = normalizeLocationNode;
}

export default DigitalTwinService;
