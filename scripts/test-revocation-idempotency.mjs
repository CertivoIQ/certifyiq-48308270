import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "src/utils/certification-review.functions.ts",
  "utf8",
);

test("sequential revocation retry returns idempotent success", () => {
  const retryBlock =
    /if\s*\(latestReview\.revoked_at\)\s*\{\s*return\s*\{\s*findingId:\s*finding\.id,\s*revokedAt:\s*latestReview\.revoked_at,\s*manifestSha256:\s*latestReview\.manifest_sha256,\s*alreadyRevoked:\s*true,\s*\}\s*as const;\s*\}/s;

  assert.match(
    source,
    retryBlock,
    "revoked approval retry must return alreadyRevoked=true",
  );

  assert.doesNotMatch(
    source,
    /error:\s*"The latest approval has already been revoked\."/,
  );
});
