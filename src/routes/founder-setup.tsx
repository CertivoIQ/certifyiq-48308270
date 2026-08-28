import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IQText } from "@/components/iq-text";

const FOUNDER_EMAIL = "rjwatkins@certivoiq.com";

type ClaimResult = {
  claimed?: boolean;
  already_active?: boolean;
  access_level?: string;
  reason?: string;
};

type FounderRpc = (
  fn: string,
) => Promise<{ data: ClaimResult | null; error: { message: string } | null }>;

export const Route = createFileRoute("/founder-setup")({
  head: () => ({
    meta: [
      { title: "Founder activation — CertivoIQ" },
      {
        name: "description",
        content: "Restricted one-time activation for the designated CertivoIQ founder administrator.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: FounderSetupPage,
});

function FounderSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function claimFounder() {
    const founderClient = supabase as unknown as { rpc: FounderRpc };
    const { data, error } = await founderClient.rpc("claim_certivoiq_founder_admin");
    if (error) throw new Error(error.message);
    if (!data?.claimed) {
      const messages: Record<string, string> = {
        authentication_required: "Sign in before activating founder access.",
        verified_email_required: "Verify the founder email before activating access.",
        designated_email_required: "This account is not the designated founder account.",
        founder_already_activated: "Founder activation has already been completed.",
      };
      throw new Error(messages[data?.reason ?? ""] ?? "Founder activation could not be completed.");
    }
    toast.success(data.already_active ? "Founder access confirmed" : "Founder administrator activated");
    await navigate({ to: "/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) claimFounder().catch((error) => {
        toast.error(error instanceof Error ? error.message : "Founder activation failed");
      });
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "create") {
        const { data, error } = await supabase.auth.signUp({
          email: FOUNDER_EMAIL,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/founder-setup`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        if (data.session) {
          await claimFounder();
          return;
        }
        setVerificationSent(true);
        toast.success("Founder verification email sent");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: FOUNDER_EMAIL,
          password,
        });
        if (error) throw error;
        if (!data.user) throw new Error("Sign in failed");
        await claimFounder();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Founder activation failed");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: FOUNDER_EMAIL,
        options: { emailRedirectTo: `${window.location.origin}/founder-setup` },
      });
      if (error) throw error;
      toast.success("Verification email resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend verification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <section className="w-full max-w-md">
        <Link to="/welcome" className="flex items-center justify-center">
          <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-12 w-auto object-contain dark:hidden" />
          <img src="/certivoiq-logo-dark.png" alt="" aria-hidden="true" className="hidden h-12 w-auto object-contain dark:block" />
        </Link>

        <div className="mt-7 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-seal">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Restricted setup</span>
          </div>
          <h1 className="mt-3 font-display text-2xl"><IQText>Founder administrator activation</IQText></h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This one-time flow creates the permanent CertivoIQ founder account. It does not start a trial or require billing.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><LockKeyhole className="size-4 text-seal" />Designated account</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{FOUNDER_EMAIL}</p>
          </div>

          {verificationSent ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-seal/25 bg-seal/5 p-4">
                <p className="flex items-start gap-2 text-sm"><MailCheck className="mt-0.5 size-4 shrink-0 text-seal" />
                  Check the founder inbox and open the verification link. The link returns here to finish Admin activation.
                </p>
              </div>
              <Button className="w-full" variant="outline" disabled={busy} onClick={resendVerification}>
                {busy && <Loader2 className="size-4 animate-spin" />}Resend verification email
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => { setMode("signin"); setVerificationSent(false); }}>
                Already verified? Sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              {mode === "create" && (
                <div className="space-y-1.5">
                  <Label htmlFor="founder-name">Founder name</Label>
                  <Input id="founder-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="founder-password">Password</Label>
                <Input id="founder-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete={mode === "create" ? "new-password" : "current-password"} />
                {mode === "create" && <p className="text-xs text-muted-foreground">Use at least 12 characters. MFA can be enabled after activation.</p>}
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "create" ? "Create founder account" : "Sign in and activate Admin access"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === "create" ? "signin" : "create")}>
                {mode === "create" ? "Founder account already created? Sign in" : "Create the founder account"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
