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

export type PhaAgencyRole =
  | "workspace_owner"
  | "executive"
  | "agency_admin"
  | "compliance_admin"
  | "hcv_pbv_specialist"
  | "public_housing_specialist"
  | "inspection_staff";

export type WorkspaceProfile = {
  organization_type: OrganizationType;
  selected_programs: string[];
  pha_programs: string[];
  derived_overlays: string[];
  pha_hotma_cohort: PhaHotmaCohort | null;
  hud_50058_reporting_path: Hud50058ReportingPath | null;
};

type ResolvedWorkspace = {
  profile: WorkspaceProfile;
  workspaceUserId: string | null;
  phaRole: PhaAgencyRole | null;
};

const DEFAULT_PROFILE: WorkspaceProfile = {
  organization_type: "multifamily_owner_agent",
  selected_programs: [],
  pha_programs: [],
  derived_overlays: [],
  pha_hotma_cohort: null,
  hud_50058_reporting_path: null,
};

const FOUNDER_EMAIL = "rjwatkins@certivoiq.com";

export function useWorkspaceProfile() {
  const { user, ready } = useSession();
  const isFounder = user?.email?.trim().toLowerCase() === FOUNDER_EMAIL;
  const queryClient = useQueryClient();

  const query = useQuery<ResolvedWorkspace>({
    queryKey: ["workspace-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Generated Supabase types lag the PHA membership migration until the next schema type refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const selectFields = "organization_type, selected_programs, pha_programs, derived_overlays, pha_hotma_cohort, hud_50058_reporting_path";
      const own = await client.from("customer_workspace_profiles").select(selectFields).eq("user_id", user!.id).maybeSingle();
      if (own.error) throw own.error;
      if (own.data) {
        return {
          profile: own.data,
          workspaceUserId: user!.id,
          phaRole: own.data.organization_type === "pha" ? "workspace_owner" : null,
        };
      }

      const membership = await client
        .from("pha_workspace_memberships")
        .select("workspace_user_id, agency_role")
        .eq("member_user_id", user!.id)
        .eq("active", true)
        .maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) return { profile: DEFAULT_PROFILE, workspaceUserId: user!.id, phaRole: null };

      const agency = await client
        .from("customer_workspace_profiles")
        .select(selectFields)
        .eq("user_id", membership.data.workspace_user_id)
        .eq("organization_type", "pha")
        .maybeSingle();
      if (agency.error) throw agency.error;
      if (!agency.data) return { profile: DEFAULT_PROFILE, workspaceUserId: user!.id, phaRole: null };

      return {
        profile: agency.data,
        workspaceUserId: membership.data.workspace_user_id,
        phaRole: membership.data.agency_role as PhaAgencyRole,
      };
    },
  });

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const channel = client
      .channel(`workspace-profile-${user.id}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_workspace_profiles" },
        () => void queryClient.invalidateQueries({ queryKey: ["workspace-profile", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pha_workspace_memberships", filter: `member_user_id=eq.${user.id}` },
        () => void queryClient.invalidateQueries({ queryKey: ["workspace-profile", user.id] }),
      )
      .subscribe();
    return () => void client.removeChannel(channel);
  }, [user?.id, queryClient]);

  const resolved = query.data ?? { profile: DEFAULT_PROFILE, workspaceUserId: user?.id ?? null, phaRole: null };
  return {
    profile: resolved.profile,
    workspaceUserId: resolved.workspaceUserId,
    // Founder navigation is platform-wide. Treat the founder as a PHA workspace
    // owner for client-side menu visibility without mutating any customer role.
    phaRole: isFounder ? "workspace_owner" : resolved.phaRole,
    loading: !ready || (!!user && query.isLoading),
    refetch: query.refetch,
  };
}
