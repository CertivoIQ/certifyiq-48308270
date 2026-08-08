import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AgencySubmissions } from "@/components/HfaRegulatoryConsole";

export const Route = createFileRoute("/_authenticated/agency/submissions/")({
  head: () => ({
    meta: [
      { title: "Agency Submission Inbox — CertivoIQ" },
      {
        name: "description",
        content: "Compliance packages owners have explicitly submitted to your housing agency.",
      },
      { property: "og:title", content: "Agency Submission Inbox — CertivoIQ" },
      { property: "og:description", content: "Review submitted owner compliance packages." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AppShell title="Submission inbox" subtitle="Only packages granted to your agency appear here">
      <AgencySubmissions />
    </AppShell>
  ),
});
