/**
 * Resolve a human display name for UI — never invent "Guest" for signed-in users.
 */

export function resolveDisplayName({ profile, user, fallback = 'Asset Owner' } = {}) {
  const clean = (v) => {
    const s = String(v || '').trim();
    return s || '';
  };

  return (
    clean(profile?.name) ||
    clean(profile?.displayName) ||
    clean(user?.displayName) ||
    clean(profile?.phone || profile?.phoneNumber || user?.phoneNumber) ||
    clean(profile?.email || user?.email)?.split('@')[0] ||
    fallback
  );
}
