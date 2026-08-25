import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("OPERATIONS_WORKER_SECRET");
  const supplied = request.headers.get("authorization");
  if (!expected || supplied !== `Bearer ${expected}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Worker runtime is not configured" }, 503);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const worker = "certivoiq-control-plane";

  const { data: reaped, error: reapError } = await db.rpc("operations_reap_stale_leases");
  if (reapError) return json({ ok: false, stage: "reap", error: reapError.message }, 500);

  const { data: claimedData, error: claimError } = await db.rpc("operations_claim_job", {
    _worker: worker,
    _lease_seconds: 120,
  });
  if (claimError) return json({ ok: false, stage: "claim", error: claimError.message }, 500);

  const job = Array.isArray(claimedData) ? claimedData[0] : claimedData;
  if (!job) return json({ ok: true, reaped: reaped ?? 0, claimed: false });

  const jobId = String(job.id);
  const jobType = String(job.job_type);

  if (jobType !== "operations_health_check") {
    const { error } = await db.rpc("operations_fail_job", {
      _job_id: jobId,
      _worker: worker,
      _error: {
        code: "HANDLER_NOT_ACTIVE",
        message: `No approved Batch 2 handler for ${jobType}`,
      },
    });
    if (error) return json({ ok: false, stage: "fail", claimed: true, jobId, error: error.message }, 500);
    return json({ ok: true, reaped: reaped ?? 0, claimed: true, jobId, status: "retry_or_quarantine" });
  }

  const { data: completed, error: completeError } = await db.rpc("operations_complete_job", {
    _job_id: jobId,
    _worker: worker,
    _result: { checkedAt: new Date().toISOString(), status: "healthy" },
  });
  if (completeError) {
    await db.rpc("operations_fail_job", {
      _job_id: jobId,
      _worker: worker,
      _error: { code: "WORKER_FAILURE", message: completeError.message },
    });
    return json({ ok: false, stage: "complete", claimed: true, jobId }, 500);
  }

  return json({
    ok: true,
    reaped: reaped ?? 0,
    claimed: true,
    jobId,
    status: completed ? "completed" : "lease_lost",
  });
});
