import { createFileRoute } from "@tanstack/react-router";
import { PhaAgencySettingsWorkspace } from "@/components/pha-agency-settings-workspace";
export const Route=createFileRoute("/_authenticated/pha-agency-settings")({component:PhaAgencySettingsWorkspace});
