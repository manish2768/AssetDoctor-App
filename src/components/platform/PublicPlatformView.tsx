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
  LogOut,
  Wrench,
  ShieldCheck,
  CalendarCheck,
  FileSearch,
  DollarSign
} from 'lucide-react';
import { PublicHomepageView } from './PublicHomepageView';
import { SmartKnowledgeHub } from './knowledge/SmartKnowledgeHub';
import { UniversalDailyToolsHub } from './tools/UniversalDailyToolsHub';
import { RepairVsReplaceTool } from './RepairVsReplaceTool';
import { MaintenanceCheckerTool } from './tools/MaintenanceCheckerTool';
import { AssetHealthScoreTool } from './tools/AssetHealthScoreTool';
import { SmartDocumentAnalyzerTool } from './SmartDocumentAnalyzerTool';
import { ExploreYourAsset } from './tools/ExploreYourAsset';
import { AssetPassportPreview } from './AssetPassportPreview';
import { SeoToolPageTemplate } from './SeoToolPageTemplate';
import { SeoRegistry } from '../../platform/seo/seoRegistry';
import { KnowledgeCategory } from '../../platform/knowledge/knowledgeHubData';

interface PublicPlatformViewProps {
  onOpenAppVault: () => void;
  onOpenLoginModal?: () => void;
  currentUser?: any;
}

export type PlatformTab =
  | 'home'
  | 'knowledge_hub'
  | 'tools_hub'
  | 'repair_vs_replace'
  | 'warranty_checker'
  | 'maintenance_checker'
  | 'health_score'
  | 'invoice_analyzer'
  | 'asset_explorer'
  | 'passport'
  | 'seo_page';

export const PublicPlatformView: React.FC<PublicPlatformViewProps> = ({
  onOpenAppVault,
  onOpenLoginModal,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('home');
  const [activeKnowledgeCat, setActiveKnowledgeCat] = useState<KnowledgeCategory | undefined>(undefined);
  const [activeSeoSlug, setActiveSeoSlug] = useState<string>('tools/warranty-checker');

  const handleNavigateToKnowledge = (cat?: KnowledgeCategory) => {
    setActiveKnowledgeCat(cat);
    setActiveTab('knowledge_hub');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToTool = (slug: string) => {
    if (slug === 'tools/repair-or-replace') {
      setActiveTab('repair_vs_replace');
    } else if (slug === 'tools/maintenance-checker') {
      setActiveTab('maintenance_checker');
    } else if (slug === 'tools/asset-health-score') {
      setActiveTab('health_score');
    } else if (slug === 'tools/invoice-analyzer' || slug === 'tools/document-analyzer') {
      setActiveTab('invoice_analyzer');
    } else if (slug === 'tools/warranty-checker' || slug === 'tools/ownership-cost' || slug === 'tools/asset-depreciation') {
      setActiveSeoSlug(slug);
      setActiveTab('seo_page');
    } else {
      setActiveSeoSlug(slug);
      setActiveTab('seo_page');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Global Header Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#070D18]/90 backdrop-blur-2xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Logo & Universal Positioning */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
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

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 border border-slate-800/90 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('tools_hub')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tools_hub' || activeTab === 'repair_vs_replace' || activeTab === 'maintenance_checker' || activeTab === 'health_score'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Free Tools
          </button>
          <button
            onClick={() => handleNavigateToKnowledge()}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'knowledge_hub' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Knowledge Hub
          </button>
          <button
            onClick={() => setActiveTab('asset_explorer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Explore Assets
          </button>
          <button
            onClick={() => setActiveTab('invoice_analyzer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'invoice_analyzer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bill Analyzer
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
            <div className="flex items-center gap-2">
              {onOpenLoginModal && (
                <button
                  onClick={onOpenLoginModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/80 cursor-pointer hidden sm:block"
                >
                  Sign In
                </button>
              )}
              <button
                onClick={onOpenAppVault}
                className="px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <span>Enter Vault</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Mobile Navigation Bar */}
        <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('tools_hub')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'tools_hub' || activeTab === 'repair_vs_replace' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Free Tools
          </button>
          <button
            onClick={() => handleNavigateToKnowledge()}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'knowledge_hub' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Knowledge Hub
          </button>
          <button
            onClick={() => setActiveTab('asset_explorer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Explore Assets
          </button>
          <button
            onClick={() => setActiveTab('invoice_analyzer')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'invoice_analyzer' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Bill Analyzer
          </button>
        </div>

        {/* Dynamic Route View Switcher */}
        {activeTab === 'home' && (
          <PublicHomepageView
            onSelectTool={handleNavigateToTool}
            onSelectKnowledge={(id) => handleNavigateToKnowledge()}
            onOpenVaultApp={onOpenAppVault}
            onOpenLoginModal={onOpenLoginModal}
          />
        )}

        {activeTab === 'tools_hub' && (
          <UniversalDailyToolsHub
            onSaveToVault={onOpenAppVault}
          />
        )}

        {activeTab === 'repair_vs_replace' && (
          <div className="space-y-6">
            <RepairVsReplaceTool onSaveToVault={onOpenAppVault} />
          </div>
        )}

        {activeTab === 'maintenance_checker' && (
          <div className="space-y-6">
            <MaintenanceCheckerTool onSaveToVault={onOpenAppVault} />
          </div>
        )}

        {activeTab === 'health_score' && (
          <div className="space-y-6">
            <AssetHealthScoreTool onSaveToVault={onOpenAppVault} />
          </div>
        )}

        {activeTab === 'invoice_analyzer' && (
          <div className="space-y-6">
            <SmartDocumentAnalyzerTool />
          </div>
        )}

        {activeTab === 'knowledge_hub' && (
          <SmartKnowledgeHub
            initialCategory={activeKnowledgeCat}
            onSelectCalculator={(slug) => handleNavigateToTool(slug)}
            onOpenVaultApp={onOpenAppVault}
          />
        )}

        {activeTab === 'asset_explorer' && (
          <ExploreYourAsset
            onSelectKnowledge={(id) => handleNavigateToKnowledge()}
            onSelectTool={(slug) => handleNavigateToTool(slug)}
          />
        )}

        {activeTab === 'passport' && (
          <AssetPassportPreview />
        )}

        {activeTab === 'seo_page' && (
          <SeoToolPageTemplate
            pageDefinition={SeoRegistry.getPage(activeSeoSlug) || SeoRegistry.getPage('tools/warranty-checker')!}
            onNavigateToTool={handleNavigateToTool}
            onOpenApp={onOpenAppVault}
          />
        )}
      </main>

      {/* 3. Global Platform Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 px-4 sm:px-8 py-12 text-xs text-slate-400 space-y-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="font-black text-white text-base">Asset Doctor</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The Universal Asset Intelligence & Lifecycle Platform. Know what you own, what it needs, and what it is worth.
            </p>
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Platform Online · v2.8 Universal</span>
            </div>
          </div>

          {/* Free Interactive Tools */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-white uppercase text-[10px] tracking-wider font-mono text-emerald-400">
              Free Asset Tools
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={() => handleNavigateToTool('tools/repair-or-replace')} className="hover:text-white transition-colors cursor-pointer">
                  Repair vs. Replace Calculator
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToTool('tools/warranty-checker')} className="hover:text-white transition-colors cursor-pointer">
                  Warranty Expiry Checker
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToTool('tools/maintenance-checker')} className="hover:text-white transition-colors cursor-pointer">
                  Maintenance Interval Checker
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToTool('tools/asset-health-score')} className="hover:text-white transition-colors cursor-pointer">
                  100-Point Asset Health Audit
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToTool('tools/ownership-cost')} className="hover:text-white transition-colors cursor-pointer">
                  Ownership Cost (TCO) Calculator
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToTool('tools/invoice-analyzer')} className="hover:text-white transition-colors cursor-pointer">
                  Bill & Invoice Analyzer
                </button>
              </li>
            </ul>
          </div>

          {/* Knowledge Categories */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-white uppercase text-[10px] tracking-wider font-mono text-cyan-400">
              Knowledge Hub
            </h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <button onClick={() => handleNavigateToKnowledge('vehicles')} className="hover:text-white transition-colors cursor-pointer">
                  Vehicles & Motorcycles
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToKnowledge('electronics')} className="hover:text-white transition-colors cursor-pointer">
                  Smartphones & Laptops
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToKnowledge('home-appliances')} className="hover:text-white transition-colors cursor-pointer">
                  AC & Home Appliances
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigateToKnowledge('household-assets')} className="hover:text-white transition-colors cursor-pointer">
                  Solar & Household Living
                </button>
              </li>
            </ul>
          </div>

          {/* Trust & Enterprise Governance */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-white uppercase text-[10px] tracking-wider font-mono text-teal-400">
              Security & Trust
            </h4>
            <div className="space-y-1.5 text-[11px] text-slate-400">
              <p>🔒 AES-256 Client Vault</p>
              <p>🛡️ Zero Advertiser Sharing</p>
              <p>⚡ DPDP & GDPR Compliant</p>
              <p className="pt-2">
                <a href="/admin" className="text-slate-500 hover:text-slate-300 font-mono text-[10px]">
                  Enterprise Admin Access
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-slate-500 font-mono">
          <p>© 2026 Asset Doctor Technologies. Universal Asset Intelligence Architecture.</p>
          <div className="flex items-center gap-4">
            <span>ISO 27001 Controls</span>
            <span>•</span>
            <span>256-bit SSL</span>
            <span>•</span>
            <span>All Categories Supported</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
