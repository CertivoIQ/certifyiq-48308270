import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Release = {
  id: string;
  release_key: string;
  source_url: string;
  bundle_url: string | null;
  source_version: string;
  published_date: string | null;
  source_checksum: string | null;
  status: string;
  verified_at: string | null;
  activated_at: string | null;
  notes: string | null;
  expected_standard_count: number | null;
  expected_deficiency_count: number | null;
  imported_standard_count: number;
  imported_deficiency_count: number;
  import_completed_at: string | null;
};
type Standard = {
  id: string;
  release_id: string | null;
  standard_name: string;
  inspectable_area: string;
  deficiency_reference: string;
  severity: string;
  correction_hours: number;
  hcv_correction_hours: number | null;
  hcv_pass_fail: string;
  source_status: string;
};
type Artifact = {
  id: string;
  release_id: string;
  artifact_name: string;
  artifact_type: string;
  sha256: string | null;
  import_status: string;
  parsed_row_count: number;
  verified_at: string | null;
};
type Attestation = { id: string; release_id: string; verifier_id: string; attested_at: string };
type AttestationResult = {
  release_id: string;
  attestations: number;
  required_attestations: number;
  activated: boolean;
};

function attestationErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "NSPIRE attestation failed";
}

export function PhaNspireStandardsWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["pha-nspire-standards-control"],
    queryFn: async () => {
      // Generated Supabase types lag newly deployed governance tables until schema types refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [r, s, a, v] = await Promise.all([
        client
          .from("pha_nspire_standard_releases")
          .select(
            "id,release_key,source_url,bundle_url,source_version,published_date,source_checksum,status,verified_at,activated_at,notes,expected_standard_count,expected_deficiency_count,imported_standard_count,imported_deficiency_count,import_completed_at",
          )
          .order("created_at", { ascending: false }),
        client
          .from("pha_nspire_deficiency_standards")
          .select(
            "id,release_id,standard_name,inspectable_area,deficiency_reference,severity,correction_hours,hcv_correction_hours,hcv_pass_fail,source_status",
          ),
        client
          .from("pha_nspire_source_artifacts")
          .select(
            "id,release_id,artifact_name,artifact_type,sha256,import_status,parsed_row_count,verified_at",
          ),
        client
          .from("pha_nspire_release_attestations")
          .select("id,release_id,verifier_id,attested_at"),
      ]);
      if (r.error) throw r.error;
      if (s.error) throw s.error;
      if (a.error) throw a.error;
      if (v.error) throw v.error;
      return {
        releases: (r.data ?? []) as Release[],
        standards: (s.data ?? []) as Standard[],
        artifacts: (a.data ?? []) as Artifact[],
        attestations: (v.data ?? []) as Attestation[],
      };
    },
  });

  const releases = query.data?.releases ?? [];
  const standards = query.data?.standards ?? [];
  const artifacts = query.data?.artifacts ?? [];
  const attestations = query.data?.attestations ?? [];
  const current = releases.find((release) => release.status === "current") ?? null;
  const target = current ?? releases[0] ?? null;
  const targetArtifact = target
    ? artifacts.find(
        (artifact) => artifact.release_id === target.id && artifact.artifact_type === "bundle_zip",
      )
    : null;
  const targetAttestations = target
    ? new Set(
        attestations
          .filter((attestation) => attestation.release_id === target.id)
          .map((attestation) => attestation.verifier_id),
      ).size
    : 0;
  const countReady =
    target?.expected_standard_count != null &&
    target.imported_standard_count === target.expected_standard_count &&
    target?.expected_deficiency_count != null &&
    target.imported_deficiency_count === target.expected_deficiency_count;

  const attestation = useMutation({
    mutationFn: async ({ releaseId, checksum }: { releaseId: string; checksum: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client.rpc("attest_and_activate_pha_nspire_release", {
        target_release_id: releaseId,
        expected_sha256: checksum,
      });
      if (error) throw error;
      return data as AttestationResult;
    },
    onSuccess: async (result) => {
      toast.success(
        result.activated
          ? "The verified NSPIRE release is active."
          : `Integrity attestation ${result.attestations} of ${result.required_attestations} recorded.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["pha-nspire-standards-control"] });
    },
    onError: (error) => toast.error(attestationErrorMessage(error)),
  });

  const attest = () => {
    if (!target?.source_checksum) {
      toast.error("A controlled source checksum is required before attestation.");
      return;
    }
    const checksum = window.prompt(
      "Independently compare the HUD ZIP SHA-256 with the controlled manifest, then enter the complete 64-character checksum.",
    );
    if (!checksum?.trim()) return;
    attestation.mutate({ releaseId: target.id, checksum: checksum.trim().toLowerCase() });
  };

  return (
    <AppShell
      title="NSPIRE Standards Control"
      subtitle="HUD source release, bundle integrity, deficiency-row population, correction timeframes, HCV pass/fail, and activation state"
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Stat
          label="Release status"
          value={current ? "Active" : "Pending"}
          hint={current ? current.source_version : "No verified release is active"}
        />
        <Stat
          label="HUD standard count"
          value={target?.expected_standard_count ?? "—"}
          hint={countReady ? "Imported counts reconciled" : "Imported count must match HUD manifest"}
        />
        <Stat
          label="Imported standards"
          value={target?.imported_standard_count ?? 0}
          hint={`${target?.imported_deficiency_count ?? 0} deficiency/location row(s)`}
        />
        <Stat
          label="Integrity attestations"
          value={targetAttestations}
          hint={current ? "Dual control complete" : "Two distinct staff verifiers required"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <Panel
          title="HUD release manifest"
          description="A release cannot activate without an official HUD bundle, checksum, count reconciliation, two distinct staff attestations, and a populated deficiency registry."
        >
          <div className="space-y-2">
            {releases.map((release) => (
              <div key={release.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{release.source_version}</div>
                    <div className="text-xs text-muted-foreground">
                      {release.release_key} · expected {release.expected_standard_count ?? "—"} standards
                      and {release.expected_deficiency_count ?? "—"} actionable rows
                    </div>
                  </div>
                  <Pill tone={release.status === "current" ? "seal" : undefined}>
                    {release.status}
                  </Pill>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Release checksum: {release.source_checksum ? "recorded" : "required"} · imported{" "}
                  {release.imported_standard_count}/{release.expected_standard_count ?? "?"} standards ·{" "}
                  {release.imported_deficiency_count}/{release.expected_deficiency_count ?? "?"} rows
                </div>
                {release.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">{release.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Deficiency registry"
          description="Correction timeframes are deficiency-specific. Voucher-program deadlines and pass/fail are retained separately from Public Housing/MFH correction windows."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3">Standard</th>
                  <th className="pb-3">Area</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">General</th>
                  <th className="pb-3">HCV</th>
                </tr>
              </thead>
              <tbody>
                {standards.slice(0, 100).map((standard) => (
                  <tr key={standard.id} className="border-t border-border">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{standard.standard_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {standard.deficiency_reference}
                      </div>
                    </td>
                    <td className="py-3 pr-3">{standard.inspectable_area}</td>
                    <td className="py-3 pr-3">{standard.severity.replaceAll("_", " ")}</td>
                    <td className="py-3 pr-3">{standard.correction_hours}h</td>
                    <td className="py-3">
                      {standard.hcv_pass_fail === "pass"
                        ? "Pass · no correction deadline"
                        : `${standard.hcv_correction_hours}h · fail`}
                    </td>
                  </tr>
                ))}
                {!query.isLoading && standards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No deficiency rows loaded. Activation is correctly blocked.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Official bundle control"
        description="The current HUD standards ZIP is checksum-locked and parsed. Each verifier must independently compare the SHA-256 value before attesting; the same account cannot satisfy both approvals."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Artifact: {targetArtifact?.import_status ?? "pending"} · parsed rows{" "}
            {targetArtifact?.parsed_row_count ?? 0} · attestations {targetAttestations}/2
          </div>
          {!current ? (
            <Button
              size="sm"
              disabled={!target || !countReady || attestation.isPending}
              onClick={attest}
            >
              <ShieldCheck className="size-4" />
              {attestation.isPending ? "Recording…" : "Verify source integrity"}
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Fail-closed activation"
        description="CertivoIQ does not infer a correction deadline from severity when HUD publishes a deficiency-specific timeframe. The release activates automatically only after the second distinct staff integrity attestation."
      />
    </AppShell>
  );
}
