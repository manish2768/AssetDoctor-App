/**
 * Collect device + app diagnostics for support email / Crashlytics.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { BRAND } from '../../theme/branding';

const recentLogs = [];
const MAX_LOGS = 40;

export function pushDiagnosticLog(line) {
  try {
    const entry = `[${new Date().toISOString()}] ${String(line || '').slice(0, 300)}`;
    recentLogs.push(entry);
    if (recentLogs.length > MAX_LOGS) recentLogs.shift();
  } catch {
    /* ignore */
  }
}

export function buildDeviceDiagnostics({ user, profile, extra = '' } = {}) {
  const appVersion =
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    'unknown';
  const build =
    Constants.expoConfig?.android?.versionCode ||
    Constants.nativeBuildVersion ||
    '';
  const lines = [
    `App: ${BRAND.name} v${appVersion}${build ? ` (${build})` : ''}`,
    `Platform: ${Platform.OS} ${Platform.Version}`,
    `Device: ${Constants.deviceName || 'unknown'}`,
    `Expo: ${Constants.expoConfig?.sdkVersion || Constants.executionEnvironment || ''}`,
    `User: ${user?.uid || profile?.uid || 'guest'}`,
    `Email: ${user?.email || profile?.email || '—'}`,
    `Phone: ${user?.phoneNumber || profile?.phone || profile?.phoneNumber || '—'}`,
    '',
    '--- Recent logs ---',
    ...(recentLogs.length ? recentLogs.slice(-20) : ['(none)']),
  ];
  if (extra) {
    lines.push('', '--- Extra ---', String(extra).slice(0, 4000));
  }
  return lines.join('\n');
}

/**
 * Open mailto:support with prefilled subject/body + diagnostics.
 */
export async function openSupportErrorEmail({
  subject = '[Asset Doctor] Report Error',
  message = '',
  error,
  user,
  profile,
} = {}) {
  const { Linking, Share } = require('react-native');
  const diagnostics = buildDeviceDiagnostics({
    user,
    profile,
    extra: [
      message,
      error?.message ? `Error: ${error.message}` : '',
      error?.stack ? String(error.stack).slice(0, 2500) : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  });
  const body = [
    message.trim() || 'Please describe what went wrong:',
    '',
    '---',
    diagnostics,
    `Creator: ${BRAND.creatorCredit}`,
  ].join('\n');
  const url = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
      return { success: true };
    }
    await Share.share({ message: body, title: subject });
    return { success: true, shared: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Could not open email' };
  }
}

export default {
  pushDiagnosticLog,
  buildDeviceDiagnostics,
  openSupportErrorEmail,
};
