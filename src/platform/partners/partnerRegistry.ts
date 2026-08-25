/**
 * Asset Doctor — Partner & B2B Integration Registry
 * Manages verified service centers, authorized dealerships, and corporate fleet integrations.
 */

export interface PartnerDefinition {
  partnerId: string;
  name: string;
  type: 'AUTHORIZED_SERVICE_CENTER' | 'DEALERSHIP' | 'INSURER' | 'OEM' | 'CORPORATE_FLEET';
  supportedCategories: string[];
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'DORMANT';
  webhookUrl?: string;
  apiAccessLevel: 'READ_ONLY' | 'READ_WRITE' | 'FULL_INTEGRATION';
}

export class PartnerRegistry {
  private partners: Map<string, PartnerDefinition> = new Map();

  public registerPartner(partner: PartnerDefinition): void {
    this.partners.set(partner.partnerId, partner);
  }

  public getPartner(partnerId: string): PartnerDefinition | undefined {
    return this.partners.get(partnerId);
  }

  public listActivePartners(): PartnerDefinition[] {
    return Array.from(this.partners.values()).filter(p => p.status === 'ACTIVE');
  }
}

export const partnerRegistry = new PartnerRegistry();
