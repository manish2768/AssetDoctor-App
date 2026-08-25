import React, { useState } from 'react';
import {
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Car,
  Smartphone,
  Wrench
} from 'lucide-react';
import { AssetValuationEngine } from '../../platform/intelligence/valuationEngine';
import { createUniversalAsset, AssetCategoryType } from '../../platform/core/universalAssetSchema';

export const RepairVsReplaceTool: React.FC = () => {
  const [category, setCategory] = useState<AssetCategoryType>('APPLIANCE');
  const [assetName, setAssetName] = useState('Daikin Inverter AC 1.5T');
  const [purchasePrice, setPurchasePrice] = useState(45000);
  const [ageYears, setAgeYears] = useState(4);
  const [estimatedRepairCost, setEstimatedRepairCost] = useState(14000);

  // Generate date in past based on ageYears
  const pastDate = new Date(Date.now() - ageYears * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const mockAsset = createUniversalAsset({
    name: assetName,
    category,
    brand: 'Brand',
    purchasePrice,
    purchaseDate: pastDate
  });

  const valuation = AssetValuationEngine.calculateValuation(mockAsset, estimatedRepairCost);

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <TrendingDown className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
              Free Financial Decision Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Repair vs. Replace Decision Calculator
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Algorithmic economic comparison balancing repair quotes against depreciation equity and remaining asset lifespan.
          </p>
        </div>
      </div>

      {/* Input Parameters & Recommendation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
            Financial & Lifespan Inputs
          </span>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Asset Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="APPLIANCE">Home Appliance (AC, Refrigerator, Geyser)</option>
                <option value="ELECTRONICS">Electronics (Smartphone, Laptop)</option>
                <option value="VEHICLE">Automotive (Car, Motorcycle, Scooter)</option>
                <option value="HOME">Home Living & Solar</option>
                <option value="BUSINESS">Office & Commercial Equipment</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Original Price (₹)</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Age of Asset (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="20"
                  value={ageYears}
                  onChange={(e) => setAgeYears(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Estimated Repair Quote (₹)</label>
              <input
                type="number"
                value={estimatedRepairCost}
                onChange={(e) => setEstimatedRepairCost(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Valuation & Recommendation Output */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Algorithmic Decision Result
            </span>
            <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
              valuation.repairVsReplaceRecommendation === 'REPLACE'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : valuation.repairVsReplaceRecommendation === 'INSPECT_FIRST'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              Recommendation: {valuation.repairVsReplaceRecommendation}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Fair Value</span>
              <span className="text-xl font-black text-cyan-400 font-mono">
                ₹{valuation.currentValue.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                {valuation.retainedEquityPercent}% Retained Equity
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Repair Cost Ratio</span>
              <span className="text-xl font-black text-amber-300 font-mono">
                {valuation.currentValue > 0 ? Math.round((estimatedRepairCost / valuation.currentValue) * 100) : 0}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                50% Threshold Rule
              </span>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Economic Rationale
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {valuation.repairVsReplaceExplanation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
