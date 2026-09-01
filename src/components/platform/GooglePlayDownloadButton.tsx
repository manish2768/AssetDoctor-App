import React from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { AnalyticsService } from '../../platform/analytics/analyticsService';

/**
 * Locked Official Google Play URL for Asset Doctor
 */
export const GOOGLE_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.assetdoctor.app';

export interface GooglePlayDownloadButtonProps {
  /** Visual preset variant */
  variant?: 'header' | 'hero' | 'primary' | 'outline' | 'pill' | 'compact';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Button label (defaults to 'Download Now') */
  label?: string;
  /** Optional secondary subtitle text */
  sublabel?: string;
  /** Custom additional classes */
  className?: string;
  /** Placement identifier for analytics tracking ('header' | 'hero' | 'showcase' | 'footer' | 'nav', etc.) */
  placement?: string;
  /** Full width on mobile/container */
  fullWidth?: boolean;
  /** Custom click handler */
  onClick?: () => void;
  /** Hide the Google Play icon */
  hideIcon?: boolean;
  /** Show right arrow / chevron */
  showChevron?: boolean;
}

/**
 * High-definition crisp Google Play official vector icon
 */
export const GooglePlayIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 shrink-0' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M3.609 1.814C3.238 2.22 3 2.825 3 3.63v16.74c0 .805.238 1.41.609 1.816l.096.095 9.38-9.38v-.22l-9.38-9.38-.096.095z"
      fill="url(#ad-gp-blue)"
    />
    <path
      d="M16.216 15.992l-3.13-3.13v-.22l3.13-3.13.072.041 3.712 2.11c1.06.601 1.06 1.587 0 2.19l-3.712 2.11-.072.042z"
      fill="url(#ad-gp-yellow)"
    />
    <path
      d="M16.288 15.95l-3.203-3.203-9.476 9.476c.35.37.942.414 1.62.03l11.059-6.303"
      fill="url(#ad-gp-red)"
    />
    <path
      d="M16.288 8.05L5.23 1.747c-.678-.385-1.27-.34-1.62.03l9.476 9.476 3.203-3.203z"
      fill="url(#ad-gp-green)"
    />
    <defs>
      <linearGradient id="ad-gp-blue" x1="12.083" y1="2.724" x2="1.38" y2="13.427" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00A0FF" />
        <stop offset="0.007" stopColor="#00A1FF" />
        <stop offset="0.26" stopColor="#00BEFF" />
        <stop offset="0.512" stopColor="#00D2FF" />
        <stop offset="0.76" stopColor="#00DFFF" />
        <stop offset="1" stopColor="#00E3FF" />
      </linearGradient>
      <linearGradient id="ad-gp-yellow" x1="19.988" y1="12.448" x2="2.776" y2="12.448" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFE000" />
        <stop offset="0.409" stopColor="#FFBD00" />
        <stop offset="0.775" stopColor="#FFA500" />
        <stop offset="1" stopColor="#FF9C00" />
      </linearGradient>
      <linearGradient id="ad-gp-red" x1="14.343" y1="14.167" x2="0.675" y2="27.836" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF3A44" />
        <stop offset="1" stopColor="#C31162" />
      </linearGradient>
      <linearGradient id="ad-gp-green" x1="0.675" y1="-3.836" x2="14.343" y2="9.833" gradientUnits="userSpaceOnUse">
        <stop stopColor="#32A071" />
        <stop offset="0.069" stopColor="#2DA771" />
        <stop offset="0.476" stopColor="#15CF74" />
        <stop offset="0.801" stopColor="#06E775" />
        <stop offset="1" stopColor="#00F076" />
      </linearGradient>
    </defs>
  </svg>
);

export const GooglePlayDownloadButton: React.FC<GooglePlayDownloadButtonProps> = ({
  variant = 'hero',
  size,
  label = 'Download Now',
  sublabel,
  className = '',
  placement = 'unspecified',
  fullWidth = false,
  onClick,
  hideIcon = false,
  showChevron = false
}) => {
  const handleClick = () => {
    try {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

      // 1. Standard internal analytics event
      AnalyticsService.trackEvent('app_download_click', {
        path: currentPath,
        metadata: {
          platform: 'android',
          destination: 'google_play',
          placement
        }
      });

      // 2. Dedicated google_play_download_click event
      AnalyticsService.trackEvent('google_play_download_click' as any, {
        path: currentPath,
        metadata: {
          platform: 'android',
          destination: 'google_play',
          placement
        }
      });

      // 3. Dispatch to window.gtag if GA4 is loaded
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'google_play_download_click', {
          placement,
          destination: 'google_play',
          platform: 'android',
          page_path: currentPath
        });
      }
    } catch (err) {
      console.debug('Analytics dispatch error on download click:', err);
    }

    if (onClick) {
      onClick();
    }
  };

  // Preset styles based on variant
  let baseStyles =
    'group relative inline-flex items-center justify-center transition-all duration-200 cursor-pointer select-none font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-[0.98]';
  let sizeStyles = '';
  let variantStyles = '';
  let iconSize = 'w-4 h-4';

  switch (variant) {
    case 'header':
    case 'compact':
      sizeStyles = size === 'sm' ? 'px-2.5 py-1 text-[11px] gap-1.5' : 'px-3.5 py-1.5 sm:py-2 text-xs gap-2';
      variantStyles =
        'rounded-full bg-slate-900/90 hover:bg-slate-800/95 text-slate-200 hover:text-white border border-slate-700/70 hover:border-emerald-500/50 shadow-sm shadow-emerald-500/5 hover:shadow-emerald-500/20 font-bold backdrop-blur-md';
      iconSize = 'w-3.5 h-3.5';
      break;

    case 'hero':
      sizeStyles = 'px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm gap-2.5';
      variantStyles =
        'rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold border border-slate-700/80 hover:border-emerald-400/60 shadow-lg shadow-black/40 hover:shadow-emerald-500/15 backdrop-blur-md';
      iconSize = 'w-4.5 h-4.5 sm:w-5 sm:h-5';
      break;

    case 'primary':
      sizeStyles = 'px-6 sm:px-7 py-3.5 text-xs sm:text-sm gap-2.5';
      variantStyles =
        'rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40';
      iconSize = 'w-4.5 h-4.5';
      break;

    case 'pill':
      sizeStyles = 'px-4 py-2 text-xs gap-2';
      variantStyles =
        'rounded-full bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-emerald-500/40 shadow-sm font-bold';
      iconSize = 'w-4 h-4';
      break;

    case 'outline':
      sizeStyles = 'px-5 py-2.5 text-xs sm:text-sm gap-2';
      variantStyles =
        'rounded-xl bg-transparent hover:bg-slate-900/60 text-slate-300 hover:text-white border border-slate-800 hover:border-emerald-500/50 font-bold';
      iconSize = 'w-4 h-4';
      break;

    default:
      sizeStyles = 'px-5 py-3 text-xs sm:text-sm gap-2.5';
      variantStyles =
        'rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold border border-slate-800 hover:border-slate-700';
      iconSize = 'w-4 h-4';
      break;
  }

  const widthStyle = fullWidth ? 'w-full' : 'w-full sm:w-auto';

  return (
    <a
      href={GOOGLE_PLAY_STORE_URL}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download Asset Doctor from Google Play"
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
    >
      {!hideIcon && <GooglePlayIcon className={`${iconSize} transition-transform duration-200 group-hover:scale-105`} />}

      <span className="flex items-center gap-1.5 tracking-tight">
        <span>{label}</span>
        {sublabel && (
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-white/10 text-slate-300">
            {sublabel}
          </span>
        )}
      </span>

      {showChevron && (
        <ChevronRight className="w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
      {variant === 'primary' && !showChevron && (
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      )}
    </a>
  );
};
