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
  Wrench,
  Info
} from 'lucide-react';
import { AssetValuationEngine } from '../../platform/intelligence/valuationEngine';
import { createUniversalAsset, AssetCategoryType } from '../../platform/core/universalAssetSchema';
import { NumericInput } from '../common/NumericInput';

export const RepairVsReplaceTool: React.FC = () => {
  const [category, setCategory] = useState<AssetCategoryType>('APPLIANCE');
  const [assetName, setAssetName] = useState('Daikin Inverter AC 1.5T');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(45000);
  const [ageYears, setAgeYears] = useState<number | null>(4);
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number | null>(14000);

  // Generate date in past based on ageYears
  const safeAge = ageYears ?? 1;
  const pastDate = new Date(Date.now() - safeAge * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const hasInputs = purchasePrice !== null && estimatedRepairCost !== null && purchasePrice > 0;

  const mockAsset = createUniversalAsset({
    name: assetName,
    category,
    brand: 'Brand',
    purchasePrice: purchasePrice ?? 0,
    purchaseDate: pastDate
  });

  const valuation = hasInputs
    ? AssetValuationEngine.calculateValuation(mockAsset, estimatedRepairCost ?? 0)
    : null;

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
                <NumericInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="e.g. 45000"
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Age of Asset (Years)</label>
                <NumericInput
                  value={ageYears}
                  onChange={setAgeYears}
                  placeholder="e.g. 4"
                  min={0}
                  max={50}
                  allowDecimal={true}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Estimated Repair Quote (₹)</label>
              <NumericInput
                value={estimatedRepairCost}
                onChange={setEstimatedRepairCost}
                placeholder="e.g. 14000"
                min={0}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Valuation & Recommendation Output */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          {valuation ? (
            <>
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
                  <span className="text-base font-black text-white font-mono">
                    ₹{(valuation.currentValue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Repair Cost Ratio</span>
                  <span className={`text-base font-black font-mono ${
                    (valuation.currentValue > 0 ? Math.round(((estimatedRepairCost ?? 0) / valuation.currentValue) * 100) : 100) > 50 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {valuation.currentValue > 0 ? Math.round(((estimatedRepairCost ?? 0) / valuation.currentValue) * 100) : 100}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Economic Analysis</span>
                <p className="leading-relaxed">{valuation.repairVsReplaceExplanation}</p>
              </div>
            </>
          ) : (
            <div className="my-auto text-center p-8 space-y-2 text-slate-400">
              <Info className="w-8 h-8 text-amber-400/80 mx-auto" />
              <h4 className="font-bold text-white text-sm">Enter Values to Calculate</h4>
              <p className="text-xs max-w-xs mx-auto">
                Fill in the original price and repair quote above to generate an instant 50% economic threshold evaluation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
