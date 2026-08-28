import { createFileRoute } from "@tanstack/react-router";
import { PhaPortabilityWorkspace } from "@/components/pha-portability-workspace";

export const Route = createFileRoute("/_authenticated/pha-portability")({
  head: () => ({ meta: [{ title: "HCV Portability — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PhaPortabilityWorkspace,
});
