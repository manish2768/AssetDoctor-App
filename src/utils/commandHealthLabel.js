/**
 * Map engine health grades to Excellent / Good / Attention for the 5-second Home read.
 * Presentation only — does not change scoring.
 */
export function commandHealthLabel(gradeOrBand = '') {
  const g = String(gradeOrBand || '');
  if (/excellent/i.test(g)) return 'Excellent';
  if (/good/i.test(g)) return 'Good';
  if (!g) return '—';
  return 'Attention';
}

export default { commandHealthLabel };
