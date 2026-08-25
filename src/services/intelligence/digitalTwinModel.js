/**
 * Pure Home / Floor / Room model helpers (no Firebase).
 * Persistence goes through LocationService / DigitalTwinService.
 */

import { LOCATION_NODE_TYPE, ROOM_TYPE_PRESETS } from './types';

export { LOCATION_NODE_TYPE, ROOM_TYPE_PRESETS };

export function buildLocationPath(parts = []) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' → ');
}

/**
 * Normalize a Locations document into typed twin node.
 */
export function normalizeLocationNode(row = {}) {
  const type = String(row.type || row.nodeType || '').toUpperCase();
  const nodeType = LOCATION_NODE_TYPE[type] || null;
  return {
    locationId: row.locationId || row.id || null,
    type: nodeType,
    name: String(row.name || row.customName || '').trim() || 'Untitled',
    customName: row.customName != null ? String(row.customName) : null,
    roomType: row.roomType || row.typeLabel || null,
    parentId: row.parentId || null,
    homeId: row.homeId || (nodeType === LOCATION_NODE_TYPE.HOME ? row.locationId || row.id : null),
    floorId: row.floorId || (nodeType === LOCATION_NODE_TYPE.FLOOR ? row.locationId || row.id : null),
    path: row.path || '',
    ownerUid: row.ownerUid || null,
    householdId: row.householdId || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    syncStatus: row.syncStatus || null,
    deletedAt: row.deletedAt || null,
  };
}

/**
 * Build Home → Floor → Room tree from flat Locations list.
 */
export function buildDigitalTwinTree(locations = []) {
  const nodes = (locations || [])
    .filter((l) => l && !l.deletedAt)
    .map(normalizeLocationNode);
  const byId = new Map(nodes.map((n) => [n.locationId, { ...n, children: [] }]));

  const roots = [];
  for (const n of byId.values()) {
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId).children.push(n);
    } else if (n.type === LOCATION_NODE_TYPE.HOME || !n.parentId) {
      roots.push(n);
    } else {
      roots.push(n);
    }
  }

  const homes = roots.filter((r) => r.type === LOCATION_NODE_TYPE.HOME || !r.type);
  return {
    homes: homes.length ? homes : roots,
    flat: nodes,
    byId,
  };
}

/**
 * Attach assets to rooms by roomId / locationId / path (never by asset name alone).
 * Preserves room identity fields so identical appliances can be distinguished without IMEI.
 */
export function attachAssetsToTwinTree(tree, assets = []) {
  const list = (assets || []).filter((a) => a && !a.deletedAt);
  const byRoom = new Map();
  for (const a of list) {
    const roomKey = a.roomId || a.locationId || null;
    if (!roomKey) continue;
    if (!byRoom.has(roomKey)) byRoom.set(roomKey, []);
    byRoom.get(roomKey).push(buildAssetTwinIdentity(a));
  }

  function walk(node) {
    const id = node.locationId;
    const attached = byRoom.get(id) || [];
    const next = {
      ...node,
      roomId: node.type === LOCATION_NODE_TYPE.ROOM ? id : node.roomId || null,
      roomName: node.type === LOCATION_NODE_TYPE.ROOM ? node.name : node.roomName || null,
      assets: attached,
      assetCount: attached.length,
      children: (node.children || []).map(walk),
    };
    return next;
  }

  return {
    ...tree,
    homes: (tree.homes || []).map(walk),
  };
}

/**
 * Stable display identity for twin leaves — room + custom name beat IMEI requirement.
 */
export function buildAssetTwinIdentity(asset = {}) {
  const roomId = asset.roomId || asset.locationId || null;
  const roomName = asset.roomName || null;
  const locationLabel =
    asset.locationLabel || asset.locationPath || (roomName ? String(roomName) : null);
  const customAssetName = asset.customAssetName || asset.nickname || null;
  const baseName = asset.assetName || 'Asset';
  const displayName = customAssetName
    ? `${customAssetName}`
    : locationLabel
      ? `${baseName} · ${locationLabel}`
      : baseName;
  return {
    assetId: asset.assetId || asset.id,
    publicAssetId: asset.publicAssetId || asset.assetCode || null,
    displayName,
    customAssetName,
    roomId,
    roomName,
    locationLabel,
    categoryId: asset.categoryId || null,
    imei: asset.imei || null,
    serialNumber: asset.serialNumber || null,
  };
}

/**
 * Find assets that share the same product name but differ by room identity.
 */
export function groupIdenticalAssetsByRoom(assets = []) {
  const map = new Map();
  for (const a of assets || []) {
    if (!a || a.deletedAt) continue;
    const key = String(a.assetName || a.productName || '')
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(buildAssetTwinIdentity(a));
  }
  return [...map.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([name, rows]) => ({ assetName: name, instances: rows }));
}

/**
 * Resolve homeId / floorId / roomId + path for an asset assignment.
 */
export function resolveAssetLocationRefs({ home, floor, room, locations = [] } = {}) {
  const roomNode = room ? normalizeLocationNode(room) : null;
  const floorNode = floor
    ? normalizeLocationNode(floor)
    : roomNode?.parentId
      ? normalizeLocationNode(locations.find((l) => (l.locationId || l.id) === roomNode.parentId) || {})
      : null;
  const homeNode = home
    ? normalizeLocationNode(home)
    : floorNode?.parentId
      ? normalizeLocationNode(locations.find((l) => (l.locationId || l.id) === floorNode.parentId) || {})
      : floorNode?.homeId
        ? normalizeLocationNode(locations.find((l) => (l.locationId || l.id) === floorNode.homeId) || {})
        : null;

  const path = buildLocationPath([
    homeNode?.name,
    floorNode?.name,
    roomNode?.name,
  ]);

  return {
    homeId: homeNode?.locationId || roomNode?.homeId || null,
    floorId: floorNode?.locationId || roomNode?.floorId || null,
    roomId: roomNode?.locationId || null,
    locationId: roomNode?.locationId || floorNode?.locationId || homeNode?.locationId || null,
    locationPath: path || roomNode?.path || '',
  };
}

export default {
  buildLocationPath,
  normalizeLocationNode,
  buildDigitalTwinTree,
  attachAssetsToTwinTree,
  buildAssetTwinIdentity,
  groupIdenticalAssetsByRoom,
  resolveAssetLocationRefs,
};
