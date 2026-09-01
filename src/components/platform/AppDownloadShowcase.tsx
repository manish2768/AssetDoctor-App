import React from 'react';
import {
  Shield,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Gauge,
  Zap,
  FileScan,
  Bell,
  CheckCircle2,
  Car,
  Cloud,
  Lock,
  BatteryCharging
} from 'lucide-react';
import { GooglePlayDownloadButton } from './GooglePlayDownloadButton';

/**
 * Asset Doctor — Premium App Download Showcase Section.
 *
 * Built to match the platform's existing dark design language
 * (#070D18 surfaces, emerald→teal→cyan accents, Inter font, glassmorphism,
 * rounded-2xl/3xl cards, mono eyebrow labels).
 *
 * The phone showcase is a pure CSS mockup reusing Asset Doctor branding and
 * the site's design tokens (no fabricated third-party screenshots were used).
 */

interface AppDownloadShowcaseProps {
  /** Optional callback to track when the secondary CTA scrolls to features. */
  onExploreFeatures?: () => void;
}

export const AppDownloadShowcase: React.FC<AppDownloadShowcaseProps> = ({
  onExploreFeatures
}) => {
  const handleExploreFeatures = () => {
    if (onExploreFeatures) {
      onExploreFeatures();
    } else {
      document.getElementById('platform-features')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureChips = [
    { label: 'Smart Asset Vault', Icon: Shield, accent: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/30', style: { top: '8%', left: '-3%' } },
    { label: 'Fuel & Mileage', Icon: Gauge, accent: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/30', style: { top: '30%', right: '-6%' } },
    { label: 'Energy Intelligence', Icon: Zap, accent: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/30', style: { bottom: '34%', left: '-7%' } },
    { label: 'Smart OCR', Icon: FileScan, accent: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-violet-500/30', style: { bottom: '12%', right: '-4%' } },
    { label: 'Renewal Alerts', Icon: Bell, accent: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/30', style: { bottom: '4%', left: '12%' } }
  ];

  return (
    <section className="relative w-full overflow-hidden" aria-labelledby="download-asset-doctor-heading">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -inset-x-8 -top-16 -bottom-16 opacity-60" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute right-[8%] top-[16%] w-[280px] h-[280px] rounded-full bg-cyan-500/10 blur-[90px]" />
        <div className="absolute left-[6%] bottom-[10%] w-[260px] h-[260px] rounded-full bg-teal-500/10 blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-6xl w-full rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 bg-[#0b1220]/70 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/40">
        {/* Inner top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" aria-hidden="true" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-6 items-center px-6 sm:px-10 lg:px-12 py-10 sm:py-14 lg:py-16">
          {/* -------------------------------------------------- */}
          {/* LEFT: Copy, CTAs, trust */}
          {/* -------------------------------------------------- */}
          <div className="text-center lg:text-left space-y-5">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider font-mono shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get the Mobile App</span>
            </div>

            {/* Headline */}
            <h2
              id="download-asset-doctor-heading"
              className="text-[28px] min-[390px]:text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold tracking-[-0.03em] text-white leading-[1.12]"
            >
              <span className="block text-white">Your Assets. Your Documents.</span>
              <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Your Peace of Mind.
              </span>
            </h2>

            {/* Supporting copy */}
            <p className="text-sm lg:text-[15px] text-slate-300 max-w-md mx-auto lg:mx-0 leading-relaxed">
              Take Asset Doctor with you. Manage your vehicles, warranties, documents, mileage and household assets — all from your phone.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center lg:items-stretch gap-3 pt-1">
              <GooglePlayDownloadButton
                variant="primary"
                placement="showcase"
                label="Get Asset Doctor on Google Play"
                className="w-full sm:w-auto lg:w-full xl:w-auto"
              />

              <button
                onClick={handleExploreFeatures}
                className="w-full sm:w-auto lg:w-full xl:w-auto px-6 sm:px-7 py-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2"
              >
                <span>Explore Asset Doctor</span>
                <ChevronRight className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            {/* Trust micro-line */}
            <div className="flex flex-col gap-3 pt-1">
              <p className="inline-flex items-center justify-center lg:justify-start gap-1.5 text-[11px] text-slate-400 font-medium flex-wrap">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Available on Android</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" aria-hidden="true" />
                <span>Official Google Play download</span>
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[11px] font-bold text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Secure Asset Vault
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  Smart Document Scanning
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  Vehicle &amp; Appliance Tracking
                </span>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------- */}
          {/* RIGHT: CSS Phone Showcase + floating feature chips */}
          {/* -------------------------------------------------- */}
          <div className="relative flex items-center justify-center py-4 lg:py-0" aria-hidden="true">
            {/* Glow behind phone */}
            <div className="absolute w-[300px] h-[440px] rounded-full bg-gradient-to-b from-emerald-500/25 via-teal-500/15 to-cyan-500/25 blur-3xl" />

            {/* Floating feature chips */}
            {featureChips.map(({ label, Icon, accent, border, glow, style }) => (
              <div
                key={label}
                className={`absolute z-20 hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl border ${border} bg-[#0b1220]/85 backdrop-blur-xl shadow-lg ${glow} ad-chip-float`}
                style={style}
              >
                <Icon className={`w-4 h-4 ${accent}`} />
                <span className="text-[11px] font-bold text-white whitespace-nowrap">{label}</span>
              </div>
            ))}

            {/* Phone frame */}
            <div className="relative w-[250px] sm:w-[270px] rounded-[2.6rem] border border-slate-700/70 bg-slate-950 p-2.5 shadow-2xl shadow-black/60 ad-phone-float">
              {/* Notch / punch + ambient rim */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-20 h-5 rounded-full bg-black/90 border border-slate-800 flex items-center justify-center gap-1.5">
                <span className="w-8 h-1.5 rounded-full bg-slate-800" />
              </div>

              {/* Screen */}
              <div className="relative w-full aspect-[9/19] rounded-[2.1rem] overflow-hidden bg-gradient-to-b from-[#0b1220] to-[#070d18] ring-1 ring-white/5">
                {/* App status bar */}
                <div className="flex items-center justify-between px-5 pt-6 text-[9px] font-bold text-slate-400">
                  <span>9:41</span>
                  <span className="flex items-center gap-1">
                    <BatteryCharging className="w-3 h-3 text-emerald-400" />
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                </div>

                {/* App header */}
                <div className="flex items-center gap-2 px-4 mt-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="leading-none">
                    <span className="text-[11px] font-black text-white">
                      Asset<span className="text-emerald-400">Doctor</span>
                    </span>
                    <span className="block text-[7px] text-slate-500 font-mono uppercase tracking-wider">Your Smart Vault</span>
                  </div>
                </div>

                {/* Metric tiles */}
                <div className="grid grid-cols-2 gap-2 px-4 mt-3">
                  <div className="col-span-2 rounded-xl bg-slate-900/80 border border-emerald-500/20 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Assets Vaulted</span>
                      <Shield className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-lg font-black text-white leading-none">24</span>
                    <span className="block text-[7px] text-emerald-400 font-semibold">All protected &amp; encrypted</span>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-cyan-500/20 p-2.5">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Warranty Soon</span>
                    <span className="text-base font-black text-amber-400 leading-none">3</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/80 border border-teal-500/20 p-2.5">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Health</span>
                    <span className="text-base font-black text-cyan-400 leading-none">87</span>
                  </div>
                </div>

                {/* Asset card */}
                <div className="mx-4 mt-2.5 rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black text-white block truncate">Honda City 1.5</span>
                      <span className="text-[7px] text-slate-500 font-mono uppercase">Vehicle • Active</span>
                    </div>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      62d
                    </span>
                  </div>
                </div>

                {/* Bottom nav */}
                <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[#0b1220]/90 border border-slate-800 p-1.5 flex items-center justify-around text-slate-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <Zap className="w-3.5 h-3.5" />
                  <FileScan className="w-3.5 h-3.5" />
                  <Bell className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped animations (kept local to avoid global keyframe collisions) */}
      <style>{`
        @keyframes adPhoneFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes adChipFloat {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        .ad-phone-float { animation: adPhoneFloat 6s ease-in-out infinite; }
        .ad-chip-float { animation: adChipFloat 5s ease-in-out infinite; }
        .ad-chip-float:nth-child(1) { animation-delay: 0s; }
        .ad-chip-float:nth-child(2) { animation-delay: 0.6s; }
        .ad-chip-float:nth-child(3) { animation-delay: 1.2s; }
        .ad-chip-float:nth-child(4) { animation-delay: 1.8s; }
        .ad-chip-float:nth-child(5) { animation-delay: 2.4s; }
        @media (prefers-reduced-motion: reduce) {
          .ad-phone-float, .ad-chip-float { animation: none; }
        }
      `}</style>
    </section>
  );
};
