import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSubmissionAuthority,
} from "../src/lib/certification-authority.mjs";

const item = {
  id: "CERT-001",
  status: "completed",
};

const manifest = {
  manifest_sha256: "manifest-v1",
};

const findings = [
  {
    id: "F-001",
    status: "PASS",
  },
  {
    id: "F-002",
    status: "FAIL",
  },
];

test("all current findings approved against current manifest allows submission", () => {
  const result = evaluateSubmissionAuthority({
    item,
    manifest,
    findings,
    reviews: [
      {
        finding_id: "F-001",
        decision: "approved",
        created_at: "2026-08-14T00:00:00Z",
        manifest_sha256: "manifest-v1",
      },
      {
        finding_id: "F-002",
        decision: "approved",
        created_at: "2026-08-14T00:00:01Z",
        manifest_sha256: "manifest-v1",
      },
    ],
  });

  assert.equal(result.submissionAuthority, "ALLOWED");
  assert.equal(result.submissionStatus, "SUBMISSION_AUTHORIZED");
});

test("missing human approval blocks submission", () => {
  const result = evaluateSubmissionAuthority({
    item,
    manifest,
    findings,
    reviews: [
      {
        finding_id: "F-001",
        decision: "approved",
        created_at: "2026-08-14T00:00:00Z",
        manifest_sha256: "manifest-v1",
      },
    ],
  });

  assert.equal(result.submissionAuthority, "BLOCKED");
  assert.equal(result.submissionStatus, "HUMAN_REVIEW_REQUIRED");
});

test("undetermined finding blocks submission", () => {
  const result = evaluateSubmissionAuthority({
    item,
    manifest,
    findings: [
      {
        id: "F-003",
        status: "UNABLE_TO_DETERMINE",
      },
    ],
    reviews: [],
  });

  assert.equal(result.submissionAuthority, "BLOCKED");
  assert.equal(result.submissionStatus, "UNDETERMINED_FINDING");
});

test("remediation request blocks submission", () => {
  const result = evaluateSubmissionAuthority({
    item,
    manifest,
    findings,
    reviews: [
      {
        finding_id: "F-001",
        decision: "approved",
        created_at: "2026-08-14T00:00:00Z",
        manifest_sha256: "manifest-v1",
      },
      {
        finding_id: "F-002",
        decision: "remediation_requested",
        created_at: "2026-08-14T00:00:01Z",
        manifest_sha256: "manifest-v1",
      },
    ],
  });

  assert.equal(result.submissionAuthority, "BLOCKED");
  assert.equal(result.submissionStatus, "REMEDIATION_REQUIRED");
});

test("approval tied to prior manifest blocks submission", () => {
  const result = evaluateSubmissionAuthority({
    item,
    manifest,
    findings,
    reviews: [
      {
        finding_id: "F-001",
        decision: "approved",
        created_at: "2026-08-14T00:00:00Z",
        manifest_sha256: "manifest-v0",
      },
      {
        finding_id: "F-002",
        decision: "approved",
        created_at: "2026-08-14T00:00:01Z",
        manifest_sha256: "manifest-v1",
      },
    ],
  });

  assert.equal(result.submissionAuthority, "BLOCKED");
  assert.equal(result.submissionStatus, "STALE_APPROVAL");
});