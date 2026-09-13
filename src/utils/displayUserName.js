/**
 * Resolve a human display name for UI — never invent "Guest" for signed-in users.
 */

export function resolveDisplayName({ profile, user, fallback = 'Name not set' } = {}) {
  const clean = (v) => {
    const s = String(v || '').trim();
    if (!s) return '';
    if (s === 'Asset Owner' || s === 'Name not set') return '';
    // Disallow phone numbers as display name
    if (/^\+?[0-9\s\-\(\)\.]{7,18}$/.test(s)) return '';
    return s.slice(0, 80);
  };

  return (
    clean(profile?.name) ||
    clean(profile?.displayName) ||
    clean(profile?.fullName) ||
    clean(user?.displayName) ||
    fallback
  );
}
