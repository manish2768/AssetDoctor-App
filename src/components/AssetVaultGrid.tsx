import React, { useState, useMemo } from 'react';
import { Search, Filter, Layers, ArrowUpDown, ShieldAlert, Plus, ScanText } from 'lucide-react';
import { Asset, AssetCategory, WarrantyStatus } from '../types';
import { AssetCard } from './AssetCard';

interface AssetVaultGridProps {
  assets: Asset[];
  activeStatusFilter: string;
  onStatusFilterChange: (status: 'all' | 'active' | 'expiring_soon' | 'expired') => void;
  onSelectAsset: (asset: Asset) => void;
  onClaimAsset: (asset: Asset) => void;
  onDeleteAsset: (id: string) => void;
  onOpenOCR: () => void;
  onOpenAddModal: () => void;
}

export const AssetVaultGrid: React.FC<AssetVaultGridProps> = ({
  assets,
  activeStatusFilter,
  onStatusFilterChange,
  onSelectAsset,
  onClaimAsset,
  onDeleteAsset,
  onOpenOCR,
  onOpenAddModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value_desc' | 'days_asc' | 'purchase_desc'>('value_desc');

  const categories: { label: string; value: string }[] = [
    { label: 'All Categories', value: 'all' },
    { label: 'Electronics', value: 'Electronics' },
    { label: 'Vehicles', value: 'Vehicles' },
    { label: 'Appliances', value: 'Appliances' },
    { label: 'Gadgets', value: 'Gadgets' },
    { label: 'Home', value: 'Home' },
  ];

  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        // Search Filter
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          asset.name.toLowerCase().includes(query) ||
          (asset.vendor && asset.vendor.toLowerCase().includes(query)) ||
          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(query));

        // Category Filter
        const matchesCategory =
          selectedCategory === 'all' || asset.category === selectedCategory;

        // Status Filter
        const matchesStatus =
          activeStatusFilter === 'all' || asset.status === activeStatusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'value_desc') return b.price - a.price;
        if (sortBy === 'days_asc') return a.daysRemaining - b.daysRemaining;
        if (sortBy === 'purchase_desc')
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        return 0;
      });
  }, [assets, searchQuery, selectedCategory, activeStatusFilter, sortBy]);

  return (
    <div id="asset-vault-section" className="space-y-6">
      
      {/* Controls Bar: Search, Category Tabs, Status Filter, Sort */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets, model, serial #..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Badge Pills */}
          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
            <span className="text-xs font-semibold text-slate-500 hidden lg:inline">Status:</span>
            <button
              onClick={() => onStatusFilterChange('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'all'
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              All ({assets.length})
            </button>

            <button
              onClick={() => onStatusFilterChange('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-950 text-emerald-400/70 border border-slate-800 hover:bg-emerald-950/30'
              }`}
            >
              🟢 Active ({assets.filter((a) => a.status === 'active').length})
            </button>

            <button
              onClick={() => onStatusFilterChange('expiring_soon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'expiring_soon'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-slate-950 text-amber-400/70 border border-slate-800 hover:bg-amber-950/30'
              }`}
            >
              🟡 Expiring Soon ({assets.filter((a) => a.status === 'expiring_soon').length})
            </button>

            <button
              onClick={() => onStatusFilterChange('expired')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStatusFilter === 'expired'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-slate-950 text-rose-400/70 border border-slate-800 hover:bg-rose-950/30'
              }`}
            >
              🔴 Expired ({assets.filter((a) => a.status === 'expired').length})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="value_desc">Valuation (High to Low)</option>
              <option value="days_asc">Expiry (Earliest First)</option>
              <option value="purchase_desc">Newest Purchase First</option>
            </select>
          </div>

        </div>

        {/* Category Horizontal Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-800/80">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.value
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Display */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onSelect={onSelectAsset}
              onClaim={onClaimAsset}
              onDelete={onDeleteAsset}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-4 my-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">
              No matching assets found in vault
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search keywords, category, or status filter, or scan a new receipt.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                onStatusFilterChange('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              Reset Filters
            </button>
            <button
              onClick={onOpenOCR}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
            >
              <ScanText className="w-3.5 h-3.5" />
              <span>Scan Receipt Now</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
