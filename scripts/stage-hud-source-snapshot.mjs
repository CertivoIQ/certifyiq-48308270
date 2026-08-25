import {
  HUD_DATASET_SCHEDULE_URL,
  prepareHudSourceSnapshot,
} from "../src/lib/hud-source-pipeline.mjs";

const required = ["CERTIVOIQ_SUPABASE_URL", "CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY", "OPERATIONS_WORKER_SECRET"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const response = await fetch(HUD_DATASET_SCHEDULE_URL, {
  redirect: "follow",
  signal: AbortSignal.timeout(20_000),
  headers: {
    accept: "text/html,application/xhtml+xml",
    "user-agent": "CertivoIQ-SourceMonitor/1.0 (+https://certivoiq.com)",
  },
});
if (!response.ok) throw new Error(`HUD source request failed with HTTP ${response.status}`);
const declaredLength = Number(response.headers.get("content-length") ?? 0);
if (declaredLength > 5 * 1024 * 1024) throw new Error("HUD source exceeds the 5 MiB limit");
const body = new Uint8Array(await response.arrayBuffer());
const snapshot = prepareHudSourceSnapshot({
  sourceUrl: HUD_DATASET_SCHEDULE_URL,
  finalUrl: response.url,
  body,
  contentType: response.headers.get("content-type"),
  retrievedAt: new Date().toISOString(),
});
if (snapshot.stage_status !== "VALIDATED_FOR_STAGING") {
  throw new Error(`HUD source validation blocked: ${snapshot.reason_code}`);
}

const endpoint = `${process.env.CERTIVOIQ_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/operations_stage_hud_source_v1`;
const staged = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: process.env.CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${process.env.CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    worker_secret: process.env.OPERATIONS_WORKER_SECRET,
    source_url: snapshot.source_url,
    final_url: snapshot.final_url,
    source_sha256: snapshot.source_sha256,
    retrieved_at: snapshot.retrieved_at,
    content_type: snapshot.content_type,
    content_length: snapshot.content_length,
    parser_build: snapshot.parser_build,
    dataset_rows: snapshot.dataset_rows,
  }),
});
const responseText = await staged.text();
if (!staged.ok) throw new Error(`Source staging failed with HTTP ${staged.status}: ${responseText}`);
console.log(responseText);
