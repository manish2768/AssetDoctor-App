import React from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Link2,
  ChevronRight,
  Plus
} from 'lucide-react';
import { SeoPageDefinition, SeoRegistry } from '../../platform/seo/seoRegistry';
import { SmartDocumentAnalyzerTool } from './SmartDocumentAnalyzerTool';
import { RepairVsReplaceTool } from './RepairVsReplaceTool';
import { AssetHealthPreviewTool } from './AssetHealthPreviewTool';
import { AssetPassportPreview } from './AssetPassportPreview';
import { UniversalAssetExplorer } from './UniversalAssetExplorer';

interface SeoToolPageTemplateProps {
  pageDefinition: SeoPageDefinition;
  onNavigateToTool?: (slug: string) => void;
  onOpenApp?: () => void;
}

export const SeoToolPageTemplate: React.FC<SeoToolPageTemplateProps> = ({
  pageDefinition,
  onNavigateToTool,
  onOpenApp
}) => {
  const renderToolComponent = () => {
    switch (pageDefinition.toolType) {
      case 'DOCUMENT_ANALYZER':
        return <SmartDocumentAnalyzerTool />;
      case 'REPAIR_VS_REPLACE':
        return <RepairVsReplaceTool />;
      case 'HEALTH_CHECK':
        return <AssetHealthPreviewTool />;
      case 'PASSPORT':
        return <AssetPassportPreview />;
      case 'UNIVERSAL_EXPLORER':
      case 'AC_CARE':
      case 'VEHICLE_CALCULATOR':
      case 'PHONE_HEALTH':
      case 'WARRANTY_CHECKER':
      default:
        return <AssetHealthPreviewTool />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-10 py-6">
      {/* 1. Page Header & Semantic H1 */}
      <header className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Asset Doctor Universal Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
          {pageDefinition.h1}
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          {pageDefinition.intro}
        </p>
      </header>

      {/* 2. Interactive Tool Container */}
      <section aria-label="Interactive Tool">
        {renderToolComponent()}
      </section>

      {/* 3. Traffic Conversion Loop: Save to Asset Doctor */}
      <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
            Never Lose Another Bill or Warranty
          </span>
          <h3 className="text-xl font-black text-white">
            Save This Asset to Your Private Vault
          </h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Free forever for your first 5 assets. Encrypted offline-first storage with automated WhatsApp alerts.
          </p>
        </div>

        <button
          onClick={onOpenApp}
          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Save to Asset Doctor</span>
        </button>
      </section>

      {/* 4. Semantic Supporting Content */}
      <article className="space-y-8">
        {pageDefinition.supportingContent.map((sec, idx) => (
          <div key={idx} className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-xl font-black text-white">{sec.sectionTitle}</h2>
            <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {sec.paragraphs.map((p, pIdx) => (
                <p key={pIdx}>{p}</p>
              ))}
            </div>

            {sec.keyTakeaways && sec.keyTakeaways.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Key Insights:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  {sec.keyTakeaways.map((k, kIdx) => (
                    <div key={kIdx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </article>

      {/* 5. Frequently Asked Questions (FAQ) */}
      {pageDefinition.faq && pageDefinition.faq.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <span>Frequently Asked Questions</span>
          </h2>

          <div className="space-y-3">
            {pageDefinition.faq.map((faq, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <h3 className="text-sm font-bold text-white">{faq.question}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Internal Linking Engine */}
      <section className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
            Related Asset Intelligence Tools & Guides
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pageDefinition.relatedToolSlugs.map((slug, idx) => {
            const relPage = SeoRegistry.getPage(slug);
            if (!relPage) return null;
            return (
              <div
                key={idx}
                onClick={() => onNavigateToTool && onNavigateToTool(slug)}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="truncate pr-2">
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 truncate">{relPage.h1}</h4>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">{relPage.category}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0" />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
