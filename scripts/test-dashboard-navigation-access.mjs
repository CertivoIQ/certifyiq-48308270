import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const shell = read("src/components/app-shell.tsx");
const dashboardAccess = read("src/hooks/use-platform-dashboard-access.ts");
const billing = read("src/routes/_authenticated/billing.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const hotmaRoute = read("src/routes/hotma-readiness.tsx");


test("founder keeps all dashboard modes independent of staff-role resolution", () => {
  assert.match(dashboardAccess, /FOUNDER_EMAIL\s*=\s*"rjwatkins@certivoiq\.com"/);
  assert.match(dashboardAccess, /const isFounder = user\?\.email/);
  assert.match(dashboardAccess, /const allowedModes = isFounder \? DASHBOARD_ORDER : entitledModes/);
  assert.doesNotMatch(dashboardAccess, /isStaff\s*\?\s*DASHBOARD_ORDER/);
  assert.match(shell, /PLATFORM_DASHBOARD_LABELS/);
  assert.match(shell, /aria-label="Platform dashboard"/);
});


test("command center puts certification upload and OCR first", () => {
  const multifamilyCommand = shell.indexOf("const MF_COMMAND");
  const phaCommand = shell.indexOf("const PHA_COMMAND");
  assert.ok(multifamilyCommand >= 0 && phaCommand >= 0);
  assert.ok(shell.indexOf('to: "/upload-certification"', multifamilyCommand) < shell.indexOf('to: "/dashboard"', multifamilyCommand));
  assert.ok(shell.indexOf('to: "/upload-certification"', phaCommand) < shell.indexOf('to: "/dashboard"', phaCommand));
  assert.match(uploadRoute, /PortfolioIntakePanel/);
  assert.match(uploadRoute, /Upload Certification & OCR/);
});


test("PHA program work is collapsed into operations while HOTMA remains primary", () => {
  assert.match(shell, /label="Operations"/);
  assert.match(shell, /HCV Portability/);
  assert.match(shell, /HCV Lease-Up/);
  assert.match(shell, /PBV Operations/);
  assert.match(shell, /Audit Operations/);
  assert.match(shell, /to: "\/hotma-readiness", label: "HOTMA Readiness"/);
  assert.match(hotmaRoute, /PhaHotmaReadinessWorkspace/);
});


test("billing is absent for ordinary operational roles and guarded at the route", () => {
  const mfAdmin = shell.slice(shell.indexOf("const MF_ADMIN"), shell.indexOf("const HELP_NAV"));
  const phaAdmin = shell.slice(shell.indexOf("const PHA_ADMIN"), shell.indexOf("function phaNavAllowed"));
  assert.doesNotMatch(mfAdmin, /to: "\/billing"/);
  assert.doesNotMatch(phaAdmin, /to: "\/billing"/);
  assert.match(shell, /dashboardMode === "executive_demo" \|\| accessLevel === "manager" \|\| phaRole === "executive"/);
  assert.match(billing, /billingAllowed = dashboardMode === "executive_demo" \|\| accessLevel === "manager" \|\| phaRole === "executive"/);
  assert.match(billing, /Employees and property-level operational users do not receive billing controls/);
});
