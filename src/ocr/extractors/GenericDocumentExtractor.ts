import { SalesInvoiceExtractor, type SalesInvoiceFields } from './SalesInvoiceExtractor.ts';

export class GenericDocumentExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    return SalesInvoiceExtractor.extract(rawText);
  }
}
