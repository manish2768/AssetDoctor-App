/**
 * Safe sync observability — no passwords, tokens, OCR text, or file bodies.
 */

const MAX = 40;
const memory = [];

export function logSyncEvent(event = {}) {
  const row = {
    at: new Date().toISOString(),
    operationType: event.operationType || null,
    entityType: event.entityType || null,
    entityId: event.entityId ? String(event.entityId).slice(0, 64) : null,
    success: Boolean(event.success),
    durationMs: Number(event.durationMs) || null,
    errorCategory: event.errorCategory
      ? String(event.errorCategory).slice(0, 80)
      : null,
  };
  memory.unshift(row);
  if (memory.length > MAX) memory.length = MAX;
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[Sync]', row.operationType, row.entityType, row.success ? 'ok' : row.errorCategory);
  }
  return row;
}

export function getRecentSyncLogs() {
  return [...memory];
}

export function clearSyncLogs() {
  memory.length = 0;
}

export default { logSyncEvent, getRecentSyncLogs, clearSyncLogs };
