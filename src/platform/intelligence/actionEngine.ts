/**
 * Asset Doctor — Universal Action Engine ("What Should I Do Next?")
 * Category-independent actionable recommendation engine across personal, household, vehicle, and business assets.
 */

import { UniversalAssetModel } from '../core/universalAssetSchema';
import { assetRuleEngine } from './ruleEngine';
import { assetModuleRegistry } from '../modules/moduleRegistry';

export interface ActionItem {
  id: string;
  assetId: string;
  assetName: string;
  category: string;
  brand: string;
  actionType: 'MAINTENANCE' | 'RENEWAL' | 'WARRANTY' | 'DOCUMENT' | 'INSPECTION' | 'REPAIR' | 'VALUATION' | 'RESALE';
  title: string;
  description: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueText: string;
  dueInDays: number;
  primaryActionLabel: string;
  primaryActionUrl?: string;
  secondaryActionLabel?: string;
  iconName: string;
  provenance: string;
}

export interface ActionEngineSummary {
  totalActions: number;
  criticalCount: number;
  highCount: number;
  actionItems: ActionItem[];
  generatedAt: string;
}

class ActionEngine {
  public generateActionsForAssets(assets: UniversalAssetModel[]): ActionEngineSummary {
    const actionItems: ActionItem[] = [];

    for (const asset of assets) {
      const module = assetModuleRegistry.getModule(asset.category);
      const ruleActions = assetRuleEngine.evaluateAsset(asset);

      for (const ra of ruleActions) {
        const urgency = ra.priority as ActionItem['urgency'];
        const dueDays = ra.dueInDays ?? 30;
        const dueText = dueDays <= 0 ? 'Due Today' : dueDays === 1 ? 'Due Tomorrow' : `Due in ${dueDays} days`;

        actionItems.push({
          id: `act_${asset.assetId}_${ra.ruleId}`,
          assetId: asset.assetId,
          assetName: asset.name,
          category: asset.category,
          brand: asset.brand,
          actionType: ra.actionType,
          title: ra.title,
          description: ra.description,
          urgency,
          dueText,
          dueInDays: dueDays,
          primaryActionLabel: ra.actionType === 'WARRANTY' ? 'Extend Warranty' : ra.actionType === 'MAINTENANCE' ? 'Mark Done' : 'Inspect Details',
          secondaryActionLabel: 'Dismiss',
          iconName: module.iconName,
          provenance: 'AssetDoctor Rule & Telemetry Engine v1.0'
        });
      }
    }

    // Sort actions by urgency (CRITICAL > HIGH > MEDIUM > LOW) and days remaining
    const urgencyWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    actionItems.sort((a, b) => {
      const diff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (diff !== 0) return diff;
      return a.dueInDays - b.dueInDays;
    });

    return {
      totalActions: actionItems.length,
      criticalCount: actionItems.filter(a => a.urgency === 'CRITICAL').length,
      highCount: actionItems.filter(a => a.urgency === 'HIGH').length,
      actionItems,
      generatedAt: new Date().toISOString()
    };
  }
}

export const actionEngine = new ActionEngine();
