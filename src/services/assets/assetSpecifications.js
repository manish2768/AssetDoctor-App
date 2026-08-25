/**
 * Extensible specifications map — future OCR can merge without schema migrations.
 * Shape: { [key]: { value, unit?, source?, confidence?, verified? } }
 */

export function emptySpecifications() {
  return {};
}

export function setSpecification(specs = {}, key, value, opts = {}) {
  const next = { ...(specs || {}) };
  if (value == null || value === '') {
    delete next[key];
    return next;
  }
  next[key] = {
    value,
    unit: opts.unit || null,
    source: opts.source || 'user',
    confidence: opts.confidence != null ? Number(opts.confidence) : null,
    verified: Boolean(opts.verified),
  };
  return next;
}

export function getSpecification(specs = {}, key) {
  const row = specs?.[key];
  if (!row) return null;
  return row;
}

export function mergeSpecifications(base = {}, incoming = {}) {
  return { ...(base || {}), ...(incoming || {}) };
}

export default {
  emptySpecifications,
  setSpecification,
  getSpecification,
  mergeSpecifications,
};
