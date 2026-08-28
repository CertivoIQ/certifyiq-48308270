import { createFileRoute } from "@tanstack/react-router";
import { PhaFamilyWorkflow } from "@/components/pha-family-workflow";

export const Route = createFileRoute("/_authenticated/pha-families")({
  component: PhaFamilyWorkflow,
});
