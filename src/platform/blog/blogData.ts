/**
 * Asset Doctor — Knowledge Hub & Blog Architecture
 * Unified repository of 50 high-quality, practical guides for vehicles and home appliances in India.
 */

import { BlogPost, BlogCategory, BlogSection, BlogFaq, SearchIntent } from './blogTypes';
import { AC_ARTICLES } from './articles/acArticles';
import { REFRIGERATOR_ARTICLES } from './articles/refrigeratorArticles';
import { WASHING_MACHINE_ARTICLES } from './articles/washingMachineArticles';
import { RO_ARTICLES } from './articles/roArticles';
import { GEYSER_KITCHEN_ARTICLES } from './articles/geyserKitchenArticles';
import { CAR_ARTICLES } from './articles/carArticles';
import { BIKE_ARTICLES } from './articles/bikeArticles';
import { VEHICLE_DOCS_INSURANCE_ARTICLES } from './articles/vehicleDocsInsuranceArticles';
import { WARRANTY_INVOICE_ARTICLES } from './articles/warrantyInvoiceArticles';

export type { BlogPost, BlogCategory, BlogSection, BlogFaq, SearchIntent };

export const BLOG_POSTS: BlogPost[] = [
  ...AC_ARTICLES,
  ...REFRIGERATOR_ARTICLES,
  ...WASHING_MACHINE_ARTICLES,
  ...RO_ARTICLES,
  ...GEYSER_KITCHEN_ARTICLES,
  ...CAR_ARTICLES,
  ...BIKE_ARTICLES,
  ...VEHICLE_DOCS_INSURANCE_ARTICLES,
  ...WARRANTY_INVOICE_ARTICLES
];

// Recommended Next 20 Topics for upcoming content pipeline
export interface TopicSeed {
  topicNumber: number;
  title: string;
  category: BlogCategory;
  suggestedSlug: string;
}

export const RECOMMENDED_NEXT_TOPICS: TopicSeed[] = [
  { topicNumber: 51, title: 'Inverter Battery कितने साल चलती है? Water Top-up & Gravity Rules', category: 'appliances', suggestedSlug: 'inverter-battery-kitne-saal-chalti-hai' },
  { topicNumber: 52, title: 'Solar Panel Maintenance: धूल से पावर लॉस कैसे रोकें?', category: 'appliances', suggestedSlug: 'solar-panel-maintenance-cleaning-guide' },
  { topicNumber: 53, title: 'EV Car Battery Life: बैटरी बदलने का खर्च और वारंटी नियम', category: 'vehicles', suggestedSlug: 'ev-car-battery-life-replacement-cost' },
  { topicNumber: 54, title: 'Car Sunroof Maintenance: ड्रेन पाइप लीकेज और मोटर जाम सॉल्यूशन', category: 'vehicles', suggestedSlug: 'car-sunroof-maintenance-water-leak-fix' },
  { topicNumber: 55, title: 'Dishwasher भारत में कितना उपयोगी है? साल्ट, डिटर्जेंट और बिजली बिल', category: 'appliances', suggestedSlug: 'dishwasher-maintenance-and-cost-india' },
  { topicNumber: 56, title: 'Television (LED/OLED) Display कितने साल चलती है? Panel Warranty Rules', category: 'appliances', suggestedSlug: 'tv-panel-warranty-and-lifespan-guide' },
  { topicNumber: 57, title: 'Car Brake Pads कितने KM पर बदलने चाहिए? Spongy Pedal Warning', category: 'vehicles', suggestedSlug: 'car-brake-pads-replacement-interval' },
  { topicNumber: 58, title: 'Wheel Alignment vs Balancing: कब और क्यों करानी चाहिए?', category: 'vehicles', suggestedSlug: 'wheel-alignment-vs-balancing-difference' },
  { topicNumber: 59, title: 'Laptop Battery Health कैसे चेक करें? 500 Cycle Count Guide', category: 'warranty', suggestedSlug: 'laptop-battery-cycle-count-health-check' },
  { topicNumber: 60, title: 'Induction Cooktop E0/E1 Error Code कैसे ठीक करें?', category: 'appliances', suggestedSlug: 'induction-cooktop-error-codes-repair' },
  { topicNumber: 61, title: 'Fastag Blacklist क्यों होता है? Low Balance & KYC Guidelines', category: 'vehicles', suggestedSlug: 'fastag-blacklist-reasons-and-kyc-fix' },
  { topicNumber: 62, title: 'Car Ceramic Coating vs PPF: पेंट सुरक्षा के लिए कौन सा बेहतर है?', category: 'vehicles', suggestedSlug: 'ppf-vs-ceramic-coating-car-paint-protection' },
  { topicNumber: 63, title: 'Air Purifier HEPA Filter कितने महीने में बदलना चाहिए?', category: 'appliances', suggestedSlug: 'air-purifier-hepa-filter-replacement-interval' },
  { topicNumber: 64, title: 'Smart TV Motherboard खराब होने के 4 लक्षण और रिपेयर खर्च', category: 'appliances', suggestedSlug: 'smart-tv-motherboard-repair-cost' },
  { topicNumber: 65, title: 'Used Car खरीदने से पहले 20-Point Inspection Checklist', category: 'vehicles', suggestedSlug: 'used-car-buying-inspection-checklist-india' },
  { topicNumber: 66, title: 'Vehicle Hypothecation (HP) Cancellation: RTO लोन कैंसलेशन प्रक्रिया', category: 'vehicles', suggestedSlug: 'rto-hypothecation-cancellation-noc-process' },
  { topicNumber: 67, title: 'Home Insurance: आग, चोरी और प्राकृतिक आपदा से सामान का बीमा', category: 'warranty', suggestedSlug: 'home-appliance-and-structure-insurance-guide' },
  { topicNumber: 68, title: 'Submersible Pump पानी कम क्यों उठा रहा है? Capacitor & Sand Clog Fix', category: 'appliances', suggestedSlug: 'submersible-pump-water-pressure-troubleshooting' },
  { topicNumber: 69, title: 'Car Clutch Plate कितने KM चलती है? Hard Clutch Warning Signs', category: 'vehicles', suggestedSlug: 'car-clutch-plate-replacement-km-symptoms' },
  { topicNumber: 70, title: 'National Consumer Helpline पर वारंटी फ्रॉड की शिकायत कैसे दर्ज करें?', category: 'warranty', suggestedSlug: 'national-consumer-helpline-warranty-complaint-process' }
];

export const TOPIC_SEEDS = RECOMMENDED_NEXT_TOPICS;

export class BlogRepository {
  public static getAllPublished(): BlogPost[] {
    return BLOG_POSTS.filter(p => p.isPublished);
  }

  public static getBySlug(slug: string): BlogPost | undefined {
    if (!slug) return undefined;
    const clean = slug.toLowerCase().replace(/^\/blog\//, '').replace(/^\//, '').trim();
    return BLOG_POSTS.find(p => p.slug === clean);
  }

  public static getByCategory(category: BlogCategory): BlogPost[] {
    return BLOG_POSTS.filter(p => p.isPublished && p.category === category);
  }

  public static getRelated(currentSlug: string, limit: number = 3): BlogPost[] {
    const current = this.getBySlug(currentSlug);
    if (!current) return this.getAllPublished().slice(0, limit);

    return BLOG_POSTS.filter(
      p => p.isPublished && p.slug !== current.slug && (p.category === current.category || current.relatedArticleSlugs.includes(p.slug))
    ).slice(0, limit);
  }

  public static getAllSlugs(): string[] {
    return BLOG_POSTS.filter(p => p.isPublished).map(p => p.slug);
  }
}
