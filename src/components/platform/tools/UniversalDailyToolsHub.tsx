import React, { useState } from 'react';
import {
  Wrench,
  TrendingDown,
  Clock,
  ShieldCheck,
  DollarSign,
  Activity,
  Plus,
  Share2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Layers,
  HelpCircle
} from 'lucide-react';
import {
  CalculatorEngine,
  RepairVsReplaceInput,
  DepreciationResult,
  WarrantyExpiryResult,
  TcoResult
} from '../../../platform/tools/calculatorEngine';

interface UniversalDailyToolsHubProps {
  initialTool?: 'repair_replace' | 'depreciation' | 'warranty' | 'tco';
  onSaveToVault?: () => void;
}

export const UniversalDailyToolsHub: React.FC<UniversalDailyToolsHubProps> = ({
  initialTool = 'repair_replace',
  onSaveToVault
}) => {
  const [activeTool, setActiveTool] = useState<'repair_replace' | 'depreciation' | 'warranty' | 'tco'>(initialTool);
  const [copied, setCopied] = useState(false);

  // 1. Repair vs Replace States
  const [rvrAssetType, setRvrAssetType] = useState<'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'HOUSEHOLD' | 'OTHER'>('APPLIANCE');
  const [rvrPrice, setRvrPrice] = useState(42000);
  const [rvrAge, setRvrAge] = useState(4.5);
  const [rvrRepairCost, setRvrRepairCost] = useState(14500);
  const [rvrRepairCount, setRvrRepairCount] = useState(1);
  const [rvrWarranty, setRvrWarranty] = useState<'ACTIVE' | 'EXPIRED' | 'EXTENDED'>('EXPIRED');

  // 2. Depreciation States
  const [depPrice, setDepPrice] = useState(165000);
  const [depAge, setDepAge] = useState(3);
  const [depCategory, setDepCategory] = useState<'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'HOUSEHOLD' | 'OTHER'>('VEHICLE');
  const [depMethod, setDepMethod] = useState<'DECLINING_BALANCE' | 'STRAIGHT_LINE'>('DECLINING_BALANCE');

  // 3. Warranty States
  const [warPurchaseDate, setWarPurchaseDate] = useState('2025-06-15');
  const [warMonths, setWarMonths] = useState(24);
  const [warExtMonths, setWarExtMonths] = useState(0);

  // 4. TCO States
  const [tcoPrice, setTcoPrice] = useState(180000);
  const [tcoAnnualMaint, setTcoAnnualMaint] = useState(8500);
  const [tcoAnnualFuel, setTcoAnnualFuel] = useState(36000);
  const [tcoAnnualIns, setTcoAnnualIns] = useState(6500);
  const [tcoYears, setTcoYears] = useState(5);

  // Calculations
  const rvrResult = CalculatorEngine.calculateRepairVsReplace({
    assetType: rvrAssetType,
    purchasePrice: rvrPrice,
    ageYears: rvrAge,
    repairCost: rvrRepairCost,
    previousRepairCount: rvrRepairCount,
    warrantyStatus: rvrWarranty
  });

  const depResult = CalculatorEngine.calculateDepreciation(depPrice, depAge, depCategory, depMethod);
  const warResult = CalculatorEngine.calculateWarranty(warPurchaseDate, warMonths, warExtMonths);
  const tcoResult = CalculatorEngine.calculateTco(tcoPrice, tcoAnnualMaint, tcoAnnualFuel, tcoAnnualIns, tcoYears);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-8">
      {/* 1. Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Daily Asset Utility Calculators</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Financial & Operational Decision Tools
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Algorithmic calculators for repair decisions, depreciation curves, warranty expiration, and total cost of ownership across your assets.
        </p>
      </div>

      {/* 2. Tool Switcher Tabs */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-thin max-w-4xl mx-auto">
        <button
          onClick={() => setActiveTool('repair_replace')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
            activeTool === 'repair_replace'
              ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Repair vs. Replace</span>
        </button>

        <button
          onClick={() => setActiveTool('depreciation')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
            activeTool === 'depreciation'
              ? 'bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Depreciation Curve</span>
        </button>

        <button
          onClick={() => setActiveTool('warranty')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
            activeTool === 'warranty'
              ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Warranty Expiry</span>
        </button>

        <button
          onClick={() => setActiveTool('tco')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
            activeTool === 'tco'
              ? 'bg-indigo-500 text-slate-950 font-black border-indigo-400 shadow-lg shadow-indigo-500/20'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Total Cost (TCO)</span>
        </button>
      </div>

      {/* 3. Active Tool Container */}
      <div className="max-w-5xl mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* ========================================== */}
        {/* TOOL 1: REPAIR VS REPLACE */}
        {/* ========================================== */}
        {activeTool === 'repair_replace' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black text-white">Repair vs. Replace Decision Engine</h3>
                <p className="text-xs text-slate-400 mt-0.5">Multi-factor economic comparison against the 50% Fair Market Valuation threshold rule.</p>
              </div>
              <button
                onClick={handleShare}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied!' : 'Share Result'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Input Parameters</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Asset Category</label>
                    <select
                      value={rvrAssetType}
                      onChange={(e) => setRvrAssetType(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="APPLIANCE">Home Appliance (AC, Washing Machine, Geyser)</option>
                      <option value="ELECTRONICS">Electronics (Smartphone, Laptop, TV)</option>
                      <option value="VEHICLE">Automotive (Car, Bike, Scooter)</option>
                      <option value="HOUSEHOLD">Household & Living (Solar, Inverter, Furniture)</option>
                      <option value="OTHER">Other Custom Asset</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Original Price (₹)</label>
                      <input
                        type="number"
                        value={rvrPrice}
                        onChange={(e) => setRvrPrice(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Asset Age (Years)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={rvrAge}
                        onChange={(e) => setRvrAge(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Estimated Repair (₹)</label>
                      <input
                        type="number"
                        value={rvrRepairCost}
                        onChange={(e) => setRvrRepairCost(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Previous Repairs</label>
                      <input
                        type="number"
                        min="0"
                        value={rvrRepairCount}
                        onChange={(e) => setRvrRepairCount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Warranty Status</label>
                    <select
                      value={rvrWarranty}
                      onChange={(e) => setRvrWarranty(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="EXPIRED">Expired Warranty</option>
                      <option value="ACTIVE">Active Manufacturer Warranty</option>
                      <option value="EXTENDED">Extended AMC / Coverage</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Recommendation Outputs */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Decision Recommendation</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border font-mono ${
                    rvrResult.recommendation === 'REPLACE'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : rvrResult.recommendation === 'MONITOR'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {rvrResult.recommendation}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Asset Value</span>
                    <span className="text-xl font-black text-cyan-400 font-mono">₹{rvrResult.fairMarketValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Repair Cost Ratio</span>
                    <span className="text-xl font-black text-amber-400 font-mono">{rvrResult.repairCostRatio}%</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Financial Impact Rationale</span>
                  <p className="text-xs text-slate-200 leading-relaxed">{rvrResult.financialImpactSummary}</p>
                </div>

                {/* Reasoning Points */}
                <div className="space-y-1.5 text-xs text-slate-300">
                  {rvrResult.reasoning.map((r, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500 italic pt-2 border-t border-slate-800">
                  {rvrResult.disclaimer}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TOOL 2: ASSET DEPRECIATION */}
        {/* ========================================== */}
        {activeTool === 'depreciation' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-white">Asset Depreciation & Salvage Calculator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Model asset value decay using Declining Balance (WDV) or Straight-Line accounting methods.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Valuation Parameters</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Asset Category</label>
                    <select
                      value={depCategory}
                      onChange={(e) => setDepCategory(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="VEHICLE">Vehicles (15% WDV Rate / 12 Yr Life)</option>
                      <option value="ELECTRONICS">Smartphones & Laptops (25% WDV Rate / 5 Yr Life)</option>
                      <option value="APPLIANCE">Home Appliances (14% WDV Rate / 10 Yr Life)</option>
                      <option value="HOUSEHOLD">Household & Living (10% WDV Rate / 12 Yr Life)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Original Price (₹)</label>
                      <input
                        type="number"
                        value={depPrice}
                        onChange={(e) => setDepPrice(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Age (Years)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={depAge}
                        onChange={(e) => setDepAge(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Accounting Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDepMethod('DECLINING_BALANCE')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          depMethod === 'DECLINING_BALANCE' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        Declining Balance (WDV)
                      </button>
                      <button
                        onClick={() => setDepMethod('STRAIGHT_LINE')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          depMethod === 'STRAIGHT_LINE' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        Straight-Line (SLM)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Output Results */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Valuation Outcome</span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Fair Value</span>
                    <span className="text-xl font-black text-cyan-400 font-mono">₹{depResult.currentValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Depreciation</span>
                    <span className="text-xl font-black text-rose-400 font-mono">₹{depResult.totalDepreciation.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* 5-Year Schedule Preview */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Yearly Depreciation Schedule</span>
                  <div className="space-y-1 text-xs">
                    {depResult.yearlySchedule.slice(0, 5).map((row) => (
                      <div key={row.year} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 font-mono text-[11px]">
                        <span className="text-slate-400 font-bold">Year {row.year}</span>
                        <span className="text-rose-400">-₹{row.depreciationAmount.toLocaleString('en-IN')}</span>
                        <span className="text-white font-bold">₹{row.closingValue.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TOOL 3: WARRANTY EXPIRY */}
        {/* ========================================== */}
        {activeTool === 'warranty' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-white">Universal Warranty Expiry Calculator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Calculate exact warranty expiration countdowns and claim eligibility windows.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Coverage Duration</span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Purchase Date</label>
                    <input
                      type="date"
                      value={warPurchaseDate}
                      onChange={(e) => setWarPurchaseDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Standard Warranty (Months)</label>
                      <input
                        type="number"
                        value={warMonths}
                        onChange={(e) => setWarMonths(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Extended AMC (Months)</label>
                      <input
                        type="number"
                        value={warExtMonths}
                        onChange={(e) => setWarExtMonths(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Warranty Output */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Status Outcome</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border font-mono ${
                    warResult.status === 'EXPIRED'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : warResult.status === 'EXPIRING_SOON'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {warResult.statusLabel}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Warranty Expiry Date</span>
                  <span className="text-2xl font-black text-white font-mono">{warResult.expiryDate}</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consumer Guidance</span>
                  <p className="text-xs text-slate-200 leading-relaxed">{warResult.guidance}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TOOL 4: TOTAL COST OF OWNERSHIP (TCO) */}
        {/* ========================================== */}
        {activeTool === 'tco' && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-xl font-black text-white">Total Cost of Ownership (TCO) Calculator</h3>
              <p className="text-xs text-slate-400 mt-0.5">Quantify the true long-term financial footprint including capital outlay, maintenance, and power/fuel.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Expense Profile</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      value={tcoPrice}
                      onChange={(e) => setTcoPrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Ownership Horizon (Yrs)</label>
                    <input
                      type="number"
                      value={tcoYears}
                      onChange={(e) => setTcoYears(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Annual Service (₹)</label>
                    <input
                      type="number"
                      value={tcoAnnualMaint}
                      onChange={(e) => setTcoAnnualMaint(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Annual Power/Fuel (₹)</label>
                    <input
                      type="number"
                      value={tcoAnnualFuel}
                      onChange={(e) => setTcoAnnualFuel(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Annual Insurance (₹)</label>
                    <input
                      type="number"
                      value={tcoAnnualIns}
                      onChange={(e) => setTcoAnnualIns(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* TCO Results */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Cumulative Lifetime Cost</span>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Cost of Ownership</span>
                  <span className="text-3xl font-black text-indigo-400 font-mono">₹{tcoResult.totalCostOfOwnership.toLocaleString('en-IN')}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span>₹{tcoResult.monthlyAverageCost.toLocaleString('en-IN')}/mo</span>
                    <span>•</span>
                    <span>₹{tcoResult.dailyCost.toLocaleString('en-IN')}/day</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">Capital Acquisition</span>
                    <span className="font-bold text-white font-mono">{tcoResult.capitalCostPercent}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-500 font-bold block">Operational & Upkeep</span>
                    <span className="font-bold text-amber-400 font-mono">{tcoResult.operatingCostPercent}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Universal Conversion CTA: Save to Asset Doctor */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-white">Want Automated Expiry & Service Tracking?</h4>
            <p className="text-xs text-slate-400">Save this asset into your private encrypted vault to receive proactive WhatsApp & in-app alerts.</p>
          </div>
          <button
            onClick={onSaveToVault}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Save to Asset Doctor Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
};
