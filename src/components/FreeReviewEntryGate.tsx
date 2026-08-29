import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Mail, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { captureFreeReviewLead, getFreeReviewLead, type FreeReviewLeadInput } from "@/lib/free-review-lead.functions";
import { isOrganizationEmail } from "@/lib/organization-email.mjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui-kit";

const PENDING_KEY = "certivoiq:pending-free-review-lead";
const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

type FormState = FreeReviewLeadInput & { password: string; fullName: string };

const emptyForm: FormState = { companyName: "", ownerName: "", ownerTitle: "", email: "", phone: "", units: 0, properties: 0, hq: "", states: [], programs: [], marketingConsent: false, password: "", fullName: "" };

function readPending(): FormState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as FormState) : null;
  } catch {
    return null;
  }
}
function savePending(form: FormState) { if (typeof sessionStorage !== "undefined") sessionStorage.setItem(PENDING_KEY, JSON.stringify(form)); }
function clearPending() { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(PENDING_KEY); }

export function FreeReviewEntryGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const captureLead = useServerFn(captureFreeReviewLead);
  const getLead = useServerFn(getFreeReviewLead);
  const [form, setForm] = useState<FormState>(() => readPending() ?? emptyForm);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [message, setMessage] = useState("");

  const lead = useQuery({ queryKey: ["free-review-lead"], queryFn: () => getLead(), enabled: Boolean(userEmail) });
  const hasUser = Boolean(userEmail);
  const pendingLead = useMemo(() => readPending(), []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUserEmail(data.user?.email ?? null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!userEmail || lead.isLoading) return;
    if (lead.data && !pendingLead) {
      navigate({ to: "/compliance-intelligence", replace: true });
      return;
    }
    if (!lead.data && pendingLead) {
      setBusy(true);
      void captureLead({ data: pendingLead })
        .then(() => {
          clearPending();
          void qc.invalidateQueries({ queryKey: ["free-review-lead"] });
          toast.success("You're cleared for 3 FREE certification reviews");
          navigate({ to: "/compliance-intelligence", replace: true });
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save your company information"))
        .finally(() => setBusy(false));
    }
  }, [captureLead, lead.data, lead.isLoading, navigate, pendingLead, qc, userEmail]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const normalized: FreeReviewLeadInput = {
        companyName: form.companyName.trim(), ownerName: form.ownerName.trim(), ownerTitle: form.ownerTitle.trim(), email: form.email.trim().toLowerCase(),
        phone: form.phone?.trim(), units: Number(form.units), properties: Number(form.properties), hq: form.hq.trim(),
        states: Array.isArray(form.states) ? form.states : splitList(String(form.states)), programs: Array.isArray(form.programs) ? form.programs : splitList(String(form.programs)), marketingConsent: Boolean(form.marketingConsent),
      };

      if (!isOrganizationEmail(normalized.email)) {
        throw new Error("Use your organization website email address. Personal email providers are not eligible for the 3 FREE certification reviews.");
      }

      if (!hasUser) {
        if (!form.fullName.trim()) throw new Error("Full name is required to create your CertivoIQ account.");
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters.");
        savePending({ ...form, ...normalized });
        const { data, error } = await supabase.auth.signUp({ email: normalized.email, password: form.password, options: { emailRedirectTo: `${window.location.origin}/trial`, data: { full_name: form.fullName.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setVerificationRequired(true);
          setMessage(`We sent a verification link to ${normalized.email}. After you verify, you'll return here and continue to the certification upload page.`);
          return;
        }
        setUserEmail(data.user?.email ?? normalized.email);
      }

      await captureLead({ data: normalized });
      clearPending();
      await qc.invalidateQueries({ queryKey: ["free-review-lead"] });
      toast.success("Lead captured — your 3 FREE certification reviews are ready");
      navigate({ to: "/compliance-intelligence", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start your FREE certification reviews");
    } finally {
      setBusy(false);
    }
  }

  if (verificationRequired) {
    return <Panel title="Check your email to continue" description="One quick verification step protects your workspace and keeps your FREE review history tied to your account." bodyClassName="p-5"><div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><div className="flex items-start gap-3"><Mail className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-6">{message}</p></div></div><Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>I've verified — continue</Button></Panel>;
  }

  if (busy && hasUser && lead.isLoading) return <Panel title="Preparing your 3 FREE certification reviews" description="Checking your review access…"><div className="h-20 animate-pulse rounded-lg bg-muted" /></Panel>;

  return (
    <Panel title="Start with your company details" description="Create your CertivoIQ account, tell us about your portfolio, and we'll prepare your 3 FREE certification reviews. Your certification upload comes immediately after this step." bodyClassName="p-5">
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-medium">Organization website email required</p><p className="mt-1 text-sm text-muted-foreground">Personal email providers are not eligible for the 3 FREE certification reviews.</p></div></div>
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        {!hasUser && <><div className="lg:col-span-2"><Label>Full name *</Label><Input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="Your full name" /></div><div><Label>Organization website email *</Label><Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="name@company.com" /></div><div><Label>Password *</Label><Input required minLength={8} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" /></div></>}
        <div><Label>Company name *</Label><Input required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Your company" /></div>
        <div><Label>Owner / decision-maker name *</Label><Input required value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} placeholder="Full name" /></div>
        <div><Label>Owner / decision-maker title *</Label><Input required value={form.ownerTitle} onChange={(e) => update("ownerTitle", e.target.value)} placeholder="Owner, CEO, VP Property Management…" /></div>
        {hasUser && <div><Label>Organization website email *</Label><Input required type="email" value={form.email || userEmail || ""} onChange={(e) => update("email", e.target.value)} placeholder="name@company.com" /></div>}
        <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="(555) 555-5555" /></div>
        <div><Label>Total portfolio units *</Label><Input required type="number" min="1" value={form.units || ""} onChange={(e) => update("units", Number(e.target.value))} placeholder="12,000" /></div>
        <div><Label>Total portfolio properties *</Label><Input required type="number" min="1" value={form.properties || ""} onChange={(e) => update("properties", Number(e.target.value))} placeholder="120" /></div>
        <div><Label>Headquarters / primary market *</Label><Input required value={form.hq} onChange={(e) => update("hq", e.target.value)} placeholder="Atlanta, GA" /></div>
        <div><Label>States / markets served *</Label><Input required value={form.states.join(", ")} onChange={(e) => update("states", splitList(e.target.value))} placeholder="GA, FL, TN" /></div>
        <div className="lg:col-span-2"><Label>Housing programs in your portfolio *</Label><Input required value={form.programs.join(", ")} onChange={(e) => update("programs", splitList(e.target.value))} placeholder="LIHTC, Section 8, HOME" /></div>
        <div className="lg:col-span-2 rounded-lg border bg-muted/30 p-4"><label className="flex items-start gap-3 text-sm leading-5"><input type="checkbox" checked={form.marketingConsent} onChange={(e) => update("marketingConsent", e.target.checked)} className="mt-1 size-4 rounded border" /><span>Optional: I agree to receive CertivoIQ marketing emails about compliance updates and plan recommendations. Operational emails needed to deliver my FREE reviews are sent separately. I can unsubscribe from marketing emails at any time.</span></label></div>
        <div className="lg:col-span-2 grid gap-3 sm:grid-cols-3 rounded-lg border border-border p-4 text-sm"><div className="flex gap-2"><Building2 className="size-4 text-primary" /><span>CRM company record</span></div><div className="flex gap-2"><Users className="size-4 text-primary" /><span>Decision-maker contact</span></div><div className="flex gap-2"><Mail className="size-4 text-primary" /><span>Personalized email fields</span></div></div>
        <Button className="lg:col-span-2 w-full sm:w-auto" size="lg" type="submit" disabled={busy}>{busy ? "Preparing your FREE reviews…" : hasUser ? "Continue to my 3 FREE certification reviews" : "Create my account & start my 3 FREE certification reviews"}</Button>
      </form>
    </Panel>
  );
}
