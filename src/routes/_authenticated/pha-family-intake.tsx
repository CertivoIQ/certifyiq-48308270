import { createFileRoute } from "@tanstack/react-router";
import { PhaFamilyIntake } from "@/components/pha-family-intake";

export const Route = createFileRoute("/_authenticated/pha-family-intake")({
  component: PhaFamilyIntake,
});
