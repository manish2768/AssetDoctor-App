import React, { useState } from 'react';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Plus,
  Car,
  Smartphone,
  Wrench,
  Home,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { KnowledgeHubService, KnowledgeProfile } from '../../../platform/knowledge/knowledgeHubData';

interface MaintenanceCheckerToolProps {
  onSaveToVault?: () => void;
}

export const MaintenanceCheckerTool: React.FC<MaintenanceCheckerToolProps> = ({ onSaveToVault }) => {
  const [selectedCat, setSelectedCat] = useState<'vehicles' | 'electronics' | 'home-appliances' | 'household-assets'>('vehicles');
  const [selectedBrandModel, setSelectedBrandModel] = useState('kn-tvs-ronin-225');
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const availableProfiles = KnowledgeHubService.getProfilesByCategory(selectedCat);
  const currentProfile = KnowledgeHubService.getProfileById(selectedBrandModel);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-wider font-mono">
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Universal Maintenance Checker</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Know What Your Asset Needs and When
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Check manufacturer service intervals, routine inspection checklists, and critical early warning signs across any physical asset.
        </p>
      </div>

      {/* Main Container */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Category Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => {
              setSelectedCat('vehicles');
              setSelectedBrandModel('kn-tvs-ronin-225');
              setIsCustomMode(false);
            }}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedCat === 'vehicles' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Vehicles</span>
          </button>
          <button
            onClick={() => {
              setSelectedCat('electronics');
              setSelectedBrandModel('kn-apple-iphone-15-16');
              setIsCustomMode(false);
            }}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedCat === 'electronics' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Electronics</span>
          </button>
          <button
            onClick={() => {
              setSelectedCat('home-appliances');
              setSelectedBrandModel('kn-daikin-inverter-ac');
              setIsCustomMode(false);
            }}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedCat === 'home-appliances' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Appliances</span>
          </button>
          <button
            onClick={() => {
              setSelectedCat('household-assets');
              setSelectedBrandModel('kn-luminous-solar-tubular-ups');
              setIsCustomMode(false);
            }}
            className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              selectedCat === 'household-assets' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Living Assets</span>
          </button>
        </div>

        {/* Brand & Model Selector */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Select Verified Hardware Model
            </label>
            {!isCustomMode ? (
              <select
                value={selectedBrandModel}
                onChange={(e) => setSelectedBrandModel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {availableProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} — {p.model}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Enter Brand (e.g. Sony)"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Enter Model (e.g. Bravia 55)"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                />
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCustomMode(!isCustomMode)}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline cursor-pointer self-end sm:self-center"
          >
            {isCustomMode ? 'Choose from verified database' : 'Asset not listed? Enter custom'}
          </button>
        </div>

        {/* Results Body */}
        {currentProfile && !isCustomMode ? (
          <div className="space-y-6">
            {/* Key Schedule Frequencies */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Recommended Service</span>
                <span className="text-base font-black text-cyan-400 block">{currentProfile.maintenanceFrequency.recommendedInterval}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Routine Inspection</span>
                <span className="text-base font-black text-emerald-400 block">{currentProfile.maintenanceFrequency.routineCheckInterval}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Major Overhaul</span>
                <span className="text-base font-black text-teal-400 block">{currentProfile.maintenanceFrequency.majorServiceInterval}</span>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Scheduled Maintenance Checklist
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {currentProfile.keyMaintenanceTasks.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Signs */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Early Warning Symptoms
              </h4>
              <div className="space-y-2">
                {currentProfile.warningSigns.map((w, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>{w.symptom}</span>
                      </span>
                      <p className="text-[11px] text-slate-400">
                        <strong className="text-slate-300">Cause:</strong> {w.probableCause}
                      </p>
                      <p className="text-[11px] text-cyan-300">
                        <strong className="text-slate-300">Action:</strong> {w.actionRequired}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                      {w.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance Footer */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-300 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Source: {currentProfile.provenance.sourceName} (Verified {currentProfile.provenance.lastVerifiedDate})</span>
              </span>
              <span className="text-emerald-400 font-bold">{Math.round(currentProfile.provenance.confidence * 100)}% Confidence</span>
            </div>
          </div>
        ) : (
          /* Generic Estimate Fallback */
          <div className="p-6 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Info className="w-4 h-4" />
              <span>Generic estimate — manufacturer schedule unavailable</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              We do not have a verified OEM maintenance matrix on file for {customBrand || 'this custom brand'} {customModel}. Here is the industry standard heuristic for {selectedCat}:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
              <li>Perform routine operational checks every 30-60 days.</li>
              <li>Inspect consumable filters, lubricants, or battery health every 180 days.</li>
              <li>Always refer to the manufacturer user manual shipped with the hardware for torque specs and fluid grades.</li>
            </ul>
          </div>
        )}

        {/* App CTA */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-white">Track This Asset Automatically</h4>
            <p className="text-xs text-slate-400">Receive proactive WhatsApp and notification alerts before service intervals pass.</p>
          </div>
          <button
            onClick={onSaveToVault}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Save to Asset Doctor</span>
          </button>
        </div>
      </div>
    </div>
  );
};
