import test from "node:test";
import assert from "node:assert/strict";

function evaluateSubmitTransition({
  ownerMatches,
  status,
  transmissionAuthority,
  transmissionStatus,
} = {}) {
  if (!ownerMatches) {
    return {
      status: "BLOCKED",
      reason: "Only the submission owner may authorize this package.",
    };
  }

  if (status !== "draft") {
    return {
      status: "BLOCKED",
      reason: "Only a draft submission may enter the submission workflow.",
    };
  }

  if (
    transmissionAuthority !== "ALLOWED" ||
    transmissionStatus !== "TRANSMISSION_AUTHORIZED"
  ) {
    return {
      status: "BLOCKED",
      reason: "Transmission authority is required.",
    };
  }

  return {
    status: "SUBMITTED",
    externalDeliveryExecuted: false,
  };
}

test("authorized owner may transition an eligible draft to submitted", () => {
  const result = evaluateSubmitTransition({
    ownerMatches: true,
    status: "draft",
    transmissionAuthority: "ALLOWED",
    transmissionStatus: "TRANSMISSION_AUTHORIZED",
  });

  assert.equal(result.status, "SUBMITTED");
  assert.equal(result.externalDeliveryExecuted, false);
});

test("non-owner cannot submit the package", () => {
  const result = evaluateSubmitTransition({
    ownerMatches: false,
    status: "draft",
    transmissionAuthority: "ALLOWED",
    transmissionStatus: "TRANSMISSION_AUTHORIZED",
  });

  assert.equal(result.status, "BLOCKED");
});

test("non-draft package cannot be submitted again", () => {
  const result = evaluateSubmitTransition({
    ownerMatches: true,
    status: "submitted",
    transmissionAuthority: "ALLOWED",
    transmissionStatus: "TRANSMISSION_AUTHORIZED",
  });

  assert.equal(result.status, "BLOCKED");
});

test("missing transmission authority blocks state transition", () => {
  const result = evaluateSubmitTransition({
    ownerMatches: true,
    status: "draft",
    transmissionAuthority: "BLOCKED",
    transmissionStatus: "UNAUTHORIZED_DESTINATION",
  });

  assert.equal(result.status, "BLOCKED");
});

test("submitted state does not imply external delivery", () => {
  const result = evaluateSubmitTransition({
    ownerMatches: true,
    status: "draft",
    transmissionAuthority: "ALLOWED",
    transmissionStatus: "TRANSMISSION_AUTHORIZED",
  });

  assert.equal(result.status, "SUBMITTED");
  assert.equal(result.externalDeliveryExecuted, false);
});