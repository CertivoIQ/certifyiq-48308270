import {
  HUD_DATASET_SCHEDULE_URL,
  prepareHudSourceSnapshot,
} from "../src/lib/hud-source-pipeline.mjs";

const required = ["CERTIVOIQ_SUPABASE_URL", "CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY", "OPERATIONS_WORKER_SECRET"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const requestUrls = [
  HUD_DATASET_SCHEDULE_URL,
  HUD_DATASET_SCHEDULE_URL.replace("https://www.huduser.gov/", "https://huduser.gov/"),
];

let snapshot;
const retrievalFailures = [];
for (const requestUrl of requestUrls) {
  try {
    const response = await fetch(requestUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) {
      retrievalFailures.push(`${new URL(requestUrl).hostname}:HTTP_${response.status}`);
      continue;
    }
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > 5 * 1024 * 1024) {
      retrievalFailures.push(`${new URL(requestUrl).hostname}:SOURCE_TOO_LARGE`);
      continue;
    }
    const body = new Uint8Array(await response.arrayBuffer());
    const candidate = prepareHudSourceSnapshot({
      sourceUrl: HUD_DATASET_SCHEDULE_URL,
      finalUrl: response.url,
      body,
      contentType: response.headers.get("content-type"),
      retrievedAt: new Date().toISOString(),
    });
    if (candidate.stage_status === "VALIDATED_FOR_STAGING") {
      snapshot = candidate;
      break;
    }
    retrievalFailures.push(`${new URL(requestUrl).hostname}:${candidate.reason_code}`);
  } catch (error) {
    retrievalFailures.push(
      `${new URL(requestUrl).hostname}:REQUEST_${error instanceof Error ? error.name : "FAILED"}`,
    );
  }
}

if (!snapshot) {
  throw new Error(`HUD source validation blocked: ${retrievalFailures.join(",") || "NO_VALID_RESPONSE"}`);
}

const endpoint = `${process.env.CERTIVOIQ_SUPABASE_URL.replace(/\\/$/, "")}/rest/v1/rpc/operations_stage_hud_source_v1`;
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
