import { createFileRoute } from "@tanstack/react-router";
import { PhaInspectionsWorkspace } from "@/components/pha-inspections-workspace";

export const Route = createFileRoute("/_authenticated/pha-inspections")({
  head: () => ({ meta: [{ title: "Inspections / NSPIRE — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PhaInspectionsWorkspace,
});
