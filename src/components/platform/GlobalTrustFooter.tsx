import React from 'react';
import { Shield, Mail, CheckCircle2 } from 'lucide-react';

interface GlobalTrustFooterProps {
  onNavigateTab: (tab: string) => void;
  onSelectTool?: (toolSlug: string) => void;
}

export const GlobalTrustFooter: React.FC<GlobalTrustFooterProps> = ({
  onNavigateTab,
  onSelectTool
}) => {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (tab: string, e: React.MouseEvent) => {
    e.preventDefault();
    onNavigateTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-white/10 bg-[#070D18]/90 text-slate-400 mt-20 pt-16 pb-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
        {/* Top Grid: Brand + 4 Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand Column (2 cols on md) */}
          <div className="col-span-2 space-y-4">
            <a
              href="/"
              onClick={(e) => handleLinkClick('home', e)}
              className="flex items-center gap-2.5 cursor-pointer inline-flex"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-tight block leading-tight">
                  Asset Doctor
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                  Universal Intelligence
                </span>
              </div>
            </a>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Universal asset intelligence and lifecycle platform helping individuals, families, and businesses understand, maintain, and protect everything they own.
            </p>

            <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-emerald-400/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Encrypted • Zero Advertiser Sharing</span>
            </div>
          </div>

          {/* Column 1: PLATFORM */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white">
              Platform
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="/"
                  onClick={(e) => handleLinkClick('home', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/tools"
                  onClick={(e) => handleLinkClick('tools_hub', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Free Tools
                </a>
              </li>
              <li>
                <a
                  href="/knowledge"
                  onClick={(e) => handleLinkClick('knowledge_hub', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Knowledge Hub
                </a>
              </li>
              <li>
                <a
                  href="/assets/explore"
                  onClick={(e) => handleLinkClick('asset_explorer', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Explore Assets
                </a>
              </li>
              <li>
                <a
                  href="/tools/document-analyzer"
                  onClick={(e) => handleLinkClick('invoice_analyzer', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Bill Analyzer
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: COMPANY & LEGAL */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white">
              Company &amp; Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="/about"
                  onClick={(e) => handleLinkClick('about', e)}
                  className="hover:text-emerald-400 transition font-bold text-slate-300"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLinkClick('contact', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy"
                  onClick={(e) => handleLinkClick('privacy_policy', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms-and-conditions"
                  onClick={(e) => handleLinkClick('terms', e)}
                  className="hover:text-emerald-400 transition"
                >
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: SUPPORT */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white">
              Support
            </h3>
            <div className="space-y-2 text-xs">
              <a
                href="mailto:support@assetdoctor.in"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-mono font-bold transition underline"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>support@assetdoctor.in</span>
              </a>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Have questions or need assistance? Reach out to our team anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Founder Credit */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            © {currentYear} Asset Doctor. All rights reserved.
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Created with passion by</span>
            <button
              onClick={(e) => handleLinkClick('about', e)}
              className="text-emerald-400 hover:text-emerald-300 font-bold transition underline cursor-pointer"
            >
              Ashutosh Rai
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
