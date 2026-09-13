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
  Info,
  Shield
} from 'lucide-react';
import { AssetValuationEngine } from '../../platform/intelligence/valuationEngine';
import { createUniversalAsset, AssetCategoryType } from '../../platform/core/universalAssetSchema';
import { NumericInput } from '../common/NumericInput';

interface RepairVsReplaceToolProps {
  onSaveToVault?: () => void;
  onDownloadApp?: () => void;
}

export const RepairVsReplaceTool: React.FC<RepairVsReplaceToolProps> = ({
  onSaveToVault,
  onDownloadApp
}) => {
  const [category, setCategory] = useState<AssetCategoryType>('APPLIANCE');
  const [assetName, setAssetName] = useState('Daikin Inverter AC 1.5T');
  const [purchasePrice, setPurchasePrice] = useState<number | null>(45000);
  const [ageYears, setAgeYears] = useState<number | null>(4);
  const [estimatedRepairCost, setEstimatedRepairCost] = useState<number | null>(14000);
  const [previousRepairs, setPreviousRepairs] = useState<number>(1);

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

  // Factor in prior repairs
  const isHighRepairFrequency = previousRepairs >= 3;
  let finalRecommendation = valuation?.repairVsReplaceRecommendation;
  if (isHighRepairFrequency && finalRecommendation === 'REPAIR') {
    finalRecommendation = 'INSPECT_FIRST';
  }

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <TrendingDown className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-amber-400 tracking-wider font-mono">
              Free Financial Decision Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Repair vs. Replace Calculator
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5 max-w-2xl">
            Compare repair quotes against asset depreciation equity, previous breakdown counts, and remaining useful lifespan using the standard 50% economic rule.
          </p>
        </div>
      </div>

      {/* Input Parameters & Recommendation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
            Financial & Usage Inputs
          </span>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-300 font-semibold mb-1">Asset Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="APPLIANCE">Home Appliance (AC, Refrigerator, Washing Machine, RO)</option>
                <option value="ELECTRONICS">Electronics (Smartphone, Laptop, TV)</option>
                <option value="VEHICLE">Automotive (Car, Motorcycle, Scooter)</option>
                <option value="HOME">Home Living & Kitchen</option>
                <option value="BUSINESS">Office & Commercial Equipment</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Original Price (₹)</label>
                <NumericInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="e.g. 45000"
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Age of Asset (Years)</label>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Repair Quote (₹)</label>
                <NumericInput
                  value={estimatedRepairCost}
                  onChange={setEstimatedRepairCost}
                  placeholder="e.g. 14000"
                  min={0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Previous Repairs Count</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={previousRepairs}
                  onChange={(e) => setPreviousRepairs(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Valuation & Recommendation Output */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          {valuation ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Indicative Recommendation
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${
                  finalRecommendation === 'REPLACE'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : finalRecommendation === 'INSPECT_FIRST'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {finalRecommendation === 'REPLACE' ? 'Consider Replacement' : finalRecommendation === 'INSPECT_FIRST' ? 'Inspect Closely' : 'Repair Economical'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Depreciated Value</span>
                  <span className="text-base font-black text-white font-mono">
                    ₹{(valuation.currentValue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Repair to Value Ratio</span>
                  <span className={`text-base font-black font-mono ${
                    (valuation.currentValue > 0 ? Math.round(((estimatedRepairCost ?? 0) / valuation.currentValue) * 100) : 100) > 50 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {valuation.currentValue > 0 ? Math.round(((estimatedRepairCost ?? 0) / valuation.currentValue) * 100) : 100}%
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Economic Analysis</span>
                <p className="leading-relaxed text-slate-300">{valuation.repairVsReplaceExplanation}</p>
                {previousRepairs >= 3 && (
                  <p className="text-amber-400 text-[11px] pt-1">
                    ⚠️ Notice: This asset has broken down {previousRepairs} times previously. Sunk costs on chronic issues may yield diminishing reliability.
                  </p>
                )}
              </div>

              {/* Explicit Honest Disclaimer */}
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[10px] text-slate-400 leading-relaxed">
                <strong>Disclaimer:</strong> This recommendation is an indicative algorithmic estimate based on the standard 50% economic rule and category depreciation benchmarks. It does not constitute a formal technical diagnosis or financial advice.
              </div>
            </>
          ) : (
            <div className="my-auto text-center p-8 space-y-2 text-slate-400">
              <Info className="w-8 h-8 text-amber-400/80 mx-auto" />
              <h4 className="font-bold text-white text-sm">Enter Values to Calculate</h4>
              <p className="text-xs max-w-xs mx-auto">
                Fill in the original price and repair quote to generate an instant 50% economic threshold evaluation.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {onSaveToVault && (
              <button
                onClick={onSaveToVault}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Save Calculation to Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onDownloadApp && (
              <button
                onClick={onDownloadApp}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-xs transition cursor-pointer"
              >
                Get Mobile App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
