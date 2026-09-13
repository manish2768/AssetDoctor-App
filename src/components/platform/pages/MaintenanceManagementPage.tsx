import React from 'react';
import { Wrench, Calendar, AlertTriangle, CheckCircle2, TrendingDown, Clock, ArrowRight, ChevronRight, Download, Sparkles } from 'lucide-react';

interface MaintenanceManagementPageProps {
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const MaintenanceManagementPage: React.FC<MaintenanceManagementPageProps> = ({
  onNavigate,
  onOpenVaultApp
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-black uppercase tracking-wider font-mono">
          <Wrench className="w-4 h-4" />
          <span>Preventive Asset Care</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Preventive Maintenance That Saves You Thousands
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Regular preventive care extends asset lifespan by up to 40% and cuts sudden breakdown expenses. Track maintenance schedules across vehicles, ACs, and home appliances.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('/download')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset Doctor</span>
          </button>
          <button
            onClick={() => onNavigate('/tools/service-due-calculator')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Service Due Calculator</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* The 4 Maintenance Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Whichever-Comes-First Scheduling</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Vehicles and machines degrade through both usage distance and calendar oxidation. Our engine predicts maintenance dates based on both odometer telemetry and elapsed days.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Early Warning Diagnostics</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unusual AC hissing, refrigerator icing, or washing machine vibration are early distress signals. Catching symptoms early prevents catastrophic component replacement costs.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Power & Fuel Efficiency Preservation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            A dirty AC filter increases compressor electricity consumption by 15%, while old engine oil lowers motorcycle mileage by 10-18%. Clean machines run cheaper.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Automated Proactive Reminders</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Receive timely WhatsApp and in-app reminders so you never forget oil drains, filter washes, battery water top-ups, or annual AMC bookings.
          </p>
        </div>
      </section>

      {/* Routine Care Checklist by Category */}
      <section className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
        <h2 className="text-2xl font-black text-white">Recommended Maintenance Cycles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-emerald-400 text-sm">Cars & Bikes</span>
            <ul className="space-y-1 text-slate-400">
              <li>• Engine oil & filter: 6-12 Months or 10,000 KM</li>
              <li>• Two-wheeler chain lube: Every 500-1,000 KM</li>
              <li>• Brake pad & fluid inspection: Annual</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-teal-400 text-sm">Air Conditioners</span>
            <ul className="space-y-1 text-slate-400">
              <li>• Mesh filter wash: Every 60-90 Days</li>
              <li>• Pre-summer wet coil cleaning: Annual</li>
              <li>• Condensate drain flush: Bi-annual</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="font-bold text-cyan-400 text-sm">RO Purifiers & Appliances</span>
            <ul className="space-y-1 text-slate-400">
              <li>• RO pre-filter candle: Every 3-4 Months</li>
              <li>• Sediment & carbon filter: Every 6-9 Months</li>
              <li>• Washing machine tub clean: Monthly</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Free Interactive Tools CTA Banner */}
      <section className="p-8 rounded-3xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-emerald-950/60 border border-teal-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Evaluate Your Maintenance Schedules Online
          </h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Check upcoming service milestones or calculate whether to repair or replace aging equipment.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate('/tools/service-due-calculator')}
            className="px-5 py-3 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition cursor-pointer text-center"
          >
            Service Due Calculator
          </button>
          <button
            onClick={() => onNavigate('/tools/repair-vs-replace')}
            className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs transition cursor-pointer text-center"
          >
            Repair vs Replace Tool
          </button>
        </div>
      </section>
    </div>
  );
};
