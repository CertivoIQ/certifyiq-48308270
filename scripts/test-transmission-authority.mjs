import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateTransmissionAuthority,
} from "../src/lib/transmission-authority.mjs";

const submissionAuthority = {
  submissionAuthority: "ALLOWED",
  submissionStatus: "SUBMISSION_AUTHORIZED",
};

const manifest = {
  id: "MANIFEST-001",
  manifest_sha256: "manifest-v1",
};

const destination = {
  agencyId: "HFA-TN",
};

const grant = {
  agency_id: "HFA-TN",
  revoked_at: null,
};

const validToken = {
  tokenId: "TOKEN-001",
  submissionId: "SUB-CURRENT",
  manifestSha256: "manifest-v1",
  destinationAgencyId: "HFA-TN",
  issuedAt: "2026-08-19T15:00:00Z",
  expiresAt: "2026-08-19T17:00:00Z",
};

const evaluatedAt = "2026-08-19T16:00:00Z";

test("current approved package with active destination grant and valid token is authorized", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    priorSubmissions: [],
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "ALLOWED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_AUTHORIZED");
  assert.equal(result.transmissionTokenId, "TOKEN-001");
});

test("missing submission authority blocks transmission", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority: {
      submissionAuthority: "BLOCKED",
      submissionStatus: "HUMAN_REVIEW_REQUIRED",
    },
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(
    result.transmissionStatus,
    "SUBMISSION_AUTHORITY_REQUIRED",
  );
});

test("manifest mismatch blocks transmission", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v0",
    destination,
    grant,
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "PACKAGE_MANIFEST_MISMATCH");
});

test("missing or revoked destination grant blocks transmission", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant: {
      agency_id: "HFA-TN",
      revoked_at: "2026-08-14T00:00:00Z",
    },
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "UNAUTHORIZED_DESTINATION");
});

test("duplicate manifest submission to same agency is blocked", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    priorSubmissions: [
      {
        id: "SUB-001",
        agency_id: "HFA-TN",
        evidence_manifest_id: "MANIFEST-001",
        status: "submitted",
      },
    ],
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "DUPLICATE_TRANSMISSION");
});

test("same manifest may be authorized for a different granted agency with matching token", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination: {
      agencyId: "HFA-KY",
    },
    grant: {
      agency_id: "HFA-KY",
      revoked_at: null,
    },
    priorSubmissions: [
      {
        id: "SUB-002",
        agency_id: "HFA-TN",
        evidence_manifest_id: "MANIFEST-001",
        status: "submitted",
      },
    ],
    token: {
      ...validToken,
      tokenId: "TOKEN-002",
      destinationAgencyId: "HFA-KY",
    },
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "ALLOWED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_AUTHORIZED");
});

test("missing transmission token blocks authorization", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_TOKEN_REQUIRED");
  assert.equal(result.tokenStatus, "INVALID");
});

test("expired transmission token blocks authorization", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    token: validToken,
    submissionId: "SUB-CURRENT",
    evaluatedAt: "2026-08-19T17:00:01Z",
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_TOKEN_REQUIRED");
  assert.equal(result.tokenStatus, "EXPIRED");
});

test("consumed transmission token blocks authorization", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    token: {
      ...validToken,
      consumedAt: "2026-08-19T15:30:00Z",
    },
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_TOKEN_REQUIRED");
  assert.equal(result.tokenStatus, "CONSUMED");
});

test("token bound to another submission blocks authorization", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    token: {
      ...validToken,
      submissionId: "SUB-OTHER",
    },
    submissionId: "SUB-CURRENT",
    evaluatedAt,
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_TOKEN_REQUIRED");
  assert.equal(result.tokenStatus, "BINDING_MISMATCH");
});
