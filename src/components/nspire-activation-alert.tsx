import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsStaff } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type PendingRelease = {
  id: string;
  source_version: string;
  imported_standard_count: number;
  imported_deficiency_count: number;
};

export function NspireActivationAlert() {
  const { isStaff, loading } = useIsStaff();
  const query = useQuery({
    queryKey: ["nspire-outstanding-governance-task"],
    enabled: isStaff,
    queryFn: async () => {
      // Generated Supabase types lag the controlled-source governance tables.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data: release, error: releaseError } = await client
        .from("pha_nspire_standard_releases")
        .select("id,source_version,imported_standard_count,imported_deficiency_count")
        .neq("status", "current")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (releaseError) throw releaseError;
      if (!release) return null;
      const { count, error: attestationError } = await client
        .from("pha_nspire_release_attestations")
        .select("id", { count: "exact", head: true })
        .eq("release_id", release.id);
      if (attestationError) throw attestationError;
      return {
        release: release as PendingRelease,
        attestations: count ?? 0,
      };
    },
  });

  if (loading || !isStaff || !query.data) return null;
  const { release, attestations } = query.data;

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
            Outstanding governance task
          </p>
          <h2 className="mt-1 font-display text-base">Complete NSPIRE source activation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {attestations}/2 independent staff attestations recorded · {release.imported_standard_count} standards ·{" "}
            {release.imported_deficiency_count} actionable rows
          </p>
        </div>
      </div>
      <Button size="sm" asChild className="shrink-0">
        <Link to="/pha-nspire-standards">Review NSPIRE standards</Link>
      </Button>
    </div>
  );
}
