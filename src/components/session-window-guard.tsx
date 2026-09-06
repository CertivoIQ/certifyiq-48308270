import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endExpiredSession, readSessionWindow } from "@/lib/session-window";

export function SessionWindowGuard() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    let sequence = 0;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const verify = async () => {
      const current = ++sequence;
      const { data } = await supabase.auth.getSession();
      if (!active || current !== sequence) return;
      clearTimeout(deadline);
      if (!data.session) return;
      try {
        const window = await readSessionWindow();
        if (!active || current !== sequence) return;
        if (!window.valid) { queryClient.clear(); await endExpiredSession(); return; }
        deadline = setTimeout(() => { void verify(); }, Math.max(1, window.remaining_seconds * 1000));
      } catch {
        // Temporary network failures do not become an extension of server access.
        // Every protected request is independently checked on the server.
        if (active && current === sequence) deadline = setTimeout(() => { void verify(); }, 5000);
      }
    };
    const changed = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") queryClient.clear();
      // Do not call Supabase inside its auth callback's lock.
      setTimeout(() => { if (active) void verify(); }, 0);
    });
    const focus = () => { void verify(); };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    document.addEventListener("visibilitychange", focus);
    void verify();
    return () => { active = false; sequence++; clearTimeout(deadline); changed.data.subscription.unsubscribe(); window.removeEventListener("focus", focus); window.removeEventListener("online", focus); document.removeEventListener("visibilitychange", focus); };
  }, [queryClient]);
  return null;
}
