import React, { useState } from 'react';
import {
  Shield,
  Sparkles,
  Zap,
  Activity,
  TrendingDown,
  QrCode,
  FileText,
  Search,
  Lock,
  ArrowRight,
  Layers,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  User,
  LogOut
} from 'lucide-react';
import { UniversalSearchBar } from './UniversalSearchBar';
import { DailyReturnEngine } from './DailyReturnEngine';
import { UniversalAssetExplorer } from './UniversalAssetExplorer';
import { SmartDocumentAnalyzerTool } from './SmartDocumentAnalyzerTool';
import { RepairVsReplaceTool } from './RepairVsReplaceTool';
import { AssetHealthPreviewTool } from './AssetHealthPreviewTool';
import { AssetPassportPreview } from './AssetPassportPreview';
import { SeoToolPageTemplate } from './SeoToolPageTemplate';
import { SeoRegistry } from '../../platform/seo/seoRegistry';

interface PublicPlatformViewProps {
  onOpenAppVault: () => void;
  onOpenLoginModal?: () => void;
  currentUser?: any;
}

export type PlatformTab =
  | 'daily_actions'
  | 'asset_explorer'
  | 'doc_analyzer'
  | 'repair_vs_replace'
  | 'health_check'
  | 'passport'
  | 'seo_page';

export const PublicPlatformView: React.FC<PublicPlatformViewProps> = ({
  onOpenAppVault,
  onOpenLoginModal,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('daily_actions');
  const [activeSeoSlug, setActiveSeoSlug] = useState<string>('tools/warranty-checker');

  const handleNavigateToSeoPage = (slug: string) => {
    setActiveSeoSlug(slug);
    setActiveTab('seo_page');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Global Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#070D18]/90 backdrop-blur-2xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Positioning */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('daily_actions')}>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg sm:text-xl tracking-tight text-white font-sans">
                Asset<span className="text-emerald-400">Doctor</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                v2.8 Universal
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden md:block">
              Universal Asset Intelligence & Lifecycle Platform
            </p>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 border border-slate-800/90 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('daily_actions')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'daily_actions' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            What to Do Today
          </button>
          <button
            onClick={() => setActiveTab('asset_explorer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Asset Explorer
          </button>
          <button
            onClick={() => setActiveTab('doc_analyzer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'doc_analyzer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Document Analyzer
          </button>
          <button
            onClick={() => setActiveTab('repair_vs_replace')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'repair_vs_replace' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Repair vs. Replace
          </button>
          <button
            onClick={() => setActiveTab('health_check')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'health_check' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Health Score
          </button>
          <button
            onClick={() => setActiveTab('passport')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'passport' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Passport
          </button>
        </nav>

        {/* Right: Enter App Vault Button */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              onClick={onOpenAppVault}
              className="px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <span>My Vault App</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal || onOpenAppVault}
              className="px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <span>Open Vault</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero & Universal Search Section */}
      <section className="relative px-4 sm:px-8 pt-10 pb-8 text-center space-y-6 overflow-hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Universal Asset Intelligence Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Know What You Own.<br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Know What It Needs.
            </span>
          </h1>

          <p className="text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Universal asset tracking, warranty protection, OEM service predictions, and fair market valuation across vehicles, electronics, appliances, and home living.
          </p>

          {/* Universal Search Bar */}
          <div className="pt-2">
            <UniversalSearchBar onSelectResult={(res) => {
              if (res.moduleId) setActiveTab('asset_explorer');
            }} />
          </div>
        </div>
      </section>

      {/* 3. Main Content View Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 pb-16 space-y-8">
        {/* Mobile Navigation Tabs */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setActiveTab('daily_actions')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'daily_actions' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            What to Do Today
          </button>
          <button
            onClick={() => setActiveTab('asset_explorer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Asset Explorer
          </button>
          <button
            onClick={() => setActiveTab('doc_analyzer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'doc_analyzer' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Doc Analyzer
          </button>
          <button
            onClick={() => setActiveTab('repair_vs_replace')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'repair_vs_replace' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Repair vs. Replace
          </button>
          <button
            onClick={() => setActiveTab('health_check')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'health_check' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Health Score
          </button>
        </div>

        {/* Tab View Switcher */}
        {activeTab === 'daily_actions' && (
          <div className="space-y-10">
            <DailyReturnEngine onActionClick={() => onOpenAppVault()} />
            <UniversalAssetExplorer />
          </div>
        )}

        {activeTab === 'asset_explorer' && (
          <UniversalAssetExplorer />
        )}

        {activeTab === 'doc_analyzer' && (
          <SmartDocumentAnalyzerTool />
        )}

        {activeTab === 'repair_vs_replace' && (
          <RepairVsReplaceTool />
        )}

        {activeTab === 'health_check' && (
          <AssetHealthPreviewTool />
        )}

        {activeTab === 'passport' && (
          <AssetPassportPreview />
        )}

        {activeTab === 'seo_page' && (
          <SeoToolPageTemplate
            pageDefinition={SeoRegistry.getPage(activeSeoSlug) || SeoRegistry.getPage('tools/warranty-checker')!}
            onNavigateToTool={handleNavigateToSeoPage}
            onOpenApp={onOpenAppVault}
          />
        )}
      </main>

      {/* 4. Global Platform Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 sm:px-8 py-10 text-xs text-slate-400 space-y-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-white text-base">Asset Doctor</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The Universal Asset Intelligence & Lifecycle Platform. Crafted by Ashutosh (14) for 10-year scalable asset surveillance.
            </p>
          </div>

          {/* Free Tools */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider block mb-2">
              Free Intelligent Tools
            </span>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={() => handleNavigateToSeoPage('tools/warranty-checker')} className="hover:text-emerald-400 cursor-pointer">
                  Warranty Checker & Tracker
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToSeoPage('tools/repair-or-replace')} className="hover:text-emerald-400 cursor-pointer">
                  Repair vs. Replace Calculator
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToSeoPage('tools/document-analyzer')} className="hover:text-emerald-400 cursor-pointer">
                  Smart Bill & Invoice Analyzer
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToSeoPage('tools/vehicle-service-calculator')} className="hover:text-emerald-400 cursor-pointer">
                  Vehicle Service Calculator
                </button>
              </li>
            </ul>
          </div>

          {/* Category Intelligence Hubs */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider block mb-2">
              Asset Categories
            </span>
            <ul className="space-y-1.5 text-[11px]">
              <li><button onClick={() => setActiveTab('asset_explorer')} className="hover:text-emerald-400 cursor-pointer">Vehicles & Automotive</button></li>
              <li><button onClick={() => setActiveTab('asset_explorer')} className="hover:text-emerald-400 cursor-pointer">Smartphones & Electronics</button></li>
              <li><button onClick={() => setActiveTab('asset_explorer')} className="hover:text-emerald-400 cursor-pointer">Home Appliances (AC, Geyser)</button></li>
              <li><button onClick={() => setActiveTab('asset_explorer')} className="hover:text-emerald-400 cursor-pointer">Home Living & Solar</button></li>
            </ul>
          </div>

          {/* Security & Access */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider block mb-2">
              Platform Security
            </span>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Client-Side Encrypted Storage</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Third-Party Ad Trackers</span>
              </div>
              <a href="/admin" className="text-slate-500 hover:text-slate-400 block pt-1 font-mono">
                Admin Control Center &rarr;
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>&copy; 2026 Asset Doctor Platform. All rights reserved. Servivault v2.8 Live PWA.</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-slate-400">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-400">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
