import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  FOUNDER_DEFAULT_DASHBOARD,
  founderDashboardSessionKey,
  isFounderUser,
  legacyPlatformDashboardStorageKey,
} from "@/lib/founder-access";

export type PlatformDashboardMode = "multifamily" | "pha" | "executive_demo";

export const PLATFORM_DASHBOARD_LABELS: Record<PlatformDashboardMode, string> = {
  multifamily: "Multifamily",
  pha: "PHA",
  executive_demo: "Executive",
};

const DASHBOARD_ORDER: PlatformDashboardMode[] = ["multifamily", "pha", "executive_demo"];

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
  const isFounder = isFounderUser(user);
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

  // Founder access is a platform invariant. Ordinary users remain strictly
  // database-entitlement based.
  const allowedModes = isFounder ? DASHBOARD_ORDER : entitledModes;

  const storage =
    typeof window === "undefined"
      ? null
      : isFounder
        ? window.sessionStorage
        : window.localStorage;
  const storageKey = user
    ? isFounder
      ? founderDashboardSessionKey(user.id)
      : legacyPlatformDashboardStorageKey(user.id)
    : null;
  const storedMode = storage && storageKey ? storage.getItem(storageKey) : null;

  // A fresh founder browser session is always anchored to the operational
  // Multifamily dashboard. PHA and Executive may be selected during the active
  // session, but no old browser value can survive a fresh login and take over.
  const selectedMode: PlatformDashboardMode | null = isFounder
    ? isPlatformDashboardMode(storedMode) && allowedModes.includes(storedMode)
      ? storedMode
      : FOUNDER_DEFAULT_DASHBOARD
    : isPlatformDashboardMode(storedMode) && allowedModes.includes(storedMode)
      ? storedMode
      : null;

  const selectDashboard = (mode: PlatformDashboardMode) => {
    if (!storage || !storageKey || !allowedModes.includes(mode)) return false;
    storage.setItem(storageKey, mode);
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
