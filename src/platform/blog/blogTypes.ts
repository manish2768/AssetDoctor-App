export type BlogCategory = 'vehicles' | 'appliances' | 'warranty' | 'maintenance';

export type SearchIntent = 
  | 'informational' 
  | 'problem-solving' 
  | 'how-to' 
  | 'comparison' 
  | 'calculator-tool' 
  | 'warranty' 
  | 'maintenance';

export interface BlogSection {
  id: string;
  heading: string;
  paragraphs: string[];
  practicalSteps?: string[];
  warning?: string;
  tip?: string;
}

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  searchIntent?: SearchIntent;
  directAnswer?: string;
  category: BlogCategory;
  categoryDisplayName: string;
  readTime: string;
  author: string;
  publishedDate: string;
  updatedDate: string;
  intro: string;
  tableOfContents: { id: string; title: string }[];
  sections: BlogSection[];
  professionalServiceNote?: string;
  faqs: BlogFaq[];
  relatedToolSlug: string;
  relatedToolName: string;
  relatedArticleSlugs: string[];
  isPublished: boolean;
}
