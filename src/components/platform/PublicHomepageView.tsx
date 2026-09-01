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
  QrCode
} from 'lucide-react';
import { UniversalSearchBar } from './UniversalSearchBar';
import { PublicToolsGrid } from './tools/PublicToolsGrid';
import { DailyReturnEngine } from './DailyReturnEngine';
import { SmartDocumentAnalyzerTool } from './SmartDocumentAnalyzerTool';
import { RepairVsReplaceTool } from './RepairVsReplaceTool';
import { AssetHealthScoreTool } from './tools/AssetHealthScoreTool';
import { AssetPassportPreview } from './AssetPassportPreview';
import { ExploreYourAsset } from './tools/ExploreYourAsset';
import { SmartKnowledgeHub } from './knowledge/SmartKnowledgeHub';
import { PlatformFaqSection } from './PlatformFaqSection';
import { AppDownloadShowcase } from './AppDownloadShowcase';
import { GooglePlayDownloadButton } from './GooglePlayDownloadButton';

interface PublicHomepageViewProps {
  onSelectTool: (toolSlug: string) => void;
  onSelectKnowledge: (profileId: string) => void;
  onOpenVaultApp: () => void;
  onOpenLoginModal?: () => void;
}

export const PublicHomepageView: React.FC<PublicHomepageViewProps> = ({
  onSelectTool,
  onSelectKnowledge,
  onOpenVaultApp,
  onOpenLoginModal
}) => {
  return (
    <div className="w-full space-y-16 sm:space-y-20 lg:space-y-24">
      {/* ============================================================ */}
      {/* 2. HERO SECTION */}
      {/* ============================================================ */}
      <section className="text-center space-y-4 sm:space-y-6 pt-2 sm:pt-6 max-w-4xl mx-auto px-4">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider font-mono shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Universal Asset Intelligence Platform</span>
        </div>

        {/* Refined Balanced Headline */}
        <h1 className="text-[32px] min-[390px]:text-[36px] sm:text-[46px] md:text-[52px] lg:text-[60px] xl:text-[68px] font-extrabold tracking-[-0.035em] text-white leading-[1.08] sm:leading-[1.04] lg:leading-[1.01] max-w-4xl mx-auto">
          <span className="block text-white">Everything you own.</span>
          <span className="block mt-1 sm:mt-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            One intelligent place to manage it.
          </span>
        </h1>

        {/* Proportional Supporting Copy */}
        <p className="text-sm sm:text-base lg:text-[17px] text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Track, protect, maintain and understand every important asset you own. Universal lifecycle intelligence across vehicles, electronics, appliances, and business equipment.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1 sm:pt-2">
          <button
            onClick={onOpenVaultApp}
            className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>Start Managing Your Assets</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectTool('assets/explore')}
            className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-800 hover:border-slate-700 flex items-center justify-center gap-2"
          >
            <span>Explore Asset Intelligence</span>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </button>
          {/* Refined Premium Google Play download CTA */}
          <GooglePlayDownloadButton
            variant="hero"
            placement="hero"
            label="Download Now"
            sublabel="Google Play"
            showChevron
          />
        </div>

        {/* Supported Asset Universe Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:pt-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors">
            <Car className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vehicles</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors">
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Electronics</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors">
            <Wrench className="w-3.5 h-3.5 text-teal-400" />
            <span>Home Appliances</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors">
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <span>Solar & Energy</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 transition-colors">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Business Assets</span>
          </span>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2.5. PREMIUM APP DOWNLOAD SHOWCASE */}
      {/* ============================================================ */}
      <section id="app-download-showcase" className="w-full">
        <AppDownloadShowcase
          onExploreFeatures={() => {
            const el = document.getElementById('platform-features');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>

      {/* ============================================================ */}
      {/* 3 & 4. SMART SEARCH & TRENDING QUESTIONS */}
      {/* ============================================================ */}
      <section className="w-full">
        <UniversalSearchBar
          onSelectKnowledge={onSelectKnowledge}
          onSelectTool={onSelectTool}
        />
      </section>

      {/* ============================================================ */}
      {/* 5. UNIVERSAL ASSET CATEGORIES */}
      {/* ============================================================ */}
      <section className="w-full">
        <ExploreYourAsset
          onSelectKnowledge={onSelectKnowledge}
          onSelectTool={onSelectTool}
        />
      </section>

      {/* ============================================================ */}
      {/* 6. FREE INTELLIGENT TOOLS */}
      {/* ============================================================ */}
      <section id="platform-features" className="w-full">
        <PublicToolsGrid onSelectTool={onSelectTool} />
      </section>

      {/* ============================================================ */}
      {/* 7. WHAT SHOULD I DO TODAY? */}
      {/* ============================================================ */}
      <section className="w-full">
        <DailyReturnEngine
          onOpenVault={onOpenVaultApp}
          onActionClick={() => onOpenVaultApp()}
        />
      </section>

      {/* ============================================================ */}
      {/* 8. DOCUMENT INTELLIGENCE */}
      {/* ============================================================ */}
      <section className="w-full">
        <SmartDocumentAnalyzerTool onSaveToVault={onOpenVaultApp} />
      </section>

      {/* ============================================================ */}
      {/* 9. REPAIR VS REPLACE FEATURE */}
      {/* ============================================================ */}
      <section className="w-full space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-mono">
            Featured Decision Engine
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Repair or Replace Calculator
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Compare repair quotes against asset depreciation and remaining lifespan using the 50% economic rule.
          </p>
        </div>
        <RepairVsReplaceTool onSaveToVault={onOpenVaultApp} />
      </section>

      {/* ============================================================ */}
      {/* 10. ASSET HEALTH SCORE */}
      {/* ============================================================ */}
      <section className="w-full">
        <AssetHealthScoreTool onSaveToVault={onOpenVaultApp} />
      </section>

      {/* ============================================================ */}
      {/* 11. ASSET PASSPORT */}
      {/* ============================================================ */}
      <section className="w-full">
        <AssetPassportPreview onOpenVault={onOpenVaultApp} />
      </section>

      {/* ============================================================ */}
      {/* 12. HOW ASSET DOCTOR WORKS (3-STEP VISUAL MICRO-GUIDE) */}
      {/* ============================================================ */}
      <section className="w-full max-w-5xl mx-auto space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>Effortless Asset Intelligence</span>
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
              Add your car, bike, smartphone, AC, washing machine, solar inverter, or living assets in seconds.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 font-mono font-black text-sm flex items-center justify-center">
              02
            </div>
            <h3 className="text-base font-black text-white">2. Scan & Understand</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scan purchase bills, service cards, or warranty documents. Our OCR extracts terms, taxes, and dates automatically.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono font-black text-sm flex items-center justify-center">
              03
            </div>
            <h3 className="text-base font-black text-white">3. Stay Ahead</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Get proactive WhatsApp & in-app alerts for maintenance milestones, warranty expiry, and repair guidance.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 13. KNOWLEDGE HUB / GUIDES */}
      {/* ============================================================ */}
      <section className="w-full">
        <SmartKnowledgeHub
          onSelectCalculator={onSelectTool}
          onOpenVaultApp={onOpenVaultApp}
        />
      </section>

      {/* ============================================================ */}
      {/* 14. FAQ ACCORDION SECTION */}
      {/* ============================================================ */}
      <section className="w-full">
        <PlatformFaqSection />
      </section>

      {/* ============================================================ */}
      {/* 15. CTA & SECURITY */}
      {/* ============================================================ */}
      <section className="w-full max-w-5xl mx-auto space-y-8">
        {/* Repeat Utility Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-8 sm:p-10 space-y-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider font-mono">
                <Repeat className="w-3.5 h-3.5" />
                <span>Repeat Daily Utility</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Useful Every Time You Need It
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Return whenever you have a new asset, repair quote, service bill, warranty question, or maintenance checklist. No login required to run calculations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onSelectTool('tools/repair-or-replace')}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer border border-slate-700 text-center"
              >
                Repair Decision Tool
              </button>
              <button
                onClick={onOpenVaultApp}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/20 text-center flex items-center justify-center gap-2"
              >
                <span>Open My Vault</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Security & Privacy */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
              Enterprise Grade Security
            </span>
            <h2 className="text-2xl font-black text-white">
              Your Assets. Your Private Encrypted Vault.
            </h2>
            <p className="text-xs text-slate-400">
              Strict client-side encryption and zero advertiser data sharing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Key className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-white text-sm">Client-Side Vault Encryption</h4>
              <p className="text-slate-400 leading-relaxed">
                Your sensitive documents and serial numbers are stored with AES-256 military-grade encryption keys.
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
        </div>
      </section>
    </div>
  );
};
