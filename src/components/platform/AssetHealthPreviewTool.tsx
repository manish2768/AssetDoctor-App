import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Car,
  Smartphone,
  Wrench,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { AssetHealthEngine } from '../../platform/intelligence/healthEngine';
import { createUniversalAsset, AssetCategoryType } from '../../platform/core/universalAssetSchema';

export const AssetHealthPreviewTool: React.FC = () => {
  const [category, setCategory] = useState<AssetCategoryType>('VEHICLE');
  const [assetName, setAssetName] = useState('TVS Ronin 225');
  const [brand, setBrand] = useState('TVS');
  const [purchasePrice, setPurchasePrice] = useState(154000);
  const [warrantyStatus, setWarrantyStatus] = useState<'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'>('ACTIVE');
  const [primaryMetric, setPrimaryMetric] = useState(6120); // KM for vehicle, Days since clean for AC, Battery % for phone

  const mockAsset = createUniversalAsset({
    name: assetName,
    category,
    brand,
    purchasePrice,
    warranty: {
      hasWarranty: true,
      warrantyStatus,
      expiryDate: warrantyStatus === 'ACTIVE' ? '2027-02-15' : '2026-09-01'
    },
    categoryData: {
      odometerKm: category === 'VEHICLE' ? primaryMetric : undefined,
      daysSinceLastFilterClean: category === 'APPLIANCE' ? primaryMetric : undefined,
      batteryHealthPercent: category === 'ELECTRONICS' ? primaryMetric : undefined
    }
  });

  const health = AssetHealthEngine.calculateHealth(mockAsset);

  const handleCategoryChange = (cat: AssetCategoryType) => {
    setCategory(cat);
    if (cat === 'VEHICLE') {
      setAssetName('TVS Ronin 225');
      setBrand('TVS');
      setPurchasePrice(154000);
      setPrimaryMetric(6120);
    } else if (cat === 'APPLIANCE') {
      setAssetName('Daikin 1.5 Ton Inverter AC');
      setBrand('Daikin');
      setPurchasePrice(42000);
      setPrimaryMetric(95);
    } else if (cat === 'ELECTRONICS') {
      setAssetName('Apple iPhone 16 Pro');
      setBrand('Apple');
      setPurchasePrice(119900);
      setPrimaryMetric(88);
    } else {
      setAssetName('Solar Inverter System');
      setBrand('Luminous');
      setPurchasePrice(35000);
      setPrimaryMetric(30);
    }
  };

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
              Free Intelligent Tool
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Universal Asset Health Calculator
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Evaluate composite health score, risk factors, and maintenance compliance across any asset type.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCategoryChange('VEHICLE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            category === 'VEHICLE'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Vehicle</span>
        </button>

        <button
          onClick={() => handleCategoryChange('APPLIANCE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            category === 'APPLIANCE'
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Home Appliance</span>
        </button>

        <button
          onClick={() => handleCategoryChange('ELECTRONICS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
            category === 'ELECTRONICS'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Electronics / Smartphone</span>
        </button>
      </div>

      {/* Interactive Controls & Live Score Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
            Asset Telemetry Parameters
          </span>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">Asset Name & Model</label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Purchase Price (₹)</label>
                <input
                  type="number"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Warranty Status</label>
                <select
                  value={warrantyStatus}
                  onChange={(e) => setWarrantyStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ACTIVE">Active Coverage</option>
                  <option value="EXPIRING_SOON">Expiring Soon (30 Days)</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1">
                {category === 'VEHICLE' ? 'Odometer Distance (KM)' : category === 'APPLIANCE' ? 'Days Since Last Filter Clean' : 'Battery Health Percentage (%)'}
              </label>
              <input
                type="number"
                value={primaryMetric}
                onChange={(e) => setPrimaryMetric(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Health Gauge & Output */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              Health Diagnostic Results
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Model v{health.modelVersion}
            </span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Health Score</span>
              <span className="text-4xl font-black text-emerald-400 font-mono">{health.score} / 100</span>
              <span className="text-xs font-bold text-slate-300 block mt-0.5">{health.statusLabel}</span>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 flex items-center justify-center bg-emerald-500/10">
              <Activity className="w-7 h-7 text-emerald-400" />
            </div>
          </div>

          {/* Factors Breakdown */}
          <div className="space-y-2 text-xs">
            {health.positiveFactors.map((pos, idx) => (
              <div key={idx} className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{pos}</span>
              </div>
            ))}
            {health.riskFactors.map((risk, idx) => (
              <div key={idx} className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
