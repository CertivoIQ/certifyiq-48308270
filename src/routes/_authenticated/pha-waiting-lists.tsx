import { createFileRoute } from "@tanstack/react-router";
import { PhaWaitingListWorkspace } from "@/components/pha-waiting-list-workspace";

export const Route = createFileRoute("/_authenticated/pha-waiting-lists")({
  head: () => ({ meta: [{ title: "PHA Waiting Lists — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PhaWaitingListWorkspace,
});
