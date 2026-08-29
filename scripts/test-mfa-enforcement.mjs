import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("MFA-enrolled sessions are forced through an AAL2 challenge", () => {
  const auth = read("src/routes/auth.tsx");
  const authenticatedRoute = read("src/routes/_authenticated/route.tsx");

  assert.match(auth, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(auth, /factor\.status === "verified"/);
  assert.match(auth, /aalData\?\.currentLevel !== "aal2"/);
  assert.match(authenticatedRoute, /hasVerifiedFactor && aal\?\.currentLevel !== "aal2"/);
  assert.match(authenticatedRoute, /redirect\(\{ to: "\/auth"/);
});

test("recovery codes have 60 bits of alphabet entropy and a dedicated input", () => {
  const recovery = read("src/utils/mfa.functions.ts");
  const security = read("src/routes/_authenticated/account.security.tsx");

  assert.match(recovery, /randomBytes\(12\)/);
  assert.match(recovery, /out\.slice\(8, 12\)/);
  assert.match(recovery, /data\.code\.length < 14/);
  assert.match(security, /disableRecoveryCode\.length !== 14/);
  assert.match(security, /placeholder="XXXX-XXXX-XXXX"/);
});

test("PHA owners and admins can reach account security", () => {
  const shell = read("src/components/app-shell.tsx");
  assert.match(
    shell,
    /\{ to: "\/account\/security", label: "Account Security", icon: ShieldCheck, key: "owner_admin" \}/,
  );
});
