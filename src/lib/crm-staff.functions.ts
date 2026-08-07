import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffUser = {
  id: string;
  email: string;
  name: string;
};

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffUser[]> => {
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isStaff) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "staff");
    if (rolesError) throw rolesError;
    if (!roles?.length) return [];

    const ids = roles.map((r) => r.user_id);
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    if (profilesError) throw profilesError;

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email ?? "",
      name: p.full_name ?? p.email ?? "",
    }));
  });
