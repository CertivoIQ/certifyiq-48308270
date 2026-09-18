import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL,
  WVHDF_MULTIFAMILY_INDEX_URL,
  prepareWvOfficialIndexSnapshot,
} from "../src/lib/wv-official-index-pipeline.mjs";

const stageScript = await readFile(
  new URL("./stage-wv-official-index.mjs", import.meta.url),
  "utf8",
);
const workflow = await readFile(
  new URL("../.github/workflows/wv-source-watch.yml", import.meta.url),
  "utf8",
);

const html = Buffer.from(
  "<html><body><h2>LIHTCP Compliance Documents</h2><p>West Virginia Income Limits Report</p><p>LIHTC Income Asset Worksheet</p></body></html>",
);

test("accepts only official WVHDF retrieval paths while preserving the canonical source identity", () => {
  const snapshot = prepareWvOfficialIndexSnapshot({
    sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    finalUrl: WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL,
    body: html,
    contentType: "text/html; charset=utf-8",
    retrievedAt: "2026-09-17T22:00:00.000Z",
  });

  assert.equal(snapshot.stage_status, "VALIDATED_FOR_STAGING");
  assert.equal(snapshot.official_url, WVHDF_MULTIFAMILY_INDEX_URL);
  assert.equal(snapshot.retrieval_url, WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL);
  assert.equal(snapshot.compliance_activation_allowed, false);

  const blocked = prepareWvOfficialIndexSnapshot({
    sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    finalUrl: "https://example.com/wvhdf-copy",
    body: html,
    contentType: "text/html",
    retrievedAt: "2026-09-17T22:00:00.000Z",
  });
  assert.equal(blocked.stage_status, "BLOCKED");
  assert.equal(blocked.reason_code, "NON_OFFICIAL_WVHDF_SOURCE");
});

test("publisher access blocks never stage or activate unverified bytes", () => {
  assert.match(stageScript, /candidate\.status === 403 \|\| candidate\.status === 429/);
  assert.match(stageScript, /status: "RETRIEVAL_BLOCKED"/);
  assert.match(stageScript, /No source bytes were staged or activated/);
  assert.match(stageScript, /compliance_activation_allowed: false/);
  assert.match(stageScript, /WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL/);
});

test("watcher runs on schedule and only relevant main-branch changes", () => {
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "41 11 \* \* \*"/);
  assert.match(workflow, /paths:/);
  assert.match(workflow, /stage-wv-official-index\.mjs/);
  assert.match(workflow, /wv-official-index-pipeline\.mjs/);
  assert.match(workflow, /node --test scripts\/test-wv-source-watch\.mjs/);
});
