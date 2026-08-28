import { createFileRoute } from "@tanstack/react-router";
import { PhaHotmaReadinessWorkspace } from "@/components/pha-hotma-readiness-workspace";
export const Route = createFileRoute("/_authenticated/pha-hotma")({ component: PhaHotmaReadinessWorkspace });
