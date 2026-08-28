import { createFileRoute } from "@tanstack/react-router";
import { PhaPbvWaitingListWorkspace } from "@/components/pha-pbv-waiting-list-workspace";
export const Route=createFileRoute("/_authenticated/pha-pbv-waiting-lists")({component:PhaPbvWaitingListWorkspace});
