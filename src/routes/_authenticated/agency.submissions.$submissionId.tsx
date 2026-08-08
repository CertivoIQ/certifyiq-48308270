import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AgencySubmissionDetail } from "@/components/HfaRegulatoryConsole";

export const Route = createFileRoute("/_authenticated/agency/submissions/$submissionId")({
  head: () => ({
    meta: [
      { title: "Submission Review — CertivoIQ Agency Console" },
      {
        name: "description",
        content:
          "Review one submitted compliance package: evidence manifest, correction cases and audit history.",
      },
      { property: "og:title", content: "Submission Review — CertivoIQ Agency Console" },
      { property: "og:description", content: "Evidence manifest, corrections and audit history." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SubmissionDetailPage,
});

function SubmissionDetailPage() {
  const { submissionId } = Route.useParams();
  return (
    <AppShell title="Submission review" subtitle="Server-side authorization; every access is audited">
      <AgencySubmissionDetail submissionId={submissionId} />
    </AppShell>
  );
}
