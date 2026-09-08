import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isInternalSegmentUser } from "./internal-segment-access";

export const requireInternalSegmentAccess = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    // Fetch the current verified email, never profile/user_metadata or stale JWT email claims.
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !isInternalSegmentUser(data.user)) throw new Response("Not found", { status: 404 });
    return next();
  });
