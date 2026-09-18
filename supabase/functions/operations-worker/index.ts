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
const STALE_CERTIFICATION_UPLOAD_HOURS = 72;

async function authorizedGitHubWorkflow(
  request: Request,
  workflowFile = "operations-worker.yml",
  allowedEvents = ["schedule", "workflow_dispatch"],
): Promise<boolean> {
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
        `CertivoIQ/certifyiq-48308270/.github/workflows/${workflowFile}@refs/heads/main` &&
      allowedEvents.includes(String(payload.event_name ?? "")) &&
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

async function purgeStaleCertificationUploads(db: ReturnType<typeof createClient>) {
  let candidateObjectCount = 0;
  let deletedObjectCount = 0;
  let markedJobCount = 0;

  try {
    const { data: candidates, error: candidateError } = await db.rpc(
      "operations_stale_certification_objects",
      { _older_than_hours: STALE_CERTIFICATION_UPLOAD_HOURS },
    );
    if (candidateError) throw new Error(`Stale upload candidate query failed: ${candidateError.message}`);

    const paths = Array.from(
      new Set(
        (candidates ?? [])
          .map((row: { storage_path?: unknown }) => String(row.storage_path ?? ""))
          .filter(Boolean),
      ),
    );
    candidateObjectCount = paths.length;

    for (const batch of chunks(paths, 100)) {
      const { error } = await db.storage.from("certification-imports").remove(batch);
      if (error) throw new Error(`Stale upload deletion failed: ${error.message}`);
      deletedObjectCount += batch.length;
    }

    const { data: marked, error: markError } = await db.rpc(
      "operations_mark_stale_certification_jobs",
      { _older_than_hours: STALE_CERTIFICATION_UPLOAD_HOURS },
    );
    if (markError) throw new Error(`Stale import job cleanup failed: ${markError.message}`);
    markedJobCount = Number(marked ?? 0);

    const { error: auditError } = await db.from("stale_certification_upload_purge_events").insert({
      cutoff_hours: STALE_CERTIFICATION_UPLOAD_HOURS,
      candidate_object_count: candidateObjectCount,
      deleted_object_count: deletedObjectCount,
      marked_job_count: markedJobCount,
      status: "completed",
    });
    if (auditError) throw new Error(`Stale upload audit insert failed: ${auditError.message}`);

    return { candidateObjectCount, deletedObjectCount, markedJobCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("stale_certification_upload_purge_events").insert({
      cutoff_hours: STALE_CERTIFICATION_UPLOAD_HOURS,
      candidate_object_count: candidateObjectCount,
      deleted_object_count: deletedObjectCount,
      marked_job_count: markedJobCount,
      status: "failed",
      error_detail: message.slice(0, 2000),
    });
    throw error;
  }
}


type HudStageRequest = {
  source_url?: unknown;
  final_url?: unknown;
  source_sha256?: unknown;
  retrieved_at?: unknown;
  content_type?: unknown;
  content_length?: unknown;
  parser_build?: unknown;
  dataset_rows?: unknown;
};

function validHudUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && ["huduser.gov", "www.huduser.gov"].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function stageHudSource(db: ReturnType<typeof createClient>, payload: HudStageRequest) {
  const sourceUrl = String(payload.source_url ?? "");
  const finalUrl = String(payload.final_url ?? "");
  const sha256 = String(payload.source_sha256 ?? "");
  const retrievedAt = String(payload.retrieved_at ?? "");
  const contentType = String(payload.content_type ?? "");
  const contentLength = Number(payload.content_length ?? 0);
  const parserBuild = String(payload.parser_build ?? "");
  const datasetRows = payload.dataset_rows;

  if (!validHudUrl(sourceUrl) || !validHudUrl(finalUrl)) throw new Error("official HUD USER HTTPS source required");
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("invalid source sha256");
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > 5 * 1024 * 1024) throw new Error("invalid content length");
  if (contentType !== "text/html") throw new Error("invalid content type");
  if (!/^hud-source-pipeline-/.test(parserBuild)) throw new Error("uncontrolled parser build");
  if (!Array.isArray(datasetRows) || datasetRows.length < 20) throw new Error("tracked dataset rows incomplete");
  for (const row of datasetRows) {
    if (!row || typeof row !== "object" || !String((row as Record<string, unknown>).dataset_id ?? "") ||
        !String((row as Record<string, unknown>).dataset_name ?? "") ||
        !(Object.prototype.hasOwnProperty.call(row, "most_recent_release")) ||
        !(Object.prototype.hasOwnProperty.call(row, "expected_next_update"))) {
      throw new Error("invalid dataset row");
    }
  }

  const { data: existing, error: existingError } = await db
    .from("operations_source_versions")
    .select("id")
    .eq("official_url", sourceUrl)
    .eq("sha256", sha256)
    .eq("authority", "HUD USER")
    .eq("program", "Dataset Update Schedule")
    .order("retrieved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`HUD source lookup failed: ${existingError.message}`);

  let sourceVersionId = existing?.id as string | undefined;
  let staged = false;
  if (!sourceVersionId) {
    const { data: inserted, error: insertError } = await db
      .from("operations_source_versions")
      .insert({
        official_url: sourceUrl,
        authority: "HUD USER",
        program: "Dataset Update Schedule",
        retrieved_at: retrievedAt,
        sha256,
        parsing_status: "parsed",
        validation_status: "validated",
        evidence_manifest: {
          final_url: finalUrl,
          content_type: contentType,
          content_length: contentLength,
          parser_build: parserBuild,
          dataset_rows: datasetRows,
          validation_scope: "SOURCE_IDENTITY_AND_SCHEDULE_STRUCTURE_ONLY",
          compliance_activation_allowed: false,
          communication_allowed: false,
        },
      })
      .select("id")
      .single();
    if (insertError) throw new Error(`HUD source insert failed: ${insertError.message}`);
    sourceVersionId = String(inserted.id);
    staged = true;
  }

  const { error: auditError } = await db.from("operations_audit_events").insert({
    actor_kind: "worker",
    action: staged ? "source.staged" : "source.unchanged",
    target_type: "operations_source_version",
    target_id: sourceVersionId,
    after_sha256: sha256,
    evidence_refs: [{ source_version_id: sourceVersionId }],
    source_refs: [sourceUrl],
    correlation_id: crypto.randomUUID(),
    detail: {
      parser_build: parserBuild,
      tracked_dataset_count: datasetRows.length,
      compliance_activation_allowed: false,
      communication_allowed: false,
      authentication: "github_oidc",
    },
  });
  if (auditError) throw new Error(`HUD source audit insert failed: ${auditError.message}`);

  return {
    ok: true,
    staged,
    sourceVersionId,
    sha256,
    trackedDatasetCount: datasetRows.length,
    complianceActivationAllowed: false,
    communicationAllowed: false,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = new URL(request.url);
  const isHudStage = url.searchParams.get("mode") === "stage-hud-source";
  const authorized = isHudStage
    ? await authorizedGitHubWorkflow(request, "hud-source-watch.yml", ["schedule", "workflow_dispatch", "push"])
    : await authorizedGitHubWorkflow(request);
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Worker runtime is not configured" }, 503);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const worker = "certivoiq-control-plane";

  if (isHudStage) {
    try {
      const payload = (await request.json()) as HudStageRequest;
      return json(await stageHudSource(db, payload));
    } catch (error) {
      return json({ ok: false, stage: "hud_source", error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

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

  let staleUploads;
  try {
    staleUploads = await purgeStaleCertificationUploads(db);
  } catch (error) {
    return json(
      {
        ok: false,
        stage: "stale_certification_uploads",
        retention,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }

  const { data: reaped, error: reapError } = await db.rpc("operations_reap_stale_leases");
  if (reapError) return json({ ok: false, stage: "reap", retention, staleUploads, error: reapError.message }, 500);

  const { data: claimedData, error: claimError } = await db.rpc("operations_claim_job", {
    _worker: worker,
    _lease_seconds: 120,
  });
  if (claimError) return json({ ok: false, stage: "claim", retention, staleUploads, error: claimError.message }, 500);

  const job = Array.isArray(claimedData) ? claimedData[0] : claimedData;
  if (!job?.id || !job?.job_type) {
    return json({ ok: true, retention, staleUploads, reaped: reaped ?? 0, claimed: false });
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
      return json({ ok: false, stage: "fail", retention, staleUploads, claimed: true, jobId, error: error.message }, 500);
    }
    return json({ ok: true, retention, staleUploads, reaped: reaped ?? 0, claimed: true, jobId, status: "retry_or_quarantine" });
  }

  const { data: completed, error: completeError } = await db.rpc("operations_complete_job", {
    _job_id: jobId,
    _worker: worker,
    _result: { checkedAt: new Date().toISOString(), status: "healthy", retention, staleUploads },
  });
  if (completeError) {
    await db.rpc("operations_fail_job", {
      _job_id: jobId,
      _worker: worker,
      _error: { code: "WORKER_FAILURE", message: completeError.message },
    });
    return json({ ok: false, stage: "complete", retention, staleUploads, claimed: true, jobId }, 500);
  }

  return json({
    ok: true,
    retention,
    staleUploads,
    reaped: reaped ?? 0,
    claimed: true,
    jobId,
    status: completed ? "completed" : "lease_lost",
  });
});