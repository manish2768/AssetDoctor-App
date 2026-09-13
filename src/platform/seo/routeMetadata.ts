import { PageMetadata } from './seoHeadManager';
import { BlogRepository, BlogCategory } from '../blog/blogData';

export const BASE_URL = 'https://assetdoctor.in';

export const ROUTE_METADATA: Record<string, PageMetadata> = {
  '/': {
    title: 'Asset Doctor — Your Home & Vehicle Doctor | Manage Warranties, Service & Maintenance',
    description: 'Track and manage your vehicles, home appliances, warranties, service dates, and maintenance reminders with Asset Doctor. Free calculators, smart QR & proactive alerts.',
    canonicalUrl: `${BASE_URL}/`,
    keywords: ['Asset Doctor', 'Home and Vehicle Doctor', 'warranty tracker', 'vehicle maintenance', 'appliance care', 'service due calculator', 'smart QR'],
    schema: [
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}/#organization`,
        name: 'Asset Doctor',
        url: `${BASE_URL}/`,
        logo: `${BASE_URL}/icon.svg`,
        email: 'support@assetdoctor.in',
        description: 'Universal Asset Intelligence & Lifecycle Platform for home appliances, personal vehicles, and household assets.'
      },
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        url: `${BASE_URL}/`,
        name: 'Asset Doctor',
        publisher: { '@id': `${BASE_URL}/#organization` }
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Asset Doctor',
        operatingSystem: 'Android, iOS, Web',
        applicationCategory: 'UtilitiesApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }
      }
    ]
  },
  '/vehicle-doctor': {
    title: 'Vehicle Doctor — Cars & Bikes Document, Warranty & Service Manager | Asset Doctor',
    description: 'Vehicle Doctor helps you manage vehicle documents, RC, insurance renewals, PUC expiry, warranty claims, service history, and emergency parking QR.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor`,
    keywords: ['vehicle doctor', 'car service tracker', 'bike maintenance', 'puc check online', 'vehicle warranty', 'smart parking qr'],
    schema: {
      '@type': 'WebPage',
      name: 'Vehicle Doctor — Car & Bike Asset Management',
      url: `${BASE_URL}/vehicle-doctor`,
      description: 'Vehicle Doctor platform for managing car and bike maintenance, warranty, insurance, and service history.'
    }
  },
  '/vehicle-doctor/cars': {
    title: 'Car Asset Management & Service Tracker | Vehicle Doctor',
    description: 'Complete car asset lifecycle management: OEM service schedules, insurance policy renewals, PUC alerts, battery health, and maintenance cost logging.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor/cars`,
    schema: {
      '@type': 'WebPage',
      name: 'Car Asset Management',
      url: `${BASE_URL}/vehicle-doctor/cars`
    }
  },
  '/vehicle-doctor/bikes': {
    title: 'Bike & Two-Wheeler Maintenance & Service Management | Vehicle Doctor',
    description: 'Track motorcycle and scooter periodic service intervals, chain lubrication, engine oil changes, insurance, and statutory PUC certificates.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor/bikes`,
    schema: {
      '@type': 'WebPage',
      name: 'Bike Asset Management',
      url: `${BASE_URL}/vehicle-doctor/bikes`
    }
  },
  '/vehicle-doctor/warranty': {
    title: 'Vehicle Warranty Tracker — OEM & Extended Coverage | Vehicle Doctor',
    description: 'Never miss a vehicle warranty claim deadline. Track manufacturer standard warranty, extended warranty policies, and AMC coverage for cars and bikes.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor/warranty`,
    schema: {
      '@type': 'WebPage',
      name: 'Vehicle Warranty Management',
      url: `${BASE_URL}/vehicle-doctor/warranty`
    }
  },
  '/vehicle-doctor/service': {
    title: 'Vehicle Service Due & Maintenance Interval Calculator | Vehicle Doctor',
    description: 'Calculate your next car or bike service date by mileage (KM) and calendar interval. Whichever-comes-first predictive maintenance engine.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor/service`,
    schema: {
      '@type': 'WebPage',
      name: 'Vehicle Service Management',
      url: `${BASE_URL}/vehicle-doctor/service`
    }
  },
  '/vehicle-doctor/documents': {
    title: 'Vehicle Document Vault — RC, Insurance & PUC Manager | Vehicle Doctor',
    description: 'Encrypted digital vault for your vehicle Registration Certificate (RC), comprehensive insurance policy, and Pollution Under Control (PUC) certificate.',
    canonicalUrl: `${BASE_URL}/vehicle-doctor/documents`,
    schema: {
      '@type': 'WebPage',
      name: 'Vehicle Document Management',
      url: `${BASE_URL}/vehicle-doctor/documents`
    }
  },
  '/appliance-doctor': {
    title: 'Appliance Doctor — Home Appliance Warranty, Service & Health Manager | Asset Doctor',
    description: 'Appliance Doctor empowers Indian households to manage AC, refrigerator, washing machine, RO, geyser, microwave, and chimney bills, warranties, and repairs.',
    canonicalUrl: `${BASE_URL}/appliance-doctor`,
    keywords: ['appliance doctor', 'ac service schedule', 'fridge warranty', 'ro filter change', 'washing machine maintenance'],
    schema: {
      '@type': 'WebPage',
      name: 'Home Appliance Doctor',
      url: `${BASE_URL}/appliance-doctor`
    }
  },
  '/appliance-doctor/ac': {
    title: 'AC Management — Filter Cleaning, Electricity Cost & Service | Appliance Doctor',
    description: 'Air conditioner lifecycle management: 90-day mesh filter cleaning reminders, power consumption calculator, annual pre-summer servicing, and compressor warranty.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/ac`,
    schema: {
      '@type': 'WebPage',
      name: 'Air Conditioner Management',
      url: `${BASE_URL}/appliance-doctor/ac`
    }
  },
  '/appliance-doctor/refrigerator': {
    title: 'Refrigerator Maintenance & Compressor Warranty Manager | Appliance Doctor',
    description: 'Maximize refrigerator lifespan and cooling efficiency. Track 10-year compressor warranty terms, condenser coil cleaning, and power efficiency.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/refrigerator`,
    schema: {
      '@type': 'WebPage',
      name: 'Refrigerator Management',
      url: `${BASE_URL}/appliance-doctor/refrigerator`
    }
  },
  '/appliance-doctor/washing-machine': {
    title: 'Washing Machine Care, Drum Descaling & Warranty | Appliance Doctor',
    description: 'Prevent drum vibration, water leaks, and motor failure. Track drum descaling cycles, inlet filter cleaning, and manufacturer motor warranties.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/washing-machine`,
    schema: {
      '@type': 'WebPage',
      name: 'Washing Machine Management',
      url: `${BASE_URL}/appliance-doctor/washing-machine`
    }
  },
  '/appliance-doctor/ro': {
    title: 'RO Water Purifier Filter Replacement & Membrane Warranty | Appliance Doctor',
    description: 'Never drink contaminated water. Track sediment, pre-carbon, and RO membrane replacement cycles, TDS audits, and AMC contracts.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/ro`,
    schema: {
      '@type': 'WebPage',
      name: 'RO Water Purifier Management',
      url: `${BASE_URL}/appliance-doctor/ro`
    }
  },
  '/appliance-doctor/geyser': {
    title: 'Geyser & Water Heater Anode Rod & Tank Warranty | Appliance Doctor',
    description: 'Preserve water heater efficiency and prevent electrical hazards. Track sacrificial anode rod replacement, thermostat safety, and tank inner lining warranty.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/geyser`,
    schema: {
      '@type': 'WebPage',
      name: 'Geyser & Water Heater Management',
      url: `${BASE_URL}/appliance-doctor/geyser`
    }
  },
  '/appliance-doctor/microwave': {
    title: 'Microwave Oven Magnetron Warranty & Maintenance | Appliance Doctor',
    description: 'Track microwave oven magnetron warranty, waveguide cover maintenance, and prevent electrical short circuits with proactive care schedules.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/microwave`,
    schema: {
      '@type': 'WebPage',
      name: 'Microwave Oven Management',
      url: `${BASE_URL}/appliance-doctor/microwave`
    }
  },
  '/appliance-doctor/chimney': {
    title: 'Kitchen Chimney Baffle Filter Cleaning & Motor Warranty | Appliance Doctor',
    description: 'Maintain maximum suction and prevent kitchen grease fires. Auto-reminders for baffle filter cleaning and motor warranty protection.',
    canonicalUrl: `${BASE_URL}/appliance-doctor/chimney`,
    schema: {
      '@type': 'WebPage',
      name: 'Kitchen Chimney Management',
      url: `${BASE_URL}/appliance-doctor/chimney`
    }
  },
  '/warranty': {
    title: 'Smart Warranty Management — Invoices, Expiry Alerts & AMC Vault | Asset Doctor',
    description: 'Never lose a warranty claim again. Vault purchase invoices, compute remaining warranty days, and get proactive notifications before coverage expires.',
    canonicalUrl: `${BASE_URL}/warranty`,
    schema: {
      '@type': 'WebPage',
      name: 'Warranty Management',
      url: `${BASE_URL}/warranty`
    }
  },
  '/maintenance': {
    title: 'Preventive Asset Maintenance Platform — Reduce Repair Costs | Asset Doctor',
    description: 'Predictive and preventive maintenance intervals across vehicles, ACs, home appliances, and household hardware. Lower repair bills by up to 40%.',
    canonicalUrl: `${BASE_URL}/maintenance`,
    schema: {
      '@type': 'WebPage',
      name: 'Maintenance Management',
      url: `${BASE_URL}/maintenance`
    }
  },
  '/smart-qr': {
    title: 'Smart QR Parking & Asset Identity Sticker | Asset Doctor',
    description: 'Privacy-first Smart QR for vehicles and home assets. Enable emergency parking contact without sharing your private mobile phone number.',
    canonicalUrl: `${BASE_URL}/smart-qr`,
    schema: {
      '@type': 'WebPage',
      name: 'Smart QR System',
      url: `${BASE_URL}/smart-qr`
    }
  },
  '/tools': {
    title: 'Free Asset Intelligence Tools & Calculators Suite | Asset Doctor',
    description: '100% free interactive browser calculators: Warranty Expiry, Asset Age, AC Electricity Cost, Service Due, and Repair vs Replace decision engine.',
    canonicalUrl: `${BASE_URL}/tools`,
    schema: {
      '@type': 'WebPage',
      name: 'Free Asset Tools Suite',
      url: `${BASE_URL}/tools`
    }
  },
  '/tools/warranty-calculator': {
    title: 'Warranty Expiry Calculator — Check Days Remaining Online | Asset Doctor',
    description: 'Free online warranty calculator. Enter purchase date and warranty tenure to calculate exact expiration date, remaining days, and claim eligibility.',
    canonicalUrl: `${BASE_URL}/tools/warranty-calculator`,
    schema: {
      '@type': 'WebApplication',
      name: 'Warranty Expiry Calculator',
      url: `${BASE_URL}/tools/warranty-calculator`,
      applicationCategory: 'UtilitiesApplication'
    }
  },
  '/tools/asset-age-calculator': {
    title: 'Asset Age Calculator — Years, Months & Days Counter | Asset Doctor',
    description: 'Free asset age calculator. Calculate exact age in years, months, and days from purchase date for depreciation and replacement planning.',
    canonicalUrl: `${BASE_URL}/tools/asset-age-calculator`,
    schema: {
      '@type': 'WebApplication',
      name: 'Asset Age Calculator',
      url: `${BASE_URL}/tools/asset-age-calculator`,
      applicationCategory: 'UtilitiesApplication'
    }
  },
  '/tools/ac-electricity-calculator': {
    title: 'AC Electricity Cost Calculator — Estimate Daily & Monthly Units | Asset Doctor',
    description: 'Free AC electricity consumption calculator. Calculate estimated daily, monthly, and yearly units (kWh) and power bill cost in rupees.',
    canonicalUrl: `${BASE_URL}/tools/ac-electricity-calculator`,
    schema: {
      '@type': 'WebApplication',
      name: 'AC Electricity Cost Calculator',
      url: `${BASE_URL}/tools/ac-electricity-calculator`,
      applicationCategory: 'UtilitiesApplication'
    }
  },
  '/tools/service-due-calculator': {
    title: 'Service Due Calculator — Next Vehicle & Appliance Maintenance | Asset Doctor',
    description: 'Calculate your next vehicle service or home appliance maintenance date. Track remaining days and avoid costly mechanical failure.',
    canonicalUrl: `${BASE_URL}/tools/service-due-calculator`,
    schema: {
      '@type': 'WebApplication',
      name: 'Service Due Calculator',
      url: `${BASE_URL}/tools/service-due-calculator`,
      applicationCategory: 'UtilitiesApplication'
    }
  },
  '/tools/repair-vs-replace': {
    title: 'Repair vs Replace Calculator — 50% Economic Rule Engine | Asset Doctor',
    description: 'Should you repair or replace your damaged asset? Calculate economic viability using fair market value depreciation and repair quote comparison.',
    canonicalUrl: `${BASE_URL}/tools/repair-vs-replace`,
    schema: {
      '@type': 'WebApplication',
      name: 'Repair vs Replace Calculator',
      url: `${BASE_URL}/tools/repair-vs-replace`,
      applicationCategory: 'UtilitiesApplication'
    }
  },
  '/blog': {
    title: 'Asset Doctor Knowledge Hub — Expert Vehicle & Appliance Guides | Hindi & English',
    description: 'Practical, India-focused guides on AC maintenance, car service intervals, refrigerator cooling issues, warranty claim tips, and household asset protection.',
    canonicalUrl: `${BASE_URL}/blog`,
    keywords: ['Asset Doctor Blog', 'AC service guide', 'Car maintenance tips', 'warranty claims', 'RO filter change'],
    schema: {
      '@type': 'Blog',
      name: 'Asset Doctor Knowledge Hub',
      url: `${BASE_URL}/blog`,
      description: 'Expert lifecycle and maintenance guides for Indian home appliances and vehicles.'
    }
  },
  '/blog/category/vehicles': {
    title: 'Vehicle Maintenance & Service Articles | Asset Doctor Blog',
    description: 'Expert articles on car and bike service intervals, insurance renewals, battery life, PUC certificates, and vehicle document management.',
    canonicalUrl: `${BASE_URL}/blog/category/vehicles`,
    schema: {
      '@type': 'Blog',
      name: 'Vehicle Maintenance Knowledge Articles',
      url: `${BASE_URL}/blog/category/vehicles`
    }
  },
  '/blog/category/appliances': {
    title: 'Home Appliance Care & Troubleshooting Articles | Asset Doctor Blog',
    description: 'Practical advice on AC filter cleaning, refrigerator defrosting, washing machine vibration, RO filter changes, and appliance warranties.',
    canonicalUrl: `${BASE_URL}/blog/category/appliances`,
    schema: {
      '@type': 'Blog',
      name: 'Home Appliance Knowledge Articles',
      url: `${BASE_URL}/blog/category/appliances`
    }
  },
  '/blog/category/warranty': {
    title: 'Warranty, AMC & Invoices Guides | Asset Doctor Blog',
    description: 'Everything you need to know about checking product warranties, AMC vs warranty differences, extended warranties, and lost invoice recovery.',
    canonicalUrl: `${BASE_URL}/blog/category/warranty`,
    schema: {
      '@type': 'Blog',
      name: 'Warranty Knowledge Articles',
      url: `${BASE_URL}/blog/category/warranty`
    }
  },
  '/blog/category/maintenance': {
    title: 'Asset Preventive Maintenance Articles | Asset Doctor Blog',
    description: 'Preventive maintenance checklists and best practices to extend the life of your household assets and vehicles.',
    canonicalUrl: `${BASE_URL}/blog/category/maintenance`,
    schema: {
      '@type': 'Blog',
      name: 'Maintenance Knowledge Articles',
      url: `${BASE_URL}/blog/category/maintenance`
    }
  },
  '/about': {
    title: 'About Asset Doctor | Built to Understand Everything You Own',
    description: 'Discover the story behind Asset Doctor, the universal asset lifecycle intelligence platform created by Ashutosh Rai to understand, protect, and manage physical assets.',
    canonicalUrl: `${BASE_URL}/about`,
    schema: {
      '@type': 'AboutPage',
      name: 'About Asset Doctor',
      url: `${BASE_URL}/about`
    }
  },
  '/contact': {
    title: 'Contact Asset Doctor | Support & Partnerships',
    description: 'Get in touch with the Asset Doctor engineering and support team for customer inquiries, feedback, or commercial asset management partnerships.',
    canonicalUrl: `${BASE_URL}/contact`,
    schema: {
      '@type': 'ContactPage',
      name: 'Contact Asset Doctor',
      url: `${BASE_URL}/contact`
    }
  },
  '/download': {
    title: 'Download Asset Doctor App — Available for Android & iOS',
    description: 'Download the official Asset Doctor mobile app. Scan bills, get WhatsApp service reminders, and manage all your home and vehicle assets in one place.',
    canonicalUrl: `${BASE_URL}/download`,
    schema: {
      '@type': 'SoftwareApplication',
      name: 'Asset Doctor App',
      url: `${BASE_URL}/download`,
      operatingSystem: 'Android, iOS',
      applicationCategory: 'UtilitiesApplication',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' }
    }
  },
  '/privacy': {
    title: 'Privacy Policy | Asset Doctor',
    description: 'Learn how Asset Doctor vaults, encrypts, and isolates your asset records with zero advertiser sharing and DPDP compliance.',
    canonicalUrl: `${BASE_URL}/privacy`,
    schema: {
      '@type': 'WebPage',
      name: 'Asset Doctor Privacy Policy',
      url: `${BASE_URL}/privacy`
    }
  },
  '/terms': {
    title: 'Terms & Conditions | Asset Doctor',
    description: 'Terms of service and user agreements governing the use of the Asset Doctor platform and free asset intelligence calculators.',
    canonicalUrl: `${BASE_URL}/terms`,
    schema: {
      '@type': 'WebPage',
      name: 'Asset Doctor Terms and Conditions',
      url: `${BASE_URL}/terms`
    }
  }
};

export function getRouteMetadata(path: string): PageMetadata {
  const cleanPath = (path || '/').toLowerCase().replace(/\/$/, '') || '/';

  if (ROUTE_METADATA[cleanPath]) {
    return ROUTE_METADATA[cleanPath];
  }

  // Handle aliases
  if (cleanPath === '/privacy-policy') return ROUTE_METADATA['/privacy'];
  if (cleanPath === '/terms-and-conditions') return ROUTE_METADATA['/terms'];
  if (cleanPath === '/tools/repair-or-replace') return ROUTE_METADATA['/tools/repair-vs-replace'];

  // Handle Dynamic Blog Posts
  if (cleanPath.startsWith('/blog/')) {
    const slug = cleanPath.replace('/blog/', '').replace(/\/$/, '');
    
    // Category Hub
    if (slug.startsWith('category/')) {
      const cat = slug.replace('category/', '') as BlogCategory;
      const categoryNames: Record<BlogCategory, string> = {
        appliances: 'Home Appliances',
        vehicles: 'Vehicle Doctor',
        warranty: 'Warranty & Invoices',
        maintenance: 'Maintenance & Service'
      };
      const catName = categoryNames[cat] || 'Knowledge Hub';
      return {
        title: `${catName} Guides, Maintenance & Troubleshooting | Asset Doctor`,
        description: `Practical guides, DIY maintenance steps, and authorized warranty information for ${catName} in Indian households.`,
        canonicalUrl: `${BASE_URL}/blog/category/${cat}`,
        keywords: [cat, `${cat} maintenance`, `${cat} guides`, 'Asset Doctor blog'],
        schema: [
          {
            '@type': 'CollectionPage',
            name: `${catName} Knowledge Hub`,
            url: `${BASE_URL}/blog/category/${cat}`,
            description: `All published guides and diagnostic checklists for ${catName}.`
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
              { '@type': 'ListItem', position: 3, name: catName, item: `${BASE_URL}/blog/category/${cat}` }
            ]
          }
        ]
      };
    }

    const post = BlogRepository.getBySlug(slug);
    if (post) {
      const schemas: any[] = [
        {
          '@type': 'Article',
          headline: post.h1,
          name: post.title,
          description: post.metaDescription,
          url: `${BASE_URL}/blog/${post.slug}`,
          datePublished: post.publishedDate,
          dateModified: post.updatedDate,
          author: {
            '@type': 'Organization',
            name: post.author,
            url: BASE_URL
          },
          publisher: {
            '@type': 'Organization',
            name: 'Asset Doctor',
            url: BASE_URL,
            logo: `${BASE_URL}/icon.svg`
          },
          mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
            { '@type': 'ListItem', position: 3, name: post.categoryDisplayName, item: `${BASE_URL}/blog/category/${post.category}` },
            { '@type': 'ListItem', position: 4, name: post.title, item: `${BASE_URL}/blog/${post.slug}` }
          ]
        }
      ];

      if (post.faqs && post.faqs.length > 0) {
        schemas.push({
          '@type': 'FAQPage',
          mainEntity: post.faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        });
      }

      return {
        title: post.title,
        description: post.metaDescription,
        canonicalUrl: `${BASE_URL}/blog/${post.slug}`,
        keywords: [post.category, post.slug.replace(/-/g, ' '), 'Asset Doctor'],
        schema: schemas
      };
    }
  }

  // Default fallback
  return {
    title: 'Asset Doctor — Your Home & Vehicle Doctor',
    description: 'Universal Asset Intelligence & Lifecycle Platform for home appliances, personal vehicles, and household assets.',
    canonicalUrl: `${BASE_URL}${cleanPath}`,
    schema: {
      '@type': 'WebPage',
      name: 'Asset Doctor',
      url: `${BASE_URL}${cleanPath}`
    }
  };
}
