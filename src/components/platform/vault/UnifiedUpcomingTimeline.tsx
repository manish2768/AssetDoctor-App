import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Car,
  Smartphone,
  Tv,
  Sun,
  Briefcase,
  Home,
  ChevronRight
} from 'lucide-react';
import type { Asset } from '../../../types';
import { AssetTimelineEngine, UpcomingExpiryItem } from '../../../platform/timeline/assetTimelineEngine';

interface UnifiedUpcomingTimelineProps {
  assets: Asset[];
  onSelectAsset?: (asset: Asset) => void;
  onNavigateToTool?: (slug: string) => void;
}

export const UnifiedUpcomingTimeline: React.FC<UnifiedUpcomingTimelineProps> = ({
  assets,
  onSelectAsset,
  onNavigateToTool
}) => {
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'critical' | 'upcoming'>('all');
  const allUpcoming = AssetTimelineEngine.getUnifiedUpcomingTimeline(assets);

  const filtered = allUpcoming.filter(item => {
    if (filterUrgency === 'critical') return item.urgency === 'OVERDUE' || item.urgency === 'CRITICAL_7D';
    if (filterUrgency === 'upcoming') return item.urgency === 'WARNING_30D' || item.urgency === 'UPCOMING';
    return true;
  });

  const getCategoryIcon = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('veh') || lower.includes('car') || lower.includes('bike')) return <Car className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.includes('elec') || lower.includes('phone') || lower.includes('gadg')) return <Smartphone className="w-3.5 h-3.5 text-cyan-400" />;
    if (lower.includes('app') || lower.includes('ac')) return <Tv className="w-3.5 h-3.5 text-emerald-400" />;
    if (lower.includes('sol')) return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    if (lower.includes('bus')) return <Briefcase className="w-3.5 h-3.5 text-indigo-400" />;
    return <Home className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white">What's Coming Up</h3>
          <p className="text-xs text-slate-400">Unified schedule of warranty milestones, service dates, and statutory renewals.</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setFilterUrgency('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              filterUrgency === 'all' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            All ({allUpcoming.length})
          </button>
          <button
            onClick={() => setFilterUrgency('critical')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              filterUrgency === 'critical' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Critical &le;7d ({allUpcoming.filter(i => i.urgency === 'OVERDUE' || i.urgency === 'CRITICAL_7D').length})
          </button>
          <button
            onClick={() => setFilterUrgency('upcoming')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              filterUrgency === 'upcoming' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Upcoming ({allUpcoming.filter(i => i.urgency === 'WARNING_30D' || i.urgency === 'UPCOMING').length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="font-bold text-white text-sm">No Milestones in this Filter Window</h4>
          <p className="text-xs text-slate-400">All registered items are up to date.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all text-xs ${
                item.urgency === 'OVERDUE'
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : item.urgency === 'CRITICAL_7D'
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  {getCategoryIcon(item.assetCategory)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{item.assetName}</span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {item.assetCategory}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                    {item.eventLabel} • Due: {item.dueDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono border ${
                  item.urgency === 'OVERDUE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : item.urgency === 'CRITICAL_7D'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {item.daysRemaining < 0
                    ? `Overdue (${Math.abs(item.daysRemaining)}d)`
                    : item.daysRemaining === 0
                    ? 'Due Today'
                    : `${item.daysRemaining} Days Left`}
                </span>

                <button
                  onClick={() => {
                    const matchedAsset = assets.find(a => a.id === item.assetId);
                    if (matchedAsset && onSelectAsset) {
                      onSelectAsset(matchedAsset);
                    } else if (onNavigateToTool) {
                      onNavigateToTool('tools/warranty-checker');
                    }
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
