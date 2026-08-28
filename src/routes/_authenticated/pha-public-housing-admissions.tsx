import { createFileRoute } from "@tanstack/react-router";
import { PhaPublicHousingAdmissionsWorkspace } from "@/components/pha-public-housing-admissions-workspace";

export const Route=createFileRoute("/_authenticated/pha-public-housing-admissions")({component:PhaPublicHousingAdmissionsWorkspace});
