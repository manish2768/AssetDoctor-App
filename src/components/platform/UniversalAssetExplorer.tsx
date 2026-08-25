import React, { useState } from 'react';
import {
  Car,
  Smartphone,
  Wrench,
  Home,
  Briefcase,
  Factory,
  Package,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { assetModuleRegistry } from '../../platform/modules/moduleRegistry';
import { AssetModuleDefinition } from '../../platform/modules/types';

export const UniversalAssetExplorer: React.FC = () => {
  const modules = assetModuleRegistry.listModules();
  const [selectedModuleId, setSelectedModuleId] = useState<string>(modules[0]?.moduleId || 'mod_vehicles');

  const selectedModule = modules.find(m => m.moduleId === selectedModuleId) || modules[0];

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Car': return <Car className="w-5 h-5 text-emerald-400" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'Wrench': return <Wrench className="w-5 h-5 text-teal-400" />;
      case 'Home': return <Home className="w-5 h-5 text-indigo-400" />;
      case 'Briefcase': return <Briefcase className="w-5 h-5 text-amber-400" />;
      case 'Factory': return <Factory className="w-5 h-5 text-rose-400" />;
      default: return <Package className="w-5 h-5 text-violet-400" />;
    }
  };

  return (
    <div className="w-full rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-black uppercase text-teal-400 tracking-wider">
              Universal Asset Intelligence
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Universal Asset Explorer
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Explore capability matrices, preventive maintenance rules, and document requirements across 7 asset tiers.
          </p>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {modules.map(mod => {
          const isActive = mod.moduleId === selectedModuleId;
          return (
            <button
              key={mod.moduleId}
              onClick={() => setSelectedModuleId(mod.moduleId)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                isActive
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              {getModuleIcon(mod.iconName)}
              <span>{mod.displayName}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Module Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Overview & Subcategories */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              {getModuleIcon(selectedModule.iconName)}
            </div>
            <div>
              <h3 className="text-base font-black text-white">{selectedModule.displayName}</h3>
              <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono">
                Category: {selectedModule.category} • v{selectedModule.version}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {selectedModule.description}
          </p>

          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
              Supported Subcategories
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedModule.supportedSubcategories.map((sub, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-medium"
                >
                  {sub}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
            <div>
              <span className="text-slate-500 font-semibold">Identifier: </span>
              <span className="font-mono text-slate-300">{selectedModule.capabilities.primaryIdentifierLabel}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Annual Depreciation: </span>
              <span className="font-mono text-amber-300">{selectedModule.valuationRule.annualDepreciationRate}% / Year</span>
            </div>
          </div>
        </div>

        {/* Center Column: Capability Matrix */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
            Declared Capability Matrix
          </span>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <CapabilityBadge label="Odometer Tracking" active={selectedModule.capabilities.hasOdometer} />
            <CapabilityBadge label="OEM Service Schedule" active={selectedModule.capabilities.hasServiceSchedule} />
            <CapabilityBadge label="Insurance Policy" active={selectedModule.capabilities.hasInsurance} />
            <CapabilityBadge label="PUC Emission Test" active={selectedModule.capabilities.hasPuc} />
            <CapabilityBadge label="Engine Maintenance" active={selectedModule.capabilities.hasEngineMaintenance} />
            <CapabilityBadge label="Filter Cleaning" active={selectedModule.capabilities.hasFilterCleaning} />
            <CapabilityBadge label="Battery Health" active={selectedModule.capabilities.hasBatteryHealth} />
            <CapabilityBadge label="Screen & Display" active={selectedModule.capabilities.hasScreenDisplay} />
            <CapabilityBadge label="OS & Software Updates" active={selectedModule.capabilities.hasOsSoftwareUpdates} />
            <CapabilityBadge label="Runtime Hours" active={selectedModule.capabilities.hasRuntimeHours} />
            <CapabilityBadge label="Statutory Calibration" active={selectedModule.capabilities.hasCalibration} />
            <CapabilityBadge label="Resale Valuation" active={selectedModule.capabilities.hasResaleEstimate} />
          </div>

          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="text-[10px] font-bold uppercase text-teal-400 block mb-1">
              Active Telemetry Model
            </span>
            {selectedModule.capabilities.serviceDueNotice}
          </div>
        </div>

        {/* Right Column: Built-in Maintenance Rules */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800/90 space-y-4">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
            Preventive Maintenance Rules ({selectedModule.maintenanceRules.length})
          </span>

          <div className="space-y-2.5">
            {selectedModule.maintenanceRules.map(rule => (
              <div key={rule.ruleId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{rule.name}</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {rule.intervalKm ? `${rule.intervalKm.toLocaleString()} KM` : rule.intervalHours ? `${rule.intervalHours} Hrs` : `${rule.intervalDays} Days`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{rule.actionText}</p>
              </div>
            ))}
          </div>

          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">
              Supported Document Types
            </span>
            <div className="flex flex-wrap gap-1">
              {selectedModule.supportedDocumentTypes.map((dt, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-400 border border-slate-800">
                  {dt}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CapabilityBadge: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
  <div className={`p-2 rounded-xl border flex items-center gap-2 ${
    active ? 'bg-emerald-500/10 border-emerald-500/20 text-slate-200' : 'bg-slate-900/40 border-slate-800/40 text-slate-600'
  }`}>
    {active ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />
    )}
    <span className="text-[11px] truncate font-medium">{label}</span>
  </div>
);
