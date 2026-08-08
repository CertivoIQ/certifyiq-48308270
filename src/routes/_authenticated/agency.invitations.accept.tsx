import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { acceptAgencyInvitation } from "@/lib/hfa-agency-admin.functions";

function AcceptInvitation() {
  const { token } = useSearch({ from: "/_authenticated/agency/invitations/accept" });
  const accept = useServerFn(acceptAgencyInvitation);
  const [state, setState] = useState<{ status: "working" | "done" | "error"; message: string }>({
    status: "working",
    message: "Checking your invitation…",
  });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "This link is missing its invitation token." });
      return;
    }
    let cancelled = false;
    accept({ data: { token } })
      .then((result) => {
        if (cancelled) return;
        if ("error" in result && result.error) setState({ status: "error", message: result.error });
        else setState({ status: "done", message: "You now have access to this agency console." });
      })
      .catch((e: Error) =>
        cancelled ? undefined : setState({ status: "error", message: e.message || "That invitation could not be redeemed." }),
      );
    return () => {
      cancelled = true;
    };
  }, [token, accept]);

  return (
    <AppShell title="Agency invitation" subtitle="Single-use agency membership invitation">
      <section className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        {state.status === "done" ? (
          <Button asChild>
            <Link to="/agency">Open the agency console</Link>
          </Button>
        ) : null}
      </section>
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated/agency/invitations/accept")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }),
  head: () => ({
    meta: [
      { title: "Accept agency invitation — CertivoIQ" },
      { name: "description", content: "Redeem a single-use invitation to join a housing agency review console." },
      { property: "og:title", content: "Accept agency invitation — CertivoIQ" },
      { property: "og:description", content: "Redeem a single-use housing agency invitation." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AcceptInvitation,
});
