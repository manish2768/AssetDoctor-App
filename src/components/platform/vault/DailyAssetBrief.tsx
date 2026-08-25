import React from 'react';
import {
  BellRing,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import type { Asset } from '../../../types';
import { AssetTimelineEngine, UpcomingExpiryItem } from '../../../platform/timeline/assetTimelineEngine';

interface DailyAssetBriefProps {
  assets: Asset[];
  onNavigateToTool?: (slug: string) => void;
  onSelectAsset?: (asset: Asset) => void;
}

export const DailyAssetBrief: React.FC<DailyAssetBriefProps> = ({
  assets,
  onNavigateToTool,
  onSelectAsset
}) => {
  const upcomingItems = AssetTimelineEngine.getUnifiedUpcomingTimeline(assets);
  const urgentAlerts = upcomingItems.filter(i => i.urgency === 'OVERDUE' || i.urgency === 'CRITICAL_7D' || i.urgency === 'WARNING_30D');

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0a1120] to-slate-900 border border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">Your Assets Today</h3>
            <p className="text-xs text-slate-400">Daily intelligence brief for your vaulted portfolio.</p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Alert Content / Empty State */}
      {urgentAlerts.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/60 flex items-center gap-4 text-xs">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Nothing requires attention right now.</h4>
            <p className="text-slate-400 mt-0.5">
              All warranties, maintenance cycles, and documentation across your {assets.length} registered asset{assets.length === 1 ? '' : 's'} are currently in optimal standing.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider font-mono block">
            Items Requiring Attention ({urgentAlerts.length})
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {urgentAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  alert.urgency === 'OVERDUE'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                    : alert.urgency === 'CRITICAL_7D'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{alert.assetName}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {alert.assetCategory}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {alert.eventLabel} •{' '}
                    {alert.daysRemaining < 0
                      ? `Overdue by ${Math.abs(alert.daysRemaining)} days`
                      : alert.daysRemaining === 0
                      ? 'Due today'
                      : `${alert.daysRemaining} days remaining`}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const matchedAsset = assets.find(a => a.id === alert.assetId);
                    if (matchedAsset && onSelectAsset) {
                      onSelectAsset(matchedAsset);
                    } else if (onNavigateToTool) {
                      onNavigateToTool('tools/warranty-checker');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-slate-700 transition cursor-pointer shrink-0"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "Since Your Last Visit" Delta Insight */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300 font-semibold">Since your last visit:</span>
          <span>
            {urgentAlerts.length > 0
              ? `${urgentAlerts.length} upcoming milestone${urgentAlerts.length === 1 ? '' : 's'} closer to deadline.`
              : 'Zero status changes or new alerts.'}
          </span>
        </div>

        <span className="text-[10px] font-mono text-emerald-400">Continuous Monitoring</span>
      </div>
    </div>
  );
};
