import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { IQText } from "@/components/iq-text";
import { ShieldCheck, Loader2, MailCheck, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAndDisableRecoveryCode } from "@/utils/mfa.functions";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: Mode } => {
    const mode = search["mode"];
    return mode === "signup" || mode === "forgot" || mode === "signin" ? { mode } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — CertifyIQ" },
      {
        name: "description",
        content:
          "Sign in to CertifyIQ to review affordable housing certifications, track findings and access the CertifyIQ CRM Dashboard.",
      },
      { property: "og:title", content: "Sign in to CertifyIQ" },
      { property: "og:description", content: "Access your compliance workspace and CertifyIQ staff tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<null | { kind: "verify" | "reset"; email: string }>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMode, setMfaMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const useRecoveryCode = useServerFn(verifyAndDisableRecoveryCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function proceedAfterMfa() {
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate({ to: "/", replace: true });
  }

  async function handleMfaVerify() {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode,
      });
      if (error) throw error;
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      toast.success("Signed in securely");
      await proceedAfterMfa();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid authentication code");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoveryCode() {
    if (!mfaCode) return;
    setBusy(true);
    try {
      const result = await useRecoveryCode({ data: { code: mfaCode } });
      if ("error" in result) throw new Error(result.error);
      toast.success("MFA disabled with recovery code");
      await proceedAfterMfa();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify recovery code");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/", replace: true });
          return;
        }
        setSentTo({ kind: "verify", email });
        toast.success("Verify your email", { description: "We sent a confirmation link to " + email });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSentTo({ kind: "reset", email });
        toast.success("Reset link sent", { description: "Check " + email + " for the password reset link." });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/confirm/i.test(error.message)) {
            setSentTo({ kind: "verify", email });
            toast.error("Email not verified", { description: "Confirm your address, or resend the link below." });
            return;
          }
          throw error;
        }
        if (!data.user) throw new Error("Sign in failed");

        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = factors?.totp?.[0];
        if (verified) {
          setMfaFactorId(verified.id);
          setMfaMode(true);
          setMfaCode("");
          return;
        }

        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setBusy(true);
    try {
      const target = sentTo?.email || email;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("Verification email resent", { description: "New link on its way to " + target });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the email");
    } finally {
      setBusy(false);
    }
  }

  const heading = mfaMode
    ? "Two-factor authentication"
    : mode === "signin"
      ? "Sign in to CertifyIQ"
      : mode === "signup"
        ? "Create your CertifyIQ account"
        : "Reset your CertifyIQ password";

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <span className="brand-gradient grid size-9 place-items-center rounded-[9px] font-mono text-sm font-bold text-gold">
            IQ
          </span>
          <span className="font-display text-xl tracking-tight">
            Certify<span className="text-gold">IQ</span>
          </span>
        </Link>

        <div className="mt-7 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="font-display text-[22px] leading-tight">
            <IQText>{heading}</IQText>
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mfaMode
              ? "Enter the 6-digit code from your authenticator app."
              : mode === "forgot"
                ? "Enter your work email and we'll send a secure link to choose a new password."
                : "Compliance workspace, Academy and — for CertifyIQ staff — the CRM Dashboard."}
          </p>

          {sentTo && !mfaMode && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3.5">
              <p className="flex items-start gap-2 text-[13px]">
                <MailCheck className="mt-0.5 size-4 shrink-0 text-seal" />
                <span>
                  {sentTo.kind === "verify"
                    ? "Confirm your email address to activate the account. "
                    : "Password reset link sent. "}
                  We emailed <span className="font-medium">{sentTo.email}</span>.
                </span>
              </p>
              {sentTo.kind === "verify" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={resendVerification}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Resend verification email
                </Button>
              )}
            </div>
          )}

          {mfaMode ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 p-3">
                <KeyRound className="size-4 text-gold" />
                <p className="text-[13px] text-gold-ink">
                  Your account requires an authenticator code to sign in.
                </p>
              </div>
              <div>
                <Label htmlFor="mfa-code" className="text-[12px] uppercase tracking-wide">
                  {recoveryMode ? "Recovery code" : "Authenticator code"}
                </Label>
                <div className="mt-2">
                  {recoveryMode ? (
                    <Input
                      id="recovery-code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
                      placeholder="XXXX-XXXX-XXX"
                      disabled={busy}
                      autoComplete="off"
                    />
                  ) : (
                    <InputOTP
                      id="mfa-code"
                      maxLength={6}
                      value={mfaCode}
                      onChange={setMfaCode}
                      disabled={busy}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  )}
                </div>
                <Button
                  className="mt-4 w-full"
                  disabled={
                    busy || (recoveryMode ? mfaCode.length < 8 : mfaCode.length !== 6)
                  }
                  onClick={recoveryMode ? handleRecoveryCode : handleMfaVerify}
                >
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {recoveryMode ? "Use recovery code" : "Verify and sign in"}
                </Button>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    className="text-[12px] font-medium text-primary hover:underline"
                    onClick={() => {
                      setRecoveryMode((v) => !v);
                      setMfaCode("");
                    }}
                    disabled={busy}
                  >
                    {recoveryMode ? "Use authenticator code" : "Lost your authenticator?"}
                  </button>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-muted-foreground hover:underline"
                    onClick={() => {
                      setMfaMode(false);
                      setMfaCode("");
                      setMfaFactorId(null);
                      setRecoveryMode(false);
                    }}
                    disabled={busy}
                  >
                    Back to sign in
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-3.5">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-[12px] font-medium text-primary hover:underline"
                        onClick={() => {
                          setSentTo(null);
                          setMode("forgot");
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
              </Button>
            </form>
          )}

          {!mfaMode && (
            <p className="mt-5 text-center text-[13px] text-muted-foreground">
              {mode === "forgot" ? (
                <>
                  Remembered it?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setSentTo(null);
                      setMode("signin");
                    }}
                  >
                    Back to sign in
                  </button>
                </>
              ) : (
                <>
                  {mode === "signin" ? "New to CertifyIQ?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => {
                      setSentTo(null);
                      setMode(mode === "signin" ? "signup" : "signin");
                    }}
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </>
              )}
            </p>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" />
          The CertifyIQ CRM Dashboard is restricted to verified @certifyiq.com accounts. Customers, leads and clients
          never see it.
        </p>
      </div>
    </div>
  );
}
