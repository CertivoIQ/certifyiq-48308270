import { createFileRoute } from "@tanstack/react-router";
import { FreeReviewEntryGate } from "@/components/FreeReviewEntryGate";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/trial")({
  head: () => ({
    meta: [
      { title: "Review Your 3 FREE Certifications — CertivoIQ" },
      {
        name: "description",
        content: "Affordable Housing Compliance Intelligence from CertivoIQ. Create your account with your organization website email and move directly to your 3 FREE certification reviews.",
      },
      { property: "og:title", content: "Review Your 3 FREE Certifications — CertivoIQ" },
      { property: "og:description", content: "Affordable Housing Compliance Intelligence. Start with proof: capture your company details, then upload your first certification for review." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://certivoiq.com/trial" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/trial" }],
  }),
  component: TrialEntryPage,
});

function TrialEntryPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="cite">AFFORDABLE HOUSING COMPLIANCE INTELLIGENCE</p>
          <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">Review Your 3 FREE Certifications</h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Create your account and tell us about your portfolio first. Then we’ll take you straight to certification upload so you can experience CertivoIQ on your own files.</p>
        </div>
        <div className="mx-auto mt-8 max-w-4xl">
          <FreeReviewEntryGate>
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
              <h2 className="font-display text-xl">Your FREE review access is ready.</h2>
              <p className="mt-2 text-muted-foreground">Continue to certification upload to review your first file.</p>
            </div>
          </FreeReviewEntryGate>
        </div>
      </main>
    </PublicShell>
  );
}
