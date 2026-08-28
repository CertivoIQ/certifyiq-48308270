import { createFileRoute } from "@tanstack/react-router";
import { PhaModulePage } from "@/components/pha-module-page";
export const Route = createFileRoute("/_authenticated/pha-families")({ component: () => <PhaModulePage kind="families" /> });
