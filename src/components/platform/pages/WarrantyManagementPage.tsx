import React from 'react';
import { ShieldCheck, FileText, Bell, Clock, ArrowRight, CheckCircle2, ChevronRight, Download, Sparkles, AlertTriangle } from 'lucide-react';

interface WarrantyManagementPageProps {
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const WarrantyManagementPage: React.FC<WarrantyManagementPageProps> = ({
  onNavigate,
  onOpenVaultApp
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>Universal Warranty Vault</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Never Lose a Warranty Claim Again
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Vault retail invoices, track 1-year and 10-year component warranties, manage AMC contracts, and get proactive WhatsApp and push alerts before coverage lapses.
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
            onClick={() => onNavigate('/tools/warranty-calculator')}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Free Warranty Calculator</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>

      {/* The Indian Warranty Challenge Grid */}
      <section className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="text-center space-y-1 max-w-2xl mx-auto">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">The Challenge</span>
          <h2 className="text-2xl font-black text-white">Why Consumers Lose Free Warranty Coverage</h2>
          <p className="text-xs text-slate-400">
            Over 68% of Indian consumers miss warranty claim windows due to lost thermal paper bills or forgotten purchase dates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">01</span>
            <h3 className="font-bold text-white text-sm">Faded Thermal Bills</h3>
            <p className="text-slate-400 leading-relaxed">
              Store receipts printed on thermal paper fade into blank sheets within 6-12 months, invalidating brand claims.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">02</span>
            <h3 className="font-bold text-white text-sm">Split Component Terms</h3>
            <p className="text-slate-400 leading-relaxed">
              ACs, fridges, and washing machines have 10-year motor/compressor warranties that users forget after 1-year product warranty ends.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">03</span>
            <h3 className="font-bold text-white text-sm">Unorganized Documents</h3>
            <p className="text-slate-400 leading-relaxed">
              When a machine breaks down, searching through physical drawers for model and serial numbers delays service for days.
            </p>
          </div>
        </div>
      </section>

      {/* How Asset Doctor Solves It */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black text-white">How Asset Doctor Manages Your Warranties</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A three-step zero-effort workflow from invoice scan to claim support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-white">Instant Invoice OCR</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload e-commerce PDFs or photos of paper bills. We automatically extract vendor, purchase date, serial number, and warranty period.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-mono font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-white">Live Countdown & Alerts</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Track real-time days remaining with proactive notifications at 30 days, 15 days, and 7 days before coverage expiration.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-white">Brand Directory & Claims</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              One-tap dial toll-free numbers or email authorized customer care for 50+ major brands including Samsung, LG, TVS, Daikin, and Whirlpool.
            </p>
          </div>
        </div>
      </section>

      {/* Free Tool Banner */}
      <section className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Check Your Warranty Expiry Date Online
          </h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Use our free interactive browser tool to calculate days remaining right now.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/tools/warranty-calculator')}
          className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-md"
        >
          Open Warranty Calculator
        </button>
      </section>
    </div>
  );
};
