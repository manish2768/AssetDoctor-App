import React, { useState } from 'react';
import { PhoneCall, ExternalLink, ShieldCheck, Search, Headphones, CheckCircle2, ChevronRight, Wrench } from 'lucide-react';

interface BrandSupportInfo {
  id: string;
  brand: string;
  category: string;
  tollFree: string;
  displayPhone: string;
  supportWebsite: string;
  hours: string;
  servicesCovered: string[];
  badgeText?: string;
}

const BRAND_DIRECTORY: BrandSupportInfo[] = [
  {
    id: 'apple',
    brand: 'Apple Care India',
    category: 'Laptops & Smartphones',
    tollFree: '18001081088',
    displayPhone: '1800-108-1088',
    supportWebsite: 'https://support.apple.com/in-in',
    hours: '24/7 Hotline Support',
    servicesCovered: ['iPhone Repair', 'MacBook Battery', 'AppleCare+ Claims', 'Display Replacement'],
    badgeText: 'Official Authorized Service',
  },
  {
    id: 'samsung',
    brand: 'Samsung Service Center',
    category: 'Electronics & Mobiles',
    tollFree: '180057267864',
    displayPhone: '1800-572-67864',
    supportWebsite: 'https://www.samsung.com/in/support/',
    hours: '24/7 Customer Care',
    servicesCovered: ['Galaxy Phone Repair', 'Smart TV Service', 'Refrigerator Maintenance', 'Washing Machine'],
    badgeText: 'Doorstep Service Available',
  },
  {
    id: 'tvs',
    brand: 'TVS Motor Company Care',
    category: 'Two-Wheelers & Scooters',
    tollFree: '18002587111',
    displayPhone: '1800-258-7111',
    supportWebsite: 'https://www.tvsmotor.com/service',
    hours: '9 AM - 8 PM Daily',
    servicesCovered: ['TVS Ronin Free Service', 'Jupiter Oil Change', 'Roadside Assistance', 'Engine Overhaul'],
    badgeText: '24x7 Roadside RSA',
  },
  {
    id: 'nothing',
    brand: 'Nothing & CMF India Support',
    category: 'Earbuds & Smartphones',
    tollFree: '18002021234',
    displayPhone: '1800-202-1234',
    supportWebsite: 'https://in.nothing.tech/pages/contact-support',
    hours: '10 AM - 7 PM (Mon-Sat)',
    servicesCovered: ['Earbuds Battery Exchange', 'Nothing Phone Display', 'Warranty Replacement', 'Software Diagnostics'],
    badgeText: 'Express Replacement',
  },
  {
    id: 'daikin',
    brand: 'Daikin AC Care Hotline',
    category: 'Air Conditioners & HVAC',
    tollFree: '18001803900',
    displayPhone: '1800-180-3900',
    supportWebsite: 'https://www.daikinindia.com/service-support',
    hours: '8 AM - 8 PM Daily',
    servicesCovered: ['Inverter AC Gas Refill', 'Seasonal Deep Cleaning', 'Compressor Warranty Claim', 'PCB Repair'],
    badgeText: 'Certified AC Mechanics',
  },
  {
    id: 'kent',
    brand: 'Kent RO Water Purifier Support',
    category: 'Water Purifiers',
    tollFree: '9278912345',
    displayPhone: '92789-12345',
    supportWebsite: 'https://www.kent.co.in/service',
    hours: '8:30 AM - 7:30 PM Daily',
    servicesCovered: ['RO Membrane Filter Change', 'UV Lamp Inspection', 'Annual Service AMC', 'TDS Calibration'],
    badgeText: 'Same-Day Technician Visit',
  },
  {
    id: 'honda',
    brand: 'Honda Two-Wheelers Service',
    category: 'Scooters & Motorcycles',
    tollFree: '18001033434',
    displayPhone: '1800-103-3434',
    supportWebsite: 'https://www.honda2wheelersindia.com/services',
    hours: '8 AM - 8 PM Daily',
    servicesCovered: ['Activa Free Service', 'Breakdown Towing', 'Clutch Plate Replacement', 'Brake Pad Service'],
    badgeText: 'Nationwide Network',
  },
  {
    id: 'hyundai',
    brand: 'Hyundai Motor India RSA',
    category: 'Automobiles & SUVs',
    tollFree: '18001024645',
    displayPhone: '1800-102-4645',
    supportWebsite: 'https://www.hyundai.com/in/en/connect-to-service',
    hours: '24x7 Emergency RSA',
    servicesCovered: ['Creta Roadside Assistance', 'Free Periodic Service', 'Battery Replacement', 'Tire Change'],
    badgeText: '24x7 Emergency Help',
  },
];

export const BrandSupportDirectory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Laptops & Smartphones', 'Electronics & Mobiles', 'Two-Wheelers & Scooters', 'Air Conditioners & HVAC', 'Water Purifiers'];

  const filteredBrands = BRAND_DIRECTORY.filter((b) => {
    const matchesSearch =
      b.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.servicesCovered.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div
      id="one-click-brand-support-directory"
      className="p-6 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-6"
    >
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Headphones className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                One-Click Brand Support Directory
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Official Hotlines
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct access to brand warranty claim portals, toll-free call lines & certified centers
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search brand (Apple, TVS, Daikin...)"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Brand Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredBrands.map((brand) => (
          <div
            key={brand.id}
            className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/50 transition-all flex flex-col justify-between space-y-3 group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
                  {brand.category}
                </span>
                {brand.badgeText && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {brand.badgeText}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-white mt-1.5 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                <span>{brand.brand}</span>
              </h3>

              <div className="text-xs font-mono font-bold text-cyan-400 mt-1 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{brand.displayPhone}</span>
              </div>

              <div className="text-[10px] text-slate-500 mt-0.5">{brand.hours}</div>

              {/* Services badges */}
              <div className="mt-2 pt-2 border-t border-slate-900 flex flex-wrap gap-1">
                {brand.servicesCovered.map((s, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-2 text-[11px]">
              <a
                href={`tel:${brand.tollFree}`}
                className="py-2 px-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Call Now</span>
              </a>

              <a
                href={brand.supportWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Official Web</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
