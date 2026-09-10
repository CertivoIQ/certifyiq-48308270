#!/usr/bin/env node

/**
 * CertivoIQ Cloudflare live-response cutover gate.
 *
 * Usage:
 *   node scripts/verify-cloudflare-live-response.mjs https://candidate.example.workers.dev
 *   CLOUDFLARE_CANDIDATE_URL=https://candidate.example.workers.dev \
 *     node scripts/verify-cloudflare-live-response.mjs
 *
 * This verifier is intentionally read-only. It performs GET requests against three
 * response classes and fails closed if Cloudflare routing or the launch response
 * security boundary cannot be verified directly from the live response.
 */

const rawTarget = process.argv[2] || process.env.CLOUDFLARE_CANDIDATE_URL;

if (!rawTarget) {
  console.error(
    "FAIL: Provide the candidate URL as argv[2] or CLOUDFLARE_CANDIDATE_URL.",
  );
  process.exit(2);
}

let baseUrl;
try {
  baseUrl = new URL(rawTarget);
} catch {
  console.error(`FAIL: Invalid candidate URL: ${rawTarget}`);
  process.exit(2);
}

if (baseUrl.protocol !== "https:") {
  console.error("FAIL: Candidate URL must use HTTPS.");
  process.exit(2);
}

baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
baseUrl.search = "";
baseUrl.hash = "";

const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const probes = [
  { name: "document/root", path: "/" },
  { name: "static/file", path: "/favicon.ico" },
  { name: "missing/error-class", path: `/__cloudflare-cutover-probe-${nonce}` },
];

const requiredHeaders = [
  {
    name: "strict-transport-security",
    validate(value) {
      const normalized = value.toLowerCase().replace(/\s+/g, "");
      return (
        normalized.includes("max-age=63072000") &&
        normalized.includes("includesubdomains") &&
        normalized.includes("preload")
      );
    },
    expected: "max-age=63072000; includeSubDomains; preload",
  },
  {
    name: "x-content-type-options",
    validate: (value) => value.toLowerCase().trim() === "nosniff",
    expected: "nosniff",
  },
  {
    name: "referrer-policy",
    validate: (value) =>
      value.toLowerCase().trim() === "strict-origin-when-cross-origin",
    expected: "strict-origin-when-cross-origin",
  },
  {
    name: "x-frame-options",
    validate: (value) => value.toLowerCase().trim() === "deny",
    expected: "DENY",
  },
  {
    name: "permissions-policy",
    validate: (value) => {
      const normalized = value.toLowerCase().replace(/\s+/g, "");
      return ["camera=()", "microphone=()", "geolocation=()", "usb=()"].every(
        (directive) => normalized.includes(directive),
      );
    },
    expected: "camera=(), microphone=(), geolocation=(), usb=()",
  },
  {
    name: "content-security-policy",
    validate: (value) => /(?:^|;)\s*frame-ancestors\s+'none'\s*(?:;|$)/i.test(value),
    expected: "frame-ancestors 'none'",
  },
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`  FAIL: ${message}`);
}

function pass(message) {
  console.log(`  PASS: ${message}`);
}

async function probe({ name, path }) {
  const url = new URL(path, `${baseUrl.toString()}/`);
  console.log(`\n[${name}] ${url}`);

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "CertivoIQ-Cloudflare-Cutover-Gate/1.0",
      },
    });
  } catch (error) {
    fail(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  console.log(`  HTTP ${response.status}`);

  const cfRay = response.headers.get("cf-ray");
  const server = response.headers.get("server") || "";
  if (cfRay || server.toLowerCase().includes("cloudflare")) {
    pass(
      `Cloudflare edge observed${cfRay ? ` (cf-ray: ${cfRay})` : ` (server: ${server})`}.`,
    );
  } else {
    fail("Cloudflare edge could not be verified (no cf-ray or Cloudflare server header)." );
  }

  for (const requirement of requiredHeaders) {
    const value = response.headers.get(requirement.name);
    if (!value) {
      fail(`${requirement.name} is missing; expected ${requirement.expected}.`);
      continue;
    }

    if (!requirement.validate(value)) {
      fail(`${requirement.name}=${JSON.stringify(value)}; expected ${requirement.expected}.`);
      continue;
    }

    pass(`${requirement.name}: ${value}`);
  }

  // Consume a bounded portion of the body so connection-level failures do not pass
  // merely because headers arrived. The body content itself is not persisted.
  try {
    const reader = response.body?.getReader();
    if (reader) {
      let total = 0;
      while (total < 64 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value?.byteLength || 0;
      }
      await reader.cancel().catch(() => {});
    }
    pass("Response body was readable from the live candidate.");
  } catch (error) {
    fail(`Response body read failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`CertivoIQ Cloudflare live-response gate`);
console.log(`Candidate: ${baseUrl.toString()}`);

for (const probeSpec of probes) {
  await probe(probeSpec);
}

console.log("\n----------------------------------------");
if (failed) {
  console.error("CLOUDFLARE LIVE RESPONSE GATE: FAIL");
  console.error("Do not cut over certivoiq.com from this candidate.");
  process.exit(1);
}

console.log("CLOUDFLARE LIVE RESPONSE GATE: PASS");
console.log("Live Cloudflare routing and response-security boundary verified.");
