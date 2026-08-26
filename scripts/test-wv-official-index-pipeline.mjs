import assert from "node:assert/strict";
import test from "node:test";

import {
  WVHDF_MULTIFAMILY_INDEX_URL,
  prepareWvOfficialIndexSnapshot,
} from "../src/lib/wv-official-index-pipeline.mjs";

const html = `
<html><body>
<h2>LIHTCP Compliance Documents</h2>
<a>West Virginia Income Limits Report</a>
<a>LIHTC Income Asset Worksheet</a>
</body></html>`;

test("official WVHDF index stages exact HTML bytes without activating compliance", () => {
  const result = prepareWvOfficialIndexSnapshot({
    sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    finalUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    body: new TextEncoder().encode(html),
    contentType: "text/html; charset=UTF-8",
    retrievedAt: "2026-08-26T03:45:00.000Z",
  });
  assert.equal(result.stage_status, "VALIDATED_FOR_STAGING");
  assert.equal(result.activation_status, "BLOCKED_PENDING_CONTENT_VALIDATION");
  assert.equal(result.compliance_activation_allowed, false);
  assert.match(result.source_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.jurisdiction, "WV");
  assert.equal(result.program, "LIHTC");
});

test("redirects outside WVHDF fail closed", () => {
  const result = prepareWvOfficialIndexSnapshot({
    sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    finalUrl: "https://example.com/resources/",
    body: new TextEncoder().encode(html),
    contentType: "text/html",
    retrievedAt: "2026-08-26T03:45:00.000Z",
  });
  assert.equal(result.stage_status, "BLOCKED");
  assert.equal(result.reason_code, "NON_OFFICIAL_WVHDF_SOURCE");
});

test("missing compliance resource markers fail closed", () => {
  const result = prepareWvOfficialIndexSnapshot({
    sourceUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    finalUrl: WVHDF_MULTIFAMILY_INDEX_URL,
    body: new TextEncoder().encode("<html><body>West Virginia</body></html>"),
    contentType: "text/html",
    retrievedAt: "2026-08-26T03:45:00.000Z",
  });
  assert.equal(result.stage_status, "BLOCKED");
  assert.equal(result.reason_code, "WV_RESOURCE_MARKERS_INCOMPLETE");
});
