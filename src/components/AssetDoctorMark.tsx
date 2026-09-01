import React from 'react';

interface AssetDoctorMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Vector mark: shield, A, heartbeat, document layer, check badge. No wordmark. */
export const AssetDoctorMark: React.FC<AssetDoctorMarkProps> = ({
  size = 48,
  className = '',
  title = 'Asset Doctor',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const tealId = `adMarkTeal-${uid}`;
  const ekgId = `adMarkEkg-${uid}`;

  return (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width={size}
    height={size}
    className={className}
    role="img"
    aria-label={title}
  >
    <defs>
      <linearGradient id={tealId} x1="8%" y1="12%" x2="92%" y2="88%">
        <stop offset="0%" stopColor="#0F766E" />
        <stop offset="45%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#6EE7B7" />
      </linearGradient>
      <linearGradient id={ekgId} x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#0F766E" />
        <stop offset="50%" stopColor="#2DD4BF" />
        <stop offset="100%" stopColor="#A7F3D0" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="114" fill="#050A0F" />
    <path
      d="M256 70 C334 108 402 108 416 120 C416 272 362 392 256 462 C150 392 96 272 96 120 C110 108 178 108 256 70 Z"
      fill="#07111F"
      stroke={`url(#${tealId})`}
      strokeWidth="16"
      strokeLinejoin="round"
    />
    <path
      d="M228 168 H292 L318 194 V338 H228 Z"
      fill="none"
      stroke="#14B8A6"
      strokeOpacity="0.28"
      strokeWidth="4"
    />
    <path
      d="M256 142 L332 348 H298 L278 294 H234 L214 348 H180 Z M242 258 H270 L256 216 Z"
      fill="#FFFFFF"
    />
    <path
      d="M150 258 H214 L230 258 L246 204 L262 312 L278 258 L294 258 H362"
      fill="none"
      stroke={`url(#${ekgId})`}
      strokeWidth="12"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="372" cy="396" r="38" fill={`url(#${tealId})`} />
    <circle cx="372" cy="396" r="38" fill="none" stroke="#ECFDF5" strokeWidth="4" />
    <path
      d="M354 396 L366 408 L392 380"
      fill="none"
      stroke="#050A0F"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
  );
};

export default AssetDoctorMark;
