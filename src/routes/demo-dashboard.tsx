import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/executive-dashboard";

export const Route = createFileRoute("/demo-dashboard")({
  head: () => ({
    meta: [
      { title: "CertivoIQ Demo Dashboard — See the Compliance Platform" },
      {
        name: "description",
        content:
          "Explore a live sample CertivoIQ portfolio: AI-reviewed LIHTC, Section 8, HOME and HOTMA certifications, findings and risk scoring — no signup required.",
      },
      { property: "og:title", content: "CertivoIQ Demo Dashboard" },
      {
        property: "og:description",
        content: "A sample affordable-housing portfolio showing CertivoIQ findings, readiness and risk scores.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://certivoiq.com/demo-dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://certivoiq.com/demo-dashboard" }],
  }),
  component: () => <ExecutiveDashboard demo />,
});
