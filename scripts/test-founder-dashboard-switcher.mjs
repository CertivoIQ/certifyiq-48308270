import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const access = read("src/hooks/use-platform-dashboard-access.ts");
const shell = read("src/components/app-shell.tsx");

test("CertivoIQ staff receive every existing platform dashboard", () => {
  assert.match(access, /import \{ useIsStaff, useSession \}/);
  assert.match(access, /const \{ isStaff, loading: staffLoading \} = useIsStaff\(\)/);
  assert.match(access, /const allowedModes = isStaff \? DASHBOARD_ORDER : entitledModes;/);
  assert.match(access, /loading: !!user && \(query\.isLoading \|\| staffLoading\)/);
});

test("dashboard switching persists in-session and returns to the dashboard", () => {
  assert.match(access, /window\.localStorage\.setItem\(storageKey, mode\)/);
  assert.match(shell, /aria-label="Platform dashboard"/);
  assert.match(shell, /window\.location\.assign\("\/dashboard"\)/);

  const switchStart = shell.indexOf("const switchDashboard");
  const switchEnd = shell.indexOf("return <div", switchStart);
  assert.ok(switchStart >= 0 && switchEnd > switchStart);
  assert.doesNotMatch(shell.slice(switchStart, switchEnd), /signOut|supabase\.auth/);
});

test("production can identify the grouped PHA navigation build", () => {
  assert.match(shell, /aria-label="PHA workspace navigation"/);
  assert.match(shell, /data-navigation-version="grouped-v1"/);
});
