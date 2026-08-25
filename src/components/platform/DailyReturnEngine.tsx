import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Wrench,
  FileText,
  DollarSign,
  Smartphone,
  Car,
  Wind,
  Sun,
  Plus,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import { actionEngine, ActionItem } from '../../platform/intelligence/actionEngine';
import { createUniversalAsset, UniversalAssetModel } from '../../platform/core/universalAssetSchema';

interface DailyReturnEngineProps {
  customAssets?: UniversalAssetModel[];
  onActionClick?: (action: any) => void;
  onOpenVault?: () => void;
}

export const DailyReturnEngine: React.FC<DailyReturnEngineProps> = ({
  customAssets,
  onActionClick,
  onOpenVault
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('vehicle_service');

  const scenarios = [
    {
      id: 'vehicle_service',
      label: 'Vehicle (5,500 KM)',
      icon: <Car className="w-3.5 h-3.5" />,
      assetName: 'Vehicle Maintenance Cycle',
      category: 'VEHICLE' as const,
      categoryData: { odometerKm: 5500, nextServiceKm: 6000 },
      warranty: { hasWarranty: true, warrantyStatus: 'ACTIVE' as const }
    },
    {
      id: 'ac_summer',
      label: 'Split AC (Pre-Summer)',
      icon: <Wind className="w-3.5 h-3.5" />,
      assetName: 'Inverter Split AC',
      category: 'APPLIANCE' as const,
      categoryData: { daysSinceLastFilterClean: 92 },
      warranty: { hasWarranty: true, warrantyStatus: 'ACTIVE' as const }
    },
    {
      id: 'phone_battery',
      label: 'Smartphone (2 Yrs)',
      icon: <Smartphone className="w-3.5 h-3.5" />,
      assetName: 'Smartphone Hardware',
      category: 'ELECTRONICS' as const,
      categoryData: { batteryHealthPercent: 78 },
      warranty: { hasWarranty: true, warrantyStatus: 'EXPIRING_SOON' as const, expiryDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0] }
    },
    {
      id: 'solar_ups',
      label: 'Solar & Inverter Battery',
      icon: <Sun className="w-3.5 h-3.5" />,
      assetName: 'Tubular Inverter Battery',
      category: 'HOME' as const,
      categoryData: { daysSinceDistilledWaterCheck: 75 },
      warranty: { hasWarranty: true, warrantyStatus: 'ACTIVE' as const }
    }
  ];

  const currentScenario = scenarios.find(s => s.id === selectedScenario) || scenarios[0];

  // Evaluate action items
  const activeAsset: UniversalAssetModel = (customAssets && customAssets.length > 0)
    ? customAssets[0]
    : createUniversalAsset({
        assetId: `scenario-${currentScenario.id}`,
        name: currentScenario.assetName,
        category: currentScenario.category,
        categoryData: currentScenario.categoryData,
        warranty: currentScenario.warranty
      });

  const summary = actionEngine.generateActionsForAssets(
    customAssets && customAssets.length > 0 ? customAssets : [activeAsset]
  );

  return (
    <section className="w-full space-y-6">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Zap className="w-3.5 h-3.5" />
          <span>Daily Action Engine</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          What Should I Do Today?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Proactive maintenance tasks, impending warranty deadlines, and operational decisions across your assets.
        </p>
      </div>

      {/* Scenario Selector for Anonymous Visitors */}
      {(!customAssets || customAssets.length === 0) && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-thin max-w-3xl mx-auto">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline-block font-mono">
            Simulate Asset:
          </span>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedScenario(s.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedScenario === s.id
                  ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Action Cards Container */}
      <div className="max-w-5xl mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">Recommended High-Impact Actions</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold">
              {summary.totalActions} Active
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {customAssets && customAssets.length > 0 ? 'Live vault records' : 'Interactive lifecycle simulation'}
          </span>
        </div>

        {/* Action Items List */}
        <div className="space-y-3">
          {(summary.actionItems || []).map((action) => (
            <div
              key={action.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                action.urgency === 'CRITICAL'
                  ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                  : action.urgency === 'HIGH'
                  ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/60'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono border ${
                    action.urgency === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : action.urgency === 'HIGH'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {action.urgency} Priority
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {action.category}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-black text-white">
                  {action.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  {action.description}
                </p>
                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
                  <span>{action.dueText || 'Action Recommended'}</span>
                  {action.provenance ? <span className="text-slate-500">• {action.provenance}</span> : null}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (onActionClick) onActionClick(action);
                    else if (onOpenVault) onOpenVault();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <span>{action.primaryActionLabel || 'Take Action'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <p className="text-slate-400">
            Want Asset Doctor to calculate these actions automatically for all your assets?
          </p>
          <button
            onClick={onOpenVault}
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <span>Save Assets in Encrypted Vault</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
