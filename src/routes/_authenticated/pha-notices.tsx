import { createFileRoute } from "@tanstack/react-router";
import { PhaNoticeCenter } from "@/components/pha-notice-center";

export const Route = createFileRoute("/_authenticated/pha-notices")({
  component: PhaNoticeCenter,
});
