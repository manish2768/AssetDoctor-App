import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Wrench, Shield, Smartphone, Car, FileText, ArrowRight, ChevronRight } from 'lucide-react';
import { KnowledgeHubService } from '../../platform/knowledge/knowledgeHubData';
import { assetModuleRegistry } from '../../platform/modules/moduleRegistry';

interface UniversalSearchBarProps {
  onSelectKnowledge?: (profileId: string) => void;
  onSelectTool?: (toolSlug: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const UniversalSearchBar: React.FC<UniversalSearchBarProps> = ({
  onSelectKnowledge,
  onSelectTool,
  onSelectCategory
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const placeholderExamples = [
    'TVS Ronin service schedule',
    'Samsung AC filter cleaning',
    'iPhone battery health',
    'RO membrane replacement',
    'Refrigerator maintenance',
    'Solar inverter battery care'
  ];

  const suggestionChips = [
    { label: 'TVS Ronin service', type: 'knowledge', target: 'kn-tvs-ronin-225' },
    { label: 'Honda Activa maintenance', type: 'tool', target: 'tools/maintenance-checker' },
    { label: 'iPhone battery health', type: 'knowledge', target: 'kn-apple-iphone-15-16' },
    { label: 'AC filter cleaning', type: 'knowledge', target: 'kn-daikin-inverter-ac' },
    { label: 'Laptop warranty', type: 'knowledge', target: 'kn-dell-latitude-enterprise' },
    { label: 'Repair or replace', type: 'tool', target: 'tools/repair-or-replace' }
  ];

  // Rotate placeholder every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderExamples.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const knowledgeResults = query.trim().length > 1
    ? KnowledgeHubService.searchProfiles(query)
    : [];

  const matchedModules = query.trim().length > 1
    ? assetModuleRegistry.listModules().filter(m =>
        m.displayName.toLowerCase().includes(query.toLowerCase()) ||
        m.supportedSubcategories.some(s => s.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  // Match system tools
  const tools = [
    { name: 'Repair vs. Replace Calculator', slug: 'tools/repair-or-replace', desc: 'Should you repair it or buy a new one?' },
    { name: 'Warranty Expiry Checker', slug: 'tools/warranty-checker', desc: 'Find warranty coverage & statutory rights' },
    { name: 'Maintenance Checker', slug: 'tools/maintenance-checker', desc: 'Authoritative OEM service countdown' },
    { name: 'Asset Health Score', slug: 'tools/asset-health-score', desc: '100-point transparent health audit' },
    { name: 'Total Cost of Ownership (TCO)', slug: 'tools/ownership-cost', desc: 'Real lifetime ownership cost' },
    { name: 'Bill & Invoice Analyzer', slug: 'tools/invoice-analyzer', desc: 'OCR service bill & document parser' }
  ];

  const matchedTools = query.trim().length > 1
    ? tools.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.desc.toLowerCase().includes(query.toLowerCase()) || t.slug.includes(query.toLowerCase()))
    : [];

  const handleSelectChip = (chip: typeof suggestionChips[0]) => {
    if (chip.type === 'knowledge' && onSelectKnowledge) {
      onSelectKnowledge(chip.target);
    } else if (chip.type === 'tool' && onSelectTool) {
      onSelectTool(chip.target);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 relative z-30">
      {/* Header Section */}
      <div className="text-center space-y-1.5">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Find Anything About Your Asset
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Search a brand, model, problem, maintenance rule, warranty question or asset tool.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className={`relative flex items-center bg-slate-900/95 backdrop-blur-2xl border rounded-2xl transition-all shadow-2xl ${
        isFocused ? 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
      }`}>
        <div className="pl-4.5 pr-2 text-slate-400">
          <Search className="w-5 h-5 text-emerald-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 300)}
          placeholder={placeholderExamples[placeholderIndex]}
          className="w-full py-4 pr-4 bg-transparent text-xs sm:text-sm font-medium text-white placeholder-slate-500 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="pr-4 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          Popular:
        </span>
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSelectChip(chip)}
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer text-[11px] font-semibold"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Dropdown Live Results */}
      {query.trim().length > 1 && isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950/98 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 max-h-[450px] overflow-y-auto">
          {/* Matched Tools */}
          {matchedTools.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Interactive Asset Tools
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedTools.map((tool, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectTool && onSelectTool(tool.slug)}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-400">{tool.name}</h4>
                      <p className="text-[10px] text-slate-400">{tool.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched OEM Knowledge Guides */}
          {knowledgeResults.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Verified OEM Knowledge & Maintenance Standards
              </span>
              <div className="space-y-2">
                {knowledgeResults.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectKnowledge && onSelectKnowledge(p.id)}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-slate-800 text-emerald-400 font-mono">
                          {p.brand}
                        </span>
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-300">{p.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{p.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Asset Categories */}
          {matchedModules.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Asset Categories
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedModules.map((m) => (
                  <div
                    key={m.moduleId}
                    onClick={() => onSelectCategory && onSelectCategory(m.moduleId)}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 cursor-pointer"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{m.displayName}</h4>
                      <p className="text-[10px] text-slate-400">{m.supportedSubcategories.slice(0, 3).join(', ')}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Explore
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedTools.length === 0 && knowledgeResults.length === 0 && matchedModules.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 space-y-1">
              <p>No verified OEM knowledge found for "{query}".</p>
              <p className="text-[11px] text-slate-500">Try searching for TVS Ronin, Daikin AC, iPhone battery, or Repair or Replace.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
