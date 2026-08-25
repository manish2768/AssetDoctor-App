import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { ExpiringAlertBanner } from './components/ExpiringAlertBanner';
import { AssetVaultGrid } from './components/AssetVaultGrid';
import { SplashScreen } from './components/SplashScreen';
import { WarrantyExpiryWidget } from './components/WarrantyExpiryWidget';
import { BrandSupportDirectory } from './components/BrandSupportDirectory';
import { SavedAssetDetails } from './components/AssetSavedModal';
import { VehicleDocuments } from './components/EmergencyModal';

// Lazily loaded heavy modal dialogs
const OCRScannerModal = lazy(() => import('./components/OCRScannerModal').then(m => ({ default: m.OCRScannerModal })));
const AssetDetailModal = lazy(() => import('./components/AssetDetailModal').then(m => ({ default: m.AssetDetailModal })));
const WarrantyClaimModal = lazy(() => import('./components/WarrantyClaimModal').then(m => ({ default: m.WarrantyClaimModal })));
const AddAssetModal = lazy(() => import('./components/AddAssetModal').then(m => ({ default: m.AddAssetModal })));
const EmergencyContactModal = lazy(() => import('./components/EmergencyContactModal').then(m => ({ default: m.EmergencyContactModal })));
const UpdatePhoneModal = lazy(() => import('./components/UpdatePhoneModal').then(m => ({ default: m.UpdatePhoneModal })));
const UpdateEmailModal = lazy(() => import('./components/UpdateEmailModal').then(m => ({ default: m.UpdateEmailModal })));
const LoginModal = lazy(() => import('./components/LoginModal').then(m => ({ default: m.LoginModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const AccountSettingsModal = lazy(() => import('./components/AccountSettingsModal').then(m => ({ default: m.AccountSettingsModal })));
const WarrantyAlertsModal = lazy(() => import('./components/WarrantyAlertsModal').then(m => ({ default: m.WarrantyAlertsModal })));
const ExportVaultModal = lazy(() => import('./components/ExportVaultModal').then(m => ({ default: m.ExportVaultModal })));
const AssetSavedModal = lazy(() => import('./components/AssetSavedModal').then(m => ({ default: m.AssetSavedModal })));
import { MobileAssetService } from './services/mobileAssetService';
import { syncEngine } from './services/mobileSyncEngine';
import { auth } from './firebase';
import { SAMPLE_ASSETS, loadDemoAssets } from './services/sampleAssets';
import { Asset, MetricSummary } from './types';
import { getProcessedInitialAssets, calculateExpiryDays } from './utils/assetUtils';
import { CheckCircle2, Camera, Sparkles } from 'lucide-react';
import { PublicPlatformView } from './components/platform/PublicPlatformView';

const STORAGE_KEY = 'assetdoctor_servivault_assets';

export default function App() {
  const [currentAppView, setCurrentAppView] = useState<'platform' | 'vault'>('platform');
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return auth.currentUser?.uid || 'guest_user';
  });

  const [assets, setAssets] = useState<Asset[]>(() => {
    try {
      const cached = MobileAssetService.getCachedAssets();
      if (cached && cached.length > 0) return cached;

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Asset[] = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load assets from cache:', e);
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

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [lastSavedAsset, setLastSavedAsset] = useState<SavedAssetDetails | null>(null);
  const [vehicleEmergencyData, setVehicleEmergencyData] = useState<VehicleDocuments | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [claimAsset, setClaimAsset] = useState<Asset | null>(null);
  const [deleteTargetAsset, setDeleteTargetAsset] = useState<Asset | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-Time Firebase Auth & Asset Sync
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      const uid = user ? user.uid : 'guest_user';
      setCurrentUserId(uid);
      if (user?.email) setUserEmail(user.email);
      if (user?.phoneNumber) setUserPhone(user.phoneNumber);

      // Subscribe to live Firestore Assets for this user
      const unsubAssets = MobileAssetService.subscribeUserAssets(
        uid,
        (liveAssets) => {
          if (liveAssets && liveAssets.length > 0) {
            setAssets(liveAssets);
          }
        }
      );

      return () => unsubAssets();
    });

    return () => unsubAuth();
  }, []);

  // Sync state to localStorage backup
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

  const handleUpdateLocation = (newLoc: string) => {
    setUserLocation(newLoc);
    try {
      localStorage.setItem('assetdoctor_user_location', newLoc);
    } catch (e) {
      console.error('Failed to save location to localStorage:', e);
    }
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

  // Handlers (Offline-First with Sync Queue)
  const handleAddAsset = async (newAsset: Asset) => {
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

    // Save to Cloud via MobileAssetService
    await MobileAssetService.saveAsset(newAsset, currentUserId);
  };

  const handleDeleteAsset = (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (target) {
      setDeleteTargetAsset(target);
    }
  };

  const confirmDeleteAsset = async () => {
    if (!deleteTargetAsset) return;
    const id = deleteTargetAsset.id;
    setAssets((prev) => prev.filter((item) => item.id !== id));
    await MobileAssetService.deleteAsset(id, currentUserId);
    setDeleteTargetAsset(null);
    showToast('Asset deleted from vault.');
  };

  const handleLoadDemoAssets = async () => {
    showToast('Loading demo assets into Cloud...');
    const success = await loadDemoAssets(userEmail || 'demo_user');
    if (success) {
      showToast('3 Demo assets loaded successfully!');
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

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    setAssets((prev) => prev.map((item) => (item.id === updatedAsset.id ? updatedAsset : item)));
    setSelectedAsset(updatedAsset);
    await MobileAssetService.saveAsset(updatedAsset, currentUserId);
    showToast(`Updated "${updatedAsset.name}" in vault`);
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

      {currentAppView === 'platform' ? (
        <PublicPlatformView
          onOpenAppVault={() => setCurrentAppView('vault')}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          currentUser={auth.currentUser}
        />
      ) : (
        <>
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
            onNavigateToPlatform={() => setCurrentAppView('platform')}
          />

          {/* Main App Container */}
          <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
            
            {/* Metric Cards */}
            <MetricCards
              metrics={metrics}
              onSelectFilter={(filter) => setActiveStatusFilter(filter)}
            />

            {/* 7-Day Expiring Soon Alert Banner */}
            <ExpiringAlertBanner
              expiringAssets={expiringAssets}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onScrollToVault={() => {
                const el = document.getElementById('asset-vault-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {/* Dynamic Warranty Expiry Widget */}
            <WarrantyExpiryWidget
              assets={assets}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onAddAssetClick={() => setIsAddModalOpen(true)}
            />

            {/* Main Vault Grid View with Category Filters, Search, and Status Tabs */}
            <section id="asset-vault-section">
              <AssetVaultGrid
                assets={assets}
                activeFilter={activeStatusFilter}
                onFilterChange={setActiveStatusFilter}
                onSelectAsset={(asset) => setSelectedAsset(asset)}
                onDeleteAsset={handleDeleteAsset}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onOpenOCRModal={() => setIsOCRModalOpen(true)}
              />
            </section>

            {/* Authorized Brand Support Directory & Customer Care Call Centre */}
            <BrandSupportDirectory
              onOpenClaim={(brandName) => {
                const matchedAsset = assets.find((a) => a.brand?.toLowerCase() === brandName.toLowerCase());
                if (matchedAsset) {
                  setClaimAsset(matchedAsset);
                } else if (assets.length > 0) {
                  setClaimAsset(assets[0]);
                } else {
                  showToast(`No assets saved under brand "${brandName}" yet.`);
                }
              }}
            />
          </main>
        </>
      )}

      {/* Modal Dialogs (Suspense Lazy Loaded) */}
      <Suspense fallback={null}>
        {selectedAsset && (
          <AssetDetailModal
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onOpenClaimModal={(asset) => {
              setSelectedAsset(null);
              setClaimAsset(asset);
            }}
            onUpdateAsset={handleUpdateAsset}
            onOpenEmergencyModal={(data) => {
              setSelectedAsset(null);
              setVehicleEmergencyData(data);
              setIsEmergencyModalOpen(true);
            }}
          />
        )}

        {claimAsset && (
          <WarrantyClaimModal
            asset={claimAsset}
            onClose={() => setClaimAsset(null)}
          />
        )}

        {isAddModalOpen && (
          <AddAssetModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAddAsset={handleAddAsset}
          />
        )}

        {isOCRModalOpen && (
          <OCRScannerModal
            isOpen={isOCRModalOpen}
            onClose={() => setIsOCRModalOpen(false)}
            onAddAsset={handleAddAsset}
          />
        )}

        {isEmergencyModalOpen && (
          <EmergencyContactModal
            isOpen={isEmergencyModalOpen}
            onClose={() => setIsEmergencyModalOpen(false)}
            vehicleDocuments={vehicleEmergencyData || undefined}
          />
        )}

        {isUpdatePhoneModalOpen && (
          <UpdatePhoneModal
            isOpen={isUpdatePhoneModalOpen}
            currentPhone={userPhone}
            onClose={() => setIsUpdatePhoneModalOpen(false)}
            onPhoneUpdated={handlePhoneUpdated}
          />
        )}

        {isUpdateEmailModalOpen && (
          <UpdateEmailModal
            isOpen={isUpdateEmailModalOpen}
            currentEmail={userEmail}
            onClose={() => setIsUpdateEmailModalOpen(false)}
            onEmailUpdated={handleEmailUpdated}
          />
        )}

        {isLoginModalOpen && (
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLoginSuccess={(email, phone) => {
              if (email) handleEmailUpdated(email);
              if (phone) handlePhoneUpdated(phone);
              showToast('Signed in successfully!');
            }}
          />
        )}

        {isAccountSettingsModalOpen && (
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
            onLoadDemoAssets={handleLoadDemoAssets}
          />
        )}

        {isWarrantyAlertsModalOpen && (
          <WarrantyAlertsModal
            isOpen={isWarrantyAlertsModalOpen}
            assets={assets}
            onClose={() => setIsWarrantyAlertsModalOpen(false)}
            onSelectAsset={(asset) => {
              setIsWarrantyAlertsModalOpen(false);
              setSelectedAsset(asset);
            }}
          />
        )}

        {isExportModalOpen && (
          <ExportVaultModal
            isOpen={isExportModalOpen}
            assets={assets}
            onClose={() => setIsExportModalOpen(false)}
          />
        )}

        {lastSavedAsset && (
          <AssetSavedModal
            isOpen={savedModalOpen}
            onClose={() => setSavedModalOpen(false)}
            assetDetails={lastSavedAsset}
          />
        )}
      </Suspense>

      {deleteTargetAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Vaulted Asset?</h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to remove <strong className="text-white">{deleteTargetAsset.name}</strong> from AssetDoctor Vault? This action will remove local and synced records.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetAsset(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAsset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition"
              >
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplash && (
        <SplashScreen
          onComplete={() => setShowSplash(false)}
        />
      )}
    </div>
  );
}
