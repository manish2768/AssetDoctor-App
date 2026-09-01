/**
 * Asset Doctor brand mark — approved shield / A / heartbeat icon.
 * Renders the official raster so in-app usage matches the launcher.
 */

import React from 'react';
import { Image } from 'react-native';

const APP_ICON = require('../../assets/icon.png');

/**
 * @param {{ size?: number, style?: object }} props
 */
export function AppLogo({ size = 96, style }) {
  return (
    <Image
      source={APP_ICON}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Asset Doctor"
    />
  );
}

export function AssetDoctorAppIcon({ size = 96, style }) {
  return <AppLogo size={size} style={style} />;
}

export function AssetDoctorMark({ size = 96, style }) {
  return <AppLogo size={size} style={style} />;
}

export default AppLogo;
