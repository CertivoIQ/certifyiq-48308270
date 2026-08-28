import { createFileRoute } from "@tanstack/react-router";
import { PhaSourceLibraryWorkspace } from "@/components/pha-source-library-workspace";
export const Route=createFileRoute("/_authenticated/pha-source-library")({component:PhaSourceLibraryWorkspace});
