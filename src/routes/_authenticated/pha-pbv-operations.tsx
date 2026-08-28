import { createFileRoute } from "@tanstack/react-router";
import { PhaProgramOperations } from "@/components/pha-program-operations";
export const Route = createFileRoute("/_authenticated/pha-pbv-operations")({ component: () => <PhaProgramOperations kind="pbv" /> });
