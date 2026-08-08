import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { OwnerSubmissionsPanel } from "@/components/hfa-owner-submissions";
import { IndependenceNotice } from "@/components/HfaRegulatoryConsole";

export const Route = createFileRoute("/_authenticated/submissions")({
  head: () => ({
    meta: [
      { title: "Agency Submissions — CertivoIQ" },
      {
        name: "description",
        content:
          "Preflight a compliance package, preview the exact snapshot, and grant or revoke housing agency access.",
      },
      { property: "og:title", content: "Agency Submissions — CertivoIQ" },
      {
        property: "og:description",
        content: "Owner-controlled submission grants for housing agency review.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AppShell title="Agency submissions" subtitle="You decide what leaves your portfolio, and when">
      <div className="space-y-4">
        <IndependenceNotice />
        <OwnerSubmissionsPanel />
      </div>
    </AppShell>
  ),
});
