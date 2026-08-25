import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export const PlatformFaqSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is Asset Doctor and how is it different from vehicle-only apps?',
      a: 'Asset Doctor is a Universal Asset Intelligence & Lifecycle Platform. Unlike traditional automotive-only tools, Asset Doctor manages vehicles, smartphones, laptops, ACs, washing machines, solar power systems, furniture, and commercial assets under a unified, encrypted architecture.'
    },
    {
      q: 'Are the public tools like Repair vs. Replace and Warranty Checker free?',
      a: 'Yes, 100% free. You can run unlimited calculations on repair economics, depreciation curves, warranty expiration countdowns, and maintenance intervals without creating an account or logging in.'
    },
    {
      q: 'How does the Repair vs. Replace engine calculate its recommendations?',
      a: 'The engine implements the standard 50% Fair Market Valuation (FMV) economic rule alongside age-to-lifespan ratios, prior repair frequencies (identifying money pits), and active warranty protections to generate an objective mathematical score (0-100) and actionable next steps.'
    },
    {
      q: 'How does the Document & Invoice Analyzer extract warranty and service information?',
      a: 'Our client-side OCR engine scans GST invoices, service job cards, and warranty policies to extract line items, merchant tax IDs, serial/IMEI numbers, odometer readings (for vehicles only), and warranty expiry clauses.'
    },
    {
      q: 'Is my vaulted data private and secure?',
      a: 'Absolutely. Asset Doctor enforces client-side AES-256 encryption. We never sell your asset details, maintenance history, or contact records to third-party advertisers or data brokers. All data is DPDP and GDPR compliant.'
    },
    {
      q: 'What is an Asset Passport and how does it help with resale value?',
      a: 'An Asset Passport is a verified cryptographic digital record consolidating purchase invoices, periodic service milestones, active warranties, and repair history. Sharing a passport with prospective buyers verifies genuine provenance and boosts resale confidence.'
    }
  ];

  return (
    <section className="w-full max-w-4xl mx-auto space-y-6">
      {/* Section Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider font-mono">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Everything You Need to Know
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Clear answers on how Asset Doctor manages, protects, and values all your physical assets.
        </p>
      </div>

      {/* Accordions */}
      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isOpen ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="font-bold text-white text-sm sm:text-base leading-snug">
                  {faq.q}
                </span>
                <span className="text-emerald-400 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
