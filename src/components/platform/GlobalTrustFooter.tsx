import React from 'react';
import { Shield, Mail, Car, Wrench, Sparkles, Download, QrCode } from 'lucide-react';
import { AssetDoctorProtectedBadge } from './trust/AssetDoctorProtectedBadge';

interface GlobalTrustFooterProps {
  onNavigateTab: (tab: string) => void;
  onSelectTool?: (toolSlug: string) => void;
}

export const GlobalTrustFooter: React.FC<GlobalTrustFooterProps> = ({
  onNavigateTab,
  onSelectTool
}) => {
  const currentYear = new Date().getFullYear();

  const handleLinkClick = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    onNavigateTab(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-white/10 bg-[#070D18]/95 text-slate-400 mt-20 pt-16 pb-12 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-12">
        {/* Top Grid: Brand + Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-6 gap-8 lg:gap-8">
          {/* Brand Column (2 cols) */}
          <div className="col-span-2 space-y-4">
            <a
              href="/"
              onClick={(e) => handleLinkClick('/', e)}
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
                  Your Home & Vehicle Doctor
                </span>
              </div>
            </a>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Universal asset intelligence platform helping people understand, maintain, and protect their vehicles, appliances, and household assets with zero advertiser sharing.
            </p>

            <div className="pt-1">
              <AssetDoctorProtectedBadge state={{ id: 'PROTECTED', label: 'Asset Doctor Protected' }} compact />
            </div>

            <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-emerald-400/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Encrypted • Zero Advertiser Sharing</span>
            </div>
          </div>

          {/* Column 1: VEHICLE DOCTOR */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vehicle Doctor</span>
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="/vehicle-doctor" onClick={(e) => handleLinkClick('/vehicle-doctor', e)} className="hover:text-emerald-400 transition">
                  Overview
                </a>
              </li>
              <li>
                <a href="/vehicle-doctor/cars" onClick={(e) => handleLinkClick('/vehicle-doctor/cars', e)} className="hover:text-emerald-400 transition">
                  Cars Management
                </a>
              </li>
              <li>
                <a href="/vehicle-doctor/bikes" onClick={(e) => handleLinkClick('/vehicle-doctor/bikes', e)} className="hover:text-emerald-400 transition">
                  Bikes & Scooters
                </a>
              </li>
              <li>
                <a href="/vehicle-doctor/warranty" onClick={(e) => handleLinkClick('/vehicle-doctor/warranty', e)} className="hover:text-emerald-400 transition">
                  Vehicle Warranty
                </a>
              </li>
              <li>
                <a href="/vehicle-doctor/service" onClick={(e) => handleLinkClick('/vehicle-doctor/service', e)} className="hover:text-emerald-400 transition">
                  Service History
                </a>
              </li>
              <li>
                <a href="/vehicle-doctor/documents" onClick={(e) => handleLinkClick('/vehicle-doctor/documents', e)} className="hover:text-emerald-400 transition">
                  RC & PUC Vault
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: APPLIANCE DOCTOR */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Appliance Doctor</span>
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="/appliance-doctor" onClick={(e) => handleLinkClick('/appliance-doctor', e)} className="hover:text-emerald-400 transition">
                  Overview
                </a>
              </li>
              <li>
                <a href="/appliance-doctor/ac" onClick={(e) => handleLinkClick('/appliance-doctor/ac', e)} className="hover:text-emerald-400 transition">
                  Air Conditioners (AC)
                </a>
              </li>
              <li>
                <a href="/appliance-doctor/refrigerator" onClick={(e) => handleLinkClick('/appliance-doctor/refrigerator', e)} className="hover:text-emerald-400 transition">
                  Refrigerators
                </a>
              </li>
              <li>
                <a href="/appliance-doctor/washing-machine" onClick={(e) => handleLinkClick('/appliance-doctor/washing-machine', e)} className="hover:text-emerald-400 transition">
                  Washing Machines
                </a>
              </li>
              <li>
                <a href="/appliance-doctor/ro" onClick={(e) => handleLinkClick('/appliance-doctor/ro', e)} className="hover:text-emerald-400 transition">
                  RO Purifiers
                </a>
              </li>
              <li>
                <a href="/appliance-doctor/geyser" onClick={(e) => handleLinkClick('/appliance-doctor/geyser', e)} className="hover:text-emerald-400 transition">
                  Geysers / Heaters
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: FREE TOOLS */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Free Tools</span>
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="/tools/warranty-calculator" onClick={(e) => handleLinkClick('/tools/warranty-calculator', e)} className="hover:text-emerald-400 transition">
                  Warranty Calculator
                </a>
              </li>
              <li>
                <a href="/tools/asset-age-calculator" onClick={(e) => handleLinkClick('/tools/asset-age-calculator', e)} className="hover:text-emerald-400 transition">
                  Asset Age Calculator
                </a>
              </li>
              <li>
                <a href="/tools/ac-electricity-calculator" onClick={(e) => handleLinkClick('/tools/ac-electricity-calculator', e)} className="hover:text-emerald-400 transition">
                  AC Electricity Bill
                </a>
              </li>
              <li>
                <a href="/tools/service-due-calculator" onClick={(e) => handleLinkClick('/tools/service-due-calculator', e)} className="hover:text-emerald-400 transition">
                  Service Due Calculator
                </a>
              </li>
              <li>
                <a href="/tools/repair-vs-replace" onClick={(e) => handleLinkClick('/tools/repair-vs-replace', e)} className="hover:text-emerald-400 transition">
                  Repair vs Replace
                </a>
              </li>
              <li>
                <a href="/tools" onClick={(e) => handleLinkClick('/tools', e)} className="hover:text-emerald-400 transition font-bold text-slate-300">
                  All Calculators →
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: KNOWLEDGE & TRUST */}
          <div className="space-y-3 text-xs">
            <h3 className="font-mono text-[11px] font-black uppercase tracking-wider text-white">
              Company &amp; Hub
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="/blog" onClick={(e) => handleLinkClick('/blog', e)} className="hover:text-emerald-400 transition font-bold text-emerald-400">
                  Knowledge Hub (Blog)
                </a>
              </li>
              <li>
                <a href="/warranty" onClick={(e) => handleLinkClick('/warranty', e)} className="hover:text-emerald-400 transition">
                  Warranty Vault
                </a>
              </li>
              <li>
                <a href="/maintenance" onClick={(e) => handleLinkClick('/maintenance', e)} className="hover:text-emerald-400 transition">
                  Maintenance Care
                </a>
              </li>
              <li>
                <a href="/smart-qr" onClick={(e) => handleLinkClick('/smart-qr', e)} className="hover:text-emerald-400 transition">
                  Smart QR Parking
                </a>
              </li>
              <li>
                <a href="/about" onClick={(e) => handleLinkClick('/about', e)} className="hover:text-emerald-400 transition font-bold text-slate-300">
                  About Us
                </a>
              </li>
              <li>
                <a href="/download" onClick={(e) => handleLinkClick('/download', e)} className="hover:text-emerald-400 transition">
                  Download Mobile App
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => handleLinkClick('/contact', e)} className="hover:text-emerald-400 transition">
                  Contact Support
                </a>
              </li>
              <li>
                <a href="/privacy" onClick={(e) => handleLinkClick('/privacy', e)} className="hover:text-emerald-400 transition">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" onClick={(e) => handleLinkClick('/terms', e)} className="hover:text-emerald-400 transition">
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            © {currentYear} Asset Doctor. All rights reserved.
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Created with passion by</span>
            <button
              onClick={(e) => handleLinkClick('/about', e)}
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
