import { createFileRoute } from "@tanstack/react-router";
import { PhaModulePage } from "@/components/pha-module-page";
export const Route = createFileRoute("/_authenticated/pha-50058")({ component: () => <PhaModulePage kind="50058" /> });
