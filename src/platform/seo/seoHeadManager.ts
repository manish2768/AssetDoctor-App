/**
 * Asset Doctor — Dynamic SEO Head & Schema Manager
 * Manages document title, meta descriptions, canonical link tags, Open Graph tags,
 * Twitter cards, and JSON-LD structured data dynamically on route transitions.
 */

export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  schema?: Record<string, any> | Record<string, any>[];
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  keywords?: string[];
}

export class SeoHeadManager {
  private static BASE_URL = 'https://assetdoctor.in';
  private static DEFAULT_IMAGE = 'https://assetdoctor.in/icon.svg';

  /**
   * Update all head elements for the active route
   */
  public static updateHead(meta: PageMetadata): void {
    if (typeof document === 'undefined') return;

    // 1. Document Title
    document.title = meta.title;

    // 2. Meta Description
    this.setMetaTag('name', 'description', meta.description);

    // 3. Keywords if present
    if (meta.keywords && meta.keywords.length > 0) {
      this.setMetaTag('name', 'keywords', meta.keywords.join(', '));
    }

    // 4. Canonical URL
    this.setCanonicalUrl(meta.canonicalUrl);

    // 5. Open Graph Meta Tags
    this.setMetaTag('property', 'og:title', meta.title);
    this.setMetaTag('property', 'og:description', meta.description);
    this.setMetaTag('property', 'og:url', meta.canonicalUrl);
    this.setMetaTag('property', 'og:type', meta.ogType || 'website');
    this.setMetaTag('property', 'og:image', meta.ogImage || this.DEFAULT_IMAGE);
    this.setMetaTag('property', 'og:site_name', 'Asset Doctor');

    if (meta.publishedTime) {
      this.setMetaTag('property', 'article:published_time', meta.publishedTime);
    }
    if (meta.modifiedTime) {
      this.setMetaTag('property', 'article:modified_time', meta.modifiedTime);
    }
    if (meta.author) {
      this.setMetaTag('property', 'article:author', meta.author);
    }

    // 6. Twitter Meta Tags
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');
    this.setMetaTag('name', 'twitter:title', meta.title);
    this.setMetaTag('name', 'twitter:description', meta.description);
    this.setMetaTag('name', 'twitter:image', meta.ogImage || this.DEFAULT_IMAGE);

    // 7. Structured Data (JSON-LD)
    this.setJsonLdSchema(meta);
  }

  private static setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
    let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attrName, attrValue);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  }

  private static setCanonicalUrl(url: string): void {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private static setJsonLdSchema(meta: PageMetadata): void {
    // Remove existing dynamic route schema
    const existing = document.getElementById('dynamic-route-schema');
    if (existing) {
      existing.remove();
    }

    if (!meta.schema) return;

    const script = document.createElement('script');
    script.id = 'dynamic-route-schema';
    script.type = 'application/ld+json';

    const schemaData = {
      '@context': 'https://schema.org',
      ...(Array.isArray(meta.schema) ? { '@graph': meta.schema } : meta.schema)
    };

    script.text = JSON.stringify(schemaData, null, 2);
    document.head.appendChild(script);
  }
}
