export const RECENT_AUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;

export function isRecentAuthentication(
  authenticatedAt: string | undefined,
  now = Date.now()
) {
  if (!authenticatedAt) return false;

  const issuedAt = Date.parse(authenticatedAt);
  if (!Number.isFinite(issuedAt)) return false;

  const age = now - issuedAt;
  return age >= -60_000 && age <= RECENT_AUTHENTICATION_WINDOW_MS;
}
