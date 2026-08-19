import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateTransmissionToken,
} from "../src/lib/transmission-token.mjs";

const baseToken = {
  tokenId: "TOKEN-001",
  submissionId: "SUB-001",
  manifestSha256: "manifest-v1",
  destinationAgencyId: "HFA-TN",
  issuedAt: "2026-08-19T15:00:00Z",
  expiresAt: "2026-08-19T17:00:00Z",
};

test("valid current token bound to exact package and destination is authorized", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-001",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T16:00:00Z",
  });

  assert.equal(result.authorized, true);
  assert.equal(result.tokenStatus, "VALID");
});

test("token bound to another submission is blocked", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-999",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T16:00:00Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "BINDING_MISMATCH");
});

test("token bound to another manifest is blocked", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-001",
    manifestSha256: "manifest-v2",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T16:00:00Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "BINDING_MISMATCH");
});

test("token bound to another destination is blocked", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-001",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-KY",
    evaluatedAt: "2026-08-19T16:00:00Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "BINDING_MISMATCH");
});

test("token cannot be used before issuance", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-001",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T14:59:59Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "NOT_YET_VALID");
});

test("expired token is blocked", () => {
  const result = evaluateTransmissionToken({
    token: baseToken,
    submissionId: "SUB-001",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T17:00:01Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "EXPIRED");
});

test("consumed token cannot be reused", () => {
  const result = evaluateTransmissionToken({
    token: {
      ...baseToken,
      consumedAt: "2026-08-19T15:30:00Z",
    },
    submissionId: "SUB-001",
    manifestSha256: "manifest-v1",
    destinationAgencyId: "HFA-TN",
    evaluatedAt: "2026-08-19T16:00:00Z",
  });

  assert.equal(result.authorized, false);
  assert.equal(result.tokenStatus, "CONSUMED");
});
