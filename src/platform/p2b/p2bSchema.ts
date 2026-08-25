/**
 * Asset Doctor — Person-to-Business (P2B) Foundation Schema
 * Prepares extensible data structures for future Business accounts, Fleet Managers, and Service Providers.
 * Zero migrations applied to existing individual production accounts.
 */

export type AccountType = 'INDIVIDUAL' | 'BUSINESS' | 'SERVICE_PROVIDER';

export interface BusinessEntityProfile {
  id: string;
  accountType: 'BUSINESS';
  companyName: string;
  businessType: 'CORPORATE' | 'SME' | 'FLEET_OPERATOR' | 'RETAIL_ENTERPRISE';
  gstin?: string;
  billingAddress?: string;
  adminContactEmail: string;
  totalAssetsManaged: number;
  departments: string[];
  costCenters: string[];
  createdAt: string;
}

export interface ServiceProviderProfile {
  id: string;
  accountType: 'SERVICE_PROVIDER';
  businessName: string;
  serviceCategory: 'AUTOMOTIVE_WORKSHOP' | 'ELECTRONICS_REPAIR' | 'HVAC_CONTRACTOR' | 'SOLAR_ENGINEER' | 'GENERAL_AMC';
  verifiedOemAffiliations: string[];
  workshopCity: string;
  serviceRadiusKm: number;
  contactNumber: string;
  isVerifiedPartner: boolean;
  activeAmcContracts: number;
  createdAt: string;
}

export interface BusinessAssetMetadata {
  department?: string;
  costCenter?: string;
  assignedEmployeeUid?: string;
  assetTagNumber?: string;
  amcContractNumber?: string;
  amcProviderName?: string;
  depreciationAccountingMethod?: 'WDV' | 'SLM';
  assetTaxCategory?: string;
}
