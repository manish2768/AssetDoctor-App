import React from 'react';
import { BRAND_PUBLIC } from '../theme/brandAssets';

interface AssetDoctorAppIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

/** Official raster app icon (navy rounded square, no wordmark). */
export const AssetDoctorAppIcon: React.FC<AssetDoctorAppIconProps> = ({
  size = 48,
  className = '',
  alt = 'Asset Doctor',
}) => (
  <img
    src={BRAND_PUBLIC.appIcon}
    alt={alt}
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
    draggable={false}
  />
);

export default AssetDoctorAppIcon;
