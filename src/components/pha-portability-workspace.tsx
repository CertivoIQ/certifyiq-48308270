import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel, Pill, Stat } from "@/components/ui-kit";
import { useWorkspaceProfile } from "@/hooks/use-workspace-profile";
import { supabase } from "@/integrations/supabase/client";

type FamilyAction = { id: string; family_reference: string; program_code: string; action_type: string; effective_date: string };
type PortabilityCase = {
  id: string; family_action_id: string; direction: string; family_status: string; requested_destination: string;
  receiving_pha_name: string | null; receiving_pha_selected_by: string | null; move_eligibility_status: string;
  receiving_pha_contacted_at: string | null; absorption_decision: string; hud_52665_part_i_complete: boolean;
  hud_52665_reference: string | null; hud_50058_reference: string | null; verification_packet_reference: string | null;
  voucher_issued_for_move: boolean; packet_sent_at: string | null; status: string; special_purpose_voucher_code: string | null;
};

type Row = PortabilityCase & { family: FamilyAction | null };
const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function PhaPortabilityWorkspace() {
  const queryClient = useQueryClient();
  const { profile, workspaceUserId } = useWorkspaceProfile();
  const [familyActionId, setFamilyActionId] = useState("");
  const [destination, setDestination] = useState("");
  const [familyStatus, setFamilyStatus] = useState("participant");
  const [receivingPha, setReceivingPha] = useState("");
  const [selectedBy, setSelectedBy] = useState("family");
  const [specialPurposeCode, setSpecialPurposeCode] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [contactReference, setContactReference] = useState("");
  const [decision, setDecision] = useState("pending");
  const [decisionReference, setDecisionReference] = useState("");
  const [form52665, setForm52665] = useState("");
  const [form50058, setForm50058] = useState("");
  const [verificationPacket, setVerificationPacket] = useState("");

  const query = useQuery<{ actions: FamilyAction[]; cases: Row[] }>({
    queryKey: ["pha-portability", workspaceUserId], enabled: !!workspaceUserId && profile.organization_type === "pha",
    queryFn: async () => {
      // Generated Supabase types lag the portability migration until schema types are refreshed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const [actionsResult, casesResult] = await Promise.all([
        client.from("pha_family_actions").select("id, family_reference, program_code, action_type, effective_date").eq("program_code", "hcv").eq("action_type", "portability").order("created_at", { ascending: false }),
        client.from("pha_portability_cases").select("id, family_action_id, direction, family_status, requested_destination, receiving_pha_name, receiving_pha_selected_by, move_eligibility_status, receiving_pha_contacted_at, absorption_decision, hud_52665_part_i_complete, hud_52665_reference, hud_50058_reference, verification_packet_reference, voucher_issued_for_move, packet_sent_at, status, special_purpose_voucher_code").order("created_at", { ascending: false }),
      ]);
      if (actionsResult.error) throw actionsResult.error;
      if (casesResult.error) throw casesResult.error;
      const actions: FamilyAction[] = actionsResult.data ?? [];
      const byId = new Map(actions.map((action) => [action.id, action]));
      return { actions, cases: (casesResult.data ?? []).map((item: PortabilityCase) => ({ ...item, family: byId.get(item.family_action_id) ?? null })) };
    },
  });

  const actions = query.data?.actions ?? [];
  const cases = query.data?.cases ?? [];
  const selected = useMemo(() => cases.find((item) => item.id === selectedCaseId) ?? cases[0] ?? null, [cases, selectedCaseId]);

  const createCase = useMutation({
    mutationFn: async () => {
      if (!workspaceUserId || !familyActionId || !destination.trim()) throw new Error("HCV portability family action and destination are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_portability_cases").insert({
        workspace_user_id: workspaceUserId, family_action_id: familyActionId, direction: "outgoing", family_status: familyStatus,
        requested_destination: destination.trim(), family_request_date: new Date().toISOString().slice(0, 10),
        special_purpose_voucher_code: specialPurposeCode.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => { setDestination(""); setSpecialPurposeCode(""); await queryClient.invalidateQueries({ queryKey: ["pha-portability", workspaceUserId] }); },
  });

  const recordEligibility = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a portability case.");
      if (!receivingPha.trim()) throw new Error("Select or record the receiving PHA first.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_portability_cases").update({ move_eligibility_status: "eligible", receiving_pha_name: receivingPha.trim(), receiving_pha_selected_by: selectedBy }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-portability", workspaceUserId] }),
  });

  const recordDecision = useMutation({
    mutationFn: async () => {
      if (!selected || !contactReference.trim() || decision === "pending" || !decisionReference.trim()) throw new Error("Confirmed receiving-PHA contact and written absorb/bill decision are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const now = new Date().toISOString();
      const { error } = await client.from("pha_portability_cases").update({ receiving_pha_contacted_at: now, receiving_pha_contact_delivery_reference: contactReference.trim(), absorption_decision: decision, absorption_decision_received_at: now, absorption_decision_reference: decisionReference.trim() }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-portability", workspaceUserId] }),
  });

  const preparePacket = useMutation({
    mutationFn: async () => {
      if (!selected || !form52665.trim() || !form50058.trim() || !verificationPacket.trim()) throw new Error("HUD-52665, current HUD-50058, and verification packet references are required.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { error } = await client.from("pha_portability_cases").update({ voucher_issued_for_move: true, hud_52665_part_i_complete: true, hud_52665_reference: form52665.trim(), hud_50058_reference: form50058.trim(), verification_packet_reference: verificationPacket.trim(), status: "packet_ready" }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["pha-portability", workspaceUserId] }),
  });

  const pending = cases.filter((item) => !["sent", "active", "closed"].includes(item.status)).length;
  const billing = cases.filter((item) => item.absorption_decision === "bill").length;
  const absorbed = cases.filter((item) => item.absorption_decision === "absorb").length;

  return (
    <AppShell title="HCV Portability" subtitle="Control family move eligibility, receiving-PHA coordination, HUD-52665 handoff, absorb/bill decisions, and portability audit evidence">
      <div className="grid gap-3 md:grid-cols-3"><Stat label="Open ports" value={pending} hint="Cases not yet sent, active, or closed" /><Stat label="Billing ports" value={billing} hint="Receiving PHA bills initial PHA" /><Stat label="Absorbed ports" value={absorbed} hint="Receiving PHA accepted voucher into its program" /></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Start outgoing port" description="Portability is restricted to HCV tenant-based assistance. Create the HCV portability family action first in Family Intake & Evidence.">
          <div className="space-y-3">
            <label className="block text-xs font-medium">HCV portability family action<select className={inputClass} value={familyActionId} onChange={(event) => setFamilyActionId(event.target.value)}><option value="">Select family action</option>{actions.map((action) => <option key={action.id} value={action.id}>{action.family_reference} · {action.effective_date}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Family status<select className={inputClass} value={familyStatus} onChange={(event) => setFamilyStatus(event.target.value)}><option value="participant">Current participant</option><option value="applicant">Applicant / new admission</option></select></label><label className="text-xs font-medium">Destination<input className={inputClass} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="City, county, or receiving jurisdiction" /></label></div>
            <label className="block text-xs font-medium">Special-purpose voucher code, if applicable<input className={inputClass} value={specialPurposeCode} onChange={(event) => setSpecialPurposeCode(event.target.value)} placeholder="HUD-VASH, FUP, etc." /></label>
            <button type="button" onClick={() => createCase.mutate()} disabled={createCase.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Create portability case</button>
            {createCase.isError ? <p className="text-xs text-destructive">{createCase.error instanceof Error ? createCase.error.message : "Unable to create portability case."}</p> : null}
          </div>
        </Panel>

        <Panel title="Receiving PHA coordination" description={selected?.family ? selected.family.family_reference : "Select a portability case below."}>
          {!selected ? <p className="text-sm text-muted-foreground">No portability case is selected.</p> : <div className="space-y-3">
            <div className="rounded-md border border-border p-3 text-xs"><div>Destination: {selected.requested_destination}</div><div>Move eligibility: {selected.move_eligibility_status}</div><div>Receiving PHA: {selected.receiving_pha_name ?? "not selected"}</div><div>Decision: {selected.absorption_decision}</div><div>Participant income redetermination solely for port: <strong>No</strong></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Receiving PHA<input className={inputClass} value={receivingPha} onChange={(event) => setReceivingPha(event.target.value)} placeholder="Receiving PHA name" /></label><label className="text-xs font-medium">Selected by<select className={inputClass} value={selectedBy} onChange={(event) => setSelectedBy(event.target.value)}><option value="family">Family</option><option value="initial_pha">Initial PHA at family request</option></select></label></div>
            <button type="button" onClick={() => recordEligibility.mutate()} disabled={recordEligibility.isPending} className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold">Record eligible move + receiving PHA</button>
            <label className="block text-xs font-medium">Confirmed contact reference<input className={inputClass} value={contactReference} onChange={(event) => setContactReference(event.target.value)} placeholder="Email/message/confirmed-delivery reference" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Receiving PHA decision<select className={inputClass} value={decision} onChange={(event) => setDecision(event.target.value)}><option value="pending">Pending</option><option value="absorb">Absorb</option><option value="bill">Bill initial PHA</option></select></label><label className="text-xs font-medium">Written decision reference<input className={inputClass} value={decisionReference} onChange={(event) => setDecisionReference(event.target.value)} /></label></div>
            <button type="button" onClick={() => recordDecision.mutate()} disabled={recordDecision.isPending} className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold">Record absorb / bill decision</button>
            <div className="grid gap-3"><label className="text-xs font-medium">HUD-52665 Part I reference<input className={inputClass} value={form52665} onChange={(event) => setForm52665(event.target.value)} /></label><label className="text-xs font-medium">Current HUD-50058 reference<input className={inputClass} value={form50058} onChange={(event) => setForm50058(event.target.value)} /></label><label className="text-xs font-medium">Related verification packet reference<input className={inputClass} value={verificationPacket} onChange={(event) => setVerificationPacket(event.target.value)} /></label></div>
            <button type="button" onClick={() => preparePacket.mutate()} disabled={preparePacket.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Validate portability packet</button>
            {(recordEligibility.isError || recordDecision.isError || preparePacket.isError) ? <p className="text-xs text-destructive">{[recordEligibility.error, recordDecision.error, preparePacket.error].find((error) => error instanceof Error)?.message ?? "Unable to update portability case."}</p> : null}
          </div>}
        </Panel>
      </div>

      <Panel className="mt-4" title="Portability register" description="The receiving PHA cannot refuse an incoming portable family without HUD's written exception. Absorption decisions are locked unless the initial PHA documents consent to reversal.">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Family</th><th className="pb-3">Destination</th><th className="pb-3">Receiving PHA</th><th className="pb-3">Eligibility</th><th className="pb-3">Decision</th><th className="pb-3">52665</th><th className="pb-3">Status</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id} onClick={() => setSelectedCaseId(item.id)} className={`cursor-pointer border-t border-border ${selected?.id === item.id ? "bg-muted/40" : ""}`}><td className="py-3 font-medium">{item.family?.family_reference ?? item.family_action_id.slice(0, 8)}</td><td className="py-3">{item.requested_destination}</td><td className="py-3">{item.receiving_pha_name ?? "—"}</td><td className="py-3"><Pill tone={item.move_eligibility_status === "eligible" ? "seal" : undefined}>{item.move_eligibility_status}</Pill></td><td className="py-3">{item.absorption_decision}</td><td className="py-3">{item.hud_52665_part_i_complete ? "ready" : "missing"}</td><td className="py-3"><Pill tone={["sent", "active", "closed"].includes(item.status) ? "seal" : undefined}>{item.status.replaceAll("_", " ")}</Pill></td></tr>)}</tbody></table></div>
      </Panel>

      <Panel className="mt-4" title="Portability authority safeguard" description="CertivoIQ applies 24 CFR 982.353-.355 and HUD-52665. Current participant income eligibility is not re-determined merely because of portability. Billing uses the federal lesser-of administrative-fee formula, but operational billing remains source-gated until the current HUD financial-procedure packet and deadlines are validated." />
    </AppShell>
  );
}
