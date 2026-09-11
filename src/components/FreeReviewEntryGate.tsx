import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { captureFreeReviewLead, getFreeReviewLead, type FreeReviewLeadInput } from "@/lib/free-review-lead.functions";
import { isOrganizationEmail } from "@/lib/organization-email.mjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui-kit";
import { SignupAgreement } from "@/components/signup-agreement";
import { BETA_TERMS_VERSION } from "@/lib/beta-terms";
import { useSession } from "@/hooks/use-session";
import { isFounderUser } from "@/lib/founder-access";

const PENDING_KEY = "certivoiq:pending-free-review-lead";

type FormState = FreeReviewLeadInput & { password: string };

const emptyForm: FormState = {
  companyName: "",
  contactName: "",
  email: "",
  password: "",
};

function readPending(): FormState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as FormState) : null;
  } catch {
    return null;
  }
}

function savePending(form: FormState) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...form, password: "" }));
  }
}

function clearPending() {
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(PENDING_KEY);
}

export function FreeReviewEntryGate({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const isFounder = isFounderUser(user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const captureLead = useServerFn(captureFreeReviewLead);
  const getLead = useServerFn(getFreeReviewLead);
  const [form, setForm] = useState<FormState>(() => readPending() ?? emptyForm);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [message, setMessage] = useState("");

  const lead = useQuery({
    queryKey: ["free-review-lead"],
    queryFn: () => getLead(),
    enabled: ready && Boolean(userEmail) && !isFounder,
  });
  const hasUser = Boolean(userEmail);
  const pendingLead = useMemo(() => readPending(), []);

  useEffect(() => {
    if (!ready) return;
    setUserEmail(user?.email ?? null);
    if (isFounder) navigate({ to: "/upload-certification", replace: true });
  }, [isFounder, navigate, ready, user?.email]);

  useEffect(() => {
    if (isFounder || !userEmail || lead.isLoading) return;
    if (lead.data && !pendingLead) {
      navigate({ to: "/upload-certification", replace: true });
      return;
    }
    if (!lead.data && pendingLead) {
      setBusy(true);
      void captureLead({ data: pendingLead })
        .then(() => {
          clearPending();
          void qc.invalidateQueries({ queryKey: ["free-review-lead"] });
          toast.success("Your 3 FREE certification reviews are ready");
          navigate({ to: "/upload-certification", replace: true });
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save your company information"))
        .finally(() => setBusy(false));
    }
  }, [captureLead, isFounder, lead.data, lead.isLoading, navigate, pendingLead, qc, userEmail]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const normalized: FreeReviewLeadInput = {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim().toLowerCase(),
      };

      if (!isOrganizationEmail(normalized.email)) {
        throw new Error("Use your organization website email address. Personal email providers are not eligible for the 3 FREE certification reviews.");
      }

      if (!hasUser) {
        if (!acceptedTerms) throw new Error("Please accept the Terms & Agreements, including the Beta Testing notice.");
        if (form.password.length < 8) throw new Error("Password must be at least 8 characters.");
        savePending({ ...form, ...normalized });
        const { data, error } = await supabase.auth.signUp({
          email: normalized.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/trial`,
            data: {
              full_name: normalized.contactName,
              terms_version: BETA_TERMS_VERSION,
              terms_accepted_at: new Date().toISOString(),
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setVerificationRequired(true);
          setMessage(`We sent a verification link to ${normalized.email}. After you verify, you'll continue directly to the certification upload page.`);
          return;
        }
        setUserEmail(data.user?.email ?? normalized.email);
      }

      await captureLead({ data: normalized });
      clearPending();
      await qc.invalidateQueries({ queryKey: ["free-review-lead"] });
      toast.success("Your 3 FREE certification reviews are ready");
      navigate({ to: "/upload-certification", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start your FREE certification reviews");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || isFounder) {
    return (
      <Panel title="Preparing your 3 FREE certification reviews" description="Opening certification upload…">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </Panel>
    );
  }

  if (verificationRequired) {
    return (
      <Panel title="Check your email to continue" description="One quick verification step protects your workspace and keeps your FREE review history tied to your account." bodyClassName="p-5">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm leading-6">{message}</p>
          </div>
        </div>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>I've verified — continue</Button>
      </Panel>
    );
  }

  if (busy && hasUser && lead.isLoading) {
    return (
      <Panel title="Preparing your 3 FREE certification reviews" description="Checking your review access…">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Start your 3 FREE certification reviews"
      description="Enter only your company, contact name, and organization email. After account verification, you'll go directly to certification upload."
      bodyClassName="p-5"
    >
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">Organization website email required</p>
          <p className="mt-1 text-sm text-muted-foreground">Personal email providers are not eligible for the 3 FREE certification reviews.</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <div>
          <Label>Company *</Label>
          <Input required value={form.companyName} onChange={(e) => update("companyName", e.target.value)} placeholder="Your company" />
        </div>
        <div>
          <Label>Contact Name *</Label>
          <Input required value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input required type="email" value={form.email || userEmail || ""} onChange={(e) => update("email", e.target.value)} placeholder="name@company.com" />
        </div>
        {!hasUser && (
          <div>
            <Label>Password *</Label>
            <Input required minLength={8} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" />
          </div>
        )}
        {!hasUser && (
          <div className="lg:col-span-2">
            <SignupAgreement checked={acceptedTerms} onChange={setAcceptedTerms} />
          </div>
        )}
        <Button className="lg:col-span-2 w-full sm:w-auto" size="lg" type="submit" disabled={busy || (!hasUser && !acceptedTerms)}>
          {busy ? "Preparing your FREE reviews…" : "Continue to upload"}
        </Button>
      </form>
    </Panel>
  );
}
