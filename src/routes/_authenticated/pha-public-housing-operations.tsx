import { createFileRoute } from "@tanstack/react-router";
import { PhaProgramOperations } from "@/components/pha-program-operations";
export const Route = createFileRoute("/_authenticated/pha-public-housing-operations")({ component: () => <PhaProgramOperations kind="public_housing" /> });
