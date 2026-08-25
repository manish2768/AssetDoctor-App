import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  Filter,
  Calculator,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Smartphone,
  Car,
  Tv,
  Sun,
  Briefcase,
  Home,
  RefreshCw,
  Share2,
  Clock,
  ArrowRight
} from 'lucide-react';
import type { Asset } from '../../../types';
import { MobileAssetService } from '../../../services/mobileAssetService';
import { SavedResultsService, SavedCalculationResult } from '../../../services/savedResultsService';
import { DeepLinkService } from '../../../services/deepLinkService';

interface MyAssetVaultViewProps {
  currentUser: any;
  onOpenAddAsset: () => void;
  onSelectAsset?: (asset: Asset) => void;
  onNavigateToTool?: (slug: string) => void;
}

export const MyAssetVaultView: React.FC<MyAssetVaultViewProps> = ({
  currentUser,
  onOpenAddAsset,
  onSelectAsset,
  onNavigateToTool
}) => {
  const [activeVaultTab, setActiveVaultTab] = useState<'assets' | 'results' | 'documents' | 'alerts'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [savedResults, setSavedResults] = useState<SavedCalculationResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const userId = currentUser?.uid || 'guest_user';

  // 1. Subscribe to real-time assets from Firestore /Users/{uid}/Assets
  useEffect(() => {
    if (!userId || userId === 'guest_user') return;
    setLoading(true);

    const unsubAssets = MobileAssetService.subscribeUserAssets(
      userId,
      (liveAssets) => {
        setAssets(liveAssets);
        setLoading(false);
      }
    );

    const unsubResults = SavedResultsService.subscribeSavedResults(
      userId,
      (liveResults) => {
        setSavedResults(liveResults);
      }
    );

    return () => {
      unsubAssets();
      unsubResults();
    };
  }, [userId]);

  // Compute stats
  const totalValuation = assets.reduce((sum, a) => sum + (a.price || 0), 0);
  const activeWarranties = assets.filter(a => a.status === 'active').length;
  const expiringSoonCount = assets.filter(a => a.status === 'expiring_soon' || (a.daysRemaining > 0 && a.daysRemaining <= 30)).length;

  // Filtered assets
  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (a.brand || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || a.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const handleDeleteAsset = async (assetId: string) => {
    await MobileAssetService.deleteAsset(assetId, userId);
    setDeleteConfirmId(null);
  };

  const handleDeleteResult = async (resultId: string) => {
    await SavedResultsService.deleteCalculationResult(userId, resultId);
  };

  const getCategoryIcon = (cat: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('veh') || lower.includes('car') || lower.includes('bike')) return <Car className="w-4 h-4 text-amber-400" />;
    if (lower.includes('elec') || lower.includes('phone') || lower.includes('gadg')) return <Smartphone className="w-4 h-4 text-cyan-400" />;
    if (lower.includes('app') || lower.includes('ac')) return <Tv className="w-4 h-4 text-emerald-400" />;
    if (lower.includes('sol')) return <Sun className="w-4 h-4 text-amber-400" />;
    if (lower.includes('bus')) return <Briefcase className="w-4 h-4 text-indigo-400" />;
    return <Home className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              My Asset Vault
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
              Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Encrypted personal vault for your physical hardware, bills, warranties, and calculation reports.
          </p>
        </div>

        <button
          onClick={onOpenAddAsset}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Asset</span>
        </button>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Total Vault Assets</span>
          <span className="text-2xl font-black text-white font-mono">{assets.length}</span>
          <span className="text-[11px] text-slate-400 block">Personal hardware registered</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Portfolio Valuation</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">₹{totalValuation.toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-slate-400 block">Acquisition cost footprint</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Active Warranties</span>
          <span className="text-2xl font-black text-cyan-400 font-mono">{activeWarranties}</span>
          <span className="text-[11px] text-slate-400 block">Protected under OEM / AMC</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Expiring Soon (&le;30d)</span>
          <span className="text-2xl font-black text-amber-400 font-mono">{expiringSoonCount}</span>
          <span className="text-[11px] text-slate-400 block">Requires attention</span>
        </div>
      </div>

      {/* 3. Vault Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveVaultTab('assets')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeVaultTab === 'assets'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          My Assets ({assets.length})
        </button>

        <button
          onClick={() => setActiveVaultTab('results')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeVaultTab === 'results'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          Saved Calculations ({savedResults.length})
        </button>

        <button
          onClick={() => setActiveVaultTab('alerts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeVaultTab === 'alerts'
              ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          Alerts ({expiringSoonCount})
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ASSETS LIST */}
      {/* ======================================================== */}
      {activeVaultTab === 'assets' && (
        <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by asset name or brand..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-thin">
              {['all', 'Vehicles', 'Electronics', 'Appliances', 'Other'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    categoryFilter === cat ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Assets Grid */}
          {filteredAssets.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">No Assets Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery ? 'No assets matching your search query.' : 'Your vault is currently empty. Add your first vehicle, appliance, or phone.'}
                </p>
              </div>
              <button
                onClick={onOpenAddAsset}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                + Add Asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                            {asset.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {asset.brand || 'Universal'} • {asset.category}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono border ${
                        asset.status === 'expired'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : asset.status === 'expiring_soon'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {asset.status === 'expired' ? 'Expired' : asset.status === 'expiring_soon' ? 'Expiring' : 'Active'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Original Price</span>
                        <span className="font-bold text-white">₹{(asset.price || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Warranty Expiry</span>
                        <span className="font-bold text-slate-300">{asset.expiryDate || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => onSelectAsset && onSelectAsset(asset)}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => DeepLinkService.openAssetCrossPlatform(asset.id)}
                        title="Share / Open Deep Link"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {deleteConfirmId === asset.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteAsset(asset.id)}
                            className="px-2 py-1 rounded bg-rose-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(asset.id)}
                          title="Delete Asset"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SAVED CALCULATIONS */}
      {/* ======================================================== */}
      {activeVaultTab === 'results' && (
        <div className="space-y-4">
          {savedResults.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                <Calculator className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">No Saved Calculations</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When you use Repair vs Replace, Depreciation, or TCO calculators, click "Save to Asset Doctor" to keep reports here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedResults.map(res => (
                <div
                  key={res.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider font-mono">
                        {res.toolType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(res.calculatedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">{res.assetName}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{res.summary}</p>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between font-mono text-xs">
                      <span className="text-slate-400">{res.primaryMetricLabel}</span>
                      <span className="font-bold text-emerald-400 text-sm">{res.primaryMetricValue}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => onNavigateToTool && onNavigateToTool(res.toolType === 'REPAIR_VS_REPLACE' ? 'tools/repair-or-replace' : 'tools/depreciation-calculator')}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Recalculate / Update</span>
                    </button>

                    <button
                      onClick={() => handleDeleteResult(res.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Delete Saved Result"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PROACTIVE ALERTS */}
      {/* ======================================================== */}
      {activeVaultTab === 'alerts' && (
        <div className="space-y-3">
          {assets.filter(a => a.status === 'expiring_soon' || a.status === 'expired').length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="font-bold text-white text-base">All Assets in Optimal Health</h4>
              <p className="text-xs text-slate-400">Zero critical warranty expirations or missed service dates.</p>
            </div>
          ) : (
            assets
              .filter(a => a.status === 'expiring_soon' || a.status === 'expired')
              .map(a => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{a.name}</h5>
                      <span className="text-[11px] text-slate-400">
                        Warranty expires on {a.expiryDate || 'Soon'} ({a.daysRemaining} days remaining)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToTool && onNavigateToTool('tools/warranty-checker')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shrink-0"
                  >
                    Check Claims
                  </button>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};
