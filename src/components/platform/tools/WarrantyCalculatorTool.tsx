import React, { useState } from 'react';
import { ShieldCheck, Calendar, Clock, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Share2, Sparkles, RefreshCw } from 'lucide-react';

interface WarrantyCalculatorToolProps {
  onSaveToVault?: () => void;
  onDownloadApp?: () => void;
}

export const WarrantyCalculatorTool: React.FC<WarrantyCalculatorToolProps> = ({
  onSaveToVault,
  onDownloadApp
}) => {
  const [purchaseDate, setPurchaseDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [periodValue, setPeriodValue] = useState<number>(24);
  const [periodUnit, setPeriodUnit] = useState<'months' | 'years'>('months');
  const [assetName, setAssetName] = useState<string>('LG 1.5 Ton Split AC');

  // Compute calculations
  const calculateResult = () => {
    if (!purchaseDate) return null;
    const start = new Date(purchaseDate);
    if (isNaN(start.getTime())) return null;

    const expiry = new Date(start);
    if (periodUnit === 'months') {
      expiry.setMonth(expiry.getMonth() + Number(periodValue));
    } else {
      expiry.setFullYear(expiry.getFullYear() + Number(periodValue));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryMidnight = new Date(expiry);
    expiryMidnight.setHours(0, 0, 0, 0);

    const diffMs = expiryMidnight.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let status: 'active' | 'expiring_soon' | 'expired' = 'active';
    if (daysRemaining < 0) {
      status = 'expired';
    } else if (daysRemaining <= 30) {
      status = 'expiring_soon';
    }

    return {
      startDateFormatted: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      expiryDateFormatted: expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      daysRemaining,
      status
    };
  };

  const result = calculateResult();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <ShieldCheck className="w-4 h-4" />
          <span>100% Free Browser Tool</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Warranty Expiry Calculator
        </h1>
        <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          Instantly determine when your product warranty ends, calculate exact days remaining, and ensure you never miss free manufacturer claims or AMC renewals.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
        {/* Left Inputs Column */}
        <div className="lg:col-span-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Enter Purchase & Warranty Details</span>
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Asset / Product Name (Optional)</label>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Samsung Refrigerator, Car, iPhone 15"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Purchase Date (Invoice Date)</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Warranty Coverage Duration</label>
            <div className="grid grid-cols-12 gap-2">
              <input
                type="number"
                min="1"
                max="120"
                value={periodValue}
                onChange={(e) => setPeriodValue(Math.max(1, Number(e.target.value)))}
                className="col-span-7 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
              <select
                value={periodUnit}
                onChange={(e) => setPeriodUnit(e.target.value as any)}
                className="col-span-5 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition cursor-pointer"
              >
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Common Presets:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setPeriodValue(12); setPeriodUnit('months'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                1 Year Standard (Electronics)
              </button>
              <button
                type="button"
                onClick={() => { setPeriodValue(24); setPeriodUnit('months'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                2 Years (Appliances)
              </button>
              <button
                type="button"
                onClick={() => { setPeriodValue(5); setPeriodUnit('years'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                5 Years (Vehicle / Inverter)
              </button>
              <button
                type="button"
                onClick={() => { setPeriodValue(10); setPeriodUnit('years'); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              >
                10 Years (Compressor/Motor)
              </button>
            </div>
          </div>
        </div>

        {/* Right Output Results Column */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6">
          {result ? (
            <div className="space-y-6">
              {/* Status Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Warranty Status</span>
                {result.status === 'active' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Protection</span>
                  </span>
                )}
                {result.status === 'expiring_soon' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Expiring in {result.daysRemaining} Days</span>
                  </span>
                )}
                {result.status === 'expired' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Coverage Expired</span>
                  </span>
                )}
              </div>

              {/* Big Metric Display */}
              <div className="text-center py-4 rounded-2xl bg-slate-900/60 border border-slate-800/60 space-y-1">
                <span className="text-xs text-slate-400 font-medium">
                  {result.status === 'expired' ? 'Days Since Expiration' : 'Days Remaining'}
                </span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  result.status === 'expired' ? 'text-rose-400' : result.status === 'expiring_soon' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {result.status === 'expired' ? Math.abs(result.daysRemaining) : result.daysRemaining}
                </div>
                <span className="text-xs text-slate-400">
                  {result.status === 'expired' ? 'days out of warranty' : 'days of free repair & support'}
                </span>
              </div>

              {/* Date Comparison Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">Warranty Start Date</span>
                  <span className="text-white font-bold text-sm block">{result.startDateFormatted}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium block">Warranty Expiry Date</span>
                  <span className="text-white font-bold text-sm block">{result.expiryDateFormatted}</span>
                </div>
              </div>

              {/* Action Recommendation */}
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Recommendation</span>
                </div>
                <p className="leading-relaxed">
                  {result.status === 'active'
                    ? 'Keep your original tax invoice and serial number safely vaulted. File claims immediately if any hardware fault appears.'
                    : result.status === 'expiring_soon'
                    ? 'Check for any unusual noise, cooling loss, or defects before the deadline. Request an official inspection before free coverage lapses.'
                    : 'Your standard warranty has ended. Consider signing up for an OEM AMC (Annual Maintenance Contract) or third-party protection.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              Please enter valid purchase date and warranty duration to compute.
            </div>
          )}

          {/* Action Button */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {onSaveToVault && (
              <button
                onClick={onSaveToVault}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
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

      {/* Educational Walkthrough Guide */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white">How to Check & Protect Your Warranty in India</h3>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <li className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block text-sm">1. Tax Invoice is Mandatory</span>
            <p className="text-slate-400 leading-relaxed">
              In India, GST retail invoices are required for warranty claims by brands like Samsung, LG, Daikin, TVS, and Tata Motors.
            </p>
          </li>
          <li className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block text-sm">2. Split Component Warranties</span>
            <p className="text-slate-400 leading-relaxed">
              ACs and refrigerators frequently have 1 year comprehensive coverage and 10 years on inverter compressors or motors.
            </p>
          </li>
          <li className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
            <span className="font-bold text-white block text-sm">3. Automatic Digital Vaulting</span>
            <p className="text-slate-400 leading-relaxed">
              Asset Doctor extracts purchase dates and warranty clauses straight from invoice photos so you never miss a deadline.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
};
