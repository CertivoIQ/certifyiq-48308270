import {
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

const response = await fetch(WVHDF_MULTIFAMILY_INDEX_URL, {
  redirect: "follow",
  signal: AbortSignal.timeout(20_000),
  headers: {
    accept: "text/html,application/xhtml+xml",
    "user-agent": "CertivoIQ-SourceMonitor/1.0 (+https://certivoiq.com)",
  },
});
if (!response.ok) throw new Error(`WVHDF source request failed with HTTP ${response.status}`);
const declaredLength = Number(response.headers.get("content-length") ?? 0);
if (declaredLength > 5 * 1024 * 1024) throw new Error("WVHDF source exceeds the 5 MiB limit");
const body = new Uint8Array(await response.arrayBuffer());
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
      activation_status: snapshot.activation_status,
      compliance_activation_allowed: false,
    },
  }),
});
const responseText = await staged.text();
if (!staged.ok) throw new Error(`WVHDF source staging failed with HTTP ${staged.status}: ${responseText}`);
console.log(responseText);
