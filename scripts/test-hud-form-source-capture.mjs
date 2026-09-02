import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isOfficialHudUrl } from "./capture-hud-form-sources.mjs";

const inventory = JSON.parse(
  await readFile(new URL("../src/lib/hud-form-source-inventory.json", import.meta.url)),
);

test("HUD source inventory includes the controlled core form set", () => {
  const ids = new Set(inventory.sources.map((source) => source.source_id));
  for (const required of [
    "HUD-50059-2014",
    "HUD-50059-A-2014",
    "HUD-9887-PACKAGE-2007",
    "HUD-9834-2016",
    "HUD-50058-2024-NON-MTW",
    "HUD-50058-2024-MTW",
    "HUD-50058-2024-MTW-EXPANSION",
    "HUD-50058-INSTRUCTION-BOOKLET-2026",
  ]) assert.ok(ids.has(required), `missing ${required}`);
});

test("HUD source inventory includes distinct lease and resident-notice families", () => {
  const ids = new Set(inventory.sources.map((source) => source.source_id));
  for (const required of [
    "HUD-90105-A-2007",
    "HUD-90105-B-2007",
    "HUD-90105-C-2007",
    "HUD-90105-D-2007",
    "HUD-90100-2007",
    "HUD-5380-2028",
    "HUD-5382-2028",
    "HUD-5383-2028",
  ]) assert.ok(ids.has(required), `missing ${required}`);
  assert.equal(inventory.sources.length, 16);
});

test("capture accepts only HTTPS HUD-owned hosts", () => {
  assert.equal(isOfficialHudUrl("https://www.hud.gov/sites/documents/50059.pdf"), true);
  assert.equal(isOfficialHudUrl("https://hud.gov/example.pdf"), true);
  assert.equal(isOfficialHudUrl("http://www.hud.gov/example.pdf"), false);
  assert.equal(isOfficialHudUrl("https://hud.gov.example.com/example.pdf"), false);
  assert.equal(isOfficialHudUrl("https://example.com/example.pdf"), false);
});

test("capture inventory cannot authorize decision use or support promotion", () => {
  assert.match(inventory.activation_policy, /SOURCE CAPTURE ONLY/i);
  assert.match(inventory.activation_policy, /do not authorize compliance decision use/i);
  assert.match(inventory.activation_policy, /do not.*support_status/i);
  for (const source of inventory.sources) {
    assert.ok(isOfficialHudUrl(source.url));
    assert.ok(Array.isArray(source.form_codes) && source.form_codes.length > 0);
    assert.ok(source.revision_label);
  }
});
