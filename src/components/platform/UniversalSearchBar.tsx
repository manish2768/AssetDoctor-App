import React, { useState } from 'react';
import { Search, Sparkles, Wrench, Shield, Smartphone, Car, FileText, ArrowRight } from 'lucide-react';
import { assetKnowledgeEngine } from '../../platform/intelligence/knowledgeEngine';
import { assetModuleRegistry } from '../../platform/modules/moduleRegistry';

interface UniversalSearchBarProps {
  onSelectResult?: (result: any) => void;
}

export const UniversalSearchBar: React.FC<UniversalSearchBarProps> = ({ onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const sampleSearches = [
    'TVS Ronin service schedule',
    'Daikin AC filter cleaning',
    'iPhone battery warranty',
    'Royal Enfield oil grade',
    'RO membrane maintenance'
  ];

  const knowledgeResults = query.trim().length > 1
    ? assetKnowledgeEngine.queryKnowledge('', '', query)
    : [];

  const matchedModules = query.trim().length > 1
    ? assetModuleRegistry.listModules().filter(m =>
        m.displayName.toLowerCase().includes(query.toLowerCase()) ||
        m.supportedSubcategories.some(s => s.toLowerCase().includes(query.toLowerCase()))
      )
    : [];

  return (
    <div className="w-full max-w-3xl mx-auto relative z-30">
      {/* Search Input Bar */}
      <div className={`relative flex items-center bg-slate-900/90 backdrop-blur-xl border rounded-2xl transition-all shadow-2xl ${
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
          onBlur={() => setTimeout(() => setIsFocused(false), 250)}
          placeholder="Search any asset, brand, maintenance rule, or tool (e.g. 'Samsung AC filter', 'Ronin service')..."
          className="w-full py-4 pr-4 bg-transparent text-sm sm:text-base font-medium text-white placeholder-slate-500 focus:outline-none"
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

      {/* Suggested Quick Tags */}
      {!query && (
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-400">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Trending:
          </span>
          {sampleSearches.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(s)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer text-[11px]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Instant Results Dropdown */}
      {query.trim().length > 1 && isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl p-4 space-y-4 max-h-[420px] overflow-y-auto">
          {/* Matched Modules */}
          {matchedModules.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                Asset Categories & Modules
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedModules.map(m => (
                  <div
                    key={m.moduleId}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between hover:border-emerald-500/40 cursor-pointer"
                    onClick={() => onSelectResult && onSelectResult(m)}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{m.displayName}</h4>
                      <p className="text-[10px] text-slate-400">{m.supportedSubcategories.slice(0, 3).join(', ')}</p>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Module
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Knowledge Records */}
          {knowledgeResults.length > 0 ? (
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                Verified Asset Knowledge ({knowledgeResults.length})
              </span>
              <div className="space-y-2">
                {knowledgeResults.map(k => (
                  <div
                    key={k.knowledgeId}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer"
                    onClick={() => onSelectResult && onSelectResult(k)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wide">
                        {k.brand} • {k.topic.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Source: {k.provenance.sourceName}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">{k.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{k.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : matchedModules.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No direct knowledge matches for &quot;{query}&quot;. Try searching for specific models (e.g. &quot;Ronin&quot;, &quot;Daikin&quot;, &quot;iPhone&quot;).
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
