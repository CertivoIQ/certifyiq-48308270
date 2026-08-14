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

test("current approved package with active destination grant is authorized", () => {
  const result = evaluateTransmissionAuthority({
    submissionAuthority,
    manifest,
    packageManifestSha256: "manifest-v1",
    destination,
    grant,
    priorSubmissions: [],
  });

  assert.equal(result.transmissionAuthority, "ALLOWED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_AUTHORIZED");
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
  });

  assert.equal(result.transmissionAuthority, "BLOCKED");
  assert.equal(result.transmissionStatus, "DUPLICATE_TRANSMISSION");
});

test("same manifest may be authorized for a different granted agency", () => {
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
  });

  assert.equal(result.transmissionAuthority, "ALLOWED");
  assert.equal(result.transmissionStatus, "TRANSMISSION_AUTHORIZED");
});