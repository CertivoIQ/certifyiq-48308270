import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IQText } from "@/components/iq-text";
import { ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Check your email", { description: "Confirm your address to finish creating the account." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

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
            <IQText>{mode === "signin" ? "Sign in to CertifyIQ" : "Create your CertifyIQ account"}</IQText>
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Compliance workspace, Academy and — for CertifyIQ staff — the CRM Dashboard.
          </p>

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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>




          <p className="mt-5 text-center text-[13px] text-muted-foreground">
            {mode === "signin" ? "New to CertifyIQ?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
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
