import { createFileRoute } from "@tanstack/react-router";
import { Pha50058SubmissionWorkspace } from "@/components/pha-50058-submission-workspace";
export const Route = createFileRoute("/_authenticated/pha-50058")({ component: Pha50058SubmissionWorkspace });
