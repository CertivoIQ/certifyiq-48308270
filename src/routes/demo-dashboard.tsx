import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/executive-dashboard";

export const Route = createFileRoute("/demo-dashboard")({
  head: () => ({
    meta: [
      { title: "CertivoIQ Demo Dashboard — See the Compliance Platform" },
      {
        name: "description",
        content:
          "Explore a fictional CertivoIQ portfolio interface with illustrative findings and priority indicators — no signup required.",
      },
      { property: "og:title", content: "CertivoIQ Demo Dashboard" },
      {
        property: "og:description",
        content: "A sample affordable-housing portfolio showing CertivoIQ findings, readiness and risk scores.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => <ExecutiveDashboard demo />,
});
