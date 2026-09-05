export const FOUNDER_EMAIL = "rjwatkins@certivoiq.com";

// Stable account identity backstop. This is intentionally duplicated with the
// exact founder email so navigation does not disappear if either identifier is
// normalized or changed independently.
export const FOUNDER_USER_IDS: ReadonlySet<string> = new Set([
  "e2f47e3c-416b-4bf5-ab5d-8e519b4afe7b",
]);

export const FOUNDER_DEFAULT_DASHBOARD = "multifamily" as const;

const FOUNDER_DASHBOARD_SESSION_PREFIX = "certivoiq:founder-dashboard-session";
const LEGACY_PLATFORM_DASHBOARD_STORAGE_PREFIX = "certivoiq:platform-dashboard";

type FounderIdentity = {
  id?: string | null;
  email?: string | null;
};

export function isFounderUser(user: FounderIdentity | null | undefined) {
  if (!user) return false;
  const normalizedEmail = user.email?.trim().toLowerCase();
  return normalizedEmail === FOUNDER_EMAIL || (!!user.id && FOUNDER_USER_IDS.has(user.id));
}

export function founderDashboardSessionKey(userId: string) {
  return `${FOUNDER_DASHBOARD_SESSION_PREFIX}:${userId}`;
}

export function legacyPlatformDashboardStorageKey(userId: string) {
  return `${LEGACY_PLATFORM_DASHBOARD_STORAGE_PREFIX}:${userId}`;
}
