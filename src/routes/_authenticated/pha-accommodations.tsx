import { createFileRoute } from "@tanstack/react-router";
import { PhaReasonableAccommodationWorkspace } from "@/components/pha-reasonable-accommodation-workspace";
export const Route = createFileRoute("/_authenticated/pha-accommodations")({ component: PhaReasonableAccommodationWorkspace });
