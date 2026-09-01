import Constants from 'expo-constants';

/**
 * Read the human-readable version from package.json as a last-resort fallback.
 * The displayed version is sourced from the native runtime (versionName from
 * build.gradle / app.json), which is the single source of truth. Never throws
 * and never hardcodes a value.
 */
let PACKAGE_VERSION = null;
function packageVersion() {
  if (PACKAGE_VERSION != null) return PACKAGE_VERSION;
  try {
    // eslint-disable-next-line global-require
    const pkg = require('../../package.json');
    PACKAGE_VERSION =
      pkg && typeof pkg.version === 'string' && pkg.version.trim()
        ? pkg.version.trim()
        : '';
  } catch {
    PACKAGE_VERSION = '';
  }
  return PACKAGE_VERSION;
}

/**
 * Human-readable app version, e.g. "1.0.75".
 * Prefers the native runtime version (versionName from build.gradle), then the
 * Expo/app.json version, then package.json. Never throws.
 */
export function appVersion() {
  try {
    return (
      Constants.nativeAppVersion ||
      Constants.expoConfig?.version ||
      packageVersion() ||
      Constants.manifest?.version ||
      '1.0.0'
    );
  } catch {
    return packageVersion() || '1.0.0';
  }
}

/**
 * Native build number / versionCode (e.g. "133" on Android).
 * Empty string when the platform does not expose one.
 */
export function buildNumber() {
  try {
    return (
      Constants.nativeBuildVersion ||
      Constants.expoConfig?.android?.versionCode ||
      String(Constants.expoConfig?.ios?.buildNumber || '')
    );
  } catch {
    return '';
  }
}

/**
 * Human-readable version code / build number for display, e.g. "132".
 * Falls back to the version string when a numeric build is unavailable.
 */
export function appVersionCode() {
  const code = buildNumber();
  if (code != null && String(code).trim() !== '') return String(code).trim();
  return appVersion();
}

/**
 * "debug" or "release", derived from the bundler's __DEV__ flag.
 * __DEV__ is a real global in React Native / Expo (Metro) builds.
 */
export function appEnvironment() {
  const isDev =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    String(process.env.NODE_ENV || '') === 'development';
  return isDev ? 'debug' : 'release';
}

/**
 * "DEBUG" or "RELEASE" for display in the About screen.
 */
export function buildLabel() {
  return appEnvironment() === 'release' ? 'RELEASE' : 'DEBUG';
}

/**
 * Build the compact version label used on the About / Profile pages.
 * e.g. "v1.0.75 (133) · release"
 */
export function appVersionLabel() {
  const v = appVersion();
  const build = buildNumber();
  const env = appEnvironment();
  const parts = [`v${v}`];
  if (build) parts.push(`(${build})`);
  parts.push(env);
  return parts.join(' ');
}

export default {
  appVersion,
  appVersionCode,
  buildNumber,
  buildLabel,
  appEnvironment,
  appVersionLabel,
};

