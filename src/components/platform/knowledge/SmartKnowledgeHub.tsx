import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Plus,
  Car,
  Smartphone,
  Wrench,
  Home,
  Info,
  Clock,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  KnowledgeHubService,
  KnowledgeProfile,
  KnowledgeCategory,
  KNOWLEDGE_PROFILES
} from '../../../platform/knowledge/knowledgeHubData';

interface SmartKnowledgeHubProps {
  initialCategory?: KnowledgeCategory;
  onSelectCalculator?: (toolSlug: string) => void;
  onOpenVaultApp?: () => void;
}

export const SmartKnowledgeHub: React.FC<SmartKnowledgeHubProps> = ({
  initialCategory,
  onSelectCalculator,
  onOpenVaultApp
}) => {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>(initialCategory || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<KnowledgeProfile | null>(null);

  const filteredProfiles = useMemo(() => {
    return KnowledgeHubService.searchProfiles(
      searchQuery,
      selectedCategory === 'all' ? undefined : selectedCategory
    );
  }, [searchQuery, selectedCategory]);

  const categories: { id: KnowledgeCategory | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Categories', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'vehicles', label: 'Vehicles & Automotive', icon: <Car className="w-3.5 h-3.5" /> },
    { id: 'electronics', label: 'Smartphones & Electronics', icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: 'home-appliances', label: 'Home Appliances', icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: 'household-assets', label: 'Household & Living Assets', icon: <Home className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="w-full space-y-8">
      {/* 1. Knowledge Hub Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Verified OEM Intelligence Hub</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Smart Asset Knowledge & Maintenance Standards
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Authoritative manufacturer service intervals, early warning symptoms, useful lifespan estimates, and document checklists across all your physical assets.
        </p>
      </div>

      {/* 2. Search & Category Filter Bar */}
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by brand, model, symptom (e.g. 'Ronin', 'Creta DPF', 'AC filter clean', 'iPhone battery')..."
            className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 shadow-xl transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategory === cat.id ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {cat.id === 'all'
                  ? KNOWLEDGE_PROFILES.length
                  : KNOWLEDGE_PROFILES.filter(p => p.category === cat.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Knowledge Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProfiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => setSelectedProfile(profile)}
            className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-2xl hover:shadow-emerald-500/5 relative overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                  {profile.brand}
                </span>
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Verified</span>
                </span>
              </div>

              <div>
                <h3 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                  {profile.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {profile.subtitle}
                </p>
              </div>

              {/* Useful Life & Interval Tags */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Service Interval</span>
                  <span className="font-bold text-emerald-400 truncate block mt-0.5">
                    {profile.maintenanceFrequency.recommendedInterval}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Useful Lifespan</span>
                  <span className="font-bold text-cyan-400 block mt-0.5">
                    ~{profile.estimatedUsefulLifeYears} Years
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs font-bold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              <span>View Full OEM Guidelines</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Full Knowledge Card Modal Details */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {selectedProfile.categoryDisplayName}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {selectedProfile.brand} · {selectedProfile.model}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                  {selectedProfile.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Key Service Frequencies */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Recommended Service</span>
                <span className="font-bold text-emerald-400 text-sm">{selectedProfile.maintenanceFrequency.recommendedInterval}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Routine Inspection</span>
                <span className="font-bold text-cyan-400">{selectedProfile.maintenanceFrequency.routineCheckInterval}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Standard Warranty</span>
                <span className="font-bold text-teal-400 text-[11px] leading-tight block">{selectedProfile.standardWarrantySummary}</span>
              </div>
            </div>

            {/* Key Tasks */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Key Preventive Maintenance Tasks
              </h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                {selectedProfile.keyMaintenanceTasks.map((task, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{task}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Signs & Symptoms */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Critical Warning Signs & Immediate Actions
              </h4>
              <div className="space-y-2">
                {selectedProfile.warningSigns.map((warn, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      warn.urgency === 'CRITICAL'
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                        : warn.urgency === 'HIGH'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 ${warn.urgency === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`} />
                        <span>{warn.symptom}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono bg-slate-900 border border-slate-800">
                        {warn.urgency}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      <strong>Probable Cause:</strong> {warn.probableCause}
                    </p>
                    <p className="text-[11px] text-emerald-300">
                      <strong>Action:</strong> {warn.actionRequired}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Checklist */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Essential Document Checklist
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedProfile.documentChecklist.map((doc, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block">{doc.name}</span>
                      <span className="text-[10px] text-slate-400">{doc.requiredFor}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Source Provenance Footer */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-400 font-mono">
              <div>
                <span className="block text-slate-300 font-bold">Source: {selectedProfile.provenance.sourceName}</span>
                <span className="text-[10px] text-slate-500">Verified on {selectedProfile.provenance.lastVerifiedDate} · Confidence: {Math.round(selectedProfile.provenance.confidence * 100)}%</span>
              </div>
              <button
                onClick={() => {
                  setSelectedProfile(null);
                  if (onOpenVaultApp) onOpenVaultApp();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Track This Asset in Vault</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
