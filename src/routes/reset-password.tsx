import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IQText } from "@/components/iq-text";
import { KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — CertivoIQ" },
      {
        name: "description",
        content: "Choose a new password for your CertivoIQ compliance workspace account.",
      },
      { property: "og:title", content: "Set a new CertivoIQ password" },
      { property: "og:description", content: "Securely reset the password for your CertivoIQ account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://certivoiq.com/reset-password" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/reset-password" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash ?? "";
    const isRecovery = hash.includes("type=recovery");

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (isRecovery && session)) {
        setReady(true);
        setInvalid(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && (isRecovery || true)) {
        setReady(true);
      } else if (!isRecovery) {
        setInvalid(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", { description: "You're signed in with your new password." });
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/welcome" className="flex items-center justify-center gap-2.5">
          <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-12 w-auto object-contain" />
        </Link>

        <div className="mt-7 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="font-display text-[22px] leading-tight">
            <IQText>Set a new CertivoIQ password</IQText>
          </h1>

          {invalid && !ready ? (
            <>
              <p className="mt-2 text-[13px] text-muted-foreground">
                This reset link is missing, expired or already used. Request a fresh one and we'll email you a new
                link.
              </p>
              <Button asChild className="mt-4 w-full">
                <Link to="/auth" search={{ mode: "forgot" }}>
                  Request a new reset link
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Choose a password with at least 8 characters. You'll stay signed in afterwards.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !ready}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[12px] text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0 text-gold" />
          Password changes take effect immediately across the compliance workspace and staff tools.
        </p>
      </div>
    </div>
  );
}
