import { createFileRoute } from "@tanstack/react-router";
import { ExecutiveDashboard } from "@/components/executive-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "CertivoIQ Dashboard — Portfolio Compliance Overview" },
      {
        name: "description",
        content:
          "Your CertivoIQ dashboard: open findings, 8823 exposure, HOTMA and NSPIRE readiness, and property-level risk scores across the portfolio.",
      },
      { property: "og:title", content: "CertivoIQ Dashboard — Portfolio Compliance Overview" },
      {
        property: "og:description",
        content: "Executive portfolio view of LIHTC, Section 8, HOME and HOTMA compliance risk.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <ExecutiveDashboard />,
});
