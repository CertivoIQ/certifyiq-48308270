import { createFileRoute } from "@tanstack/react-router";
import { PhaHcvLeaseUpWorkspace } from "@/components/pha-hcv-lease-up-workspace";

export const Route=createFileRoute("/_authenticated/pha-hcv-lease-up")({component:PhaHcvLeaseUpWorkspace});
