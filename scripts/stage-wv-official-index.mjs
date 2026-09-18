import {
  WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL,
  WVHDF_MULTIFAMILY_INDEX_URL,
  prepareWvOfficialIndexSnapshot,
} from "../src/lib/wv-official-index-pipeline.mjs";

const required = [
  "CERTIVOIQ_SUPABASE_URL",
  "CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY",
  "OPERATIONS_WORKER_SECRET",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const MAX_BYTES = 5 * 1024 * 1024;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const MONITOR_UA = "CertivoIQ-SourceMonitor/1.1 (+https://certivoiq.com)";

const attempts = [
  { url: WVHDF_MULTIFAMILY_INDEX_URL, userAgent: MONITOR_UA, mode: "canonical-monitor" },
  { url: WVHDF_MULTIFAMILY_INDEX_URL, userAgent: BROWSER_UA, mode: "canonical-browser" },
  { url: WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL, userAgent: BROWSER_UA, mode: "official-fallback-browser" },
];

let response = null;
const blocked = [];
for (const attempt of attempts) {
  let candidate;
  try {
    candidate = await fetch(attempt.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "user-agent": attempt.userAgent,
      },
    });
  } catch (error) {
    blocked.push({ mode: attempt.mode, url: attempt.url, error: error instanceof Error ? error.message : String(error) });
    continue;
  }

  if (candidate.ok) {
    response = candidate;
    break;
  }
  if (candidate.status === 403 || candidate.status === 429) {
    blocked.push({ mode: attempt.mode, url: attempt.url, status: candidate.status });
    continue;
  }
  throw new Error(`WVHDF source request failed with HTTP ${candidate.status} at ${attempt.url}`);
}

if (!response) {
  console.warn(
    "::warning title=WVHDF publisher blocked automated retrieval::Official WVHDF endpoints returned access blocks. No source bytes were staged or activated; the last validated source remains unchanged.",
  );
  console.log(JSON.stringify({
    status: "RETRIEVAL_BLOCKED",
    authority: "West Virginia Housing Development Fund",
    canonical_url: WVHDF_MULTIFAMILY_INDEX_URL,
    compliance_activation_allowed: false,
    attempts: blocked,
  }));
  process.exit(0);
}

const declaredLength = Number(response.headers.get("content-length") ?? 0);
if (declaredLength > MAX_BYTES) throw new Error("WVHDF source exceeds the 5 MiB limit");
const body = new Uint8Array(await response.arrayBuffer());
if (body.byteLength > MAX_BYTES) throw new Error("WVHDF source exceeds the 5 MiB limit");

const snapshot = prepareWvOfficialIndexSnapshot({
  sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
  finalUrl: response.url,
  body,
  contentType: response.headers.get("content-type"),
  retrievedAt: new Date().toISOString(),
});
if (snapshot.stage_status !== "VALIDATED_FOR_STAGING") {
  throw new Error(`WVHDF source validation blocked: ${snapshot.reason_code}`);
}

const endpoint = `${process.env.CERTIVOIQ_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/operations_stage_source_version_v1`;
const staged = await fetch(endpoint, {
  method: "POST",
  headers: {
    apikey: process.env.CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${process.env.CERTIVOIQ_SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    worker_secret: process.env.OPERATIONS_WORKER_SECRET,
    source_url: snapshot.official_url,
    authority_name: snapshot.authority,
    program_code: snapshot.program,
    jurisdiction_code: snapshot.jurisdiction,
    source_effective_date: null,
    source_retrieved_at: snapshot.retrieved_at,
    source_sha256: snapshot.source_sha256,
    source_evidence_manifest: {
      parser_build: snapshot.parser_build,
      content_type: snapshot.content_type,
      content_length: snapshot.content_length,
      retrieval_url: snapshot.retrieval_url,
      activation_status: snapshot.activation_status,
      compliance_activation_allowed: false,
    },
  }),
});
const responseText = await staged.text();
if (!staged.ok) throw new Error(`WVHDF source staging failed with HTTP ${staged.status}: ${responseText}`);
console.log(responseText);
