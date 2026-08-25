/**
 * Asset Doctor — Multi-Tenant & Organization Architecture
 * Supports Personal, Family, Business, Dealer, Service Center, and Enterprise accounts
 * without requiring future core database rewrites.
 */

export type TenantType =
  | 'PERSONAL'
  | 'FAMILY'
  | 'BUSINESS'
  | 'DEALER'
  | 'WORKSHOP'
  | 'PROPERTY_MANAGER'
  | 'FLEET'
  | 'ENTERPRISE';

export interface TenantModel {
  tenantId: string;
  name: string;
  type: TenantType;
  primaryOwnerUid: string;
  plan: 'FREE' | 'PLUS' | 'PRO' | 'ENTERPRISE';
  maxWorkspaces: number;
  maxAssets: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceModel {
  workspaceId: string;
  tenantId: string;
  name: string; // e.g. "Home Vault", "Delhi Branch", "Fleet A"
  icon?: string;
  assetCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembership {
  id: string;
  tenantId: string;
  workspaceId: string;
  userId: string;
  email: string;
  role: 'OWNER' | 'FAMILY_MEMBER' | 'VIEWER' | 'EDITOR' | 'MANAGER' | 'SERVICE_PROVIDER' | 'DEALER' | 'PARTNER' | 'ADMIN' | 'SUPER_ADMIN';
  joinedAt: string;
}
