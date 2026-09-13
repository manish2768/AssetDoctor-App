/**
 * Asset Doctor — SEO Prerendering & Static HTML Generation Engine
 * Post-build engine: Generates static crawlable HTML files for all 82 public pages,
 * injecting unique title, description, canonical link, Open Graph, Twitter cards,
 * and JSON-LD structured schemas (Article, BreadcrumbList, WebApplication, FAQPage, Organization).
 * Also updates public/sitemap.xml to stay 100% in sync.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BLOG_POSTS } from '../src/platform/blog/blogData';
import { ROUTE_METADATA, getRouteMetadata, BASE_URL } from '../src/platform/seo/routeMetadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SITEMAP_PATH = path.join(ROOT_DIR, 'public', 'sitemap.xml');

interface RouteItem {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  h1?: string;
  intro?: string;
}

// 1. Compile all indexable routes
const ALL_ROUTES: RouteItem[] = [
  // Homepage
  { path: '/', changefreq: 'daily', priority: '1.0', h1: 'Your Home & Vehicle Doctor', intro: 'Universal Asset Intelligence platform to track, maintain, and protect everything you own across vehicles and home appliances.' },
  
  // Hubs
  { path: '/vehicle-doctor', changefreq: 'weekly', priority: '0.9', h1: 'Vehicle Doctor — Total Digital Care for Your Cars & Bikes' },
  { path: '/appliance-doctor', changefreq: 'weekly', priority: '0.9', h1: 'Appliance Doctor — Home Appliance Warranty, Service & Health Manager' },
  { path: '/warranty', changefreq: 'weekly', priority: '0.9', h1: 'Smart Warranty Management & Expiry Radar' },
  { path: '/maintenance', changefreq: 'weekly', priority: '0.9', h1: 'Predictive & Preventive Asset Maintenance Platform' },
  { path: '/smart-qr', changefreq: 'weekly', priority: '0.8', h1: 'Smart QR Parking & Emergency Identity Sticker' },
  { path: '/download', changefreq: 'weekly', priority: '0.8', h1: 'Download Asset Doctor App for Android & Web' },

  // Vehicle Categories
  { path: '/vehicle-doctor/cars', changefreq: 'weekly', priority: '0.8', h1: 'Car Asset Management & Ownership Intelligence' },
  { path: '/vehicle-doctor/bikes', changefreq: 'weekly', priority: '0.8', h1: 'Bike & Scooter Maintenance & Document Hub' },
  { path: '/vehicle-doctor/warranty', changefreq: 'weekly', priority: '0.8', h1: 'Vehicle Warranty & Extended Coverage Tracking' },
  { path: '/vehicle-doctor/service', changefreq: 'weekly', priority: '0.8', h1: 'Periodic Vehicle Service & Upkeep Engine' },
  { path: '/vehicle-doctor/documents', changefreq: 'weekly', priority: '0.8', h1: 'Vehicle Document Management' },

  // Appliance Categories
  { path: '/appliance-doctor/ac', changefreq: 'weekly', priority: '0.8', h1: 'Air Conditioner Management & Service Hub' },
  { path: '/appliance-doctor/refrigerator', changefreq: 'weekly', priority: '0.8', h1: 'Refrigerator Maintenance & Compressor Care' },
  { path: '/appliance-doctor/washing-machine', changefreq: 'weekly', priority: '0.8', h1: 'Washing Machine Care & Drum Descaling Hub' },
  { path: '/appliance-doctor/ro', changefreq: 'weekly', priority: '0.8', h1: 'RO Water Purifier & Membrane Health Hub' },
  { path: '/appliance-doctor/geyser', changefreq: 'weekly', priority: '0.8', h1: 'Geyser & Water Heater Maintenance Hub' },
  { path: '/appliance-doctor/microwave', changefreq: 'weekly', priority: '0.7', h1: 'Microwave Oven Safety & Maintenance Guide' },
  { path: '/appliance-doctor/chimney', changefreq: 'weekly', priority: '0.7', h1: 'Kitchen Chimney Baffle Filter Cleaning Guide' },

  // Interactive Tools
  { path: '/tools', changefreq: 'weekly', priority: '0.9', h1: 'Free Asset Intelligence Tools & Calculators Suite' },
  { path: '/tools/warranty-calculator', changefreq: 'weekly', priority: '0.9', h1: 'Warranty Expiry Calculator — Check Days Remaining' },
  { path: '/tools/asset-age-calculator', changefreq: 'weekly', priority: '0.8', h1: 'Asset Age Calculator — Years, Months & Days Counter' },
  { path: '/tools/ac-electricity-calculator', changefreq: 'weekly', priority: '0.9', h1: 'AC Electricity Cost Calculator — Daily & Monthly Units' },
  { path: '/tools/service-due-calculator', changefreq: 'weekly', priority: '0.9', h1: 'Vehicle Service Due Estimator — Next Maintenance Calculator' },
  { path: '/tools/repair-vs-replace', changefreq: 'weekly', priority: '0.8', h1: 'Repair vs. Replace Advisor — 50% Rule Decision Tool' },

  // Blog Hub & Categories
  { path: '/blog', changefreq: 'daily', priority: '0.9', h1: 'Asset Doctor Knowledge Hub & Research Library' },
  { path: '/blog/category/appliances', changefreq: 'weekly', priority: '0.8', h1: 'Home Appliances Maintenance & Diagnostic Guides' },
  { path: '/blog/category/vehicles', changefreq: 'weekly', priority: '0.8', h1: 'Vehicle Care, Service & Documentation Guides' },
  { path: '/blog/category/warranty', changefreq: 'weekly', priority: '0.8', h1: 'Warranty Rights, Invoice Claims & AMC Advice' },
  { path: '/blog/category/maintenance', changefreq: 'weekly', priority: '0.8', h1: 'Preventive Asset Maintenance & Lifespan Upkeep' },

  // About & Contact
  { path: '/about', changefreq: 'monthly', priority: '0.6', h1: 'About Asset Doctor — India\'s Universal Asset Intelligence Platform' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6', h1: 'Contact Asset Doctor — Support & Feedback' },

  // Legal
  { path: '/privacy', changefreq: 'monthly', priority: '0.5', h1: 'Privacy Policy' },
  { path: '/terms', changefreq: 'monthly', priority: '0.5', h1: 'Terms & Conditions' },

  // 50 Blog Articles
  ...BLOG_POSTS.map(post => ({
    path: `/blog/${post.slug}`,
    changefreq: 'weekly' as const,
    priority: '0.8',
    h1: post.h1,
    intro: post.directAnswer || post.intro
  }))
];

function prerender() {
  const templatePath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error(`[Prerender] Error: ${templatePath} not found. Run vite build first.`);
    process.exit(1);
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf-8');
  console.log(`[Prerender] Starting static HTML generation for ${ALL_ROUTES.length} routes...`);

  let count = 0;
  for (const route of ALL_ROUTES) {
    const meta = getRouteMetadata(route.path);
    let html = templateHtml;

    // Title
    html = html.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);

    // Meta Description
    if (html.includes('name="description"')) {
      html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${meta.description}" />`);
    } else {
      html = html.replace('</head>', `  <meta name="description" content="${meta.description}" />\n</head>`);
    }

    // Canonical URL
    if (html.includes('rel="canonical"')) {
      html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${meta.canonicalUrl}" />`);
    } else {
      html = html.replace('</head>', `  <link rel="canonical" href="${meta.canonicalUrl}" />\n</head>`);
    }

    // Open Graph
    html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${meta.title}" />`);
    html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${meta.description}" />`);
    html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${meta.canonicalUrl}" />`);

    // Twitter
    html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${meta.title}" />`);
    html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${meta.description}" />`);

    // JSON-LD Schema
    if (meta.schema) {
      const schemaData = Array.isArray(meta.schema)
        ? { '@context': 'https://schema.org', '@graph': meta.schema }
        : { '@context': 'https://schema.org', ...meta.schema };
      const schemaScript = `\n<script type="application/ld+json" id="route-static-schema">\n${JSON.stringify(schemaData, null, 2)}\n</script>\n`;
      html = html.replace('</head>', `${schemaScript}</head>`);
    }

    // Crawlable semantic HTML fallback for Googlebot/Bingbot inside #root
    if (route.path !== '/') {
      const crawlableFallback = `
        <div id="root">
          <div style="opacity: 0.01; position: absolute; pointer-events: none; z-index: -1;">
            <h1>${route.h1 || meta.title}</h1>
            <p>${route.intro || meta.description}</p>
            <nav>
              <a href="/">Home</a>
              <a href="/vehicle-doctor">Vehicle Doctor</a>
              <a href="/appliance-doctor">Appliance Doctor</a>
              <a href="/warranty">Warranty Management</a>
              <a href="/maintenance">Maintenance Management</a>
              <a href="/tools">Free Tools</a>
              <a href="/blog">Knowledge Hub</a>
              <a href="/download">Download App</a>
            </nav>
          </div>
        </div>
      `;
      html = html.replace(/<div id="root"><\/div>/i, crawlableFallback.trim());
    }

    // Output destination
    if (route.path === '/') {
      fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf-8');
    } else {
      const routeDir = path.join(DIST_DIR, route.path.replace(/^\//, ''));
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf-8');
    }
    count++;
  }

  console.log(`[Prerender] Successfully generated static HTML files for ${count} routes in dist/`);

  // Generate public/sitemap.xml
  generateSitemap();
}

function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const urls = ALL_ROUTES.map(r => `  <url>
    <loc>${BASE_URL}${r.path === '/' ? '' : r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  fs.writeFileSync(SITEMAP_PATH, sitemapXml, 'utf-8');
  console.log(`[Sitemap] Successfully updated ${SITEMAP_PATH} with ${ALL_ROUTES.length} URLs.`);

  // Also copy sitemap.xml to dist/sitemap.xml
  const distSitemap = path.join(DIST_DIR, 'sitemap.xml');
  fs.writeFileSync(distSitemap, sitemapXml, 'utf-8');
}

prerender();
