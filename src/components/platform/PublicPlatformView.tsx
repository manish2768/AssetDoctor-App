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
  Plus,
  Car,
  Wind,
  BookOpen,
  Download
} from 'lucide-react';
import { PublicHomepageView } from './PublicHomepageView';
import { GooglePlayDownloadButton } from './GooglePlayDownloadButton';
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

// New Multi-Page Ecosystem Views
import { VehicleDoctorLanding, VehicleDoctorSubPage } from './vehicles/VehicleDoctorLanding';
import { ApplianceDoctorLanding, ApplianceSubPage } from './appliances/ApplianceDoctorLanding';
import { WarrantyManagementPage } from './pages/WarrantyManagementPage';
import { MaintenanceManagementPage } from './pages/MaintenanceManagementPage';
import { SmartQrPage } from './pages/SmartQrPage';
import { DownloadAppPage } from './pages/DownloadAppPage';

// New Interactive Browser Free Tools
import { WarrantyCalculatorTool } from './tools/WarrantyCalculatorTool';
import { AssetAgeCalculatorTool } from './tools/AssetAgeCalculatorTool';
import { AcElectricityCalculatorTool } from './tools/AcElectricityCalculatorTool';
import { ServiceDueCalculatorTool } from './tools/ServiceDueCalculatorTool';

// New Blog & Knowledge Hub Views
import { BlogHubView } from './blog/BlogHubView';
import { BlogPostView } from './blog/BlogPostView';
import { BlogRepository, BlogCategory, BlogPost } from '../../platform/blog/blogData';

// SEO & Schema Head Engine
import { SeoHeadManager } from '../../platform/seo/seoHeadManager';
import { getRouteMetadata } from '../../platform/seo/routeMetadata';

interface PublicPlatformViewProps {
  onOpenAppVault: () => void;
  onOpenLoginModal?: () => void;
  currentUser?: any;
  onOpenAddAsset?: () => void;
  onSelectAsset?: (asset: Asset) => void;
}

export type PlatformTab =
  | 'home'
  | 'vehicle_doctor'
  | 'appliance_doctor'
  | 'warranty_page'
  | 'maintenance_page'
  | 'smart_qr_page'
  | 'download_page'
  | 'tools_hub'
  | 'tool_warranty'
  | 'tool_asset_age'
  | 'tool_ac_electricity'
  | 'tool_service_due'
  | 'repair_vs_replace'
  | 'maintenance_checker'
  | 'health_score'
  | 'invoice_analyzer'
  | 'blog_hub'
  | 'blog_post'
  | 'knowledge_hub'
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
  const [activeVehicleSubPage, setActiveVehicleSubPage] = useState<VehicleDoctorSubPage>('landing');
  const [activeApplianceSubPage, setActiveApplianceSubPage] = useState<ApplianceSubPage>('landing');
  const [activeBlogCategory, setActiveBlogCategory] = useState<BlogCategory | undefined>(undefined);
  const [activeBlogPost, setActiveBlogPost] = useState<BlogPost | null>(null);
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
  // MULTIPAGE ROUTING & HISTORY ARCHITECTURE
  // ----------------------------------------------------
  const navigateToPath = (path: string, pushHistory: boolean = true) => {
    const cleanPath = (path || '/').toLowerCase().replace(/\/$/, '') || '/';

    let targetTab: PlatformTab = 'home';
    let found = false;

    // 1. Core Top-Level Routes
    if (cleanPath === '/') {
      targetTab = 'home';
      found = true;
    } else if (cleanPath === '/about') {
      targetTab = 'about';
      found = true;
    } else if (cleanPath === '/contact') {
      targetTab = 'contact';
      found = true;
    } else if (cleanPath === '/download') {
      targetTab = 'download_page';
      found = true;
    } else if (cleanPath === '/privacy' || cleanPath === '/privacy-policy') {
      targetTab = 'privacy_policy';
      found = true;
    } else if (cleanPath === '/terms' || cleanPath === '/terms-and-conditions') {
      targetTab = 'terms';
      found = true;
    } else if (cleanPath === '/cookie-policy') {
      targetTab = 'cookie_policy';
      found = true;
    } else if (cleanPath === '/warranty') {
      targetTab = 'warranty_page';
      found = true;
    } else if (cleanPath === '/maintenance') {
      targetTab = 'maintenance_page';
      found = true;
    } else if (cleanPath === '/smart-qr') {
      targetTab = 'smart_qr_page';
      found = true;
    } else if (cleanPath === '/vault') {
      targetTab = 'my_vault';
      found = true;
    }

    // 2. Vehicle Doctor Ecosystem Routes
    else if (cleanPath === '/vehicle-doctor') {
      setActiveVehicleSubPage('landing');
      targetTab = 'vehicle_doctor';
      found = true;
    } else if (cleanPath === '/vehicle-doctor/cars') {
      setActiveVehicleSubPage('cars');
      targetTab = 'vehicle_doctor';
      found = true;
    } else if (cleanPath === '/vehicle-doctor/bikes') {
      setActiveVehicleSubPage('bikes');
      targetTab = 'vehicle_doctor';
      found = true;
    } else if (cleanPath === '/vehicle-doctor/warranty') {
      setActiveVehicleSubPage('warranty');
      targetTab = 'vehicle_doctor';
      found = true;
    } else if (cleanPath === '/vehicle-doctor/service') {
      setActiveVehicleSubPage('service');
      targetTab = 'vehicle_doctor';
      found = true;
    } else if (cleanPath === '/vehicle-doctor/documents') {
      setActiveVehicleSubPage('documents');
      targetTab = 'vehicle_doctor';
      found = true;
    }

    // 3. Appliance Doctor Ecosystem Routes
    else if (cleanPath === '/appliance-doctor') {
      setActiveApplianceSubPage('landing');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/ac') {
      setActiveApplianceSubPage('ac');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/refrigerator') {
      setActiveApplianceSubPage('refrigerator');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/washing-machine') {
      setActiveApplianceSubPage('washing-machine');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/ro') {
      setActiveApplianceSubPage('ro');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/geyser') {
      setActiveApplianceSubPage('geyser');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/microwave') {
      setActiveApplianceSubPage('microwave');
      targetTab = 'appliance_doctor';
      found = true;
    } else if (cleanPath === '/appliance-doctor/chimney') {
      setActiveApplianceSubPage('chimney');
      targetTab = 'appliance_doctor';
      found = true;
    }

    // 4. Free Tools Routes
    else if (cleanPath === '/tools') {
      targetTab = 'tools_hub';
      found = true;
    } else if (cleanPath === '/tools/warranty-calculator' || cleanPath === '/tools/warranty-checker') {
      targetTab = 'tool_warranty';
      found = true;
    } else if (cleanPath === '/tools/asset-age-calculator') {
      targetTab = 'tool_asset_age';
      found = true;
    } else if (cleanPath === '/tools/ac-electricity-calculator') {
      targetTab = 'tool_ac_electricity';
      found = true;
    } else if (cleanPath === '/tools/service-due-calculator') {
      targetTab = 'tool_service_due';
      found = true;
    } else if (cleanPath === '/tools/repair-vs-replace' || cleanPath === '/tools/repair-or-replace') {
      targetTab = 'repair_vs_replace';
      found = true;
    } else if (cleanPath === '/tools/maintenance-checker') {
      targetTab = 'maintenance_checker';
      found = true;
    } else if (cleanPath === '/tools/asset-health-score' || cleanPath === '/tools/asset-health-check') {
      targetTab = 'health_score';
      found = true;
    } else if (cleanPath === '/tools/document-analyzer' || cleanPath === '/tools/invoice-analyzer') {
      targetTab = 'invoice_analyzer';
      found = true;
    } else if (cleanPath === '/tools/asset-passport') {
      targetTab = 'passport';
      found = true;
    }

    // 5. Blog & Knowledge Hub Routes
    else if (cleanPath === '/blog') {
      setActiveBlogCategory(undefined);
      targetTab = 'blog_hub';
      found = true;
    } else if (cleanPath.startsWith('/blog/category/')) {
      const cat = cleanPath.replace('/blog/category/', '') as BlogCategory;
      setActiveBlogCategory(cat);
      targetTab = 'blog_hub';
      found = true;
    } else if (cleanPath.startsWith('/blog/')) {
      const slug = cleanPath.replace('/blog/', '');
      const post = BlogRepository.getBySlug(slug);
      if (post) {
        setActiveBlogPost(post);
        targetTab = 'blog_post';
        found = true;
      }
    }

    // 6. Legacy Knowledge & Assets Routes
    else if (cleanPath === '/knowledge') {
      targetTab = 'knowledge_hub';
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
      found = true;
    } else if (cleanPath === '/assets/explore' || cleanPath.startsWith('/assets/')) {
      targetTab = 'asset_explorer';
      found = true;
    } else if (cleanPath.startsWith('/tools/')) {
      const slug = cleanPath.replace(/^\//, '');
      const seoPage = SeoRegistry.getPage(slug);
      if (seoPage) {
        setActiveSeoSlug(slug);
        targetTab = 'seo_page';
        found = true;
      }
    }

    if (!found && cleanPath !== '/') {
      targetTab = 'not_found';
    }

    setActiveTab(targetTab);

    // Apply Dynamic SEO & Metadata
    if (typeof window !== 'undefined') {
      if (pushHistory && window.location.pathname !== cleanPath) {
        window.history.pushState({ path: cleanPath, tab: targetTab }, '', cleanPath);
      }

      if (targetTab === 'blog_post' && activeBlogPost) {
        SeoHeadManager.updateHead({
          title: `${activeBlogPost.title} | Asset Doctor`,
          description: activeBlogPost.metaDescription,
          canonicalUrl: `https://assetdoctor.in/blog/${activeBlogPost.slug}`,
          ogType: 'article',
          author: activeBlogPost.author,
          publishedTime: activeBlogPost.publishedDate,
          modifiedTime: activeBlogPost.updatedDate,
          schema: {
            '@type': 'BlogPosting',
            headline: activeBlogPost.h1,
            description: activeBlogPost.metaDescription,
            url: `https://assetdoctor.in/blog/${activeBlogPost.slug}`,
            author: {
              '@type': 'Organization',
              name: activeBlogPost.author
            },
            publisher: {
              '@type': 'Organization',
              name: 'Asset Doctor',
              logo: 'https://assetdoctor.in/icon.svg'
            },
            datePublished: activeBlogPost.publishedDate,
            dateModified: activeBlogPost.updatedDate
          }
        });
      } else {
        const meta = getRouteMetadata(cleanPath);
        SeoHeadManager.updateHead(meta);
      }

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

  // Save-To-Vault Handlers
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
      showToast('Signed out of Asset Doctor');
      navigateToPath('/');
    } catch (e) {
      showToast('Error signing out');
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0B1220] border border-emerald-500/50 shadow-2xl text-xs font-bold text-emerald-400 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.text}</span>
          {toastMessage.actionLabel && toastMessage.onAction && (
            <button
              onClick={toastMessage.onAction}
              className="ml-2 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-wider hover:bg-emerald-400 transition cursor-pointer"
            >
              {toastMessage.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* 1. Global Platform Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#070D18]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors">
        {/* Left: Brand Identity */}
        <div
          onClick={() => navigateToPath('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-base sm:text-lg tracking-tight">
                Asset Doctor
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                Home &amp; Vehicle
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden md:block">
              Your Home &amp; Vehicle Doctor
            </p>
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 border border-slate-800/90 p-1 rounded-2xl text-xs font-bold">
          <button
            onClick={() => navigateToPath('/')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateToPath('/vehicle-doctor')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'vehicle_doctor' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Vehicle Doctor</span>
          </button>
          <button
            onClick={() => navigateToPath('/appliance-doctor')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'appliance_doctor' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Appliance Doctor</span>
          </button>
          <button
            onClick={() => navigateToPath('/tools')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tools_hub' ||
              activeTab === 'tool_warranty' ||
              activeTab === 'tool_asset_age' ||
              activeTab === 'tool_ac_electricity' ||
              activeTab === 'tool_service_due' ||
              activeTab === 'repair_vs_replace'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Free Tools
          </button>
          <button
            onClick={() => navigateToPath('/blog')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'blog_hub' || activeTab === 'blog_post' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Hub</span>
          </button>
          <button
            onClick={() => navigateToPath('/about')}
            className={`px-3 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'about' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            About
          </button>

          {/* Authenticated Customer Nav Tab */}
          {currentUser && (
            <button
              onClick={() => navigateToPath('/vault')}
              className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my_vault' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-emerald-400 hover:text-white'
              }`}
            >
              <FolderLock className="w-3.5 h-3.5" />
              <span>My Vault</span>
            </button>
          )}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <GooglePlayDownloadButton
                variant="header"
                placement="header_auth"
                label="Download App"
                size="sm"
                className="hidden md:inline-flex"
              />
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer flex items-center gap-2 shadow-md"
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToPath('/download')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/80 cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>App</span>
              </button>

              <button
                onClick={() => {
                  setAuthContextMessage(undefined);
                  setIsAuthModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/80 cursor-pointer hidden md:block transition"
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
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'home' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateToPath('/vehicle-doctor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'vehicle_doctor' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Vehicle Doctor
          </button>
          <button
            onClick={() => navigateToPath('/appliance-doctor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'appliance_doctor' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Appliance Doctor
          </button>
          <button
            onClick={() => navigateToPath('/tools')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'tools_hub' || activeTab.startsWith('tool_') ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Tools
          </button>
          <button
            onClick={() => navigateToPath('/blog')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
              activeTab === 'blog_hub' || activeTab === 'blog_post' ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            Blog
          </button>
          {currentUser && (
            <button
              onClick={() => navigateToPath('/vault')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border ${
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
              onNavigate={(p) => navigateToPath(p)}
            />
          )}

          {/* Vehicle Doctor Ecosystem */}
          {activeTab === 'vehicle_doctor' && (
            <VehicleDoctorLanding
              subPage={activeVehicleSubPage}
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {/* Appliance Doctor Ecosystem */}
          {activeTab === 'appliance_doctor' && (
            <ApplianceDoctorLanding
              subPage={activeApplianceSubPage}
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {/* Dedicated Feature Pages */}
          {activeTab === 'warranty_page' && (
            <WarrantyManagementPage
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'maintenance_page' && (
            <MaintenanceManagementPage
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'smart_qr_page' && (
            <SmartQrPage
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'download_page' && (
            <DownloadAppPage
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
          )}

          {/* Interactive Browser Free Tools */}
          {activeTab === 'tool_warranty' && (
            <WarrantyCalculatorTool
              onSaveToVault={() => {
                handleSaveCalculation({
                  toolType: 'WARRANTY',
                  assetName: 'Warranty Evaluation',
                  assetCategory: 'General',
                  summary: 'Calculated using Warranty Expiry Calculator',
                  primaryMetricLabel: 'Status',
                  primaryMetricValue: 'Evaluated'
                });
              }}
              onDownloadApp={() => navigateToPath('/download')}
            />
          )}

          {activeTab === 'tool_asset_age' && (
            <AssetAgeCalculatorTool
              onSaveToVault={() => {
                handleSaveCalculation({
                  toolType: 'DEPRECIATION',
                  assetName: 'Asset Age Evaluation',
                  assetCategory: 'General',
                  summary: 'Calculated using Asset Age Calculator',
                  primaryMetricLabel: 'Age',
                  primaryMetricValue: 'Calculated'
                });
              }}
              onDownloadApp={() => navigateToPath('/download')}
            />
          )}

          {activeTab === 'tool_ac_electricity' && (
            <AcElectricityCalculatorTool
              onSaveToVault={() => {
                handleSaveCalculation({
                  toolType: 'TCO',
                  assetName: 'AC Electricity Estimate',
                  assetCategory: 'APPLIANCE',
                  summary: 'Estimated power consumption and monthly bill',
                  primaryMetricLabel: 'Cost',
                  primaryMetricValue: 'Estimated'
                });
              }}
              onDownloadApp={() => navigateToPath('/download')}
            />
          )}

          {activeTab === 'tool_service_due' && (
            <ServiceDueCalculatorTool
              onSaveToVault={() => {
                handleSaveCalculation({
                  toolType: 'MAINTENANCE',
                  assetName: 'Service Due Prediction',
                  assetCategory: 'VEHICLE',
                  summary: 'Whichever-comes-first service milestone calculation',
                  primaryMetricLabel: 'Upkeep Due',
                  primaryMetricValue: 'Scheduled'
                });
              }}
              onDownloadApp={() => navigateToPath('/download')}
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
                onDownloadApp={() => navigateToPath('/download')}
              />
            </div>
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

          {/* Blog & Knowledge Hub Views */}
          {activeTab === 'blog_hub' && (
            <BlogHubView
              activeCategory={activeBlogCategory}
              onNavigate={(p) => navigateToPath(p)}
            />
          )}

          {activeTab === 'blog_post' && activeBlogPost && (
            <BlogPostView
              post={activeBlogPost}
              onNavigate={(p) => navigateToPath(p)}
              onOpenVaultApp={currentUser ? () => setActiveTab('my_vault') : () => setIsAuthModalOpen(true)}
            />
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
        onNavigateTab={(path) => navigateToPath(path)}
        onSelectTool={handleNavigateToTool}
      />
    </div>
  );
};
