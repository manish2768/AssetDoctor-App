/**
 * Asset Doctor — RBAC (Role-Based Access Control)
 * Decoupled capability-based authorization matrix.
 */

export type UserRole =
  | 'OWNER'
  | 'FAMILY_MEMBER'
  | 'VIEWER'
  | 'EDITOR'
  | 'MANAGER'
  | 'SERVICE_PROVIDER'
  | 'DEALER'
  | 'PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type PlatformPermission =
  | 'ASSET_READ'
  | 'ASSET_CREATE'
  | 'ASSET_EDIT'
  | 'ASSET_DELETE'
  | 'ASSET_ARCHIVE'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_DELETE'
  | 'SERVICE_RECORD_ADD'
  | 'SERVICE_RECORD_VERIFY'
  | 'VALUATION_OVERRIDE'
  | 'WORKSPACE_INVITE'
  | 'WORKSPACE_MANAGE'
  | 'BILLING_MANAGE'
  | 'API_KEY_MANAGE'
  | 'AUDIT_LOG_VIEW'
  | 'SYSTEM_SETTINGS_EDIT';

const ROLE_PERMISSIONS: Record<UserRole, PlatformPermission[]> = {
  OWNER: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT', 'ASSET_DELETE', 'ASSET_ARCHIVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE',
    'SERVICE_RECORD_ADD', 'SERVICE_RECORD_VERIFY', 'VALUATION_OVERRIDE',
    'WORKSPACE_INVITE', 'WORKSPACE_MANAGE', 'BILLING_MANAGE', 'API_KEY_MANAGE'
  ],
  SUPER_ADMIN: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT', 'ASSET_DELETE', 'ASSET_ARCHIVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DELETE',
    'SERVICE_RECORD_ADD', 'SERVICE_RECORD_VERIFY', 'VALUATION_OVERRIDE',
    'WORKSPACE_INVITE', 'WORKSPACE_MANAGE', 'BILLING_MANAGE', 'API_KEY_MANAGE',
    'AUDIT_LOG_VIEW', 'SYSTEM_SETTINGS_EDIT'
  ],
  ADMIN: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT', 'ASSET_ARCHIVE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW',
    'SERVICE_RECORD_ADD', 'SERVICE_RECORD_VERIFY',
    'WORKSPACE_INVITE', 'AUDIT_LOG_VIEW'
  ],
  MANAGER: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW',
    'SERVICE_RECORD_ADD', 'WORKSPACE_INVITE'
  ],
  EDITOR: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW',
    'SERVICE_RECORD_ADD'
  ],
  FAMILY_MEMBER: [
    'ASSET_READ', 'ASSET_CREATE', 'ASSET_EDIT',
    'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW',
    'SERVICE_RECORD_ADD'
  ],
  VIEWER: [
    'ASSET_READ', 'DOCUMENT_VIEW'
  ],
  SERVICE_PROVIDER: [
    'ASSET_READ', 'SERVICE_RECORD_ADD', 'DOCUMENT_UPLOAD'
  ],
  DEALER: [
    'ASSET_READ', 'ASSET_CREATE', 'SERVICE_RECORD_ADD', 'DOCUMENT_UPLOAD'
  ],
  PARTNER: [
    'ASSET_READ', 'SERVICE_RECORD_ADD'
  ]
};

export function hasPermission(role: UserRole, permission: PlatformPermission): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

export function canMutateAsset(role: UserRole): boolean {
  return hasPermission(role, 'ASSET_EDIT');
}

export function canDeleteAsset(role: UserRole): boolean {
  return hasPermission(role, 'ASSET_DELETE');
}

export function isSuperAdminRole(role: string): boolean {
  return role === 'SUPER_ADMIN';
}
