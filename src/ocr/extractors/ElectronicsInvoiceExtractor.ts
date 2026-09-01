import { SalesInvoiceExtractor, type SalesInvoiceFields } from './SalesInvoiceExtractor.ts';

export class ElectronicsInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    return SalesInvoiceExtractor.extract(rawText);
  }
}
