import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");

test("PHA navigation is grouped into the six approved sections", () => {
  for (const label of [
    "Command Center",
    "Families & Programs",
    "Compliance",
    "Evidence & Reporting",
    "Agency Administration",
    "Help",
  ]) {
    assert.match(source, new RegExp(`label: "${label.replace(/[&]/g, "\\&")}"`));
  }

  assert.match(source, /function PhaNavSectionGroup/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /initiallyOpen=\{section\.id === "command"\}/);
});

test("unassigned PHA users do not inherit administrator navigation", () => {
  assert.match(source, /if \(!role\) return key === "command" \|\| key === "support";/);
  assert.doesNotMatch(source, /if \(!role \|\| role === "workspace_owner"/);
  assert.match(source, /Role assignment required/);
});

test("administrator and compliance navigation remain explicitly role-scoped", () => {
  assert.match(source, /role === "workspace_owner" \|\| role === "agency_admin"/);
  assert.match(source, /role === "compliance_admin"/);
  assert.match(source, /section: "evidence_reporting"/);
  assert.match(source, /section: "administration"/);
});

test("mobile PHA navigation is viewport constrained", () => {
  assert.match(source, /max-h-\[calc\(100vh-4\.5rem\)\] overflow-y-auto/);
});
