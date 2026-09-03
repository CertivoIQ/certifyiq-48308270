import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("./prepare-cloudflare-candidate-config.mjs", import.meta.url);

async function run(config, name = "certivoiq-cutover-candidate-20260903") {
  const dir = await mkdtemp(join(tmpdir(), "certivoiq-cloudflare-"));
  const source = join(dir, "wrangler.json");
  const destination = join(dir, "candidate.json");
  await writeFile(source, JSON.stringify(config), "utf8");
  const result = spawnSync(
    process.execPath,
    [script.pathname, source, destination, name],
    { encoding: "utf8" },
  );
  let candidate = null;
  if (result.status === 0) {
    candidate = JSON.parse(await readFile(destination, "utf8"));
  }
  return { ...result, candidate };
}

const baseConfig = {
  compatibility_date: "2026-09-03",
  main: "index.mjs",
  assets: { binding: "ASSETS", directory: "../public" },
  name: "watkin5-certifyiq-48308270",
  compatibility_flags: ["nodejs_compat", "no_nodejs_compat_v2"],
  no_bundle: true,
  rules: [{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }],
};

test("prepares an isolated workers.dev candidate and removes redundant Node compat enable flags", async () => {
  const result = await run(baseConfig);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.candidate.name, "certivoiq-cutover-candidate-20260903");
  assert.equal(result.candidate.workers_dev, true);
  assert.equal(result.candidate.preview_urls, true);
  assert.deepEqual(result.candidate.compatibility_flags, ["no_nodejs_compat_v2"]);
  assert.equal("route" in result.candidate, false);
  assert.equal("routes" in result.candidate, false);
  assert.equal("custom_domains" in result.candidate, false);
});

test("preserves explicit nodejs_compat before the Cloudflare default-on date", async () => {
  const result = await run({ ...baseConfig, compatibility_date: "2026-08-03" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.candidate.compatibility_flags, ["nodejs_compat", "no_nodejs_compat_v2"]);
});

test("fails closed if generated config contains a production route", async () => {
  const result = await run({ ...baseConfig, routes: [{ pattern: "certivoiq.com/*" }] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /forbidden candidate routing key: routes/i);
});

test("fails closed if candidate name equals generated production Worker name", async () => {
  const result = await run(baseConfig, "watkin5-certifyiq-48308270");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not equal the production\/generated Worker name/i);
});

test("fails closed for an invalid compatibility date", async () => {
  const result = await run({ ...baseConfig, compatibility_date: "today" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid YYYY-MM-DD compatibility_date/i);
});
