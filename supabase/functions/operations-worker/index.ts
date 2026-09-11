import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.9.6";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const githubKeys = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

const CERTIFICATION_OCR_SIDECAR_SUFFIX = ".certivoiq-ocr.json";

async function authorizedGitHubWorkflow(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, githubKeys, {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "certivoiq-operations-worker",
      algorithms: ["RS256"],
    });
    return (
      payload.repository === "CertivoIQ/certifyiq-48308270" &&
      payload.repository_id === "1326099740" &&
      payload.ref === "refs/heads/main" &&
      payload.workflow_ref ===
        "CertivoIQ/certifyiq-48308270/.github/workflows/operations-worker.yml@refs/heads/main" &&
      (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch") &&
      payload.runner_environment === "github-hosted"
    );
  } catch {
    return false;
  }
}

type PurgeTarget = {
  user_id: string;
  environment: string;
  files_purge_at: string;
};

type StorageObject = { bucket: string; path: string };

const chunks = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

async function purgeExpiredCustomerFiles(db: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  const { data: targets, error: targetError } = await db
    .from("account_access")
    .select("user_id,environment,files_purge_at")
    .not("files_purge_at", "is", null)
    .is("files_purged_at", null)
    .lte("files_purge_at", now)
    .limit(25);

  if (targetError) throw new Error(`Retention target query failed: ${targetError.message}`);

  let completed = 0;
  let objectsDeleted = 0;

  for (const target of (targets ?? []) as PurgeTarget[]) {
    try {
      const [{ data: imports, error: importError }, { data: evidence, error: evidenceError }] =
        await Promise.all([
          db.from("certification_import_items").select("storage_path").eq("user_id", target.user_id),
          db
            .from("correction_evidence")
            .select("storage_bucket,storage_path")
            .eq("submitted_by", target.user_id),
        ]);

      if (importError) throw new Error(`Import inventory failed: ${importError.message}`);
      if (evidenceError) throw new Error(`Evidence inventory failed: ${evidenceError.message}`);

      const objectMap = new Map<string, StorageObject>();
      for (const row of imports ?? []) {
        if (row.storage_path) {
          const path = String(row.storage_path);
          const item = { bucket: "certification-imports", path };
          objectMap.set(`${item.bucket}/${item.path}`, item);
          const sidecar = {
            bucket: "certification-imports",
            path: `${path}${CERTIFICATION_OCR_SIDECAR_SUFFIX}`,
          };
          objectMap.set(`${sidecar.bucket}/${sidecar.path}`, sidecar);
        }
      }
      for (const row of evidence ?? []) {
        if (row.storage_bucket && row.storage_path) {
          const item = { bucket: String(row.storage_bucket), path: String(row.storage_path) };
          objectMap.set(`${item.bucket}/${item.path}`, item);
        }
      }

      const byBucket = new Map<string, string[]>();
      for (const object of objectMap.values()) {
        const paths = byBucket.get(object.bucket) ?? [];
        paths.push(object.path);
        byBucket.set(object.bucket, paths);
      }

      for (const [bucket, paths] of byBucket) {
        for (const batch of chunks(paths, 100)) {
          const { error } = await db.storage.from(bucket).remove(batch);
          if (error) throw new Error(`Storage deletion failed for ${bucket}: ${error.message}`);
        }
      }

      const { error: eventError } = await db.from("retention_purge_events").insert({
        user_id: target.user_id,
        scheduled_for: target.files_purge_at,
        status: "completed",
        object_count: objectMap.size,
      });
      if (eventError) throw new Error(`Retention audit insert failed: ${eventError.message}`);

      const { error: markError } = await db
        .from("account_access")
        .update({ files_purged_at: now, updated_at: now })
        .eq("user_id", target.user_id)
        .eq("environment", target.environment)
        .is("files_purged_at", null)
        .lte("files_purge_at", now);
      if (markError) throw new Error(`Retention completion update failed: ${markError.message}`);

      completed += 1;
      objectsDeleted += objectMap.size;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.from("retention_purge_events").insert({
        user_id: target.user_id,
        scheduled_for: target.files_purge_at,
        status: "failed",
        object_count: 0,
        error_detail: message.slice(0, 2000),
      });
      throw error;
    }
  }

  return { targets: targets?.length ?? 0, completed, objectsDeleted };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!(await authorizedGitHubWorkflow(request))) {
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

  let retention;
  try {
    retention = await purgeExpiredCustomerFiles(db);
  } catch (error) {
    return json(
      {
        ok: false,
        stage: "retention",
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }

  const { data: reaped, error: reapError } = await db.rpc("operations_reap_stale_leases");
  if (reapError) return json({ ok: false, stage: "reap", retention, error: reapError.message }, 500);

  const { data: claimedData, error: claimError } = await db.rpc("operations_claim_job", {
    _worker: worker,
    _lease_seconds: 120,
  });
  if (claimError) return json({ ok: false, stage: "claim", retention, error: claimError.message }, 500);

  const job = Array.isArray(claimedData) ? claimedData[0] : claimedData;
  if (!job?.id || !job?.job_type) {
    return json({ ok: true, retention, reaped: reaped ?? 0, claimed: false });
  }

  const jobId = String(job.id);
  const jobType = String(job.job_type);

  if (jobType !== "operations_health_check") {
    const { error } = await db.rpc("operations_fail_job", {
      _job_id: jobId,
      _worker: worker,
      _error: { code: "HANDLER_NOT_ACTIVE", message: `No approved handler for ${jobType}` },
    });
    if (error) {
      return json({ ok: false, stage: "fail", retention, claimed: true, jobId, error: error.message }, 500);
    }
    return json({ ok: true, retention, reaped: reaped ?? 0, claimed: true, jobId, status: "retry_or_quarantine" });
  }

  const { data: completed, error: completeError } = await db.rpc("operations_complete_job", {
    _job_id: jobId,
    _worker: worker,
    _result: { checkedAt: new Date().toISOString(), status: "healthy", retention },
  });
  if (completeError) {
    await db.rpc("operations_fail_job", {
      _job_id: jobId,
      _worker: worker,
      _error: { code: "WORKER_FAILURE", message: completeError.message },
    });
    return json({ ok: false, stage: "complete", retention, claimed: true, jobId }, 500);
  }

  return json({
    ok: true,
    retention,
    reaped: reaped ?? 0,
    claimed: true,
    jobId,
    status: completed ? "completed" : "lease_lost",
  });
});