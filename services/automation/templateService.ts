/**
 * Asset Doctor — WhatsApp Template Validation, Formatting & Management Service
 * Strictly adheres to Meta WhatsApp Cloud API specification.
 */

import type {
  MetaTemplateCategory,
  TemplateButton,
  WhatsAppTemplate
} from './types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TemplateService {
  /**
   * Validate template before saving or submitting to Meta
   */
  static validateTemplate(template: Partial<WhatsAppTemplate>): ValidationResult {
    const errors: string[] = [];

    // 1. Template Key & Display Name
    if (!template.templateKey || !template.templateKey.trim()) {
      errors.push('Template Key is required.');
    }
    if (!template.displayName || !template.displayName.trim()) {
      errors.push('Display Name is required.');
    }

    // 2. Meta Template Name (Meta format: lowercase alphanumeric and underscores only)
    if (!template.metaTemplateName || !template.metaTemplateName.trim()) {
      errors.push('Meta Template Name is required.');
    } else {
      const metaNameRegex = /^[a-z0-9_]+$/;
      if (!metaNameRegex.test(template.metaTemplateName)) {
        errors.push('Meta Template Name can only contain lowercase letters, numbers, and underscores (e.g. "ad_insurance_expiry_30d").');
      }
      if (template.metaTemplateName.length > 512) {
        errors.push('Meta Template Name cannot exceed 512 characters.');
      }
    }

    // 3. Category Validation
    const validCategories: MetaTemplateCategory[] = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
    if (!template.category || !validCategories.includes(template.category)) {
      errors.push('Category must be one of: UTILITY, MARKETING, AUTHENTICATION.');
    }

    // 4. Language
    if (!template.language || !template.language.trim()) {
      errors.push('Language code is required (e.g. "en_US", "en", "hi").');
    }

    // 5. Body Length & Content
    if (!template.body || !template.body.trim()) {
      errors.push('Template Body is required.');
    } else {
      if (template.body.length > 1024) {
        errors.push(`Template body length (${template.body.length}) exceeds maximum limit of 1024 characters.`);
      }

      // Safety checks: Detect potential secrets in template text
      const forbiddenKeywords = ['password', 'auth_token', 'private_key', 'bearer', 'service_account', 'access_token'];
      for (const kw of forbiddenKeywords) {
        if (template.body.toLowerCase().includes(kw)) {
          errors.push(`Template body contains prohibited security keyword "${kw}". Do not include secrets or credentials in templates.`);
        }
      }

      // 6. Variable Validation
      const varMatches = template.body.match(/\{\{(\d+)\}\}/g) || [];
      const varPositions = varMatches.map(m => parseInt(m.replace(/\D/g, ''), 10));

      // Check variable sequence (must be sequential starting at 1: {{1}}, {{2}}, ...)
      varPositions.sort((a, b) => a - b);
      for (let i = 0; i < varPositions.length; i++) {
        if (varPositions[i] !== i + 1) {
          errors.push(`Variable numbers must be sequential without gaps starting from {{1}}. Found {{${varPositions[i]}}} instead of {{${i + 1}}}.`);
          break;
        }
      }

      // Check mapping count matches template variable occurrences
      const declaredVars = template.variables || [];
      if (declaredVars.length !== varPositions.length) {
        errors.push(`Variable count mismatch: Template body has ${varPositions.length} variables (${varMatches.join(', ')}), but variable mapping defines ${declaredVars.length}.`);
      }
    }

    // 7. Header Validation
    if (template.headerType && template.headerType !== 'NONE') {
      if (template.headerType === 'TEXT' && template.headerContent) {
        if (template.headerContent.length > 60) {
          errors.push('Text header cannot exceed 60 characters.');
        }
      }
    }

    // 8. Footer Validation
    if (template.footer && template.footer.length > 60) {
      errors.push('Footer text cannot exceed 60 characters.');
    }

    // 9. Buttons Validation
    if (template.buttons && template.buttons.length > 0) {
      if (template.buttons.length > 3) {
        errors.push('WhatsApp allows a maximum of 3 buttons.');
      }
      for (const btn of template.buttons) {
        if (!btn.text || !btn.text.trim()) {
          errors.push('Button text is required.');
        } else if (btn.text.length > 25) {
          errors.push(`Button text "${btn.text}" exceeds 25 characters.`);
        }
        if (btn.type === 'URL' && (!btn.url || !btn.url.startsWith('http'))) {
          errors.push(`URL button "${btn.text}" must have a valid http/https URL.`);
        }
        if (btn.type === 'PHONE_NUMBER' && !btn.phoneNumber) {
          errors.push(`Phone button "${btn.text}" must specify a phone number.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format Meta Cloud API template creation payload
   */
  static formatMetaSubmissionPayload(template: WhatsAppTemplate): Record<string, any> {
    const components: any[] = [];

    // Header Component
    if (template.headerType && template.headerType !== 'NONE') {
      if (template.headerType === 'TEXT' && template.headerContent) {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: template.headerContent
        });
      } else if (template.headerType === 'IMAGE' || template.headerType === 'DOCUMENT') {
        components.push({
          type: 'HEADER',
          format: template.headerType
        });
      }
    }

    // Body Component with sample values
    const bodyComponent: any = {
      type: 'BODY',
      text: template.body
    };

    if (template.variables && template.variables.length > 0) {
      bodyComponent.example = {
        body_text: [
          template.variables.map(v => v.sampleValue || `Sample ${v.position}`)
        ]
      };
    }
    components.push(bodyComponent);

    // Footer Component
    if (template.footer && template.footer.trim()) {
      components.push({
        type: 'FOOTER',
        text: template.footer.trim()
      });
    }

    // Buttons Component
    if (template.buttons && template.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: template.buttons.map(b => {
          if (b.type === 'QUICK_REPLY') {
            return { type: 'QUICK_REPLY', text: b.text };
          } else if (b.type === 'URL') {
            return { type: 'URL', text: b.text, url: b.url };
          } else if (b.type === 'PHONE_NUMBER') {
            return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber };
          }
          return { type: 'QUICK_REPLY', text: b.text };
        })
      });
    }

    return {
      name: template.metaTemplateName,
      category: template.category,
      language: template.language || 'en_US',
      components
    };
  }

  /**
   * Render simulated WhatsApp preview
   */
  static renderPreview(template: WhatsAppTemplate, sampleValues?: Record<string, any>): {
    headerText?: string;
    bodyText: string;
    footerText?: string;
    buttons: TemplateButton[];
  } {
    let bodyText = template.body;

    const values = sampleValues || {};
    // Replace positional variables {{1}}, {{2}} with sample values or descriptions
    (template.variables || []).forEach(v => {
      const val = values[v.position] || values[v.source] || v.sampleValue || `[${v.source || `Var ${v.position}`}]`;
      bodyText = bodyText.replace(new RegExp(`\\{\\{${v.position}\\}\\}`, 'g'), String(val));
    });

    return {
      headerText: template.headerType === 'TEXT' ? template.headerContent : undefined,
      bodyText,
      footerText: template.footer,
      buttons: template.buttons || []
    };
  }

  /**
   * Generates standard initial template set for Asset Doctor automation
   */
  static getStandardTemplates(): WhatsAppTemplate[] {
    const now = new Date().toISOString();
    return [
      {
        templateKey: 'insurance_expiry_30d',
        displayName: 'Vehicle Insurance Expiring in 30 Days',
        metaTemplateName: 'ad_insurance_expiry_30d_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'TEXT',
        headerContent: 'Asset Doctor Alert',
        body: 'Hi {{1}}, the insurance policy for your {{2}} ({{3}}) expires on {{4}} (in 30 days). Renew early to ensure continuous coverage and avoid penalties.',
        footer: 'Asset Doctor Vault Protection',
        buttons: [
          { type: 'URL', text: 'Renew on Asset Doctor', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'customer.name', sampleValue: 'Manish Rai', description: 'Customer Name' },
          { position: 2, source: 'asset.assetName', sampleValue: 'TVS Ronin', description: 'Asset Name' },
          { position: 3, source: 'asset.registration', sampleValue: 'MH02EV9999', description: 'Registration / Identifier' },
          { position: 4, source: 'asset.insuranceExpiry', sampleValue: '23 Sep 2026', description: 'Expiry Date' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      },
      {
        templateKey: 'warranty_expiry_30d',
        displayName: 'Warranty Expiring in 30 Days',
        metaTemplateName: 'ad_warranty_expiry_30d_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'TEXT',
        headerContent: 'Asset Doctor Warranty Alert',
        body: 'Hi {{1}}, the manufacturer warranty on your {{2}} ({{3}}) expires on {{4}} (in 30 days). Consider checking extended warranty plans.',
        footer: 'Asset Doctor Protection',
        buttons: [
          { type: 'URL', text: 'Check Coverage', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'customer.name', sampleValue: 'Manish Rai', description: 'Customer Name' },
          { position: 2, source: 'asset.assetName', sampleValue: 'LG 65 QNED TV', description: 'Asset Name' },
          { position: 3, source: 'asset.serialNumber', sampleValue: 'SN-LGC-65QNED', description: 'Serial Number' },
          { position: 4, source: 'asset.warrantyExpiry', sampleValue: '23 Sep 2026', description: 'Expiry Date' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      },
      {
        templateKey: 'puc_expiry_7d',
        displayName: 'PUC Certificate Expiring in 7 Days',
        metaTemplateName: 'ad_puc_expiry_7d_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'TEXT',
        headerContent: 'Asset Doctor PUC Alert',
        body: 'Urgent: The PUC certificate for your vehicle {{1}} ({{2}}) expires in 7 days on {{3}}. Avoid challan by getting it tested.',
        footer: 'Asset Doctor Compliance',
        buttons: [
          { type: 'URL', text: 'View RC & PUC', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'asset.assetName', sampleValue: 'TVS Ronin', description: 'Vehicle Name' },
          { position: 2, source: 'asset.registration', sampleValue: 'MH02EV9999', description: 'Registration Number' },
          { position: 3, source: 'asset.pucExpiry', sampleValue: '31 Aug 2026', description: 'Expiry Date' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      },
      {
        templateKey: 'service_due',
        displayName: 'Periodic Maintenance Service Due',
        metaTemplateName: 'ad_service_due_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'TEXT',
        headerContent: 'Asset Doctor Maintenance',
        body: 'Hi {{1}}, your {{2}} ({{3}}) is due for periodic maintenance service (Due: {{4}}). Book a service slot today to keep your asset healthy.',
        footer: 'Asset Doctor Fleet Health',
        buttons: [
          { type: 'URL', text: 'View Service Log', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'customer.name', sampleValue: 'Manish Rai', description: 'Customer Name' },
          { position: 2, source: 'asset.assetName', sampleValue: 'TVS Ronin', description: 'Vehicle Name' },
          { position: 3, source: 'asset.registration', sampleValue: 'MH02EV9999', description: 'Identifier' },
          { position: 4, source: 'asset.dueDate', sampleValue: '31 Aug 2026', description: 'Due Date' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      },
      {
        templateKey: 'document_uploaded',
        displayName: 'Document Uploaded Successfully',
        metaTemplateName: 'ad_document_uploaded_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'NONE',
        body: 'Hi {{1}}, your document {{2}} for {{3}} has been safely vaulted in your Asset Doctor digital locker.',
        footer: 'Asset Doctor Document Vault',
        buttons: [
          { type: 'URL', text: 'Open Vault', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'customer.name', sampleValue: 'Manish Rai', description: 'Customer Name' },
          { position: 2, source: 'document.label', sampleValue: 'Tax Invoice & RC', description: 'Document Label' },
          { position: 3, source: 'asset.assetName', sampleValue: 'TVS Ronin', description: 'Asset Name' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      },
      {
        templateKey: 'support_ticket_resolved',
        displayName: 'Support Request Resolved',
        metaTemplateName: 'ad_support_ticket_resolved_v1',
        category: 'UTILITY',
        language: 'en_US',
        headerType: 'TEXT',
        headerContent: 'Asset Doctor Support',
        body: 'Hi {{1}}, your support request (Ticket #{{2}}) has been resolved: {{3}}.',
        footer: 'Asset Doctor Support Desk',
        buttons: [
          { type: 'URL', text: 'View Resolution', url: 'https://assetdoctor.in' }
        ],
        variables: [
          { position: 1, source: 'customer.name', sampleValue: 'Manish Rai', description: 'Customer Name' },
          { position: 2, source: 'ticket.ticketId', sampleValue: 'TICK-9021', description: 'Ticket ID' },
          { position: 3, source: 'ticket.resolutionNote', sampleValue: 'Policy verified with insurance provider', description: 'Resolution Note' }
        ],
        status: 'draft',
        isActive: true,
        metaStatus: 'NOT_SUBMITTED',
        createdAt: now,
        updatedAt: now,
        createdBy: 'system'
      }
    ];
  }
}
