/**
 * Asset lifecycle status flags
 */

export const ASSET_STATUS = Object.freeze({
  ACTIVE: 'active',
  IN_REPAIR: 'in_repair',
  RETIRED: 'retired',
  SOLD: 'sold',
});

export const ASSET_STATUS_OPTIONS = [
  { id: ASSET_STATUS.ACTIVE, label: 'Active', color: '#10B981' },
  { id: ASSET_STATUS.IN_REPAIR, label: 'In Repair', color: '#F59E0B' },
  { id: ASSET_STATUS.RETIRED, label: 'Retired', color: '#9CA3AF' },
  { id: ASSET_STATUS.SOLD, label: 'Sold', color: '#6366F1' },
];

export function isAlertableStatus(status) {
  return status === ASSET_STATUS.ACTIVE || status === ASSET_STATUS.IN_REPAIR || !status;
}
