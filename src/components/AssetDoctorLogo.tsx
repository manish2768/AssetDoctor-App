import React from 'react';
import { AssetDoctorAppIcon } from './AssetDoctorAppIcon';

interface AssetDoctorLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_PX = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
} as const;

export const AssetDoctorLogo: React.FC<AssetDoctorLogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  onClick,
}) => {
  const px = SIZE_PX[size];
  const textClass =
    size === 'sm'
      ? 'text-sm'
      : size === 'lg'
        ? 'text-2xl'
        : size === 'xl'
          ? 'text-3xl'
          : 'text-lg';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-all' : ''} ${className}`}
    >
      <AssetDoctorAppIcon size={px} />

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight text-white ${textClass}`}>
              Asset<span className="text-teal-300">Doctor</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Universal Asset Intelligence
          </span>
        </div>
      )}
    </div>
  );
};

export default AssetDoctorLogo;
