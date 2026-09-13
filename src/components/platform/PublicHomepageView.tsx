import React from 'react';
import {
  Shield,
  Sparkles,
  ArrowRight,
  Plus,
  Lock,
  EyeOff,
  CheckCircle2,
  Car,
  Smartphone,
  Wrench,
  Home,
  Layers,
  ChevronRight,
  Database,
  Key,
  ShieldCheck,
  Zap,
  Repeat,
  HelpCircle,
  FileSearch,
  Activity,
  QrCode,
  Download,
  Calendar,
  Clock,
  Droplets,
  Wind,
  Flame,
  BookOpen
} from 'lucide-react';
import { UniversalSearchBar } from './UniversalSearchBar';
import { DailyReturnEngine } from './DailyReturnEngine';
import { SmartDocumentAnalyzerTool } from './SmartDocumentAnalyzerTool';
import { RepairVsReplaceTool } from './RepairVsReplaceTool';
import { AssetHealthScoreTool } from './tools/AssetHealthScoreTool';
import { AssetPassportPreview } from './AssetPassportPreview';
import { PlatformFaqSection } from './PlatformFaqSection';
import { AppDownloadShowcase } from './AppDownloadShowcase';
import { GooglePlayDownloadButton } from './GooglePlayDownloadButton';

interface PublicHomepageViewProps {
  onSelectTool: (toolSlug: string) => void;
  onSelectKnowledge: (profileId: string) => void;
  onOpenVaultApp: () => void;
  onOpenLoginModal?: () => void;
  onNavigate?: (path: string) => void;
}

export const PublicHomepageView: React.FC<PublicHomepageViewProps> = ({
  onSelectTool,
  onSelectKnowledge,
  onOpenVaultApp,
  onOpenLoginModal,
  onNavigate = onSelectTool
}) => {
  return (
    <div className="w-full space-y-16 sm:space-y-20 lg:space-y-24">
      {/* ============================================================ */}
      {/* 1. HERO SECTION: "Your Home & Vehicle Doctor" */}
      {/* ============================================================ */}
      <section className="text-center space-y-5 sm:space-y-6 pt-2 sm:pt-6 max-w-4xl mx-auto px-4">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider font-mono shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Asset Doctor — Your Home & Vehicle Doctor</span>
        </div>

        {/* Refined Balanced Headline */}
        <h1 className="text-[32px] min-[390px]:text-[38px] sm:text-[48px] md:text-[56px] lg:text-[64px] font-extrabold tracking-[-0.035em] text-white leading-[1.08] sm:leading-[1.04] max-w-4xl mx-auto">
          <span className="block text-white">Your Home & Vehicle Doctor</span>
          <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Protect, Track & Save on Everything You Own
          </span>
        </h1>

        {/* Supporting Copy */}
        <p className="text-sm sm:text-base lg:text-[17px] text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Manage your <strong>Vehicles</strong>, <strong>Home Appliances</strong>, <strong>Warranties</strong>, <strong>Documents</strong>, <strong>Maintenance</strong>, <strong>Smart QR</strong>, and <strong>Asset Health</strong> with proactive alerts.
        </p>

        {/* Primary & Secondary CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {/* Primary CTA: "Download Asset Doctor" */}
          <button
            onClick={() => onNavigate('/download')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset Doctor</span>
          </button>

          {/* Secondary CTA: "Explore Free Tools" */}
          <button
            onClick={() => {
              const el = document.getElementById('free-tools-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else onNavigate('/tools');
            }}
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2"
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>Explore Free Tools</span>
          </button>

          {/* Google Play Download Badge */}
          <GooglePlayDownloadButton
            variant="hero"
            placement="hero"
            label="Google Play"
            sublabel="Direct Install"
            showChevron
          />
        </div>

        {/* Value Prop Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
          {[
            { label: 'Vehicles', path: '/vehicle-doctor', icon: Car },
            { label: 'Home Appliances', path: '/appliance-doctor', icon: Wrench },
            { label: 'Warranties', path: '/warranty', icon: ShieldCheck },
            { label: 'Documents', path: '/vehicle-doctor/documents', icon: FileSearch },
            { label: 'Maintenance', path: '/maintenance', icon: Clock },
            { label: 'Smart QR', path: '/smart-qr', icon: QrCode },
            { label: 'Asset Health', path: '/tools/asset-health-score', icon: Activity }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(item.path)}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. SECTION: "Manage Everything You Own" */}
      {/* ============================================================ */}
      <section className="w-full max-w-6xl mx-auto space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
            <Layers className="w-3.5 h-3.5" />
            <span>Universal Asset Vault</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Manage Everything You Own
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            From cars and bikes to air conditioners and kitchen appliances, Asset Doctor is your digital memory for invoices, service dates, warranties, and maintenance.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Vehicles */}
          <div
            onClick={() => onNavigate('/vehicle-doctor')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Car className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">Vehicles</h3>
              <p className="text-xs text-slate-400">Cars, bikes, scooters, RC, insurance & PUC tracking.</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 pt-1">
              <span>Explore Vehicle Doctor</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* AC */}
          <div
            onClick={() => onNavigate('/appliance-doctor/ac')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wind className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">Air Conditioners (AC)</h3>
              <p className="text-xs text-slate-400">90-day filter cleans, power cost estimation, compressor warranty.</p>
            </div>
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1 pt-1">
              <span>Manage AC</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Refrigerator */}
          <div
            onClick={() => onNavigate('/appliance-doctor/refrigerator')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition">Refrigerator</h3>
              <p className="text-xs text-slate-400">Compressor warranty, door seal tests, defrost upkeep.</p>
            </div>
            <span className="text-xs font-bold text-teal-400 flex items-center gap-1 pt-1">
              <span>Manage Fridge</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Washing Machine */}
          <div
            onClick={() => onNavigate('/appliance-doctor/washing-machine')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition">Washing Machine</h3>
              <p className="text-xs text-slate-400">Drum descaling, vibration leveling, motor warranty vault.</p>
            </div>
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1 pt-1">
              <span>Manage Washer</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* RO Purifiers */}
          <div
            onClick={() => onNavigate('/appliance-doctor/ro')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Droplets className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition">RO Purifier</h3>
              <p className="text-xs text-slate-400">Pre-filter, carbon cartridge, and RO membrane renewals.</p>
            </div>
            <span className="text-xs font-bold text-sky-400 flex items-center gap-1 pt-1">
              <span>Manage RO</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Geyser */}
          <div
            onClick={() => onNavigate('/appliance-doctor/geyser')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Flame className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition">Geyser / Water Heater</h3>
              <p className="text-xs text-slate-400">Anode rod replacement, tank warranty & safety checks.</p>
            </div>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1 pt-1">
              <span>Manage Geyser</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Kitchen Appliances (Chimney & Microwave) */}
          <div
            onClick={() => onNavigate('/appliance-doctor/chimney')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Home className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition">Kitchen Chimney & Ovens</h3>
              <p className="text-xs text-slate-400">Baffle filter degreasing, magnetron tube protection.</p>
            </div>
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1 pt-1">
              <span>Manage Kitchen</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Other Assets */}
          <div
            onClick={() => onNavigate('/assets/explore')}
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">Other Assets</h3>
              <p className="text-xs text-slate-400">Smartphones, laptops, solar power systems & furniture.</p>
            </div>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 pt-1">
              <span>Explore All Assets</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. SECTION: "Free Tools" */}
      {/* ============================================================ */}
      <section id="free-tools-section" className="w-full max-w-6xl mx-auto space-y-6 px-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Calculators</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Free Asset Tools
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            100% free interactive browser calculators designed to give you instant, accurate answers for the things you own. No registration required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Warranty Calculator */}
          <div
            onClick={() => onNavigate('/tools/warranty-calculator')}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-3 flex flex-col justify-between group shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition">
                Warranty Calculator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter purchase date and warranty tenure to calculate exact expiry date, days remaining, and active claim status.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 pt-2 border-t border-slate-800">
              <span>Calculate Warranty</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* AC Electricity Calculator */}
          <div
            onClick={() => onNavigate('/tools/ac-electricity-calculator')}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer space-y-3 flex flex-col justify-between group shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">
                AC Electricity Calculator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Estimate daily, monthly, and seasonal power units (kWh) and electricity bill in rupees based on tonnage and star rating.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1 pt-2 border-t border-slate-800">
              <span>Calculate AC Bill</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Asset Age Calculator */}
          <div
            onClick={() => onNavigate('/tools/asset-age-calculator')}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition cursor-pointer space-y-3 flex flex-col justify-between group shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
                Asset Age Calculator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Determine the exact age of your vehicle, appliance, or gadget in years, months, and days from the invoice date.
              </p>
            </div>
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1 pt-2 border-t border-slate-800">
              <span>Calculate Asset Age</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Service Due Calculator */}
          <div
            onClick={() => onNavigate('/tools/service-due-calculator')}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-teal-500/50 transition cursor-pointer space-y-3 flex flex-col justify-between group shadow-lg"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-teal-300 transition">
                Service Due Calculator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Predict your next car, bike, or appliance maintenance date using whichever-comes-first odometer and calendar rules.
              </p>
            </div>
            <span className="text-xs font-bold text-teal-400 flex items-center gap-1 pt-2 border-t border-slate-800">
              <span>Calculate Service Due</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Repair vs Replace */}
          <div
            onClick={() => onNavigate('/tools/repair-vs-replace')}
            className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 transition cursor-pointer space-y-3 flex flex-col justify-between group shadow-lg sm:col-span-2 lg:col-span-2"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition">
                Repair vs Replace Calculator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Should you repair damaged equipment or buy a new replacement? Compare quotes against depreciation value using the 50% economic rule.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1 pt-2 border-t border-slate-800">
              <span>Calculate Repair Viability</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. SECTION: "Learn & Protect" (Blog Categories & Articles) */}
      {/* ============================================================ */}
      <section className="w-full max-w-6xl mx-auto space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Asset Doctor Knowledge Hub</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Learn & Protect
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Practical, India-focused guides and maintenance tips in simple Hindi and English.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/blog')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Explore all articles</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: 'Vehicles', desc: 'Car & Bike maintenance', path: '/blog/category/vehicles', icon: Car },
            { name: 'Appliances', desc: 'AC, Fridge, RO & Washers', path: '/blog/category/appliances', icon: Wrench },
            { name: 'Warranty', desc: 'Bills & claim support', path: '/blog/category/warranty', icon: ShieldCheck },
            { name: 'Maintenance', desc: 'Preventive upkeep schedules', path: '/blog/category/maintenance', icon: Clock }
          ].map((cat, i) => {
            const Icon = cat.icon;
            return (
              <div
                key={i}
                onClick={() => onNavigate(cat.path)}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer space-y-1.5"
              >
                <Icon className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                <p className="text-[11px] text-slate-400">{cat.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Featured Guides Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div
            onClick={() => onNavigate('/blog/ac-service-kitne-mahine-mein-karni-chahiye')}
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-[10px] uppercase font-bold text-cyan-400">AC Care</span>
            <h4 className="font-bold text-white text-sm">AC Service कितने महीने में करनी चाहिए?</h4>
            <p className="text-slate-400">90-day mesh filter cleaning rules and pre-summer jet foam wash schedule.</p>
          </div>

          <div
            onClick={() => onNavigate('/blog/car-service-kitne-km-par-karni-chahiye')}
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-[10px] uppercase font-bold text-emerald-400">Automotive</span>
            <h4 className="font-bold text-white text-sm">Car Service कितने KM पर करनी चाहिए?</h4>
            <p className="text-slate-400">Whichever-comes-first odometer and calendar rules for Indian cars.</p>
          </div>

          <div
            onClick={() => onNavigate('/blog/product-warranty-kaise-check-kare')}
            className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2"
          >
            <span className="text-[10px] uppercase font-bold text-teal-400">Warranty Vault</span>
            <h4 className="font-bold text-white text-sm">Product Warranty कैसे Check करें?</h4>
            <p className="text-slate-400">How to look up serial numbers and claim coverage even if paper bills are lost.</p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. APP DOWNLOAD SHOWCASE */}
      {/* ============================================================ */}
      <section id="app-download-showcase" className="w-full">
        <AppDownloadShowcase
          onExploreFeatures={() => {
            const el = document.getElementById('free-tools-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>

      {/* ============================================================ */}
      {/* 6. UNIVERSAL SEARCH BAR */}
      {/* ============================================================ */}
      <section className="w-full">
        <UniversalSearchBar
          onSelectKnowledge={onSelectKnowledge}
          onSelectTool={onSelectTool}
        />
      </section>

      {/* ============================================================ */}
      {/* 7. HOW ASSET DOCTOR WORKS (3-STEP GUIDE) */}
      {/* ============================================================ */}
      <section className="w-full max-w-5xl mx-auto space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>Simple 3-Step Protection</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            How Asset Doctor Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Three simple steps to complete lifecycle intelligence and proactive reminders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-black text-sm flex items-center justify-center">
              01
            </div>
            <h3 className="text-base font-black text-white">1. Add Your Asset</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add your car, bike, AC, refrigerator, washing machine, RO purifier, or smartphone in seconds.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 font-mono font-black text-sm flex items-center justify-center">
              02
            </div>
            <h3 className="text-base font-black text-white">2. Scan Invoice or Policy</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload purchase bills or service cards. Our OCR extracts serial numbers, warranty terms, and service dates automatically.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm flex items-center justify-center">
              03
            </div>
            <h3 className="text-base font-black text-white">3. Relax & Stay Ahead</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Get timely WhatsApp and in-app alerts for maintenance milestones, warranty expiry, and repair guidance.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 8. FAQ ACCORDION */}
      {/* ============================================================ */}
      <section className="w-full">
        <PlatformFaqSection />
      </section>

      {/* ============================================================ */}
      {/* 9. SECURITY & DATA PRIVACY */}
      {/* ============================================================ */}
      <section className="w-full max-w-5xl mx-auto space-y-6 text-center">
        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
            Zero-Advertiser Security
          </span>
          <h2 className="text-2xl font-black text-white">
            Your Assets. Your Private Encrypted Vault.
          </h2>
          <p className="text-xs text-slate-400">
            Strict client-side encryption, zero advertiser data sharing, and complete DPDP compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-left">
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Key className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-white text-sm">Client-Side Encryption</h4>
            <p className="text-slate-400 leading-relaxed">
              Your sensitive documents and serial numbers are encrypted with bank-grade security standards.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <EyeOff className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-white text-sm">Zero Advertiser Sharing</h4>
            <p className="text-slate-400 leading-relaxed">
              We never sell your asset details, purchase history, or contact records to third-party advertisers.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-white text-sm">DPDP & GDPR Compliant</h4>
            <p className="text-slate-400 leading-relaxed">
              Full data portability, single-click export, and permanent right-to-be-forgotten deletion controls.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
