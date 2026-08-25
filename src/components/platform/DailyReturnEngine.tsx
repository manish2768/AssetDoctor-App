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
  Wind
} from 'lucide-react';
import { actionEngine, ActionItem } from '../../platform/intelligence/actionEngine';
import { createUniversalAsset, UniversalAssetModel } from '../../platform/core/universalAssetSchema';

interface DailyReturnEngineProps {
  customAssets?: UniversalAssetModel[];
  onActionClick?: (action: ActionItem) => void;
}

export const DailyReturnEngine: React.FC<DailyReturnEngineProps> = ({
  customAssets,
  onActionClick
}) => {
  // Built-in demonstration sample portfolio for instant visitor intelligence
  const samplePortfolio: UniversalAssetModel[] = [
    createUniversalAsset({
      assetId: 'sample-car',
      name: 'TVS Ronin 225',
      category: 'VEHICLE',
      brand: 'TVS',
      model: 'Ronin Base',
      purchasePrice: 154000,
      primaryIdentifier: 'MH-02-EV-9999',
      categoryData: {
        odometerKm: 5800,
        nextServiceKm: 6000
      },
      warranty: {
        hasWarranty: true,
        warrantyStatus: 'ACTIVE',
        expiryDate: '2027-02-15'
      }
    }),
    createUniversalAsset({
      assetId: 'sample-ac',
      name: 'Daikin 1.5 Ton Inverter AC',
      category: 'APPLIANCE',
      brand: 'Daikin',
      purchasePrice: 42000,
      primaryIdentifier: 'SN-DKN-882910',
      categoryData: {
        daysSinceLastFilterClean: 98
      },
      warranty: {
        hasWarranty: true,
        warrantyStatus: 'ACTIVE',
        expiryDate: '2026-09-01'
      }
    }),
    createUniversalAsset({
      assetId: 'sample-laptop',
      name: 'MacBook Air M2',
      category: 'ELECTRONICS',
      brand: 'Apple',
      purchasePrice: 99000,
      primaryIdentifier: 'C02GF998MD6T',
      warranty: {
        hasWarranty: true,
        warrantyStatus: 'EXPIRING_SOON',
        expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    })
  ];

  const assetsToEvaluate = customAssets && customAssets.length > 0 ? customAssets : samplePortfolio;
  const summary = actionEngine.generateActionsForAssets(assetsToEvaluate);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const handleMarkDone = (actionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedIds(prev => [...prev, actionId]);
  };

  const getUrgencyBadge = (urgency: ActionItem['urgency']) => {
    switch (urgency) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="w-full rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
              Universal Action Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            What Should I Do Today?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time prioritized maintenance, warranty, and lifecycle actions across your entire asset portfolio.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Pending</span>
            <span className="text-lg font-black text-white font-mono">
              {summary.totalActions - completedIds.length}
            </span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">High Priority</span>
            <span className="text-lg font-black text-amber-300 font-mono">
              {summary.highCount + summary.criticalCount}
            </span>
          </div>
        </div>
      </div>

      {/* Action Cards List */}
      <div className="space-y-3">
        {summary.actionItems.map((action) => {
          const isDone = completedIds.includes(action.id);
          if (isDone) return null;

          return (
            <div
              key={action.id}
              onClick={() => onActionClick && onActionClick(action)}
              className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-emerald-500/40 hover:bg-slate-900/60 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                  {action.actionType === 'WARRANTY' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
                  {action.actionType === 'MAINTENANCE' && <Wrench className="w-5 h-5 text-emerald-400" />}
                  {action.actionType === 'INSPECTION' && <Smartphone className="w-5 h-5 text-cyan-400" />}
                  {action.actionType !== 'WARRANTY' && action.actionType !== 'MAINTENANCE' && action.actionType !== 'INSPECTION' && <FileText className="w-5 h-5 text-indigo-400" />}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-white">{action.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getUrgencyBadge(action.urgency)}`}>
                      {action.dueText}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                      {action.brand} • {action.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    {action.description}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono block pt-0.5">
                    Source: {action.provenance}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={(e) => handleMarkDone(action.id, e)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                </button>
                <button
                  onClick={() => onActionClick && onActionClick(action)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                  <span>{action.primaryActionLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {summary.actionItems.length === completedIds.length && (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">All Caught Up!</h4>
            <p className="text-xs text-slate-400">
              No outstanding maintenance or warranty actions required today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
