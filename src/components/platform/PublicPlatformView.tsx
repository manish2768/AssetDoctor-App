import React, { useState, useEffect } from 'react';
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
  DollarSign,
  FolderLock,
  Plus
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
import { PublicAssetPassportView } from './passport/PublicAssetPassportView';
import { NotFoundView } from './NotFoundView';
import { AboutUsView } from './AboutUsView';
import { PrivacyPolicyView } from './PrivacyPolicyView';
import { TermsAndConditionsView } from './TermsAndConditionsView';
import { ContactView } from './ContactView';
import { CookiePolicyView } from './CookiePolicyView';
import { GlobalTrustFooter } from './GlobalTrustFooter';
import { SeoToolPageTemplate } from './SeoToolPageTemplate';
import { SeoRegistry } from '../../platform/seo/seoRegistry';
import { KnowledgeCategory } from '../../platform/knowledge/knowledgeHubData';
import { PlatformErrorBoundary } from './PlatformErrorBoundary';
import { CustomerVaultAuthModal } from './auth/CustomerVaultAuthModal';
import { DuplicateAssetModal } from './DuplicateAssetModal';
import { GuestMigrationModal } from './GuestMigrationModal';
import { MyAssetVaultView } from './vault/MyAssetVaultView';
import { GuestSessionService, GuestCalculation } from '../../services/guestSessionService';
import { SavedResultsService, SavedCalculationResult } from '../../services/savedResultsService';
import { DuplicateProtectionService } from '../../services/duplicateProtectionService';
import { MobileAssetService } from '../../services/mobileAssetService';
import { AnalyticsService } from '../../platform/analytics/analyticsService';
import { auth } from '../../firebase';
import type { Asset } from '../../types';

interface PublicPlatformViewProps {
  onOpenAppVault: () => void;
  onOpenLoginModal?: () => void;
  currentUser?: any;
  onOpenAddAsset?: () => void;
  onSelectAsset?: (asset: Asset) => void;
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
  | 'seo_page'
  | 'my_vault'
  | 'about'
  | 'privacy_policy'
  | 'terms'
  | 'contact'
  | 'cookie_policy'
  | 'not_found';

export const PublicPlatformView: React.FC<PublicPlatformViewProps> = ({
  onOpenAppVault,
  onOpenLoginModal,
  currentUser,
  onOpenAddAsset,
  onSelectAsset
}) => {
  const [activeTab, setActiveTab] = useState<PlatformTab>('home');
  const [activeKnowledgeCat, setActiveKnowledgeCat] = useState<KnowledgeCategory | undefined>(undefined);
  const [activeSeoSlug, setActiveSeoSlug] = useState<string>('tools/warranty-checker');

  // Customer Auth & Conversion Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authContextMessage, setAuthContextMessage] = useState<string | undefined>(undefined);
  const [pendingSaveCalculation, setPendingSaveCalculation] = useState<any | null>(null);
  const [pendingSaveAsset, setPendingSaveAsset] = useState<Partial<Asset> | null>(null);

  // Migration & Duplicate Modals
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [pendingGuestCalculations, setPendingGuestCalculations] = useState<GuestCalculation[]>([]);
  const [duplicateModalState, setDuplicateModalState] = useState<{
    isOpen: boolean;
    candidate?: Partial<Asset>;
    existingAsset?: Asset;
    reason?: string;
  }>({ isOpen: false });

  // User Profile Menu
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; actionLabel?: string; onAction?: () => void } | null>(null);

  // Toast Helper
  const showToast = (text: string, actionLabel?: string, onAction?: () => void) => {
    setToastMessage({ text, actionLabel, onAction });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ----------------------------------------------------
  // REAL SPA BROWSER ROUTING & HISTORY ARCHITECTURE
  // ----------------------------------------------------
  const ROUTE_CONFIGS: Record<string, { tab: PlatformTab; title: string; desc: string }> = {
    '/': {
      tab: 'home',
      title: 'Asset Doctor — Universal Asset Intelligence & Lifecycle Platform',
      desc: 'Know what you own, what it needs, what it\'s worth, and what to do next. Universal asset tracking, warranty alerts, and preventive maintenance across 7 asset categories.'
    },
    '/about': {
      tab: 'about',
      title: 'About Asset Doctor | Universal Asset Intelligence Platform',
      desc: 'Discover the story behind Asset Doctor, the universal asset lifecycle intelligence platform created by Ashutosh Rai to understand, protect, and manage physical assets.'
    },
    '/contact': {
      tab: 'contact',
      title: 'Contact Asset Doctor',
      desc: 'Get in touch with Asset Doctor. Submit product feedback, report technical issues, or inquire about business asset portfolio partnerships.'
    },
    '/privacy-policy': {
      tab: 'privacy_policy',
      title: 'Privacy Policy | Asset Doctor',
      desc: 'Asset Doctor Privacy Policy: Learn how we protect your asset data, enforce automated PII scrubbing, and maintain client-side zero-advertiser data isolation.'
    },
    '/terms-and-conditions': {
      tab: 'terms',
      title: 'Terms & Conditions | Asset Doctor',
      desc: 'Asset Doctor Terms and Conditions: User agreement, service capabilities, calculation heuristics, and intellectual property terms.'
    },
    '/terms': {
      tab: 'terms',
      title: 'Terms & Conditions | Asset Doctor',
      desc: 'Asset Doctor Terms and Conditions: User agreement, service capabilities, calculation heuristics, and intellectual property terms.'
    },
    '/cookie-policy': {
      tab: 'cookie_policy',
      title: 'Cookie Policy | Asset Doctor',
      desc: 'Learn how Asset Doctor uses essential local storage and privacy-scrubbed analytics without third-party advertising tracking cookies.'
    },
    '/tools': {
      tab: 'tools_hub',
      title: 'Free Asset Intelligence Tools Suite | Asset Doctor',
      desc: 'Interactive calculators for repair vs replace, warranty expiration, depreciation, and maintenance tracking.'
    },
    '/tools/repair-or-replace': {
      tab: 'repair_vs_replace',
      title: 'Repair vs Replace Calculator | Asset Doctor',
      desc: 'Make data-backed decisions on whether to repair or replace failing equipment.'
    },
    '/tools/maintenance-checker': {
      tab: 'maintenance_checker',
      title: 'Predictive Maintenance Checker | Asset Doctor',
      desc: 'Check preventive maintenance intervals and upcoming service requirements.'
    },
    '/tools/asset-health-score': {
      tab: 'health_score',
      title: 'Asset Health Score Calculator | Asset Doctor',
      desc: 'Audit the condition, reliability, and lifespan score of your physical assets.'
    },
    '/tools/document-analyzer': {
      tab: 'invoice_analyzer',
      title: 'Smart Document & Bill Analyzer OCR | Asset Doctor',
      desc: 'Extract key purchase metadata, serial numbers, and warranty terms from invoices.'
    },
    '/tools/invoice-analyzer': {
      tab: 'invoice_analyzer',
      title: 'Smart Document & Bill Analyzer OCR | Asset Doctor',
      desc: 'Extract key purchase metadata, serial numbers, and warranty terms from invoices.'
    },
    '/tools/asset-passport': {
      tab: 'passport',
      title: 'Digital Asset Passport | Asset Doctor',
      desc: 'Complete immutable digital passport and lifecycle timeline for physical assets.'
    },
    '/knowledge': {
      tab: 'knowledge_hub',
      title: 'Asset Intelligence Knowledge Hub | Asset Doctor',
      desc: 'Comprehensive maintenance schedules, warranty insights, and depreciation norms across 6 asset sectors.'
    },
    '/assets/explore': {
      tab: 'asset_explorer',
      title: 'Explore Your Asset Universe | Asset Doctor',
      desc: 'Explore intelligence, depreciation models, and care schedules across all asset categories.'
    },
    '/vault': {
      tab: 'my_vault',
      title: 'My Asset Vault | Asset Doctor',
      desc: 'Manage and protect your vaulted assets with offline-first synchronization.'
    }
  };

  const navigateToPath = (path: string, pushHistory: boolean = true) => {
    const cleanPath = (path || '/').toLowerCase().replace(/\/$/, '') || '/';

    let targetTab: PlatformTab = 'home';
    let targetTitle = 'Asset Doctor — Universal Asset Intelligence & Lifecycle Platform';
    let targetDesc = 'Know what you own, what it needs, what it\'s worth, and what to do next.';
    let found = false;

    if (ROUTE_CONFIGS[cleanPath]) {
      const cfg = ROUTE_CONFIGS[cleanPath];
      targetTab = cfg.tab;
      targetTitle = cfg.title;
      targetDesc = cfg.desc;
      found = true;
    } else if (cleanPath.startsWith('/knowledge/')) {
      const sub = cleanPath.replace('/knowledge/', '');
      let cat: KnowledgeCategory = 'VEHICLE';
      if (sub === 'electronics') cat = 'ELECTRONICS';
      else if (sub === 'home-appliances') cat = 'APPLIANCE';
      else if (sub === 'solar-energy') cat = 'SOLAR';
      else if (sub === 'business-assets') cat = 'BUSINESS';
      setActiveKnowledgeCat(cat);
      targetTab = 'knowledge_hub';
      targetTitle = `${cat.charAt(0) + cat.slice(1).toLowerCase()} Asset Intelligence | Asset Doctor`;
      targetDesc = `Comprehensive maintenance and lifecycle intelligence for ${cat.toLowerCase()} assets.`;
      found = true;
    } else if (cleanPath.startsWith('/assets/')) {
      targetTab = 'asset_explorer';
      targetTitle = 'Explore Your Asset Universe | Asset Doctor';
      targetDesc = 'Explore asset intelligence, valuation, and care schedules.';
      found = true;
    } else if (cleanPath.startsWith('/tools/')) {
      const slug = cleanPath.replace(/^\//, '');
      const seoPage = SeoRegistry.getPage(slug);
      if (seoPage) {
        setActiveSeoSlug(slug);
        targetTab = 'seo_page';
        targetTitle = seoPage.title;
        targetDesc = seoPage.metaDescription;
        found = true;
      }
    }

    if (!found && cleanPath !== '/') {
      targetTab = 'not_found';
      targetTitle = 'Page Not Found (404) | Asset Doctor';
      targetDesc = 'The requested page could not be found.';
    }

    setActiveTab(targetTab);

    if (typeof window !== 'undefined') {
      if (pushHistory && window.location.pathname !== cleanPath) {
        window.history.pushState({ path: cleanPath, tab: targetTab }, '', cleanPath);
      }
      document.title = targetTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', targetDesc);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Listen to browser Back/Forward & parse initial route on mount
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        navigateToPath(window.location.pathname, false);
      }
    };

    if (typeof window !== 'undefined') {
      navigateToPath(window.location.pathname, false);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check guest migration on user login
  useEffect(() => {
    if (currentUser && currentUser.uid && currentUser.uid !== 'guest_user') {
      const guestItems = GuestSessionService.getGuestCalculations();
      if (guestItems.length > 0) {
        setPendingGuestCalculations(guestItems);
        setIsMigrationModalOpen(true);
      }
    }
  }, [currentUser]);

  const handleNavigateToKnowledge = (cat?: KnowledgeCategory) => {
    if (cat) {
      setActiveKnowledgeCat(cat);
      const slugMap: Record<KnowledgeCategory, string> = {
        VEHICLE: 'vehicles',
        ELECTRONICS: 'electronics',
        APPLIANCE: 'home-appliances',
        SOLAR: 'solar-energy',
        BUSINESS: 'business-assets',
        LIVING: 'vehicles'
      };
      navigateToPath(`/knowledge/${slugMap[cat] || 'vehicles'}`);
    } else {
      setActiveKnowledgeCat(undefined);
      navigateToPath('/knowledge');
    }
  };

  const handleNavigateToTool = (slug: string) => {
    const clean = slug.startsWith('tools/') ? `/${slug}` : `/tools/${slug.replace(/^\//, '')}`;
    navigateToPath(clean);
  };

  // ----------------------------------------------------
  // SAVE-TO-VAULT CONVERSION HANDLERS
  // ----------------------------------------------------
  const handleSaveCalculation = async (calcData: {
    toolType: 'REPAIR_VS_REPLACE' | 'DEPRECIATION' | 'WARRANTY' | 'TCO' | 'MAINTENANCE' | 'HEALTH_SCORE';
    assetName: string;
    assetCategory: string;
    summary: string;
    primaryMetricLabel: string;
    primaryMetricValue: string | number;
    details?: Record<string, any>;
  }) => {
    if (currentUser && currentUser.uid && currentUser.uid !== 'guest_user') {
      try {
        await SavedResultsService.saveCalculationResult(currentUser.uid, {
          toolType: calcData.toolType,
          assetName: calcData.assetName,
          assetCategory: calcData.assetCategory,
          summary: calcData.summary,
          primaryMetricLabel: calcData.primaryMetricLabel,
          primaryMetricValue: calcData.primaryMetricValue,
          details: calcData.details || {}
        });
        showToast('Saved result to your Asset Vault!', 'View Vault', () => setActiveTab('my_vault'));
      } catch (e) {
        showToast('Failed to save calculation to Vault.');
      }
    } else {
      // Guest Mode: Store in local guest session first, then prompt optional sign-up
      GuestSessionService.addGuestCalculation({
        toolType: calcData.toolType,
        assetName: calcData.assetName,
        assetCategory: calcData.assetCategory,
        summary: calcData.summary,
        primaryMetricLabel: calcData.primaryMetricLabel,
        primaryMetricValue: calcData.primaryMetricValue,
        details: calcData.details || {}
      });
      setPendingSaveCalculation(calcData);
      setAuthContextMessage(`Save your ${calcData.assetName} calculation`);
      setIsAuthModalOpen(true);
    }
  };

  const handleSaveAssetCandidate = async (candidate: Partial<Asset>) => {
    if (currentUser && currentUser.uid && currentUser.uid !== 'guest_user') {
      // Check for duplicate asset in user's vault
      const existingAssets = MobileAssetService.getCachedAssets(currentUser.uid);
      const dupCheck = DuplicateProtectionService.checkForDuplicate(candidate, existingAssets);

      if (dupCheck.isDuplicate && dupCheck.existingAsset) {
        setDuplicateModalState({
          isOpen: true,
          candidate,
          existingAsset: dupCheck.existingAsset,
          reason: dupCheck.reason
        });
        return;
      }

      try {
        await MobileAssetService.saveAsset(candidate, currentUser.uid);
        showToast(`Added "${candidate.name}" to your Asset Vault!`, 'View Vault', () => setActiveTab('my_vault'));
      } catch (e) {
        showToast('Failed to add asset to Vault.');
      }
    } else {
      setPendingSaveAsset(candidate);
      setAuthContextMessage(`Sign in to save ${candidate.name || 'this asset'} to your Vault`);
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = async (user: any) => {
    if (pendingSaveCalculation && user?.uid) {
      try {
        await SavedResultsService.saveCalculationResult(user.uid, {
          toolType: pendingSaveCalculation.toolType,
          assetName: pendingSaveCalculation.assetName,
          assetCategory: pendingSaveCalculation.assetCategory,
          summary: pendingSaveCalculation.summary,
          primaryMetricLabel: pendingSaveCalculation.primaryMetricLabel,
          primaryMetricValue: pendingSaveCalculation.primaryMetricValue,
          details: pendingSaveCalculation.details || {}
        });
        setPendingSaveCalculation(null);
        showToast('Saved result to your Asset Vault!', 'View Vault', () => setActiveTab('my_vault'));
      } catch (e) {
        console.warn('Post-auth calculation save error:', e);
      }
    }

    if (pendingSaveAsset && user?.uid) {
      try {
        await MobileAssetService.saveAsset(pendingSaveAsset, user.uid);
        setPendingSaveAsset(null);
        showToast(`Added "${pendingSaveAsset.name}" to your Asset Vault!`, 'View Vault', () => setActiveTab('my_vault'));
      } catch (e) {
        console.warn('Post-auth asset save error:', e);
      }
    }

    // Check if other guest calculations exist
    const guestItems = GuestSessionService.getGuestCalculations();
    if (guestItems.length > 0) {
      setPendingGuestCalculations(guestItems);
      setIsMigrationModalOpen(true);
    }
  };

  const handleMigrateAllGuestData = async () => {
    if (currentUser?.uid) {
      const count = await SavedResultsService.migrateGuestCalculations(currentUser.uid);
      setIsMigrationModalOpen(false);
      showToast(`Synced ${count} calculations to your Asset Vault!`, 'View Vault', () => setActiveTab('my_vault'));
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setIsProfileMenuOpen(false);
      setActiveTab('home');
      showToast('Signed out of Asset Doctor Vault.');
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 text-xs font-bold text-emerald-400 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
          {toastMessage.actionLabel && toastMessage.onAction && (
            <button
              onClick={toastMessage.onAction}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[11px] hover:bg-emerald-400 cursor-pointer ml-1"
            >
              {toastMessage.actionLabel}
            </button>
          )}
        </div>
      )}

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
            onClick={() => navigateToPath('/')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateToPath('/tools')}
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
            onClick={() => navigateToPath('/assets/explore')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Explore Assets
          </button>
          <button
            onClick={() => navigateToPath('/tools/document-analyzer')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'invoice_analyzer' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bill Analyzer
          </button>
          <button
            onClick={() => navigateToPath('/about')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'about' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            About
          </button>

          {/* Authenticated Customer Nav Tab */}
          {currentUser && (
            <button
              onClick={() => navigateToPath('/vault')}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my_vault' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-emerald-400 hover:text-white'
              }`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              <span>My Vault</span>
            </button>
          )}
        </nav>

        {/* Right: Guest vs Authenticated User Actions */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center gap-2 shadow-md"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                  {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline-block max-w-[130px] truncate text-slate-300">
                  {currentUser.email || 'My Account'}
                </span>
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#070D18] border border-slate-800 p-2 shadow-2xl space-y-1 z-50 text-xs animate-scale-up">
                  <div className="px-3 py-2 border-b border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Signed in as</span>
                    <span className="font-bold text-white truncate block text-[11px]">
                      {currentUser.email || 'Asset Doctor Member'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigateToPath('/vault');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2 font-semibold transition cursor-pointer text-left"
                  >
                    <FolderLock className="w-4 h-4 text-emerald-400" />
                    <span>My Asset Vault</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenAppVault();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2 font-semibold transition cursor-pointer text-left"
                  >
                    <Shield className="w-4 h-4 text-teal-400" />
                    <span>Open Native App UI</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 font-semibold transition cursor-pointer text-left border-t border-slate-800/80 pt-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAuthContextMessage(undefined);
                  setIsAuthModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/80 cursor-pointer hidden sm:block transition"
              >
                Sign In
              </button>

              <button
                onClick={() => {
                  setAuthContextMessage('Sign in to open your personal Asset Vault');
                  setIsAuthModalOpen(true);
                }}
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
            onClick={() => navigateToPath('/')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateToPath('/tools')}
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
            onClick={() => navigateToPath('/assets/explore')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'asset_explorer' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Explore Assets
          </button>
          <button
            onClick={() => navigateToPath('/about')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'about' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            About
          </button>
          {currentUser && (
            <button
              onClick={() => navigateToPath('/vault')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
                activeTab === 'my_vault' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-emerald-400 border-slate-800'
              }`}
            >
              My Vault
            </button>
          )}
        </div>

        {/* Dynamic Route View Switcher */}
        <PlatformErrorBoundary>
          {activeTab === 'home' && (
            <PublicHomepageView
              onSelectTool={handleNavigateToTool}
              onSelectKnowledge={(id) => handleNavigateToKnowledge()}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
              onOpenLoginModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'tools_hub' && (
            <UniversalDailyToolsHub
              onSaveToVault={() => {
                handleSaveCalculation({
                  toolType: 'REPAIR_VS_REPLACE',
                  assetName: 'Daily Tool Evaluation',
                  assetCategory: 'General',
                  summary: 'Calculated using Universal Daily Tools Suite',
                  primaryMetricLabel: 'Result Status',
                  primaryMetricValue: 'Processed'
                });
              }}
            />
          )}

          {activeTab === 'repair_vs_replace' && (
            <div className="space-y-6">
              <RepairVsReplaceTool
                onSaveToVault={() => {
                  handleSaveCalculation({
                    toolType: 'REPAIR_VS_REPLACE',
                    assetName: 'Repair vs Replace Evaluation',
                    assetCategory: 'APPLIANCE',
                    summary: '50% economic decision threshold calculation',
                    primaryMetricLabel: 'Decision',
                    primaryMetricValue: 'Evaluated'
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'maintenance_checker' && (
            <div className="space-y-6">
              <MaintenanceCheckerTool
                onSaveToVault={() => {
                  handleSaveCalculation({
                    toolType: 'MAINTENANCE',
                    assetName: 'Maintenance Schedule Review',
                    assetCategory: 'VEHICLE',
                    summary: 'Scheduled maintenance threshold check',
                    primaryMetricLabel: 'Upkeep',
                    primaryMetricValue: 'Checked'
                  });
                }}
              />
            </div>
          )}

          {activeTab === 'health_score' && (
            <div className="space-y-6">
              <AssetHealthScoreTool
                onSaveToVault={() => {
                  handleSaveCalculation({
                    toolType: 'HEALTH_SCORE',
                    assetName: 'Asset Health Diagnostic',
                    assetCategory: 'VEHICLE',
                    summary: '100-point transparent health audit',
                    primaryMetricLabel: 'Health Score',
                    primaryMetricValue: 'Audit Completed'
                  });
                }}
              />
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
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'asset_explorer' && (
            <ExploreYourAsset
              onSelectKnowledge={(id) => handleNavigateToKnowledge()}
              onSelectTool={(slug) => handleNavigateToTool(slug)}
            />
          )}

          {activeTab === 'passport' && (
            <PublicAssetPassportView
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'seo_page' && (
            <SeoToolPageTemplate
              pageDefinition={SeoRegistry.getPage(activeSeoSlug) || SeoRegistry.getPage('tools/warranty-checker')!}
              onNavigateToTool={handleNavigateToTool}
              onOpenApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'my_vault' && (
            <MyAssetVaultView
              currentUser={currentUser}
              onOpenAddAsset={onOpenAddAsset || (() => onOpenAppVault())}
              onSelectAsset={onSelectAsset}
              onNavigateToTool={handleNavigateToTool}
            />
          )}

          {activeTab === 'about' && (
            <AboutUsView
              onOpenVaultApp={currentUser ? () => navigateToPath('/vault') : () => setIsAuthModalOpen(true)}
              onExploreAssets={() => navigateToPath('/assets/explore')}
              onExploreTools={() => navigateToPath('/tools')}
            />
          )}

          {activeTab === 'privacy_policy' && (
            <PrivacyPolicyView onGoBack={() => navigateToPath('/')} />
          )}

          {activeTab === 'terms' && (
            <TermsAndConditionsView onGoBack={() => navigateToPath('/')} />
          )}

          {activeTab === 'contact' && (
            <ContactView onGoHome={() => navigateToPath('/')} />
          )}

          {activeTab === 'cookie_policy' && (
            <CookiePolicyView onGoBack={() => navigateToPath('/')} />
          )}

          {activeTab === 'not_found' && (
            <NotFoundView
              onGoHome={() => navigateToPath('/')}
              onExploreTools={() => navigateToPath('/tools')}
              onExploreAssets={() => navigateToPath('/assets/explore')}
            />
          )}
        </PlatformErrorBoundary>
      </main>

      {/* 3. Customer Authentication Modal */}
      <CustomerVaultAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingSaveCalculation(null);
          setPendingSaveAsset(null);
        }}
        onAuthSuccess={handleAuthSuccess}
        contextMessage={authContextMessage}
      />

      {/* 4. Guest Calculation Migration Modal */}
      <GuestMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => {
          setIsMigrationModalOpen(false);
          GuestSessionService.clearGuestCalculations();
        }}
        pendingCalculations={pendingGuestCalculations}
        onMigrateAll={handleMigrateAllGuestData}
      />

      {/* 5. Duplicate Asset Protection Modal */}
      {duplicateModalState.existingAsset && (
        <DuplicateAssetModal
          isOpen={duplicateModalState.isOpen}
          onClose={() => setDuplicateModalState({ isOpen: false })}
          existingAsset={duplicateModalState.existingAsset}
          onOpenExisting={(asset) => {
            setDuplicateModalState({ isOpen: false });
            navigateToPath('/vault');
            if (onSelectAsset) onSelectAsset(asset);
          }}
          onCreateAnother={async () => {
            if (duplicateModalState.candidate && currentUser?.uid) {
              await MobileAssetService.saveAsset(duplicateModalState.candidate, currentUser.uid);
              setDuplicateModalState({ isOpen: false });
              showToast(`Created duplicate asset copy in Vault!`, 'View Vault', () => navigateToPath('/vault'));
            }
          }}
          reason={duplicateModalState.reason}
        />
      )}

      {/* 6. Global Trust & Platform Footer */}
      <GlobalTrustFooter
        onNavigateTab={(tab) => {
          if (tab.startsWith('/')) {
            navigateToPath(tab);
          } else if (tab === 'home') {
            navigateToPath('/');
          } else if (tab === 'about') {
            navigateToPath('/about');
          } else if (tab === 'contact') {
            navigateToPath('/contact');
          } else if (tab === 'privacy_policy') {
            navigateToPath('/privacy-policy');
          } else if (tab === 'terms') {
            navigateToPath('/terms-and-conditions');
          } else if (tab === 'cookie_policy') {
            navigateToPath('/cookie-policy');
          } else if (tab === 'my_vault') {
            navigateToPath('/vault');
          } else if (tab === 'tools_hub') {
            navigateToPath('/tools');
          } else if (tab === 'asset_explorer') {
            navigateToPath('/assets/explore');
          } else if (tab === 'knowledge_hub') {
            navigateToPath('/knowledge');
          } else if (tab === 'invoice_analyzer') {
            navigateToPath('/tools/document-analyzer');
          } else if (tab === 'passport') {
            navigateToPath('/tools/asset-passport');
          } else {
            navigateToPath(`/${tab}`);
          }
        }}
        onSelectTool={handleNavigateToTool}
      />
    </div>
  );
};
