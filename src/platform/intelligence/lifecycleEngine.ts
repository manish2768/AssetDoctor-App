/**
 * Asset Doctor — Universal Asset Lifecycle Engine
 * State machine managing asset transitions across its 10-year lifetime.
 */

import { AssetLifecycleStatus, UniversalAssetModel } from '../core/universalAssetSchema';

export interface LifecycleTransition {
  from: AssetLifecycleStatus;
  to: AssetLifecycleStatus;
  allowed: boolean;
  reason?: string;
}

const LIFECYCLE_GRAPH: Record<AssetLifecycleStatus, AssetLifecycleStatus[]> = {
  PURCHASED: ['REGISTERED', 'ACTIVE'],
  REGISTERED: ['ACTIVE', 'MAINTENANCE_DUE', 'RETIRED'],
  ACTIVE: ['MAINTENANCE_DUE', 'SERVICE', 'REPAIR', 'WARRANTY', 'AGING', 'RESALE', 'RETIRED'],
  MAINTENANCE_DUE: ['SERVICE', 'ACTIVE', 'REPAIR'],
  SERVICE: ['ACTIVE', 'MAINTENANCE_DUE', 'REPAIR'],
  REPAIR: ['ACTIVE', 'AGING', 'RESALE', 'RETIRED'],
  WARRANTY: ['ACTIVE', 'REPAIR', 'REPLACED'],
  AGING: ['ACTIVE', 'RESALE', 'REPLACED', 'RETIRED'],
  RESALE: ['SOLD', 'ACTIVE', 'RETIRED'],
  SOLD: ['RETIRED'],
  REPLACED: ['RETIRED'],
  RETIRED: []
};

export class AssetLifecycleEngine {
  public static canTransition(current: AssetLifecycleStatus, target: AssetLifecycleStatus): boolean {
    const allowed = LIFECYCLE_GRAPH[current] || [];
    return allowed.includes(target);
  }

  public static transitionAsset(
    asset: UniversalAssetModel,
    targetStatus: AssetLifecycleStatus,
    reason?: string
  ): UniversalAssetModel {
    if (!this.canTransition(asset.lifecycle.currentStatus, targetStatus)) {
      throw new Error(`Invalid lifecycle transition from ${asset.lifecycle.currentStatus} to ${targetStatus}`);
    }

    const now = new Date().toISOString();
    return {
      ...asset,
      lifecycle: {
        currentStatus: targetStatus,
        statusUpdatedAt: now,
        retiredAt: (targetStatus === 'RETIRED' || targetStatus === 'SOLD') ? now : asset.lifecycle.retiredAt
      },
      updatedAt: now
    };
  }

  public static getActiveStageLabel(status: AssetLifecycleStatus): { label: string; colorClass: string } {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Active & Protected', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'MAINTENANCE_DUE':
        return { label: 'Maintenance Due', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'SERVICE':
        return { label: 'In Service', colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'REPAIR':
        return { label: 'Under Repair', colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      case 'AGING':
        return { label: 'Aging Hardware', colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'RESALE':
        return { label: 'Ready for Resale', colorClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
      case 'SOLD':
      case 'RETIRED':
        return { label: 'Archived / Retired', colorClass: 'bg-slate-700 text-slate-400 border-slate-600/30' };
      default:
        return { label: 'Registered', colorClass: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  }
}
