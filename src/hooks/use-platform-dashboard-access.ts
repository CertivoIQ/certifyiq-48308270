import { useQuery } from "@tanstack/react-query";
import { useIsStaff, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export type PlatformDashboardMode = "multifamily" | "pha" | "executive_demo";

export const PLATFORM_DASHBOARD_LABELS: Record<PlatformDashboardMode, string> = {
  multifamily: "Multifamily",
  pha: "PHA",
  executive_demo: "Executive demo",
};

const DASHBOARD_ORDER: PlatformDashboardMode[] = ["multifamily", "pha", "executive_demo"];
const STORAGE_PREFIX = "certivoiq:platform-dashboard";

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
  const { isStaff, loading: staffLoading } = useIsStaff();
  const query = useQuery({
    queryKey: ["platform-dashboard-access", user?.id],
    enabled: !!user,
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
  // CertivoIQ staff can inspect every product workspace without changing a
  // customer organization profile. Customer access remains entitlement-based.
  const allowedModes = isStaff ? DASHBOARD_ORDER : entitledModes;

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
    loading: !!user && (query.isLoading || staffLoading),
  };
}
