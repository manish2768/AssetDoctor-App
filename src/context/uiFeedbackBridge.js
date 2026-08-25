/**
 * Non-React bridge so utilities (authGate) can use ConfirmDialog / toast
 * without hooks. Bound by UiFeedbackProvider on mount.
 */

let handlers = null;

export function bindUiFeedbackBridge(next) {
  handlers = next || null;
}

export function isUiFeedbackBridgeBound() {
  return Boolean(handlers?.confirm);
}

export function bridgeConfirm(options) {
  if (handlers?.confirm) return handlers.confirm(options);
  return Promise.resolve(null); // null = unbound (distinct from user cancel false)
}

export function bridgeInfo(title, message) {
  handlers?.info?.(title, message);
}

export function bridgeSuccess(message) {
  handlers?.success?.(message);
}

export function bridgeError(title, message) {
  handlers?.error?.(title, message);
}

export default {
  bindUiFeedbackBridge,
  isUiFeedbackBridgeBound,
  bridgeConfirm,
  bridgeInfo,
  bridgeSuccess,
  bridgeError,
};
