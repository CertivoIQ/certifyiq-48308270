import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const shell = read("src/components/app-shell.tsx");
const dashboardAccess = read("src/hooks/use-platform-dashboard-access.ts");
const billing = read("src/routes/_authenticated/billing.tsx");
const uploadRoute = read("src/routes/upload-certification.tsx");
const certificationUpload = read("src/components/certification-upload-panel.tsx");
const propertiesRoute = read("src/routes/properties.index.tsx");
const portfolioOnboarding = read("src/components/portfolio-onboarding-panel.tsx");
const dashboardRoute = read("src/routes/_authenticated/dashboard.tsx");
const launchpad = read("src/routes/launchpad.tsx");
const hotmaRoute = read("src/routes/hotma-readiness.tsx");


test("founder keeps all dashboard modes independent of staff-role resolution", () => {
  assert.match(dashboardAccess, /FOUNDER_EMAIL\s*=\s*"rjwatkins@certivoiq\.com"/);
  assert.match(dashboardAccess, /const isFounder = user\?\.email/);
  assert.match(dashboardAccess, /const allowedModes = isFounder \? DASHBOARD_ORDER : entitledModes/);
  assert.doesNotMatch(dashboardAccess, /isStaff\s*\?\s*DASHBOARD_ORDER/);
  assert.match(shell, /PLATFORM_DASHBOARD_LABELS/);
  assert.match(shell, /aria-label="Platform dashboard"/);
});


test("command center puts dedicated certification upload and OCR first", () => {
  const multifamilyCommand = shell.indexOf("const MF_COMMAND");
  const phaCommand = shell.indexOf("const PHA_COMMAND");
  assert.ok(multifamilyCommand >= 0 && phaCommand >= 0);
  assert.ok(shell.indexOf('to: "/upload-certification"', multifamilyCommand) < shell.indexOf('to: "/dashboard"', multifamilyCommand));
  assert.ok(shell.indexOf('to: "/upload-certification"', phaCommand) < shell.indexOf('to: "/dashboard"', phaCommand));
  assert.match(uploadRoute, /CertificationUploadPanel/);
  assert.doesNotMatch(uploadRoute, /PortfolioIntakePanel/);
  assert.match(certificationUpload, /Certification document intake/);
  assert.match(certificationUpload, /does not create properties, units, or tenant profiles/);
  assert.match(certificationUpload, /intake_type: "certification_documents"/);
});


test("portfolio and tenant intake is a separate LaunchPad onboarding task", () => {
  const mfCommand = shell.slice(shell.indexOf("const MF_COMMAND"), shell.indexOf("const MF_OPERATIONS"));
  const mfAdmin = shell.slice(shell.indexOf("const MF_ADMIN"), shell.indexOf("const HELP_NAV"));
  assert.doesNotMatch(mfCommand, /to: "\/properties"|Properties & Tenant Intake/);
  assert.match(mfAdmin, /to: "\/launchpad", label: "Onboarding & Portfolio Setup"/);
  assert.match(propertiesRoute, /PortfolioOnboardingPanel/);
  assert.doesNotMatch(propertiesRoute, /CertificationUploadPanel|PortfolioIntakePanel/);
  assert.match(portfolioOnboarding, /Portfolio & tenant onboarding/);
  assert.match(portfolioOnboarding, /certification files are not uploaded here/i);
  assert.match(launchpad, /case 3:[\s\S]*to="\/properties"/);
  assert.match(launchpad, /case 4:[\s\S]*to="\/upload-certification"/);
  assert.match(launchpad, /At least one property, unit, and tenant profile must be loaded/);
  assert.match(dashboardRoute, /customer_onboarding_progress/);
  assert.match(dashboardRoute, /data && !data\.completed_at/);
  assert.match(dashboardRoute, /to: "\/launchpad"/);
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
