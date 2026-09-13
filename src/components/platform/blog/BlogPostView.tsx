import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  Share2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Download,
  Bookmark,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import { BlogPost, BlogRepository } from '../../../platform/blog/blogData';

interface BlogPostViewProps {
  post: BlogPost;
  onNavigate: (path: string) => void;
  onOpenVaultApp?: () => void;
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({
  post,
  onNavigate,
  onOpenVaultApp
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [isCopied, setIsCopied] = useState(false);

  const relatedArticles = BlogRepository.getRelated(post.slug, 3);

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <article className="w-full max-w-4xl mx-auto space-y-10">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400">
        <button
          onClick={() => onNavigate('/')}
          className="hover:text-white transition cursor-pointer"
        >
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <button
          onClick={() => onNavigate('/blog')}
          className="hover:text-white transition cursor-pointer"
        >
          Blog
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <button
          onClick={() => onNavigate(`/blog/category/${post.category}`)}
          className="hover:text-white transition cursor-pointer uppercase text-emerald-400 font-semibold"
        >
          {post.categoryDisplayName}
        </button>
      </nav>

      {/* Article Header */}
      <header className="space-y-4 border-b border-slate-800 pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider font-mono">
            {post.categoryDisplayName}
          </span>
          <span className="text-xs text-slate-500">•</span>
          <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{post.readTime}</span>
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {post.h1}
        </h1>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              AD
            </div>
            <div>
              <span className="font-bold text-white block">{post.author}</span>
              <span className="text-[11px] text-slate-500">
                Published {new Date(post.publishedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • Updated {new Date(post.updatedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isCopied ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Short Direct Answer (Featured Snippet / Quick Answer) */}
      {post.directAnswer && (
        <section className="p-5 sm:p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-100 text-sm sm:text-base leading-relaxed space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Quick Direct Answer / त्वरित सीधा उत्तर</span>
          </div>
          <p className="text-white font-medium">{post.directAnswer}</p>
        </section>
      )}

      {/* Introduction */}
      <section className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-200 text-sm sm:text-base leading-relaxed space-y-3 font-normal">
        <p>{post.intro}</p>
      </section>

      {/* Table of Contents */}
      {post.tableOfContents && post.tableOfContents.length > 0 && (
        <section className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Table of Contents (विषय सूची)
          </span>
          <nav className="space-y-1.5">
            {post.tableOfContents.map((toc) => (
              <button
                key={toc.id}
                onClick={() => scrollToSection(toc.id)}
                className="block text-left text-xs sm:text-sm text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer hover:underline"
              >
                {toc.title}
              </button>
            ))}
          </nav>
        </section>
      )}

      {/* Main Content Sections */}
      <main className="space-y-10 text-slate-200 leading-relaxed text-sm sm:text-base">
        {post.sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-4 pt-2">
            <h2 className="text-2xl font-bold text-white tracking-tight border-b border-slate-800/80 pb-2">
              {section.heading}
            </h2>

            {section.paragraphs.map((p, pIdx) => (
              <p key={pIdx} className="text-slate-300 leading-relaxed text-sm sm:text-base">
                {p}
              </p>
            ))}

            {/* Practical Action Steps Callout */}
            {section.practicalSteps && section.practicalSteps.length > 0 && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                <span className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Practical Steps (महत्वपूर्ण कदम)</span>
                </span>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  {section.practicalSteps.map((step, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warning Callout Box */}
            {section.warning && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold text-rose-200 block">चेतावनी / Important Warning:</strong>
                  <p className="leading-relaxed">{section.warning}</p>
                </div>
              </div>
            )}

            {/* Pro Tip Box */}
            {section.tip && (
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs sm:text-sm flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold text-teal-200 block">Pro Tip:</strong>
                  <p className="leading-relaxed">{section.tip}</p>
                </div>
              </div>
            )}
          </section>
        ))}
      </main>

      {/* When Professional Service Is Required */}
      {post.professionalServiceNote && (
        <section className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-amber-500/30 text-slate-200 text-xs sm:text-sm space-y-2.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider font-mono">
            <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
            <span>When Professional Service Is Required (कब अधिकृत मैकेनिक/टेक्नीशियन बुलाएं)</span>
          </div>
          <p className="text-slate-300 leading-relaxed">{post.professionalServiceNote}</p>
        </section>
      )}

      {/* Embedded Related Free Tool Widget Card */}
      {post.relatedToolSlug && (
        <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
            <Sparkles className="w-4 h-4" />
            <span>Interactive Tool for this Topic</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">{post.relatedToolName}</h3>
              <p className="text-xs text-slate-300 max-w-md">
                Calculate numbers for your exact machine or vehicle online in 30 seconds without signing up.
              </p>
            </div>

            <button
              onClick={() => onNavigate(`/${post.relatedToolSlug.replace(/^\//, '')}`)}
              className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>Use Free Calculator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      )}

      {/* Frequently Asked Questions (Accordion) */}
      {post.faqs && post.faqs.length > 0 && (
        <section id="faqs" className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <span>Frequently Asked Questions (FAQs)</span>
          </h2>

          <div className="space-y-3">
            {post.faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-emerald-300 transition cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-emerald-400 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Asset Doctor App Download Callout */}
      <section className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white">
          Manage All Your Home & Vehicle Assets with Asset Doctor
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Snap bills, track warranties, receive proactive WhatsApp maintenance reminders, and protect your family’s physical equity with zero advertiser sharing.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('/download')}
            className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Asset Doctor Free</span>
          </button>
        </div>
      </section>

      {/* Related Articles Carousel / Grid */}
      {relatedArticles.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Related Knowledge Guides</h3>
            <button
              onClick={() => onNavigate('/blog')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
            >
              <span>Explore all articles</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedArticles.map((rel) => (
              <div
                key={rel.slug}
                onClick={() => onNavigate(`/blog/${rel.slug}`)}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    {rel.categoryDisplayName}
                  </span>
                  <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-2">
                    {rel.title}
                  </h4>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <span>{rel.readTime}</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <span>Read</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
