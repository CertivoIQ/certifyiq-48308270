import { createFileRoute } from "@tanstack/react-router";
import { PhaPolicyOverlayConsole } from "@/components/pha-policy-overlay-console";

export const Route = createFileRoute("/_authenticated/pha-policies")({
  head: () => ({ meta: [{ title: "PHA Policies & Notice Controls — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PhaPolicyOverlayConsole,
});
