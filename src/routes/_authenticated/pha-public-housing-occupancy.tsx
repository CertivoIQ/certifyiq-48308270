import { createFileRoute } from "@tanstack/react-router";
import { PhaPublicHousingOccupancyWorkspace } from "@/components/pha-public-housing-occupancy-workspace";

export const Route=createFileRoute("/_authenticated/pha-public-housing-occupancy")({component:PhaPublicHousingOccupancyWorkspace});
