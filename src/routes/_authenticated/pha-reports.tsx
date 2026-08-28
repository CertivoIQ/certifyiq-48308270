import { createFileRoute } from "@tanstack/react-router";
import { PhaReportsWorkspace } from "@/components/pha-reports-workspace";
export const Route = createFileRoute("/_authenticated/pha-reports")({ component: PhaReportsWorkspace });
