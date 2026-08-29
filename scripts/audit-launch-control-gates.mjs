import { readFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile(new URL("../config/launch-control-gates.json", import.meta.url), "utf8"),
);
const accepted = new Set(["technical_complete", "human_approved"]);
const openBlocking = config.gates.filter(
  (gate) => gate.blocking && !accepted.has(gate.status),
);
const summary = {
  total: config.gates.length,
  complete: config.gates.length - openBlocking.length,
  openBlocking: openBlocking.length,
  gates: openBlocking.map(({ id, category, status, ownerRole, action }) => ({
    id,
    category,
    status,
    ownerRole,
    action,
  })),
};

console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes("--enforce") && openBlocking.length > 0) {
  process.exitCode = 2;
}
