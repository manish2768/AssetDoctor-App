import React from 'react';
import {
  Wrench,
  ShieldCheck,
  CalendarCheck,
  Activity,
  DollarSign,
  FileSearch,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface PublicToolsGridProps {
  onSelectTool: (toolSlug: string) => void;
}

export const PublicToolsGrid: React.FC<PublicToolsGridProps> = ({ onSelectTool }) => {
  const tools = [
    {
      id: 'repair-replace',
      title: 'Repair or Replace',
      tagline: 'Should you repair it or buy a new one?',
      description: 'Algorithmic 50% Fair Market Value economic calculation evaluating repair quotes against asset depreciation and remaining lifespan.',
      icon: <Wrench className="w-6 h-6 text-amber-400" />,
      borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      badge: '50% Valuation Rule',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      slug: 'tools/repair-or-replace'
    },
    {
      id: 'warranty-checker',
      title: 'Warranty Checker',
      tagline: 'Find your warranty status and important dates.',
      description: 'Calculate exact countdown days, standard manufacturer coverage terms, extended AMC policies, and statutory consumer rights.',
      icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      badge: 'Expiry Countdown',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      slug: 'tools/warranty-checker'
    },
    {
      id: 'maintenance-checker',
      title: 'Maintenance Checker',
      tagline: 'Know what your asset needs and when.',
      description: 'Authoritative OEM service intervals, lubrication schedules, and early warning signs across vehicles, phones, laptops, and appliances.',
      icon: <CalendarCheck className="w-6 h-6 text-cyan-400" />,
      borderHover: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      badge: 'Verified OEM Matrix',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      slug: 'tools/maintenance-checker'
    },
    {
      id: 'asset-health-score',
      title: 'Asset Health Score',
      tagline: 'See how healthy your asset is.',
      description: 'Transparent 100-point physical and operational health audit factoring age, maintenance history, warranty, and documentation completeness.',
      icon: <Activity className="w-6 h-6 text-teal-400" />,
      borderHover: 'hover:border-teal-500/50 hover:shadow-teal-500/10',
      badge: 'Transparent 100-Point Audit',
      badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      slug: 'tools/asset-health-score'
    },
    {
      id: 'ownership-cost',
      title: 'Asset Cost Calculator',
      tagline: 'Understand the real cost of owning an asset.',
      description: 'Calculate Total Cost of Ownership (TCO) including capital depreciation, scheduled maintenance, energy consumption, and compliance.',
      icon: <DollarSign className="w-6 h-6 text-indigo-400" />,
      borderHover: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10',
      badge: 'Lifetime TCO Analysis',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      slug: 'tools/ownership-cost'
    },
    {
      id: 'invoice-analyzer',
      title: 'Bill & Invoice Analyzer',
      tagline: 'Understand what is actually on your bill.',
      description: 'Scan purchase invoices and repair job cards to extract line items, taxes, odometer milestones, warranty clues, and service dates.',
      icon: <FileSearch className="w-6 h-6 text-sky-400" />,
      borderHover: 'hover:border-sky-500/50 hover:shadow-sky-500/10',
      badge: 'Universal OCR Parser',
      badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
      slug: 'tools/invoice-analyzer'
    }
  ];

  return (
    <section className="w-full space-y-6">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Asset Intelligence Suite</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Free Asset Tools
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Useful answers for the things you own. Free, instant, and privacy-first.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => onSelectTool(tool.slug)}
            className={`p-6 rounded-3xl bg-slate-900/80 border border-slate-800 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-4 hover:shadow-2xl ${tool.borderHover}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                  {tool.icon}
                </div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border font-mono ${tool.badgeColor}`}>
                  {tool.badge}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs font-bold text-emerald-400 mt-0.5">
                  {tool.tagline}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs font-bold text-slate-300 group-hover:text-emerald-400">
              <span>Launch Free Calculator</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
