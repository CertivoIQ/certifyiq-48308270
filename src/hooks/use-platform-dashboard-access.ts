import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export type PlatformDashboardMode = "multifamily" | "pha" | "executive_demo";

export const PLATFORM_DASHBOARD_LABELS: Record<PlatformDashboardMode, string> = {
  multifamily: "Multifamily",
  pha: "PHA",
  executive_demo: "Executive",
};

const DASHBOARD_ORDER: PlatformDashboardMode[] = ["multifamily", "pha", "executive_demo"];
const STORAGE_PREFIX = "certivoiq:platform-dashboard";
const FOUNDER_EMAIL = "rjwatkins@certivoiq.com";
const FOUNDER_USER_IDS = new Set(["e2f47e3c-416b-4bf5-ab5d-8e519b4afe7b"]);

function isPlatformDashboardMode(value: unknown): value is PlatformDashboardMode {
  return value === "multifamily" || value === "pha" || value === "executive_demo";
}

export function resolvePlatformDashboardMode(
  selectedMode: PlatformDashboardMode | null,
  organizationType: string | null | undefined,
): PlatformDashboardMode {
  if (selectedMode) return selectedMode;
  return organizationType === "pha" ? "pha" : "multifamily";
}

export function usePlatformDashboardAccess() {
  const { user } = useSession();
  const normalizedEmail = user?.email?.trim().toLowerCase();
  const isFounder =
    normalizedEmail === FOUNDER_EMAIL ||
    (user?.id ? FOUNDER_USER_IDS.has(user.id) : false);
  const query = useQuery({
    queryKey: ["platform-dashboard-access", user?.id],
    enabled: !!user && !isFounder,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Generated Supabase types lag the entitlement migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("platform_dashboard_access")
        .select("dashboard_key")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Array<{ dashboard_key: string }>;
    },
  });

  const entitledModes = DASHBOARD_ORDER.filter((mode) =>
    (query.data ?? []).some((row) => row.dashboard_key === mode),
  );

  // The founder must never lose cross-workspace access because of a staff-role,
  // workspace-profile, navigation, RLS-query, or email-normalization regression.
  // Other users remain strictly entitlement-based.
  const allowedModes = isFounder ? DASHBOARD_ORDER : entitledModes;

  const storageKey = user ? `${STORAGE_PREFIX}:${user.id}` : null;
  const storedMode =
    storageKey && typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
  const selectedMode =
    isPlatformDashboardMode(storedMode) && allowedModes.includes(storedMode) ? storedMode : null;

  const selectDashboard = (mode: PlatformDashboardMode) => {
    if (!storageKey || !allowedModes.includes(mode) || typeof window === "undefined") return false;
    window.localStorage.setItem(storageKey, mode);
    return true;
  };

  return {
    allowedModes,
    selectedMode,
    selectDashboard,
    hasSwitcher: allowedModes.length > 1,
    isFounder,
    loading: !!user && !isFounder && query.isLoading,
  };
}
