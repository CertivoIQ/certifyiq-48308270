const expectedSha = (process.argv[2] || process.env.EXPECTED_RELEASE_SHA || "").trim().toLowerCase();
const hosts = ["https://certivoiq.com", "https://www.certivoiq.com"];

if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  throw new Error("Expected release SHA must be a full 40-character Git commit SHA");
}

for (const host of hosts) {
  const response = await fetch(`${host}/api/public/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${host} health returned HTTP ${response.status}`);

  const body = await response.json();
  const bodySha = String(body.releaseSha || "").toLowerCase();
  const headerSha = String(response.headers.get("x-certivoiq-release-sha") || "").toLowerCase();

  if (bodySha !== expectedSha || headerSha !== expectedSha) {
    throw new Error(
      `${host} release mismatch: expected=${expectedSha} body=${bodySha || "missing"} header=${headerSha || "missing"}`,
    );
  }

  console.log(`VERIFIED ${host} releaseSha=${expectedSha}`);
}
