import React from 'react';

interface AssetDoctorLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export const AssetDoctorLogo: React.FC<AssetDoctorLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  onClick,
}) => {
  // Size mapping
  const dimensions = {
    sm: { container: 'w-8 h-8', shield: 'w-5 h-5', plus: 'w-2.5 h-2.5', text: 'text-sm' },
    md: { container: 'w-11 h-11', shield: 'w-7 h-7', plus: 'w-3.5 h-3.5', text: 'text-lg' },
    lg: { container: 'w-16 h-16', shield: 'w-10 h-10', plus: 'w-5 h-5', text: '2xl' },
    xl: { container: 'w-24 h-24', shield: 'w-14 h-14', plus: 'w-7 h-7', text: 'text-3xl' },
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-all' : ''} ${className}`}
    >
      {/* Logo Icon Container: Dark Navy Blue Base + Emerald Green Border & Glow */}
      <div className={`relative flex items-center justify-center ${dimensions.container} rounded-2xl bg-gradient-to-b from-[#0b192e] via-[#071325] to-[#030a16] border-2 border-emerald-500/40 shadow-lg shadow-emerald-950/50 group`}>
        
        {/* Glow halo */}
        <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 blur-sm group-hover:bg-emerald-500/20 transition-all"></div>

        {/* Custom SVG Shield with Green Care/Tech Plus Icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${dimensions.shield} relative z-10 filter drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]`}
        >
          {/* Outer Shield Body - Dark Navy Fill with Metallic Emerald Border */}
          <path
            d="M12 2L4 5V11C4 16.55 7.42 21.74 12 23C16.58 21.74 20 16.55 20 11V5L12 2Z"
            fill="url(#navyShieldGradient)"
            stroke="url(#emeraldBorderGradient)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interior Care / Tech Plus Badge Circle */}
          <circle
            cx="12"
            cy="11.5"
            r="4.8"
            fill="#022c22"
            stroke="#10b981"
            strokeWidth="1.2"
          />

          {/* Vibrant Emerald Green Medical/Tech Plus Icon */}
          <path
            d="M12 8.5V14.5M9 11.5H15"
            stroke="#34d399"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="navyShieldGradient" x1="12" y1="2" x2="12" y2="23" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0f223d" />
              <stop offset="0.6" stopColor="#081426" />
              <stop offset="1" stopColor="#020813" />
            </linearGradient>

            <linearGradient id="emeraldBorderGradient" x1="4" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="0.5" stopColor="#10b981" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>

        {/* Corner Indicator Pill */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
      </div>

      {/* Brand Text Header */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight text-white ${dimensions.text}`}>
              Asset<span className="text-emerald-400">Doctor</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Vault
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Warranty Care & Maintenance
          </span>
        </div>
      )}
    </div>
  );
};
