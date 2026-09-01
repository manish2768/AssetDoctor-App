import React from 'react';
import {
  Sparkles,
  Shield,
  Lightbulb,
  Cpu,
  Layers,
  ArrowRight,
  ChevronRight,
  Compass,
  Zap,
  Car,
  Smartphone,
  Wrench,
  Sun,
  Briefcase,
  Home,
  CheckCircle2
} from 'lucide-react';

import { AssetDoctorLogo } from '../AssetDoctorLogo';
import { GooglePlayDownloadButton } from './GooglePlayDownloadButton';

interface AboutUsViewProps {
  onOpenVaultApp: () => void;
  onExploreAssets: () => void;
  onExploreTools: () => void;
}

export const AboutUsView: React.FC<AboutUsViewProps> = ({
  onOpenVaultApp,
  onExploreAssets,
  onExploreTools
}) => {
  return (
    <div className="w-full space-y-16 sm:space-y-20 max-w-5xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* 1. HERO SECTION */}
      <section className="text-center space-y-4 sm:space-y-6 pt-2 sm:pt-4 max-w-4xl mx-auto">
        <div className="flex justify-center">
          <AssetDoctorLogo size="lg" />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>The Asset Doctor Story</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.06]">
          Built to Understand <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Everything You Own.
          </span>
        </h1>

        <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Asset Doctor is a universal asset intelligence and lifecycle platform designed to help people understand, protect, maintain and manage the things that matter to them.
        </p>
      </section>

      {/* 2. FOUNDER SPOTLIGHT: ASHUTOSH RAI */}
      <section className="glass border border-white/10 rounded-3xl p-6 sm:p-10 bg-slate-900/80 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-emerald-400 uppercase font-black tracking-widest block">
                Meet the Builder
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Ashutosh Rai
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-400">
                Young Builder • Product Thinker • Creator of Asset Doctor
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Started building Asset Doctor at 14</span>
            </div>
          </div>

          {/* Core Narrative */}
          <div className="space-y-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-4xl">
            <p>
              Asset Doctor began with a simple question: why should managing the things we own be so complicated?
            </p>
            <p>
              From vehicles and smartphones to air conditioners, appliances, solar systems and business equipment, every important asset has a lifecycle.
            </p>
            <p>
              The idea behind Asset Doctor was to bring that lifecycle into one intelligent place.
            </p>
            <p>
              What makes the story unusual is the person behind the project — <strong>Ashutosh Rai</strong>, who began building Asset Doctor at just 14 years of age.
            </p>
            <p>
              Instead of seeing age as a limitation, Ashutosh approached the problem with curiosity, experimentation and a determination to learn by building.
            </p>
            <p>
              Asset Doctor represents that mindset: start with a real-world problem, understand it deeply, and build technology that can make everyday life simpler.
            </p>
            <p>
              The vision is not limited to cars or any single category. Asset Doctor is being designed around a much bigger idea — understanding every important asset a person, family or business owns.
            </p>
            <p>
              Over time, the platform is intended to become a long-term digital memory for assets: their documents, maintenance, warranties, lifecycle events, health, value and important decisions.
            </p>
            <p>
              The project combines product design, automation, document intelligence, asset lifecycle thinking and modern software architecture into one platform.
            </p>
            <p>
              For Ashutosh, Asset Doctor is more than a website or application; it is an ongoing experiment in turning a real-world idea into technology that can grow for years.
            </p>
            <p>
              The long-term vision is to make asset management as simple as checking your messages — intelligent, understandable, secure and available whenever you need it.
            </p>
            <p className="text-emerald-300 font-semibold pt-1">
              Asset Doctor is still evolving, but its foundation is simple: build useful technology, solve real problems and keep thinking bigger.
            </p>
          </div>

          {/* Builder Journey Timeline */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6">
              The Evolution of Asset Doctor
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-emerald-400 font-black">PHASE 1</span>
                <h4 className="text-sm font-bold text-white">IDEA</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Questioning why personal and household asset management was fractured across paper bills and apps.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-cyan-400 font-black">PHASE 2</span>
                <h4 className="text-sm font-bold text-white">PROTOTYPE</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Building the first working prototypes for document scanning, warranty tracking, and service schedules.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-teal-400 font-black">PHASE 3</span>
                <h4 className="text-sm font-bold text-white">ASSET INTELLIGENCE</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Developing algorithmic decision models including Repair vs. Replace, WDV depreciation, and health scores.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-indigo-400 font-black">PHASE 4</span>
                <h4 className="text-sm font-bold text-white">UNIVERSAL PLATFORM</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Expanding across all 6 asset universes: vehicles, electronics, appliances, solar, business, and living.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1.5">
                <span className="text-[10px] font-mono text-amber-400 font-black">PHASE 5</span>
                <h4 className="text-sm font-bold text-white">FUTURE VISION</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Long-term digital memory and universal asset passports making ownership effortless and transparent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHY WE BUILT ASSET DOCTOR */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-[11px] font-mono text-emerald-400 uppercase font-black tracking-widest block">
            The Problem We Solve
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Why We Built Asset Doctor
          </h2>
          <p className="text-sm text-slate-400">
            Ownership should provide value and peace of mind — not disorganized paperwork and surprise breakdowns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">Scattered & Lost Documents</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Invoices, insurance schedules, PUC certificates, and AMC policies end up scattered in email threads, physical folders, or lost entirely when needed.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">Forgotten Warranty Windows</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Over 60% of consumer electronics and appliance repairs are paid out of pocket simply because warranty deadlines expired unnoticed.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">Difficult Maintenance Schedules</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automotive odometer thresholds, 90-day AC filter cleanings, and solar inverter checkups are difficult to track without proactive alerts.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">The Repair vs. Replace Dilemma</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When high repair quotes arrive, owners struggle to determine whether repairing makes economic sense or if upgrading is financially rational.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">Unclear Asset Equity & Depreciation</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Asset values decline continuously, but without clear depreciation tracking, resale timing and insurance coverages become guesswork.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-bold text-white">Category-Specific Silos</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Existing software forces users into single-vertical apps (cars only, or IT only). Asset Doctor delivers one unified platform for everything.
            </p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-cyan-950/40 border border-emerald-500/20 text-center space-y-2">
          <p className="text-sm sm:text-base font-semibold text-emerald-200">
            Asset Doctor brings these lifecycle needs together into one universal asset intelligence experience.
          </p>
        </div>
      </section>

      {/* 4. WHAT ASSET DOCTOR UNDERSTANDS (6-UNIVERSE GRID) */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-[11px] font-mono text-cyan-400 uppercase font-black tracking-widest block">
            Universal Coverage
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            What Asset Doctor Understands
          </h2>
          <p className="text-sm text-slate-400">
            Category-aware lifecycle intelligence tailored to how different assets age and require care.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Car className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Vehicles</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cars, 2-wheelers, and electric vehicles with odometer tracking, OEM service intervals, fuel efficiency, and compliance alerts.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Electronics</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Smartphones, laptops, audio systems, and tablets with battery health diagnostics, warranty countdowns, and resale valuation.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Wrench className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Home Appliances</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Air conditioners, refrigerators, washing machines, and microwave ovens with 90-day maintenance schedules and energy efficiency tracking.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sun className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Solar & Energy</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Rooftop solar PV arrays, battery storage banks, and inverter systems with degradation surveillance and generation ROI tracking.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Business Assets</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Commercial printers, office workstations, servers, and machinery with vendor AMC management and WDV tax depreciation.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Home className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Home & Living</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Furniture, power tools, water purifiers, and home security equipment with automated document vaulting and care reminders.
            </p>
          </div>
        </div>
      </section>

      {/* 5. CALL TO ACTION */}
      <section className="glass border border-white/10 rounded-3xl p-8 sm:p-12 text-center space-y-6 bg-gradient-to-b from-slate-900/90 to-slate-950">
        <h2 className="text-2xl sm:text-3xl font-black text-white max-w-xl mx-auto">
          Ready to experience universal asset intelligence?
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Start for free as a guest with instant calculators, or open your private vault to protect your physical equity for years to come.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenVaultApp}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>Start Managing Your Assets</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <GooglePlayDownloadButton
            variant="hero"
            placement="about_cta"
            label="Download Now"
            sublabel="Google Play"
            showChevron
          />
          <button
            onClick={onExploreTools}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2"
          >
            <span>Explore Free Tools</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        <div className="pt-4 text-center">
          <p className="text-xs text-slate-400">
            Have questions or feedback for the builder? Email us at{' '}
            <a href="mailto:support@assetdoctor.in" className="text-emerald-400 font-mono font-bold hover:underline">
              support@assetdoctor.in
            </a>
          </p>
        </div>
      </section>
    </div>
  );
};
