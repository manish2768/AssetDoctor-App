import React, { useState } from 'react';
import { BookOpen, Calendar, Clock, ArrowRight, ChevronRight, Tag, Sparkles, Search } from 'lucide-react';
import { BlogRepository, BlogCategory, BlogPost, TOPIC_SEEDS } from '../../../platform/blog/blogData';

interface BlogHubViewProps {
  activeCategory?: BlogCategory;
  onNavigate: (path: string) => void;
}

export const BlogHubView: React.FC<BlogHubViewProps> = ({
  activeCategory,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const categories: { id: BlogCategory | 'all'; label: string; path: string }[] = [
    { id: 'all', label: 'All Articles', path: '/blog' },
    { id: 'vehicles', label: 'Vehicles (कार व बाइक)', path: '/blog/category/vehicles' },
    { id: 'appliances', label: 'Appliances (AC, फ्रिज, RO)', path: '/blog/category/appliances' },
    { id: 'warranty', label: 'Warranty & AMC (वारंटी गाइड)', path: '/blog/category/warranty' },
    { id: 'maintenance', label: 'Maintenance (रखरखाव)', path: '/blog/category/maintenance' }
  ];

  const allArticles = activeCategory
    ? BlogRepository.getByCategory(activeCategory)
    : BlogRepository.getAllPublished();

  const filteredArticles = searchQuery.trim()
    ? allArticles.filter(
        a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.intro.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allArticles;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <section className="text-center space-y-4 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <BookOpen className="w-4 h-4" />
          <span>Asset Doctor Knowledge Hub</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Practical Guides for Home & Vehicle Care
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Original, India-focused maintenance checklists, warranty claim advice, and troubleshooting tips written for real homeowners and vehicle owners.
        </p>

        {/* Search Bar */}
        <div className="max-w-md mx-auto relative pt-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AC, car service, warranty, RO..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </section>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin border-b border-slate-800">
        {categories.map((cat) => {
          const isActive = (!activeCategory && cat.id === 'all') || (activeCategory === cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => onNavigate(cat.path)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Articles Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredArticles.length} published guides</span>
          <span>Updated weekly</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((post) => (
            <article
              key={post.slug}
              onClick={() => onNavigate(`/blog/${post.slug}`)}
              className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition cursor-pointer flex flex-col justify-between space-y-4 group shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                    {post.categoryDisplayName}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{post.readTime}</span>
                  </span>
                </div>

                <h2 className="text-lg font-bold text-white group-hover:text-emerald-300 transition leading-snug">
                  {post.title}
                </h2>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {post.intro}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  {new Date(post.publishedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Read Guide</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Upcoming Topic Seeds Catalog */}
      <section className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-6">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">Knowledge Catalog</span>
          <h3 className="text-xl font-bold text-white">40 Verified Knowledge Topics in Progress</h3>
          <p className="text-xs text-slate-400">
            Our editorial lab is actively researching and indexing manufacturer service specifications for the following Indian household & vehicle topics:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {TOPIC_SEEDS.slice(0, 16).map((seed) => (
            <div
              key={seed.topicNumber}
              onClick={() => onNavigate(`/blog/${seed.suggestedSlug}`)}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>#{seed.topicNumber}</span>
                <span className="uppercase text-emerald-400 font-semibold">{seed.category}</span>
              </div>
              <span className="font-semibold text-slate-200 line-clamp-2">{seed.title}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
