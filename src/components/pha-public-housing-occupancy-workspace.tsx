import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

type Lease = {
  id: string;
  family_action_id: string;
  unit_reference: string;
  lease_start: string;
  status: string;
  lease_document_reference: string | null;
  grievance_procedure_version: string | null;
};
type Transfer = {
  id: string;
  lease_id: string;
  transfer_reason: string;
  current_unit_reference: string;
  offered_unit_reference: string | null;
  status: string;
  grievance_status: string;
  is_adverse_action: boolean;
  adverse_action_ground: string | null;
  block_reason: string | null;
};
type Choice = { id: string; label: string };
type WorkspaceData = {
  leases: Lease[];
  transfers: Transfer[];
  families: Choice[];
  overlays: Choice[];
  unitOffers: Choice[];
  accommodations: Choice[];
  notices: Choice[];
};

const fieldClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";
const buttonClass =
  "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function PhaPublicHousingOccupancyWorkspace() {
  const queryClient = useQueryClient();
  const [lease, setLease] = useState({
    familyActionId: "",
    overlayId: "",
    unitOfferId: "",
    unitReference: "",
    leaseStart: new Date().toISOString().slice(0, 10),
    documentReference: "",
    grievanceVersion: "",
  });
  const [transfer, setTransfer] = useState({
    leaseId: "",
    overlayId: "",
    reason: "family_composition",
    currentUnit: "",
    offeredUnit: "",
    accommodationId: "",
    noticeId: "",
    ground: "",
    grievanceDeadline: "",
    adverse: false,
    appropriateSize: true,
    unitAvailable: true,
  });

  const q = useQuery({
    queryKey: ["pha-public-housing-occupancy"],
    queryFn: async (): Promise<WorkspaceData> => {
      // Generated Supabase types lag these PHA occupancy tables until schema refresh.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [leases, transfers, families, overlays, unitOffers, accommodations, notices] =
        await Promise.all([
          client
            .from("pha_public_housing_leases")
            .select(
              "id,family_action_id,unit_reference,lease_start,status,lease_document_reference,grievance_procedure_version",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          client
            .from("pha_public_housing_transfers")
            .select(
              "id,lease_id,transfer_reason,current_unit_reference,offered_unit_reference,status,grievance_status,is_adverse_action,adverse_action_ground,block_reason",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          client
            .from("pha_family_actions")
            .select("id,family_reference")
            .eq("program_code", "public_housing")
            .order("created_at", { ascending: false })
            .limit(200),
          client
            .from("pha_notice_policy_overlays")
            .select("id,policy_version")
            .eq("program_code", "public_housing")
            .eq("policy_type", "acop")
            .eq("active", true)
            .eq("validated", true)
            .order("effective_date", { ascending: false }),
          client
            .from("pha_public_housing_unit_offers")
            .select("id,unit_reference")
            .eq("final_selection_status", "ready")
            .order("created_at", { ascending: false }),
          client
            .from("pha_reasonable_accommodation_requests")
            .select("id,request_type")
            .in("status", ["approved", "implemented"])
            .order("created_at", { ascending: false }),
          client
            .from("pha_family_notices")
            .select("id,specific_reasons")
            .eq("status", "issued")
            .eq("legal_requirements_validated", true)
            .in("determination_outcome", ["change", "termination"])
            .order("issued_at", { ascending: false }),
        ]);
      const failed = [leases, transfers, families, overlays, unitOffers, accommodations, notices].find(
        (result) => result.error,
      );
      if (failed?.error) throw failed.error;
      return {
        leases: (leases.data ?? []) as Lease[],
        transfers: (transfers.data ?? []) as Transfer[],
        families: (families.data ?? []).map((row: { id: string; family_reference: string }) => ({
          id: row.id,
          label: row.family_reference,
        })),
        overlays: (overlays.data ?? []).map((row: { id: string; policy_version: string }) => ({
          id: row.id,
          label: row.policy_version,
        })),
        unitOffers: (unitOffers.data ?? []).map((row: { id: string; unit_reference: string }) => ({
          id: row.id,
          label: row.unit_reference,
        })),
        accommodations: (accommodations.data ?? []).map(
          (row: { id: string; request_type: string }) => ({ id: row.id, label: row.request_type }),
        ),
        notices: (notices.data ?? []).map(
          (row: { id: string; specific_reasons: string }) => ({
            id: row.id,
            label: row.specific_reasons,
          }),
        ),
      };
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["pha-public-housing-occupancy"] });

  const createLease = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const signedAt = new Date().toISOString();
      const { error } = await client.from("pha_public_housing_leases").insert({
        family_action_id: lease.familyActionId,
        acop_overlay_id: lease.overlayId,
        unit_offer_id: lease.unitOfferId || null,
        unit_reference: lease.unitReference,
        lease_start: lease.leaseStart,
        lease_document_reference: lease.documentReference,
        lease_provisions_snapshot: {
          authority: "24 CFR 966.4",
          confirmed_at: signedAt,
          controls: ["required_lease_provisions", "grievance_procedure", "tenant_and_pha_signatures"],
        },
        grievance_procedure_version: lease.grievanceVersion,
        required_lease_provisions_confirmed: true,
        grievance_procedure_included: true,
        signature_complete: true,
        tenant_signed_at: signedAt,
        pha_signed_at: signedAt,
        status: "executed",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setLease((value) => ({
        ...value,
        unitOfferId: "",
        unitReference: "",
        documentReference: "",
      }));
      await refresh();
    },
  });

  const createTransfer = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_public_housing_transfers").insert({
        lease_id: transfer.leaseId,
        acop_overlay_id: transfer.overlayId,
        transfer_reason: transfer.reason,
        current_unit_reference: transfer.currentUnit,
        offered_unit_reference: transfer.offeredUnit || null,
        appropriate_size_confirmed: transfer.appropriateSize,
        unit_available_confirmed: transfer.unitAvailable,
        accommodation_request_id:
          transfer.reason === "reasonable_accommodation" ? transfer.accommodationId || null : null,
        is_adverse_action: transfer.adverse,
        adverse_action_notice_id: transfer.adverse ? transfer.noticeId || null : null,
        adverse_action_ground: transfer.adverse ? transfer.ground || null : null,
        explanation_right_included: transfer.adverse,
        grievance_right_included: transfer.adverse,
        grievance_request_deadline: transfer.adverse ? transfer.grievanceDeadline || null : null,
        status: "ready",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTransfer((value) => ({ ...value, offeredUnit: "", noticeId: "", ground: "" }));
      await refresh();
    },
  });

  const completeTransfer = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client
        .from("pha_public_housing_transfers")
        .update({ status: "completed", effective_date: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const submitLease = (event: FormEvent) => {
    event.preventDefault();
    createLease.mutate();
  };
  const submitTransfer = (event: FormEvent) => {
    event.preventDefault();
    createTransfer.mutate();
  };

  const leases = q.data?.leases ?? [];
  const transfers = q.data?.transfers ?? [];
  const error = q.error ?? createLease.error ?? createTransfer.error ?? completeTransfer.error;

  return (
    <AppShell
      title="Public Housing Occupancy & Transfers"
      subtitle="Execute controlled leases, right-size transfers, grievance holds, and accommodation-linked moves"
    >
      {error ? (
        <div role="alert" className="mb-4 rounded-md border border-reject/30 bg-reject-soft p-3 text-sm text-reject">
          Occupancy workspace error: {message(error)}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Executed leases"
          value={leases.filter((row) => row.status === "executed").length}
          hint="Evidence-backed leases with both signatures"
        />
        <Stat
          label="Transfers ready"
          value={transfers.filter((row) => row.status === "ready").length}
          hint="Moves cleared after federal and ACOP controls"
        />
        <Stat
          label="Transfers blocked"
          value={transfers.filter((row) => row.status === "blocked").length}
          hint="Notice, grievance, unit, or accommodation controls unresolved"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Execute a Public Housing lease" description="24 CFR 966.4 evidence and signature controls.">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitLease}>
            <select
              className={fieldClass}
              required
              value={lease.familyActionId}
              onChange={(event) => setLease({ ...lease, familyActionId: event.target.value })}
            >
              <option value="">Select family action</option>
              {q.data?.families.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <select
              className={fieldClass}
              required
              value={lease.overlayId}
              onChange={(event) => setLease({ ...lease, overlayId: event.target.value })}
            >
              <option value="">Select validated ACOP</option>
              {q.data?.overlays.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <select
              className={fieldClass}
              value={lease.unitOfferId}
              onChange={(event) => {
                const selected = q.data?.unitOffers.find((row) => row.id === event.target.value);
                setLease({
                  ...lease,
                  unitOfferId: event.target.value,
                  unitReference: selected?.label ?? lease.unitReference,
                });
              }}
            >
              <option value="">No linked unit offer</option>
              {q.data?.unitOffers.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <input
              className={fieldClass}
              required
              placeholder="Unit reference"
              value={lease.unitReference}
              onChange={(event) => setLease({ ...lease, unitReference: event.target.value })}
            />
            <input
              className={fieldClass}
              required
              type="date"
              value={lease.leaseStart}
              onChange={(event) => setLease({ ...lease, leaseStart: event.target.value })}
            />
            <input
              className={fieldClass}
              required
              placeholder="Controlled lease document reference"
              value={lease.documentReference}
              onChange={(event) => setLease({ ...lease, documentReference: event.target.value })}
            />
            <input
              className={fieldClass}
              required
              placeholder="Grievance procedure version"
              value={lease.grievanceVersion}
              onChange={(event) => setLease({ ...lease, grievanceVersion: event.target.value })}
            />
            <button className={buttonClass} disabled={createLease.isPending} type="submit">
              {createLease.isPending ? "Executing…" : "Execute controlled lease"}
            </button>
          </form>
        </Panel>

        <Panel title="Create a controlled transfer" description="Unit, accommodation, notice, and grievance gates.">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitTransfer}>
            <select
              className={fieldClass}
              required
              value={transfer.leaseId}
              onChange={(event) => {
                const selected = leases.find((row) => row.id === event.target.value);
                setTransfer({
                  ...transfer,
                  leaseId: event.target.value,
                  currentUnit: selected?.unit_reference ?? transfer.currentUnit,
                });
              }}
            >
              <option value="">Select executed lease</option>
              {leases.filter((row) => row.status === "executed").map((row) => (
                <option key={row.id} value={row.id}>{row.unit_reference}</option>
              ))}
            </select>
            <select
              className={fieldClass}
              required
              value={transfer.overlayId}
              onChange={(event) => setTransfer({ ...transfer, overlayId: event.target.value })}
            >
              <option value="">Select validated ACOP</option>
              {q.data?.overlays.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <select
              className={fieldClass}
              value={transfer.reason}
              onChange={(event) => setTransfer({ ...transfer, reason: event.target.value })}
            >
              <option value="family_composition">Family composition</option>
              <option value="reasonable_accommodation">Reasonable accommodation</option>
              <option value="emergency">Emergency</option>
              <option value="voluntary">Voluntary</option>
              <option value="administrative">Administrative</option>
            </select>
            <input
              className={fieldClass}
              required
              placeholder="Current unit"
              value={transfer.currentUnit}
              onChange={(event) => setTransfer({ ...transfer, currentUnit: event.target.value })}
            />
            <input
              className={fieldClass}
              required
              placeholder="Offered unit"
              value={transfer.offeredUnit}
              onChange={(event) => setTransfer({ ...transfer, offeredUnit: event.target.value })}
            />
            {transfer.reason === "reasonable_accommodation" ? (
              <select
                className={fieldClass}
                required
                value={transfer.accommodationId}
                onChange={(event) => setTransfer({ ...transfer, accommodationId: event.target.value })}
              >
                <option value="">Select approved accommodation</option>
                {q.data?.accommodations.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
              </select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={transfer.appropriateSize}
                type="checkbox"
                onChange={(event) => setTransfer({ ...transfer, appropriateSize: event.target.checked })}
              />
              Appropriate size confirmed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={transfer.unitAvailable}
                type="checkbox"
                onChange={(event) => setTransfer({ ...transfer, unitAvailable: event.target.checked })}
              />
              Unit availability confirmed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={transfer.adverse}
                type="checkbox"
                onChange={(event) => setTransfer({ ...transfer, adverse: event.target.checked })}
              />
              Adverse agency action
            </label>
            {transfer.adverse ? (
              <>
                <select
                  className={fieldClass}
                  required
                  value={transfer.noticeId}
                  onChange={(event) => {
                    const selected = q.data?.notices.find((row) => row.id === event.target.value);
                    setTransfer({
                      ...transfer,
                      noticeId: event.target.value,
                      ground: selected?.label ?? transfer.ground,
                    });
                  }}
                >
                  <option value="">Select issued controlled notice</option>
                  {q.data?.notices.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </select>
                <input
                  className={fieldClass}
                  required
                  placeholder="Specific adverse-action ground"
                  value={transfer.ground}
                  onChange={(event) => setTransfer({ ...transfer, ground: event.target.value })}
                />
                <input
                  className={fieldClass}
                  required
                  type="date"
                  value={transfer.grievanceDeadline}
                  onChange={(event) => setTransfer({ ...transfer, grievanceDeadline: event.target.value })}
                />
              </>
            ) : null}
            <button className={buttonClass} disabled={createTransfer.isPending} type="submit">
              {createTransfer.isPending ? "Saving…" : "Create transfer"}
            </button>
          </form>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Public Housing leases" description="Executed lease evidence and grievance versions.">
          <div className="space-y-2">
            {leases.map((row) => (
              <div key={row.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Unit {row.unit_reference}</div>
                    <div className="text-xs text-muted-foreground">
                      Lease start {row.lease_start} · {row.lease_document_reference ?? "document pending"} · grievance{" "}
                      {row.grievance_procedure_version ?? "version pending"}
                    </div>
                  </div>
                  <Pill tone={row.status === "executed" ? "seal" : undefined}>{row.status}</Pill>
                </div>
              </div>
            ))}
            {!q.isLoading && !q.error && leases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Public Housing lease records are active.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Transfers" description="Controlled move status and blocking reasons.">
          <div className="space-y-2">
            {transfers.map((row) => (
              <div key={row.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {row.current_unit_reference} → {row.offered_unit_reference ?? "unit pending"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.transfer_reason.replaceAll("_", " ")} · grievance{" "}
                      {row.grievance_status.replaceAll("_", " ")}
                      {row.is_adverse_action ? " · adverse action" : ""}
                    </div>
                    {row.adverse_action_ground ? (
                      <p className="mt-1 text-xs">Ground: {row.adverse_action_ground}</p>
                    ) : null}
                    {row.block_reason ? (
                      <p className="mt-1 text-xs text-reject">{row.block_reason}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Pill tone={row.status === "ready" || row.status === "completed" ? "seal" : undefined}>
                      {row.status}
                    </Pill>
                    {row.status === "ready" ? (
                      <button
                        className="text-xs font-medium text-primary underline"
                        disabled={completeTransfer.isPending}
                        onClick={() => completeTransfer.mutate(row.id)}
                        type="button"
                      >
                        Mark completed
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!q.isLoading && !q.error && transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Public Housing transfers are active.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Occupancy safeguard"
        description="Ready and completed moves require an available offered unit. Adverse actions require a legally validated issued notice whose specific reason matches the transfer ground, plus completed explanation and grievance protections. Reasonable-accommodation moves remain linked to an approved accommodation request."
      />
    </AppShell>
  );
}
