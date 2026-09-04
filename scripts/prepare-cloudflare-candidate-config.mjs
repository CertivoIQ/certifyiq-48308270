#!/usr/bin/env node

/**
 * Prepare a deployment-safe, isolated Cloudflare candidate config from Nitro's
 * generated Wrangler config.
 *
 * The generated config is never modified in place. The candidate config:
 * - uses a distinct Worker name;
 * - cannot contain production routes/custom domains;
 * - forces workers.dev + preview URLs on;
 * - runs the Worker first so src/server.ts can explicitly dispatch /assets/*
 *   to the Cloudflare Static Assets binding before Nitro SSR;
 * - removes Node compatibility enable-flags that Cloudflare makes implicit for
 *   compatibility dates >= 2026-08-04 (where explicitly setting them is invalid).
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const NODE_COMPAT_DEFAULT_DATE = "2026-08-04";
const DEFAULT_SOURCE = ".output/server/wrangler.json";
const DEFAULT_DESTINATION = ".output/server/wrangler.candidate.json";
const PRODUCTION_AUTO_NAME = "watkin5-certifyiq-48308270";

const sourcePath = resolve(process.argv[2] || DEFAULT_SOURCE);
const destinationPath = resolve(process.argv[3] || DEFAULT_DESTINATION);
const candidateName = (
  process.argv[4] ||
  process.env.CLOUDFLARE_CANDIDATE_WORKER_NAME ||
  ""
).trim();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

if (!candidateName) fail("A dedicated candidate Worker name is required.");
if (!/^[a-z0-9-]+$/.test(candidateName)) {
  fail("Candidate Worker name must contain only lowercase letters, digits, and hyphens.");
}
if (candidateName === PRODUCTION_AUTO_NAME) {
  fail(`Candidate Worker name must not equal the production/generated Worker name (${PRODUCTION_AUTO_NAME}).`);
}

let config;
try {
  config = JSON.parse(await readFile(sourcePath, "utf8"));
} catch (error) {
  fail(`Unable to read generated Wrangler config: ${error instanceof Error ? error.message : String(error)}`);
}

if (!config || typeof config !== "object" || Array.isArray(config)) {
  fail("Generated Wrangler config must be a JSON object.");
}
if (!isDate(config.compatibility_date)) {
  fail("Generated Wrangler config has no valid YYYY-MM-DD compatibility_date.");
}

const forbiddenRouteKeys = ["route", "routes", "custom_domains"];
for (const key of forbiddenRouteKeys) {
  if (key in config) fail(`Generated Wrangler config contains forbidden candidate routing key: ${key}.`);
}

const candidate = structuredClone(config);
candidate.name = candidateName;
candidate.workers_dev = true;
candidate.preview_urls = true;

if (!candidate.assets || typeof candidate.assets !== "object" || Array.isArray(candidate.assets)) {
  fail("Generated Wrangler config must contain an assets object for the Nitro deployment.");
}
if (!candidate.assets.binding || !candidate.assets.directory) {
  fail("Generated Wrangler assets config must contain both binding and directory.");
}
// Keep Worker-first routing deterministic. src/server.ts intercepts /assets/*
// and dispatches it to env.ASSETS.fetch(request) before Nitro handles SSR.
candidate.assets.run_worker_first = true;

const flags = Array.isArray(candidate.compatibility_flags)
  ? candidate.compatibility_flags.filter((flag) => typeof flag === "string")
  : [];

if (candidate.compatibility_date >= NODE_COMPAT_DEFAULT_DATE) {
  candidate.compatibility_flags = flags.filter(
    (flag) => flag !== "nodejs_compat" && flag !== "nodejs_compat_v2",
  );
} else {
  candidate.compatibility_flags = flags;
}

for (const key of forbiddenRouteKeys) {
  if (key in candidate) {
    fail(`Candidate config unexpectedly contains forbidden routing key after preparation: ${key}.`);
  }
}

await writeFile(destinationPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");

console.log(`PASS: candidate config written to ${destinationPath}`);
console.log(`Candidate Worker: ${candidate.name}`);
console.log(`Compatibility date: ${candidate.compatibility_date}`);
console.log(`Workers.dev enabled: ${candidate.workers_dev === true}`);
console.log(`Preview URLs enabled: ${candidate.preview_urls === true}`);
console.log(`Worker-first asset routing: ${candidate.assets.run_worker_first === true}`);
console.log(
  `Compatibility flags: ${candidate.compatibility_flags.length ? candidate.compatibility_flags.join(", ") : "(none)"}`,
);
console.log("Production routes/custom domains: none");
