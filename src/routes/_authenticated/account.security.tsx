import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useServerFn } from "@tanstack/react-start";
import {
  clearUnverifiedMfaFactors,
  generateRecoveryCodes,
  countRecoveryCodes,
  verifyAndDisableRecoveryCode,
} from "@/utils/mfa.functions";
import { Shield, ShieldCheck, ShieldAlert, Loader2, Download, Copy, Check, RotateCcw, Lock, KeyRound } from "lucide-react";
import type { AuthMFAEnrollTOTPResponse } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated/account/security")({
  head: () => ({
    meta: [
      { title: "Security settings — CertivoIQ" },
      {
        name: "description",
        content: "Manage your CertivoIQ account security, including two-factor authentication and recovery codes.",
      },
      { property: "og:title", content: "Security settings — CertivoIQ" },
      {
        property: "og:description",
        content: "Manage two-factor authentication and recovery codes for your CertivoIQ account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SecurityPage,
});

type Factor = {
  id: string;
  friendly_name: string;
  factor_type: "totp";
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
};

function SecurityPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [aal, setAal] = useState<"aal1" | "aal2" | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<AuthMFAEnrollTOTPResponse["data"] | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("");
  const [disableMode, setDisableMode] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);

  const clearStaleFactors = useServerFn(clearUnverifiedMfaFactors);
  const generateCodes = useServerFn(generateRecoveryCodes);
  const getRecoveryCount = useServerFn(countRecoveryCodes);
  const submitRecoveryCode = useServerFn(verifyAndDisableRecoveryCode);

  const refresh = async () => {
    const [{ data: factorsData }, { data: aalData }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    setFactors((factorsData?.all as Factor[]) ?? []);
    setAal((aalData?.currentLevel as "aal1" | "aal2" | null) ?? null);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    getRecoveryCount().then(({ count }) => setRecoveryCount(count)).catch(() => {});
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");
  const isMfaEnabled = !!verifiedFactor;

  async function startEnrollment() {
    setEnrolling(true);
    try {
      // Supabase does not return a TOTP secret again after the enrollment page
      // is left, and its browser factor list can omit unverified factors. The
      // authenticated server operation removes only this user's abandoned,
      // unverified enrollments; verified factors are never touched.
      await clearStaleFactors();

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "CertivoIQ Authenticator",
      });
      if (error) throw error;
      setEnrollData(data as AuthMFAEnrollTOTPResponse["data"]);
      setVerifyCode("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start MFA setup");
    } finally {
      setEnrolling(false);
    }
  }

  async function confirmEnrollment() {
    if (!enrollData || verifyCode.length !== 6) return;
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.id,
        code: verifyCode,
      });
      if (error) throw error;
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      const { codes } = await generateCodes();
      setRecoveryCodes(codes);
      setEnrollData(null);
      setVerifyCode("");
      await refresh();
      await getRecoveryCount().then(({ count }) => setRecoveryCount(count));
      toast.success("Two-factor authentication enabled", {
        description: "Save your recovery codes in a safe place.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setEnrolling(false);
    }
  }

  async function regenerateCodes() {
    try {
      const { codes } = await generateCodes();
      setRecoveryCodes(codes);
      await getRecoveryCount().then(({ count }) => setRecoveryCount(count));
      toast.success("Recovery codes regenerated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate codes");
    }
  }

  async function disableMfa() {
    if (!verifiedFactor || disableCode.length !== 6) return;
    setEnrolling(true);
    try {
      // First upgrade to AAL2 by verifying the current factor, then unenroll.
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactor.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
      if (unenrollError) throw unenrollError;

      await refresh();
      setDisableMode(false);
      setDisableCode("");
      setDisableRecoveryCode("");
      setRecoveryCount(0);
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable MFA");
    } finally {
      setEnrolling(false);
    }
  }

  async function disableWithRecoveryCode() {
    if (disableRecoveryCode.length !== 14) return;
    setEnrolling(true);
    try {
      const result = await submitRecoveryCode({ data: { code: disableRecoveryCode } });
      if ("error" in result) throw new Error(result.error);
      await refresh();
      setDisableMode(false);
      setDisableCode("");
      setDisableRecoveryCode("");
      setRecoveryCount(0);
      toast.success("Two-factor authentication disabled using recovery code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable MFA");
    } finally {
      setEnrolling(false);
    }
  }

  async function copyCodes() {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Recovery codes copied");
  }

  async function downloadCodes() {
    if (!recoveryCodes) return;
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certivoiq-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Security settings" subtitle="Protect your account with two-factor authentication">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-gold/10">
              {isMfaEnabled ? (
                <ShieldCheck className="size-5 text-gold" />
              ) : (
                <Shield className="size-5 text-gold" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg">Two-factor authentication</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {isMfaEnabled
                  ? "Your account is protected with an authenticator app."
                  : "Add an extra layer of security by requiring a code from an authenticator app at sign-in."}
              </p>
              {aal && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12px]">
                  <Lock className="size-3.5" />
                  Current session: {aal === "aal2" ? "Two-factor verified" : "Password only"}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            {isMfaEnabled ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-5 text-seal" />
                    <div>
                      <p className="text-[13px] font-medium">{verifiedFactor?.friendly_name}</p>
                      <p className="text-[12px] text-muted-foreground">Added {new Date(verifiedFactor?.created_at ?? "").toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDisableMode(true)}>
                    Disable
                  </Button>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <KeyRound className="size-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-[13px] font-medium">Recovery codes</p>
                    <p className="text-[12px] text-muted-foreground">{recoveryCount} unused codes remaining</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={regenerateCodes}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={startEnrollment} disabled={enrolling} className="w-full sm:w-auto">
                {enrolling && <Loader2 className="mr-2 size-4 animate-spin" />}
                Set up authenticator
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-seal/10">
              <ShieldAlert className="size-5 text-seal" />
            </div>
            <div>
              <h2 className="font-display text-lg">Why 2FA matters</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                CertivoIQ handles sensitive affordable-housing compliance data. Two-factor authentication keeps your
                account safe even if your password is compromised.
              </p>
            </div>
          </div>
        </div>
      </div>

      {enrollData && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display text-lg">Scan the QR code</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the code below. Then
            enter the 6-digit code to verify.
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="overflow-hidden rounded-lg border border-border bg-white p-2">
              <img
                src={enrollData.totp.qr_code}
                alt="Authenticator QR code"
                className="size-44"
              />
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-[12px] uppercase tracking-wide">Can&apos;t scan?</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    value={enrollData.totp.secret}
                    readOnly
                    className="font-mono text-[12px]"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollData.totp.secret);
                      toast.success("Secret copied");
                    }}
                    aria-label="Copy secret"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="verify-otp" className="text-[12px] uppercase tracking-wide">
                  Verification code
                </Label>
                <div className="mt-2">
                  <InputOTP
                    id="verify-otp"
                    maxLength={6}
                    value={verifyCode}
                    onChange={setVerifyCode}
                    disabled={enrolling}
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
                </div>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  disabled={verifyCode.length !== 6 || enrolling}
                  onClick={confirmEnrollment}
                >
                  {enrolling && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Verify and enable
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {disableMode && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display text-lg">Disable two-factor authentication</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Enter the 6-digit code from your authenticator app, or use a single recovery code to disable MFA.
          </p>
          <div className="mt-4">
            <Label htmlFor="disable-otp" className="text-[12px] uppercase tracking-wide">
              Authenticator code or recovery code
            </Label>
            <div className="mt-2">
              <InputOTP
                id="disable-otp"
                maxLength={6}
                value={disableCode}
                onChange={setDisableCode}
                disabled={enrolling}
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
            </div>
            <div className="mt-4">
              <Label htmlFor="disable-recovery" className="text-[12px] uppercase tracking-wide">
                Recovery code
              </Label>
              <Input
                id="disable-recovery"
                value={disableRecoveryCode}
                onChange={(event) => setDisableRecoveryCode(event.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                maxLength={14}
                autoComplete="off"
                disabled={enrolling}
                className="mt-2 max-w-xs font-mono"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={disableCode.length !== 6 || enrolling}
                onClick={disableMfa}
              >
                {enrolling && <Loader2 className="mr-2 size-4 animate-spin" />}
                Disable with authenticator
              </Button>
              <Button
                variant="outline"
                disabled={disableRecoveryCode.length !== 14 || enrolling}
                onClick={disableWithRecoveryCode}
              >
                Use recovery code
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDisableMode(false);
                  setDisableCode("");
                  setDisableRecoveryCode("");
                }}
                disabled={enrolling}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {recoveryCodes && (
        <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 text-gold" />
            <div className="flex-1">
              <h3 className="font-display text-lg">Save your recovery codes</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Each code can be used once to regain access if you lose your authenticator device. Store them in a
                password manager or print them.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-md border border-border bg-card px-2 py-1.5 text-center font-mono text-[12px]"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={copyCodes}>
                  {copied ? <Check className="mr-1.5 size-4" /> : <Copy className="mr-1.5 size-4" />}
                  Copy all
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCodes}>
                  <Download className="mr-1.5 size-4" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRecoveryCodes(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
