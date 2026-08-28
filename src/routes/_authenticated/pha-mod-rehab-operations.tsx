import { createFileRoute } from "@tanstack/react-router";
import { PhaModRehabOperations } from "@/components/pha-mod-rehab-operations";
export const Route = createFileRoute("/_authenticated/pha-mod-rehab-operations")({ component: PhaModRehabOperations });
