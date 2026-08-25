/**
 * Asset Doctor — Declarative Asset Rule Engine
 * Evaluates conditions and triggers smart maintenance and governance actions across all categories.
 */

import { UniversalAssetModel } from '../core/universalAssetSchema';

export interface AssetRule {
  ruleId: string;
  name: string;
  category: string; // or 'ALL'
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  condition: (asset: UniversalAssetModel) => boolean;
  actionGenerator: (asset: UniversalAssetModel) => {
    actionType: 'MAINTENANCE' | 'RENEWAL' | 'WARRANTY' | 'DOCUMENT' | 'INSPECTION' | 'REPAIR' | 'VALUATION';
    title: string;
    description: string;
    dueInDays?: number;
    recommendedProvider?: string;
  };
}

class AssetRuleEngine {
  private rules: AssetRule[] = [];

  constructor() {
    this.registerDefaultRules();
  }

  public registerRule(rule: AssetRule): void {
    this.rules.push(rule);
  }

  public evaluateAsset(asset: UniversalAssetModel): Array<ReturnType<AssetRule['actionGenerator']> & { ruleId: string; priority: string }> {
    const actions: Array<ReturnType<AssetRule['actionGenerator']> & { ruleId: string; priority: string }> = [];

    for (const rule of this.rules) {
      if (rule.category !== 'ALL' && rule.category !== asset.category) {
        continue;
      }

      try {
        if (rule.condition(asset)) {
          const action = rule.actionGenerator(asset);
          actions.push({
            ...action,
            ruleId: rule.ruleId,
            priority: rule.priority
          });
        }
      } catch (err) {
        console.warn(`[RuleEngine] Error evaluating rule ${rule.ruleId}:`, err);
      }
    }

    return actions;
  }

  private registerDefaultRules(): void {
    // 1. Warranty Expiry Rule (Universal)
    this.registerRule({
      ruleId: 'rule_warranty_expiring_soon',
      name: 'Warranty Expiry Warning',
      category: 'ALL',
      description: 'Triggers when warranty expires within 30 days',
      priority: 'HIGH',
      condition: (asset) => {
        if (!asset.warranty?.expiryDate) return false;
        const diffDays = Math.round((new Date(asset.warranty.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      },
      actionGenerator: (asset) => ({
        actionType: 'WARRANTY',
        title: `Extend Warranty for ${asset.name}`,
        description: `OEM warranty expires on ${asset.warranty.expiryDate}. Consider purchasing an extended warranty protection plan.`,
        dueInDays: Math.max(0, Math.round((new Date(asset.warranty.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      })
    });

    // 2. Air Conditioner Filter Cleaning Rule
    this.registerRule({
      ruleId: 'rule_ac_filter_clean',
      name: 'AC 90-Day Filter Maintenance',
      category: 'APPLIANCE',
      description: 'Triggers every 90 days for air conditioners to preserve 100% cooling & power efficiency',
      priority: 'MEDIUM',
      condition: (asset) => {
        const isAc = asset.name.toLowerCase().includes('ac') || asset.name.toLowerCase().includes('air conditioner') || asset.subcategory?.toLowerCase().includes('ac');
        const days = Number(asset.categoryData?.daysSinceLastFilterClean || 95);
        return isAc && days >= 90;
      },
      actionGenerator: (asset) => ({
        actionType: 'MAINTENANCE',
        title: `Clean Air Filters: ${asset.name}`,
        description: 'Clean dust mesh filters to maintain optimal cooling airflow and reduce electricity power draw by up to 15%.',
        dueInDays: 0
      })
    });

    // 3. Vehicle Periodic Service Rule
    this.registerRule({
      ruleId: 'rule_vehicle_service_interval',
      name: 'Vehicle Service Milestone',
      category: 'VEHICLE',
      description: 'Triggers when vehicle reaches service KM or 180-day calendar threshold',
      priority: 'HIGH',
      condition: (asset) => {
        const odo = Number(asset.categoryData?.odometerKm || 0);
        const nextServiceKm = Number(asset.categoryData?.nextServiceKm || 6000);
        return (nextServiceKm - odo) <= 500;
      },
      actionGenerator: (asset) => {
        const odo = Number(asset.categoryData?.odometerKm || 0);
        const nextKm = Number(asset.categoryData?.nextServiceKm || 6000);
        const rem = Math.max(0, nextKm - odo);
        return {
          actionType: 'MAINTENANCE',
          title: `Service Due: ${asset.name}`,
          description: `Vehicle is ${rem > 0 ? `within ${rem} KM of` : 'past'} scheduled service target (${nextKm.toLocaleString()} KM). Schedule oil drain & brake inspection.`,
          dueInDays: 7
        };
      }
    });

    // 4. Smartphone Battery Health Calibration Rule
    this.registerRule({
      ruleId: 'rule_phone_battery_health',
      name: 'Smartphone Battery Optimization',
      category: 'ELECTRONICS',
      description: 'Triggers when battery health falls below 80% or exceeds 180 days without diagnostic check',
      priority: 'MEDIUM',
      condition: (asset) => {
        const health = Number(asset.categoryData?.batteryHealthPercent || 79);
        return health < 80;
      },
      actionGenerator: (asset) => ({
        actionType: 'INSPECTION',
        title: `Battery Health Check: ${asset.name}`,
        description: 'Battery health is below 80%. Authorized service center replacement recommended for full-day battery retention.',
        dueInDays: 14
      })
    });
  }
}

export const assetRuleEngine = new AssetRuleEngine();
