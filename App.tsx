import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ExpiringAlertBanner } from './components/ExpiringAlertBanner';
import { AssetVaultGrid } from './components/AssetVaultGrid';
import { OCRScannerModal } from './components/OCRScannerModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { WarrantyClaimModal } from './components/WarrantyClaimModal';
import { AddAssetModal } from './components/AddAssetModal';
import { EmergencyContactModal } from './components/EmergencyContactModal';
import { UpdatePhoneModal } from './components/UpdatePhoneModal';
import { UpdateEmailModal } from './components/UpdateEmailModal';
import { LoginModal } from './components/LoginModal';
import { AuthModal } from './components/AuthModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { WarrantyAlertsModal } from './components/WarrantyAlertsModal';
import { SplashScreen } from './components/SplashScreen';
import { WarrantyExpiryWidget } from './components/WarrantyExpiryWidget';
import { BrandSupportDirectory } from './components/BrandSupportDirectory';
import { ExportVaultModal } from './components/ExportVaultModal';
import { AssetSavedModal, SavedAssetDetails } from './components/AssetSavedModal';
import { EmergencyModal, VehicleDocuments } from './components/EmergencyModal';
import { saveAssetToCloud } from './services/assetCloudService';
import { SAMPLE_ASSETS, loadDemoAssets } from './services/sampleAssets';
import { Asset, MetricSummary } from './types';
import { getProcessedInitialAssets, calculateExpiryDays } from './utils/assetUtils';
import { CheckCircle2, Camera, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'assetdoctor_servivault_assets';

export default function App() {
  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Asset[] = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load assets from localStorage:', e);
    }
    return getProcessedInitialAssets();
  });

  const [isOCRModalOpen, setIsOCRModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isUpdatePhoneModalOpen, setIsUpdatePhoneModalOpen] = useState(false);
  const [isUpdateEmailModalOpen, setIsUpdateEmailModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountSettingsModalOpen, setIsAccountSettingsModalOpen] = useState(false);
  const [isWarrantyAlertsModalOpen, setIsWarrantyAlertsModalOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [userPhone, setUserPhone] = useState<string>(() => {
    return localStorage.getItem('assetdoctor_user_phone') || '+91 98765 43210';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('assetdoctor_user_email') || 'manish2768@gmail.com';
  });
  const [userLocation, setUserLocation] = useState<string>(() => {
    return localStorage.getItem('assetdoctor_user_location') || 'Mumbai, Maharashtra';
  });

  const handleUpdateLocation = (newLoc: string) => {
    setUserLocation(newLoc);
    try {
      localStorage.setItem('assetdoctor_user_location', newLoc);
    } catch (e) {
      console.error('Failed to save location to localStorage:', e);
    }
  };
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [lastSavedAsset, setLastSavedAsset] = useState<SavedAssetDetails | null>(null);
  const [vehicleEmergencyData, setVehicleEmergencyData] = useState<VehicleDocuments | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [claimAsset, setClaimAsset] = useState<Asset | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    } catch (e) {
      console.error('Failed to save assets to localStorage:', e);
    }
  }, [assets]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute Metrics
  const metrics: MetricSummary = useMemo(() => {
    const totalAssets = assets.length;
    const totalValuation = assets.reduce((sum, item) => sum + (item.price || 0), 0);
    const expiringSoonCount = assets.reduce((acc, item) => {
      let count = 0;
      // 1. Warranty alert
      if (item.status === 'expiring_soon' || (item.daysRemaining > 0 && item.daysRemaining <= 7)) {
        count++;
      }
      // 2. Vehicle Insurance alert
      if (item.insuranceExpiryDate) {
        const { daysRemaining } = calculateExpiryDays(item.insuranceExpiryDate);
        if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7) {
          count++;
        }
      }
      // 3. Vehicle PUC alert
      if (item.pucExpiryDate) {
        const { daysRemaining } = calculateExpiryDays(item.pucExpiryDate);
        if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7) {
          count++;
        }
      }
      return acc + count;
    }, 0);
    const expiredCount = assets.filter((item) => item.status === 'expired' || item.daysRemaining <= 0).length;
    const activeCount = assets.filter((item) => item.daysRemaining > 7).length;
    const upcomingMaintenanceCount = assets.filter((item) => Boolean(item.maintenanceDueDate)).length;

    return {
      totalAssets,
      totalValuation,
      expiringSoonCount,
      expiredCount,
      activeCount,
      upcomingMaintenanceCount,
    };
  }, [assets]);

  // Assets expiring within 7 days for top alert banner
  const expiringAssets = useMemo(() => {
    return assets.filter((item) => item.daysRemaining > 0 && item.daysRemaining <= 7);
  }, [assets]);

  const handleAssetSaveSuccess = (newAssetData: SavedAssetDetails) => {
    setLastSavedAsset(newAssetData);
    setSavedModalOpen(true);
  };

  // Handlers
  const handleAddAsset = (newAsset: Asset) => {
    setAssets((prev) => [newAsset, ...prev]);
    showToast(`Added "${newAsset.name}" to AssetDoctor Vault!`);

    // Open celebration modal
    handleAssetSaveSuccess({
      id: newAsset.id,
      name: newAsset.name,
      category: newAsset.category,
      brand: newAsset.brand,
      purchaseDate: newAsset.purchaseDate,
      expiryDate: newAsset.expiryDate,
      insuranceExpiry: newAsset.insuranceExpiryDate,
      pucExpiry: newAsset.pucExpiryDate,
      brandSupportNumber: '18002587111',
      supportNumber: '18002587111',
      imageUrl: newAsset.imageUrl,
    });

    // Save to Cloud in background
    saveAssetToCloud({
      userId: userEmail || 'guest_user',
      name: newAsset.name,
      category: newAsset.category,
      purchaseDate: newAsset.purchaseDate,
      expiryDate: newAsset.expiryDate,
      pucExpiry: newAsset.pucExpiryDate,
      insuranceExpiry: newAsset.insuranceExpiryDate,
      price: newAsset.price,
      notes: newAsset.notes,
    }).catch((err) => {
      console.log('Background Cloud sync notice:', err);
    });
  };

  const handleDeleteAsset = (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (confirm(`Are you sure you want to remove ${target?.name || 'this asset'} from AssetDoctor Vault?`)) {
      setAssets((prev) => prev.filter((item) => item.id !== id));
      showToast('Asset deleted from vault.');
    }
  };

  const handleLoadDemoAssets = async () => {
    showToast('Loading demo assets into Cloud...');
    const success = await loadDemoAssets(userEmail || 'demo_user');
    if (success) {
      showToast('3 Demo assets loaded successfully!');
      // Add demo items to state
      const newItems: Asset[] = SAMPLE_ASSETS.map((item, idx) => {
        const { daysRemaining, status } = calculateExpiryDays(item.expiryDate);
        const remDays = daysRemaining ?? 365;
        const mappedStatus = remDays <= 0 ? 'expired' : remDays <= 30 ? 'expiring_soon' : 'active';
        return {
          id: `demo-${Date.now()}-${idx}`,
          name: item.name,
          brand: item.brand || 'Brand',
          category: (item.category === 'Bike' ? 'Vehicles' : item.category === 'Home Appliance' ? 'Appliances' : 'Gadgets') as any,
          purchaseDate: item.purchaseDate,
          warrantyMonths: 12,
          expiryDate: item.expiryDate || '',
          daysRemaining: remDays,
          status: mappedStatus,
          price: item.price || 0,
          notes: item.notes,
          imageUrl: item.imageUrl,
          isEncrypted: true,
          addedDate: new Date().toISOString().split('T')[0],
        };
      });
      setAssets((prev) => [...newItems, ...prev]);
    } else {
      showToast('Failed to load demo assets.');
    }
  };

  const handlePhoneUpdated = (newPhone: string) => {
    setUserPhone(newPhone);
    try {
      localStorage.setItem('assetdoctor_user_phone', newPhone);
    } catch (e) {
      console.error('Failed to save user phone:', e);
    }
    showToast(`Updated user phone number in database to ${newPhone}`);
  };

  const handleEmailUpdated = (newEmail: string) => {
    setUserEmail(newEmail);
    try {
      localStorage.setItem('assetdoctor_user_email', newEmail);
    } catch (e) {
      console.error('Failed to save user email:', e);
    }
    showToast(`Updated user Auth email address to ${newEmail}`);
  };

  const handleUpdateAsset = (updatedAsset: Asset) => {
    setAssets((prev) => prev.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
    setSelectedAsset(updatedAsset);
    showToast(`Updated service history for "${updatedAsset.name}"`);
  };

  const handleExportVault = () => {
    setIsExportModalOpen(true);
  };

  const handleScrollToAlerts = () => {
    setActiveStatusFilter('expiring_soon');
    const el = document.getElementById('top-notification-expiry-banner') || document.getElementById('asset-vault-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-slate-950">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 border border-teal-500/50 shadow-2xl shadow-teal-500/20 text-xs font-bold text-teal-400 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Fixed Header */}
      <Header
        totalValuation={metrics.totalValuation}
        totalAssetsCount={metrics.totalAssets}
        expiringSoonCount={metrics.expiringSoonCount}
        userPhone={userPhone}
        userEmail={userEmail}
        userLocation={userLocation}
        onOpenOCR={() => setIsOCRModalOpen(true)}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        onOpenUpdatePhoneModal={() => setIsUpdatePhoneModalOpen(true)}
        onOpenUpdateEmailModal={() => setIsUpdateEmailModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenAccountSettingsModal={() => setIsAccountSettingsModalOpen(true)}
        onOpenWarrantyAlertsModal={() => setIsWarrantyAlertsModalOpen(true)}
        onOpenSplashScreen={() => setShowSplash(true)}
        onExportVault={handleExportVault}
        onScrollToAlerts={handleScrollToAlerts}
      />

      {/* Main App Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
        
        {/* Metric Cards (Total Assets Managed with Bike/AC/RO/Car breakdown, Upcoming Maintenance & Renewal Due, Warranty Expiry Alert Section) */}
        <MetricCards
          metrics={metrics}
          assets={assets}
          onFilterStatus={(st) => setActiveStatusFilter(st)}
          activeFilter={activeStatusFilter}
          onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        />

        {/* Top Notification Banner for Assets Expiring Within 7 Days */}
        <ExpiringAlertBanner
          expiringAssets={expiringAssets}
          allAssets={assets}
          onSelectAsset={(ast) => setSelectedAsset(ast)}
          onOpenClaimModal={(ast) => setClaimAsset(ast)}
          onRenewWarrantyToast={(msg) => showToast(msg)}
        />

        {/* Upcoming Warranty Expiries Section with 30d, 60d, 90d, Expired filter tabs */}
        <WarrantyExpiryWidget
          assets={assets}
          onSelectAsset={(ast) => setSelectedAsset(ast)}
          onOpenClaimModal={(ast) => setClaimAsset(ast)}
        />

        {/* One-Click Brand Support Directory */}
        <BrandSupportDirectory />

        {/* Main Vault Grid Section */}
        <AssetVaultGrid
          assets={assets}
          activeStatusFilter={activeStatusFilter}
          onStatusFilterChange={(st) => setActiveStatusFilter(st)}
          onSelectAsset={(ast) => setSelectedAsset(ast)}
          onClaimAsset={(ast) => setClaimAsset(ast)}
          onDeleteAsset={handleDeleteAsset}
          onOpenOCR={() => setIsOCRModalOpen(true)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-slate-950/80 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">AssetDoctor</span>
            <span>•</span>
            <span className="text-teal-400 font-semibold">Smart Asset & Warranty Vault</span>
          </div>
          <div className="text-slate-500">
            Emergency Service Hotline & Instant OCR Invoice Scanner
          </div>
        </div>
      </footer>

      {/* Modals */}
      <OCRScannerModal
        isOpen={isOCRModalOpen}
        onClose={() => setIsOCRModalOpen(false)}
        onAddAsset={handleAddAsset}
      />

      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddAsset={handleAddAsset}
      />

      <EmergencyContactModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
      />

      <UpdatePhoneModal
        isOpen={isUpdatePhoneModalOpen}
        currentPhone={userPhone}
        onClose={() => setIsUpdatePhoneModalOpen(false)}
        onPhoneUpdated={handlePhoneUpdated}
      />

      <UpdateEmailModal
        isOpen={isUpdateEmailModalOpen}
        currentEmail={userEmail}
        onClose={() => setIsUpdateEmailModalOpen(false)}
        onEmailUpdated={handleEmailUpdated}
      />

      <ExportVaultModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        assets={assets}
        totalValuation={metrics.totalValuation}
      />

      <AssetDetailModal
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onOpenClaimModal={(ast) => setClaimAsset(ast)}
        onUpdateAsset={handleUpdateAsset}
        onOpenEmergencyModal={(data) => setVehicleEmergencyData(data)}
      />

      <WarrantyClaimModal
        asset={claimAsset}
        onClose={() => setClaimAsset(null)}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        userEmail={userEmail}
        userPhone={userPhone}
        onClose={() => setIsLoginModalOpen(false)}
        onOpenAuthModal={() => {
          setIsLoginModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        onLoginSuccess={(e) => {
          showToast(`Welcome back! Logged in as ${e}`);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user: any) => {
          const identifier = user?.email || user?.phoneNumber || 'User';
          showToast(`AssetDoctor login successful! (${identifier})`);
          if (user?.email) {
            setUserEmail(user.email);
            localStorage.setItem('assetdoctor_user_email', user.email);
          }
          if (user?.phoneNumber) {
            setUserPhone(user.phoneNumber);
            localStorage.setItem('assetdoctor_user_phone', user.phoneNumber);
          }
        }}
      />

      <AccountSettingsModal
        isOpen={isAccountSettingsModalOpen}
        userEmail={userEmail}
        userPhone={userPhone}
        userLocation={userLocation}
        onClose={() => setIsAccountSettingsModalOpen(false)}
        onOpenUpdatePhoneModal={() => setIsUpdatePhoneModalOpen(true)}
        onOpenUpdateEmailModal={() => setIsUpdateEmailModalOpen(true)}
        onOpenForgotPassword={() => setIsLoginModalOpen(true)}
        onUpdateLocation={handleUpdateLocation}
        onPasswordChangedToast={(msg) => showToast(msg)}
        onShowToast={(msg) => showToast(msg)}
        onLoadDemoAssets={handleLoadDemoAssets}
      />

      <WarrantyAlertsModal
        isOpen={isWarrantyAlertsModalOpen}
        assets={assets}
        onClose={() => setIsWarrantyAlertsModalOpen(false)}
        onSelectAsset={(ast) => setSelectedAsset(ast)}
        onOpenClaimModal={(ast) => setClaimAsset(ast)}
        onRenewWarrantyToast={(msg) => showToast(msg)}
      />

      <AssetSavedModal
        isOpen={savedModalOpen}
        onClose={() => setSavedModalOpen(false)}
        asset={lastSavedAsset}
        onRenewClick={(asset, type) => {
          showToast(`${asset.name} का ${type.toUpperCase()} रिन्यू करने का प्रोसेस चालू हो रहा है...`);
        }}
      />

      <EmergencyModal
        isOpen={!!vehicleEmergencyData}
        onClose={() => setVehicleEmergencyData(null)}
        data={vehicleEmergencyData}
      />

      {/* Splash Screen Intro overlay */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* Floating Action Button (FAB) for Quick Scanning */}
      <button
        onClick={() => setIsOCRModalOpen(true)}
        id="floating-scan-fab-btn"
        className="fixed bottom-6 right-6 z-40 group flex items-center gap-2.5 px-4 py-3.5 rounded-full bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500 text-slate-950 font-black text-xs sm:text-sm shadow-2xl shadow-teal-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 ring-4 ring-slate-950/60"
        title="Scan New Bill / Document with AI OCR"
      >
        <Camera className="w-5 h-5 text-slate-950 stroke-[2.5]" />
        <span className="font-extrabold tracking-tight">Scan New Bill / Document</span>
        <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
      </button>

    </div>
  );
}
