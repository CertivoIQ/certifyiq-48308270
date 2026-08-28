import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export type OrganizationType =
  | "multifamily_owner_agent"
  | "pha"
  | "developer_owner"
  | "compliance_asset_management"
  | "housing_agency"
  | "other";

export type PhaHotmaCohort =
  | "NON_MTW_NON_FRS"
  | "INITIAL_MTW"
  | "MTW_EXPANSION"
  | "FRS_EXCLUSIVE";

export type Hud50058ReportingPath =
  | "HUD_50058_2024"
  | "HUD_50058_2020_ALTERNATIVE";

export type WorkspaceProfile = {
  organization_type: OrganizationType;
  selected_programs: string[];
  pha_programs: string[];
  derived_overlays: string[];
  pha_hotma_cohort: PhaHotmaCohort | null;
  hud_50058_reporting_path: Hud50058ReportingPath | null;
};

const DEFAULT_PROFILE: WorkspaceProfile = {
  organization_type: "multifamily_owner_agent",
  selected_programs: [],
  pha_programs: [],
  derived_overlays: [],
  pha_hotma_cohort: null,
  hud_50058_reporting_path: null,
};

export function useWorkspaceProfile() {
  const { user, ready } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery<WorkspaceProfile>({
    queryKey: ["workspace-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Generated Supabase types lag this new migration until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("customer_workspace_profiles")
        .select("organization_type, selected_programs, pha_programs, derived_overlays, pha_hotma_cohort, hud_50058_reporting_path")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PROFILE;
    },
  });

  useEffect(() => {
    if (!user) return;
    // Generated Supabase types lag this new migration until the next schema type refresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const channel = client
      .channel(`workspace-profile-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_workspace_profiles", filter: `user_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["workspace-profile", user.id] }),
      )
      .subscribe();
    return () => void client.removeChannel(channel);
  }, [user?.id, queryClient]);

  return {
    profile: query.data ?? DEFAULT_PROFILE,
    loading: !ready || (!!user && query.isLoading),
    refetch: query.refetch,
  };
}
