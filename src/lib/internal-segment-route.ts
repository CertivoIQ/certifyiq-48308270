import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isInternalSegmentUser } from "./internal-segment-access";

export async function requireInternalSegmentRoute() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !isInternalSegmentUser(data.user)) throw redirect({ to: "/dashboard" });
}
