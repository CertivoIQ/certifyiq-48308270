import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, KeyRound, LockKeyhole, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill } from "@/components/ui-kit";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type AuditorGrant = {
  id: string;
  owner_user_id: string;
  auditor_user_id: string;
  organization_id: string;
  scope_type: "enterprise" | "portfolio" | "property";
  portfolio_ref: string | null;
  property_ids: string[];
  program_codes: string[];
  date_from: string;
  date_to: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

type WorkspaceSnapshot = {
  grant: {
    id: string;
    organization_id: string;
    scope_type: string;
    property_ids: string[];
    program_codes: string[];
    date_from: string;
    date_to: string;
    expires_at: string;
    read_only: boolean;
  };
  approved_certifications: unknown[];
  evidence_records: unknown[];
  findings: unknown[];
  remediation: unknown[];
  regulatory_citations: unknown[];
};

function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function AuditorWorkspace() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [auditorIds, setAuditorIds] = useState("");
  const [scopeType, setScopeType] = useState<AuditorGrant["scope_type"]>("property");
  const [portfolioRef, setPortfolioRef] = useState("");
  const [propertyIds, setPropertyIds] = useState("");
  const [programCodes, setProgramCodes] = useState("");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 7 * 86_400_000);
    return date.toISOString().slice(0, 16);
  });
  const [selectedGrantId, setSelectedGrantId] = useState("");
  // Generated database types intentionally trail controlled rollout migrations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const grants = useQuery({
    queryKey: ["auditor-access-grants"],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await client
        .from("auditor_access_grants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuditorGrant[];
    },
  });

  const effectiveGrantId = selectedGrantId || grants.data?.[0]?.id || "";
  const selectedGrant = grants.data?.find((grant) => grant.id === effectiveGrantId);
  const snapshot = useQuery({
    queryKey: ["auditor-workspace-snapshot", effectiveGrantId],
    enabled: Boolean(effectiveGrantId && selectedGrant?.auditor_user_id === session?.user.id),
    queryFn: async () => {
      const { data, error } = await client.rpc("auditor_workspace_snapshot", {
        _grant_id: effectiveGrantId,
      });
      if (error) throw error;
      return data as WorkspaceSnapshot;
    },
  });

  const createGrant = useMutation({
    mutationFn: async () => {
      const ownerId = session?.user.id;
      if (!ownerId) throw new Error("Sign in to create auditor access");
      const authorizedAuditorIds = splitList(auditorIds);
      if (authorizedAuditorIds.length === 0) throw new Error("Enter at least one authenticated auditor account ID");
      if (scopeType === "property" && splitList(propertyIds).length === 0) {
        throw new Error("Property scope requires at least one property ID");
      }
      const { data, error } = await client.rpc("create_auditor_access_grants", {
        _owner_user_id: ownerId,
        _organization_id: ownerId,
        _auditor_user_ids: authorizedAuditorIds,
        _scope_type: scopeType,
        _portfolio_ref: portfolioRef.trim() || null,
        _property_ids: splitList(propertyIds),
        _program_codes: splitList(programCodes).map((code) => code.toUpperCase()),
        _date_from: dateFrom,
        _date_to: dateTo,
        _expires_at: new Date(expiresAt).toISOString(),
        _include_approved_certifications: true,
        _include_evidence_records: true,
        _include_findings_remediation: true,
        _include_regulatory_citations: true,
      });
      if (error) throw error;
      return data as string[];
    },
    onSuccess: (ids) => {
      setSelectedGrantId(ids[0] ?? "");
      setAuditorIds("");
      setShowCreate(false);
      toast.success(ids.length === 1 ? "Temporary auditor access created" : `${ids.length} temporary auditor access grants created`);
      void queryClient.invalidateQueries({ queryKey: ["auditor-access-grants"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Auditor access could not be created"),
  });

  const revokeGrant = useMutation({
    mutationFn: async (grantId: string) => {
      const { error } = await client.rpc("revoke_auditor_access_grant", { _grant_id: grantId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Auditor access revoked");
      void queryClient.invalidateQueries({ queryKey: ["auditor-access-grants"] });
      void queryClient.invalidateQueries({ queryKey: ["auditor-workspace-snapshot"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Auditor access could not be revoked"),
  });

  return (
    <Panel
      title="Auditor Workspace"
      description="Temporary, read-only access to approved records within an explicit property, program, and date scope."
      actions={
        <Button size="sm" variant="outline" onClick={() => setShowCreate((value) => !value)}>
          <KeyRound className="size-4" /> Create access
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Pill tone="seal">Read-only</Pill>
        <Pill tone="neutral">Expiration enforced server-side</Pill>
        <Pill tone="neutral">Unlimited authorized auditors</Pill>
        <Pill tone="neutral">Every open logged</Pill>
      </div>

      {showCreate ? (
        <div className="mb-5 grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="auditor-id">Authenticated auditor account IDs</Label>
            <Input
              id="auditor-id"
              value={auditorIds}
              onChange={(event) => setAuditorIds(event.target.value)}
              placeholder="UUID, UUID, UUID"
            />
            <p className="text-xs text-muted-foreground">
              Paid Multifamily Enterprise accounts may authorize unlimited auditors. Enter one or more authenticated CertivoIQ account IDs separated by commas.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auditor-scope">Scope</Label>
            <select
              id="auditor-scope"
              value={scopeType}
              onChange={(event) => setScopeType(event.target.value as AuditorGrant["scope_type"])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="enterprise">Enterprise</option>
              <option value="portfolio">Portfolio</option>
              <option value="property">Property</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio-ref">Portfolio reference</Label>
            <Input id="portfolio-ref" value={portfolioRef} onChange={(event) => setPortfolioRef(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auditor-properties">Property IDs, comma separated</Label>
            <Input id="auditor-properties" value={propertyIds} onChange={(event) => setPropertyIds(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auditor-programs">Programs, comma separated</Label>
            <Input id="auditor-programs" value={programCodes} onChange={(event) => setProgramCodes(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auditor-from">Records from</Label>
            <Input id="auditor-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auditor-to">Records through</Label>
            <Input id="auditor-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="auditor-expires">Access expires</Label>
            <Input id="auditor-expires" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </div>
          <Button className="md:col-span-2" onClick={() => createGrant.mutate()} disabled={createGrant.isPending}>
            <LockKeyhole className="size-4" /> Issue scoped read-only access
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {(grants.data ?? []).map((grant) => {
          const isOwner = grant.owner_user_id === session?.user.id;
          const active = !grant.revoked_at && new Date(grant.expires_at).valueOf() > Date.now();
          return (
            <div key={grant.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left font-medium underline-offset-4 hover:underline"
                  onClick={() => setSelectedGrantId(grant.id)}
                >
                  {grant.scope_type} · {grant.program_codes.join(", ") || "All programs"}
                </button>
                <div className="flex gap-2">
                  <Pill tone={active ? "seal" : "neutral"}>{active ? "Active" : "Inactive"}</Pill>
                  {isOwner && active ? (
                    <Button size="sm" variant="outline" onClick={() => revokeGrant.mutate(grant.id)}>
                      <ShieldX className="size-4" /> Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {grant.date_from}–{grant.date_to} · expires {new Date(grant.expires_at).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {snapshot.data ? (
        <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <Eye className="size-4" /> Scoped workspace opened
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <span>{snapshot.data.approved_certifications.length} approved certifications</span>
            <span>{snapshot.data.evidence_records.length} Evidence Records</span>
            <span>{snapshot.data.findings.length} findings</span>
            <span>{snapshot.data.remediation.length} remediation actions</span>
            <span>{snapshot.data.regulatory_citations.length} citations</span>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
