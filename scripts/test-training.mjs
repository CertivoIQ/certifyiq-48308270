import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const lessons = JSON.parse(read("src/lib/training/lessons.json"));
const source = read("src/lib/training/catalog.ts").replace('import lessonData from "./lessons.json";', `const lessonData = ${JSON.stringify(lessons)};`);
const { filterTrainingLessons, parseTrainingProgress } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const routeFiles = readdirSync(new URL("../src/routes", import.meta.url), { recursive: true }).map(path=>path.replaceAll('\\','/')).filter((path) => path.endsWith(".tsx"));
const systemRoutes = new Set(["__root.tsx", "index.tsx", "_authenticated/route.tsx"]);
const urlFor = (file) => "/" + file.replace(/^_authenticated\//, "").replace(/\.tsx$/, "").replaceAll(".", "/").replace(/\/index$/, "");
const routes = routeFiles.filter((file) => !systemRoutes.has(file)).map(urlFor);

test("every user-facing page has a training walkthrough", () => {
  const covered = new Set(lessons.flatMap((lesson) => lesson.coveredRoutes));
  assert.deepEqual(routes.filter((route) => !covered.has(route)), []);
});

test("lesson links resolve to real static starting pages and IDs are unique", () => {
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, lessons.length);
  for (const lesson of lessons) {
    assert.ok(routes.includes(lesson.href), lesson.href);
    assert.ok(!lesson.href.includes("$"), "Do not invent record identifiers");
    assert.match(lesson.id, /^[a-z0-9-]+$/);
    assert.ok(lesson.steps.length >= 3);
    assert.ok(lesson.steps.every((step) => step.title && step.instruction.length > 30));
  }
});

test("staff guides are excluded from customer search and filters", () => {
  assert.equal(filterTrainingLessons(false, "", "staff").length, 0);
  assert.ok(filterTrainingLessons(false).every((lesson) => lesson.audience !== "staff"));
  assert.ok(filterTrainingLessons(true, "", "staff").length > 0);
  assert.ok(filterTrainingLessons(true, "", "multifamily").every((lesson) => lesson.audience === "all"));
});

test("search matches tab names and combines topic and workspace filters", () => {
  assert.ok(filterTrainingLessons(false, "jobs pay").some((lesson) => lesson.href === "/income-calculator"));
  assert.equal(filterTrainingLessons(false, "rfta", "pha", "PHA workflows").length, 0);
  assert.ok(filterTrainingLessons(false, "rfta", "pha", "PHA workflows", true).some((lesson) => lesson.href === "/pha-hcv-lease-up"));
  assert.equal(filterTrainingLessons(false, "rfta", "multifamily").length, 0);
  assert.equal(filterTrainingLessons(false, "no-such-training-xyz").length, 0);
});

test("progress ignores corrupt, obsolete, duplicate, and non-string values", () => {
  assert.deepEqual(parseTrainingProgress("not json"), []);
  assert.deepEqual(parseTrainingProgress('{"training":true}'), []);
  assert.deepEqual(parseTrainingProgress('["training","unknown",42,null,"training"]'), ["training"]);
});

test("all calculator tabs and TIC parts have explicit steps", () => {
  const calculator = lessons.find((lesson) => lesson.href === "/income-calculator");
  for (const title of ["Household", "Jobs & Pay", "Other Income & Assets", "Prior 12 Months", "Program Adjustments", "Property Rule Setup / Program Rule Inputs", "Results & Review"]) {
    assert.ok(calculator.steps.some((step) => step.title === title), title);
  }
  const tic = lessons.find((lesson) => lesson.title.startsWith("TIC Review Form"));
  for (const part of ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"]) assert.ok(tic.steps.some((step) => step.title.startsWith(`Part ${part} ·`)));
});

test("sample pages and setup-only integrations disclose their actual status", () => {
  for (const path of ["/findings", "/copilot", "/portfolio-compliance", "/audit-simulator", "/demo-dashboard"]) assert.equal(lessons.find((lesson) => lesson.href === path).status, "demonstration");
  assert.equal(lessons.find((lesson) => lesson.href === "/pms-hub").status, "setup");
  assert.ok(!JSON.stringify(lessons).match(/malfunctions|final review ready|human|\bAI\b/i));
});
