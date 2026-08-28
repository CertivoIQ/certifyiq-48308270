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

export type WorkspaceProfile = {
  organization_type: OrganizationType;
  selected_programs: string[];
  pha_programs: string[];
  derived_overlays: string[];
};

const DEFAULT_PROFILE: WorkspaceProfile = {
  organization_type: "multifamily_owner_agent",
  selected_programs: [],
  pha_programs: [],
  derived_overlays: [],
};

export function useWorkspaceProfile() {
  const { user, ready } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery<WorkspaceProfile>({
    queryKey: ["workspace-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from("customer_workspace_profiles")
        .select("organization_type, selected_programs, pha_programs, derived_overlays")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PROFILE;
    },
  });

  useEffect(() => {
    if (!user) return;
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
