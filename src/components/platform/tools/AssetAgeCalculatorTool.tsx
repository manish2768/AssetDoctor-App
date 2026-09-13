import React, { useState } from 'react';
import { Clock, Calendar, ArrowRight, Sparkles, TrendingDown, Layers } from 'lucide-react';

interface AssetAgeCalculatorToolProps {
  onSaveToVault?: () => void;
  onDownloadApp?: () => void;
}

export const AssetAgeCalculatorTool: React.FC<AssetAgeCalculatorToolProps> = ({
  onSaveToVault,
  onDownloadApp
}) => {
  const [purchaseDate, setPurchaseDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    d.setMonth(d.getMonth() - 4);
    return d.toISOString().split('T')[0];
  });
  const [assetCategory, setAssetCategory] = useState<string>('Vehicle');
  const [assetName, setAssetName] = useState<string>('Honda City / Activa 6G');

  // Compute exact age breakdown
  const calculateAge = () => {
    if (!purchaseDate) return null;
    const start = new Date(purchaseDate);
    if (isNaN(start.getTime())) return null;

    const today = new Date();
    if (start > today) {
      return { isFuture: true };
    }

    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let days = today.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const totalDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalMonths = years * 12 + months;

    // Estimated lifespan by category
    const lifespanMap: Record<string, number> = {
      Vehicle: 15,
      AC: 10,
      Refrigerator: 12,
      'Washing Machine': 10,
      Smartphone: 4,
      Laptop: 5,
      RO: 7,
      Other: 8
    };

    const expectedLife = lifespanMap[assetCategory] || 10;
    const lifecyclePercentage = Math.min(100, Math.round((years + months / 12) / expectedLife * 100));

    return {
      isFuture: false,
      years,
      months,
      days,
      totalDays,
      totalMonths,
      expectedLife,
      lifecyclePercentage,
      startDateFormatted: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  };

  const age = calculateAge();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider font-mono">
          <Clock className="w-4 h-4" />
          <span>100% Free Browser Tool</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Asset Age Calculator
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          Calculate the exact age of your vehicle, home appliance, or gadget in years, months, and days. Plan timely maintenance, warranty extensions, and replacements.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        {/* Left Inputs */}
        <div className="lg:col-span-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Select Purchase Date & Asset Type</span>
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Asset Name (Optional)</label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Maruti Suzuki Brezza, LG Refrigerator"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Asset Category</label>
            <select
              value={assetCategory}
              onChange={(e) => setAssetCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              <option value="Vehicle">Vehicle (Car / Bike / Scooter)</option>
              <option value="AC">Air Conditioner (Split / Window)</option>
              <option value="Refrigerator">Refrigerator / Fridge</option>
              <option value="Washing Machine">Washing Machine</option>
              <option value="RO">RO Water Purifier</option>
              <option value="Smartphone">Smartphone / Tablet</option>
              <option value="Laptop">Laptop / Computer</option>
              <option value="Other">Other Home Asset</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Purchase / Invoice Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* Presets */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Quick Presets:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 1);
                  setPurchaseDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                1 Year Ago
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 3);
                  setPurchaseDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                3 Years Ago
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 5);
                  setPurchaseDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                5 Years Ago
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 8);
                  setPurchaseDate(d.toISOString().split('T')[0]);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                8 Years Ago
              </button>
            </div>
          </div>
        </div>

        {/* Right Output */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6">
          {age && !age.isFuture ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calculated Asset Age</span>
                <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold font-mono">
                  {age.totalDays.toLocaleString('en-IN')} Total Days
                </span>
              </div>

              {/* Age Breakdown Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <div className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono">
                    {age.years}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Years</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <div className="text-3xl sm:text-4xl font-black text-teal-400 font-mono">
                    {age.months}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Months</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-1">
                  <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                    {age.days}
                  </div>
                  <span className="text-xs text-slate-400 font-medium">Days</span>
                </div>
              </div>

              {/* Lifecycle Progress Bar */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Design Lifecycle Consumed:</span>
                  <span className="font-bold text-white font-mono">{age.lifecyclePercentage}% (~{age.expectedLife} yrs typical)</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      age.lifecyclePercentage > 80 ? 'bg-rose-500' : age.lifecyclePercentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${age.lifecyclePercentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Purchased on <strong className="text-slate-200">{age.startDateFormatted}</strong> ({age.totalMonths} months of active ownership).
                </p>
              </div>

              {/* Recommendation Notice */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Depreciation & Maintenance Context</span>
                </div>
                <p className="leading-relaxed text-slate-400">
                  {age.years < 2
                    ? 'Asset is in prime condition. Keep all warranty and invoice records securely backed up for resale equity.'
                    : age.years < 5
                    ? 'Asset is entering middle lifecycle. Ensure preventive servicing is done to maintain optimal efficiency and lower power/fuel costs.'
                    : 'Asset is in mature lifecycle. Check whether repair costs exceed 50% of current depreciated value before making major part repairs.'}
                </p>
              </div>
            </div>
          ) : age?.isFuture ? (
            <div className="py-12 text-center text-rose-400 text-sm">
              Purchase date cannot be in the future. Please select a past date.
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Please enter purchase date to calculate age.
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {onSaveToVault && (
              <button
                onClick={onSaveToVault}
                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Save to Asset Vault</span>
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
