import { supabase } from "@/integrations/supabase/client";

export type SessionWindow = { valid: boolean; remaining_seconds: number };
// The original login timestamp is read from auth.sessions on the server.
// Refreshing a JWT or opening another tab never extends this deadline.
export async function readSessionWindow(): Promise<SessionWindow> {
  const { data, error } = await supabase.rpc("get_session_window" as never);
  if (error) throw new Error("Could not verify your login session. Please try again.");
  const value = data as unknown as SessionWindow;
  if (!value || typeof value.valid !== "boolean" || !Number.isFinite(value.remaining_seconds)) throw new Error("Invalid session response.");
  return value;
}

let ending: Promise<void> | null = null;
export function endExpiredSession(): Promise<void> {
  if (!ending) ending = (async () => {
    await supabase.auth.signOut({ scope: "local" });
    if (typeof window !== "undefined" && window.location.pathname !== "/auth") window.location.replace("/auth?mode=signin");
  })().finally(() => { ending = null; });
  return ending;
}
