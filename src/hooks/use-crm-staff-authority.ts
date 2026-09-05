import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { isFounderUser } from "@/lib/founder-access";

export type CrmStaffAccessLevel = "employee" | "manager" | "admin";

export function useCrmStaffAuthority() {
  const { user } = useSession();
  const isFounder = isFounderUser(user);
  const query = useQuery({
    queryKey: ["crm-staff-authority", user?.id],
    enabled: !!user && !isFounder,
    queryFn: async () => {
      // Generated Supabase types lag the CRM staff access migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .from("crm_staff_access")
        .select("access_level,status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { access_level: CrmStaffAccessLevel; status: "active" | "disabled" } | null;
    },
  });

  // Founder access is platform-wide and must not be reduced by a missing or stale
  // CRM staff row. All other users remain database-authorized.
  const accessLevel: CrmStaffAccessLevel | null = isFounder
    ? "admin"
    : query.data?.status === "active"
      ? query.data.access_level
      : null;

  return {
    accessLevel,
    canManageStaff: accessLevel === "manager" || accessLevel === "admin",
    isCrmAdmin: accessLevel === "admin",
    loading: !!user && !isFounder && query.isLoading,
  };
}
