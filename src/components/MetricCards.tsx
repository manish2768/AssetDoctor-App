import React from 'react';
import { ShieldCheck, IndianRupee, AlertTriangle, PackageX, TrendingUp, Sparkles, Wrench, Bike, Droplets, Wind, Car, CalendarClock } from 'lucide-react';
import { Asset, MetricSummary } from '../types';
import { formatINR } from '../utils/assetUtils';

interface MetricCardsProps {
  metrics: MetricSummary;
  assets?: Asset[];
  onFilterStatus?: (status: 'all' | 'active' | 'expiring_soon' | 'expired') => void;
  activeFilter?: string;
  onOpenEmergencyModal?: () => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  metrics,
  assets = [],
  onFilterStatus,
  activeFilter = 'all',
  onOpenEmergencyModal,
}) => {
  // Compute category breakdown counts for Total Assets Managed card
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      Bike: 0,
      AC: 0,
      RO: 0,
      Car: 0,
      Electronics: 0,
    };

    assets.forEach((ast) => {
      const lname = ast.name.toLowerCase();
      if (lname.includes('bike') || lname.includes('motorcycle') || lname.includes('scooter') || ast.category === 'Vehicles') {
        if (lname.includes('car') || lname.includes('creta')) {
          counts.Car = (counts.Car || 0) + 1;
        } else {
          counts.Bike = (counts.Bike || 0) + 1;
        }
      } else if (lname.includes('ac') || lname.includes('air conditioner')) {
        counts.AC = (counts.AC || 0) + 1;
      } else if (lname.includes('ro') || lname.includes('purifier') || lname.includes('water')) {
        counts.RO = (counts.RO || 0) + 1;
      } else {
        counts.Electronics = (counts.Electronics || 0) + 1;
      }
    });

    return counts;
  }, [assets]);

  // Maintenance & Renewal reminders list
  const maintenanceReminders = React.useMemo(() => {
    return assets.filter((ast) => ast.maintenanceDueDate || ast.serviceDate).slice(0, 3);
  }, [assets]);

  return (
    <div className="space-y-4 mb-8">
      
      {/* Primary Bento Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Assets Managed */}
        <div
          onClick={() => onFilterStatus?.('all')}
          id="metric-card-total-assets"
          className={`group relative p-5 rounded-3xl bg-slate-900/80 backdrop-blur-md border ${
            activeFilter === 'all'
              ? 'border-teal-500/80 ring-2 ring-teal-500/30 bg-teal-950/20'
              : 'border-slate-800 hover:border-slate-700'
          } transition-all duration-300 cursor-pointer overflow-hidden shadow-xl flex flex-col justify-between`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-colors"></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                Total Assets Managed
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {metrics.totalAssets}
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                <Sparkles className="w-3 h-3" /> {metrics.activeCount} Active
              </span>
            </div>
          </div>

          {/* Quick Category Chips: Bike, AC, RO, Car */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-950 text-amber-300 border border-amber-500/20 flex items-center gap-1">
              <Bike className="w-3 h-3" /> Bike ({categoryCounts.Bike})
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-950 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
              <Wind className="w-3 h-3" /> AC ({categoryCounts.AC})
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-950 text-blue-300 border border-blue-500/20 flex items-center gap-1">
              <Droplets className="w-3 h-3" /> RO ({categoryCounts.RO})
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-950 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <Car className="w-3 h-3" /> Car ({categoryCounts.Car})
            </span>
          </div>
        </div>

        {/* Card 2: Upcoming Maintenance & Renewal Reminders */}
        <div
          id="metric-card-upcoming-maintenance"
          className="group relative p-5 rounded-3xl bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-cyan-500/40 transition-all duration-300 overflow-hidden shadow-xl flex flex-col justify-between col-span-1 md:col-span-1 lg:col-span-2"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors"></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-300">
                  Upcoming Maintenance & Renewal Due
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                Service Schedule
              </span>
            </div>

            {/* List of maintenance tasks: Insurance, RO Filter, Bike Service */}
            <div className="space-y-2 mt-3">
              {maintenanceReminders.length > 0 ? (
                maintenanceReminders.map((item) => (
                  <div
                    key={`maint-${item.id}`}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs gap-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>
                      <span className="font-bold text-slate-200 truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold text-cyan-400 block">
                        {item.maintenanceType || 'Routine Maintenance'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Due: {item.maintenanceDueDate || 'Aug 2026'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">All scheduled services are up to date.</p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">
              Total Vault Valuation: <strong className="text-emerald-400 font-mono font-bold">{formatINR(metrics.totalValuation)}</strong>
            </span>
            <button
              onClick={onOpenEmergencyModal}
              className="text-[11px] text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3 h-3" /> Call Mechanic
            </button>
          </div>
        </div>

        {/* Card 3: Warranty Expiry Alert Section */}
        <div
          onClick={() => onFilterStatus?.('expiring_soon')}
          id="metric-card-expiring-soon"
          className={`group relative p-5 rounded-3xl bg-slate-900/80 backdrop-blur-md border ${
            activeFilter === 'expiring_soon'
              ? 'border-amber-500/80 ring-2 ring-amber-500/40 bg-amber-950/20'
              : metrics.expiringSoonCount > 0
              ? 'border-amber-500/40 hover:border-amber-500/70'
              : 'border-slate-800 hover:border-slate-700'
          } transition-all duration-300 cursor-pointer overflow-hidden shadow-xl flex flex-col justify-between`}
        >
          {metrics.expiringSoonCount > 0 && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl animate-pulse"></div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
                Warranty Expiry Alerts
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5 animate-pulse text-amber-400" />
              </div>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                {metrics.expiringSoonCount}
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Due &le; 30 Days
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-2 font-medium">
              {metrics.expiringSoonCount > 0
                ? 'Action required: Claim warranty or request renewal'
                : 'All warranties currently protected'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Expired: <strong className="text-rose-400 font-mono font-bold">{metrics.expiredCount}</strong>
            </span>
            <span className="text-amber-400 font-bold underline">
              View Alerts &rarr;
            </span>
          </div>

        </div>

      </div>

    </div>
  );
};
