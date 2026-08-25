/**
 * Replaceable partner adapter — no fake APIs, no embedded tokens.
 * Future: OneAssist, Servify, PolicyBazaar, GoMechanic, OEM centres, etc.
 */

export const PARTNER_KIND = Object.freeze({
  INSURANCE: 'INSURANCE',
  SERVICE: 'SERVICE',
  ROADSIDE: 'ROADSIDE',
  MARKETPLACE: 'MARKETPLACE',
  VEHICLE_SERVICE: 'VEHICLE_SERVICE',
});

export class PartnerProvider {
  constructor(config = {}) {
    this.partnerId = config.partnerId || 'unknown';
    this.kind = config.kind || PARTNER_KIND.SERVICE;
  }

  /** Lead/referral handoff — requires explicit user consent before call. */
  async submitLead(_lead, _consent) {
    throw new Error('PartnerProvider.submitLead not implemented');
  }

  async fetchServices(_asset) {
    throw new Error('PartnerProvider.fetchServices not implemented');
  }
}

/** Commission / marketplace domain shapes — not implemented yet. */
export const COMMISSION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
});

export default PartnerProvider;
