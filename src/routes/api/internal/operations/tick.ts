import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const expected = process.env["OPERATIONS_WORKER_SECRET"];
  if (!expected) return false;
  const supplied = request.headers.get("authorization");
  return supplied === `Bearer ${expected}`;
}

export const Route = createFileRoute("/api/internal/operations/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { reapStaleOperationsLeases, claimOperationsJob, completeOperationsJob, failOperationsJob } =
          await import("@/lib/operations-worker.server");

        const reaped = await reapStaleOperationsLeases();
        const worker = "certivoiq-control-plane";
        const job = await claimOperationsJob(worker);

        if (!job) {
          return Response.json({ ok: true, reaped, claimed: false });
        }

        const jobId = String(job["id"]);
        const jobType = String(job["job_type"]);
        try {
          // Batch 2 intentionally activates only a zero-side-effect health job.
          // Source ingestion and communications handlers arrive in later batches.
          if (jobType !== "operations_health_check") {
            await failOperationsJob(jobId, worker, {
              code: "HANDLER_NOT_ACTIVE",
              message: `No approved Batch 2 handler for ${jobType}`,
            });
            return Response.json({ ok: true, reaped, claimed: true, jobId, status: "retry_or_quarantine" });
          }

          await completeOperationsJob(jobId, worker, {
            checkedAt: new Date().toISOString(),
            status: "healthy",
          });
          return Response.json({ ok: true, reaped, claimed: true, jobId, status: "completed" });
        } catch (error) {
          await failOperationsJob(jobId, worker, {
            code: "WORKER_FAILURE",
            message: error instanceof Error ? error.message : String(error),
          });
          return Response.json({ ok: false, reaped, claimed: true, jobId }, { status: 500 });
        }
      },
    },
  },
});
