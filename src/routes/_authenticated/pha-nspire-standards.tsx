import { createFileRoute } from "@tanstack/react-router";
import { PhaNspireStandardsWorkspace } from "@/components/pha-nspire-standards-workspace";
export const Route=createFileRoute("/_authenticated/pha-nspire-standards")({component:PhaNspireStandardsWorkspace});
