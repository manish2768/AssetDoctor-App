import { SalesInvoiceExtractor, type SalesInvoiceFields } from './SalesInvoiceExtractor.ts';

export class PurchaseInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    return SalesInvoiceExtractor.extract(rawText);
  }
}
