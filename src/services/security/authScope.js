/**
 * Auth scope helpers — never trust client-provided userId alone.
 * Callers must pass Firebase Auth uid; this asserts match.
 */

export function assertAuthUid(actorUid, claimedUserId, action = 'access') {
  if (!actorUid) {
    return { ok: false, error: 'UNAUTHENTICATED', message: 'Sign in required' };
  }
  if (claimedUserId && claimedUserId !== actorUid) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: `Not authorized to ${action} another user's data`,
    };
  }
  return { ok: true, userId: actorUid };
}

export function requireAuthUid(actorUid, claimedUserId, action = 'access') {
  const result = assertAuthUid(actorUid, claimedUserId, action);
  if (!result.ok) {
    const err = new Error(result.message);
    err.code = result.error;
    throw err;
  }
  return result.userId;
}

export default { assertAuthUid, requireAuthUid };
