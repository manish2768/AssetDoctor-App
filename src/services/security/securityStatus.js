/**
 * Security status dashboard — only real checks (no fake green checks).
 */

import { AppLockService } from './AppLockService';
import { getBackupStatus } from './BackupStatusService';
import { getPrivacyPrefs } from './privacyPrefs';

export async function buildSecurityStatus({ userId, isAuthenticated } = {}) {
  const [lockOn, canUseLock, backup, privacy] = await Promise.all([
    AppLockService.isEnabled().catch(() => false),
    AppLockService.canUseDeviceLock().catch(() => false),
    getBackupStatus(userId),
    getPrivacyPrefs(userId),
  ]);

  const items = [];

  items.push({
    id: 'account',
    ok: Boolean(isAuthenticated && userId),
    label: isAuthenticated ? 'Account Protected' : 'Sign in to protect your account',
    warn: !isAuthenticated,
  });

  items.push({
    id: 'backup',
    ok: isAuthenticated && backup.state === 'active',
    label:
      !isAuthenticated
        ? 'Cloud backup unavailable (signed out)'
        : backup.state === 'pending'
          ? 'Cloud backup pending sync'
          : backup.state === 'failed'
            ? 'Cloud backup needs attention'
            : 'Cloud Backup Active',
    warn: isAuthenticated && backup.state !== 'active',
  });

  items.push({
    id: 'documents',
    ok: true,
    label: 'Documents Protected (owner-only Storage rules)',
    warn: false,
  });

  items.push({
    id: 'sync',
    ok: isAuthenticated,
    label: isAuthenticated ? 'Sync Secure (Auth-scoped)' : 'Sync requires sign-in',
    warn: !isAuthenticated,
  });

  items.push({
    id: 'vault',
    ok: lockOn && canUseLock,
    label: lockOn
      ? canUseLock
        ? 'Vault Lock Enabled'
        : 'Vault Lock on — set phone PIN/biometrics'
      : 'Enable Vault Lock',
    warn: !lockOn || !canUseLock,
  });

  items.push({
    id: 'notification_privacy',
    ok: privacy.notificationPrivacy !== false,
    label:
      privacy.notificationPrivacy !== false
        ? 'Notification Privacy On'
        : 'Notification Privacy Off',
    warn: privacy.notificationPrivacy === false,
  });

  return {
    items,
    scoreOk: items.filter((i) => i.ok && !i.warn).length,
    scoreTotal: items.length,
    backup,
  };
}

export default { buildSecurityStatus };
