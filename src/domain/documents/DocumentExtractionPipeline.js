/**
 * Schema-driven document extraction entry — single OCR semantic pipeline.
 * Avoid parallel OCR implementations; providers map into NormalizedDocument.
 */
import { runSemanticOcrPipeline } from '../../services/ocr/runSemanticOcrPipeline';
import { classifyDocument } from './DocumentClassifier';
import { getDocumentSchema } from './DocumentSchemaRegistry';

export function runDocumentExtraction(rawText = '', parsedSeed = {}, opts = {}) {
  const structured = runSemanticOcrPipeline(rawText, parsedSeed, opts);
  const classification = classifyDocument(rawText, {
    productName: structured.productName,
    shopName: structured.shopName,
    registration: structured.registration,
    chassisNumber: structured.chassisNumber,
  });
  const schema = getDocumentSchema(classification.domainType);
  return {
    ...structured,
    domainDocumentType: classification.domainType,
    schema,
    classification,
  };
}

export default { runDocumentExtraction };
