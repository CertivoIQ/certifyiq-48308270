import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const sourcePath = new URL("../src/routes/_authenticated/tasks.tsx", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function task(id, overrides = {}) {
  return {
    id,
    category: "verification",
    title: `task ${id}`,
    description: "description",
    status: "queued",
    active: true,
    occurredAt: "2026-09-01T00:00:00Z",
    destination: "/state-rule-validation",
    actionLabel: "Verify source",
    ...overrides,
  };
}

const DEFAULT_TASKS = [
  task("source-a", { validationStateCode: "AK" }),
  task("source-b", { validationStateCode: "WY", attention: true }),
  task("pack-ready", {
    category: "rule_pack",
    title: "Activate AK state rule pack",
    packCandidateId: "pack-ak",
    activationStateCode: "AK",
    activationReady: true,
    actionLabel: "Activate state pack",
  }),
  task("pack-blocked", {
    category: "rule_pack",
    title: "WY state rule-pack validation",
    packCandidateId: "pack-wy",
    activationStateCode: "WY",
    activationReady: false,
    validationStateCode: "WY",
    actionLabel: "Validate sources",
  }),
  task("approval-a", { category: "approval", title: "approval work", actionLabel: "Open operations", destination: "/crm/operations" }),
  task("cert-a", { category: "certification", title: "certification approval", destination: "/files", actionLabel: "Review" }),
  task("incident-a", { category: "incident", title: "open incident", attention: true, destination: "/crm/operations", actionLabel: "Resolve incident" }),
  task("done-a", { active: false, title: "completed source", status: "complete" }),
];

function setup({ tasks = DEFAULT_TASKS } = {}) {
  let cursor = 0;
  const cells = [];
  const mutations = [];
  const jsx = (type, props) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {} });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
        return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
      },
      useMemo: (fn) => fn(),
      useRef: () => ({ current: null }),
    },
    "@tanstack/react-router": {
      createFileRoute: () => (config) => config,
      Link: function Link() { return null; },
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries: () => {} }),
      useQuery: () => ({ data: tasks, error: null, isLoading: false, refetch: () => {} }),
      useMutation: () => ({ mutate: (value) => mutations.push(value), isPending: false }),
    },
    "@/hooks/use-session": { useSession: () => ({ user: { id: "u1" } }), useIsStaff: () => ({ isStaff: true, loading: false }) },
    "@/lib/internal-segment-access": { isInternalSegmentUser: () => true },
    "@/integrations/supabase/client": { supabase: {} },
    sonner: { toast: { success: () => {}, error: () => {} } },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => mocks[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
    requestAnimationFrame: (fn) => fn(),
  });
  componentRegistry = { TaskList: exports.TaskList };
  const render = () => { cursor = 0; return exports.Route.component(); };
  return { render, mutations, exports };
}

let componentRegistry = {};
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  const own = [tree];
  const expanded = componentRegistry[tree.type] ? componentRegistry[tree.type](tree.props) : null;
  return [
    ...own,
    ...nodes(tree.props?.children),
    ...nodes(tree.props?.actions),
    ...nodes(expanded),
  ];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const findAll = (tree, predicate) => nodes(tree).filter(predicate);
function flatten(children) {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(flatten).join("");
  if (typeof children === "object") return flatten(children.props?.children);
  return "";
}
const listedTitles = (app) =>
  findAll(app.render(), (n) => n.type === "li").map((n) => find(n, (c) => c.type === "h3")).map((h) => flatten(h?.props?.children));
const card = (app, label) => find(app.render(), (n) => n.props["aria-label"] === `View ${label}`);
const checkboxes = (app) => findAll(app.render(), (n) => n.type === "Checkbox");
const buttonLabelled = (tree, label) =>
  findAll(tree, (n) => n.type === "Button" && flatten(n.props.children).trim().startsWith(label));

test("summary cards are keyboard and click actionable buttons", () => {
  const app = setup();
  for (const label of ["active tasks", "awaiting approval", "verification required", "exceptions"]) {
    const tile = card(app, label);
    assert.ok(tile, `${label} renders`);
    assert.equal(tile.type, "button");
    assert.equal(tile.props.type, "button");
    assert.equal(typeof tile.props.onClick, "function");
    assert.equal(typeof tile.props["aria-pressed"], "boolean");
  }
  assert.deepEqual(app.mutations, []);
});

test("Verification required filters the active list to verification and rule packs", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  const titles = listedTitles(app);
  assert.deepEqual(titles.sort(), [
    "Activate AK state rule pack",
    "WY state rule-pack validation",
    "task source-a",
    "task source-b",
  ].sort());
  assert.equal(card(app, "verification required").props["aria-pressed"], true);
});

test("other summary cards filter their own categories and Active resets", () => {
  const app = setup();
  card(app, "awaiting approval").props.onClick();
  assert.deepEqual(listedTitles(app).sort(), ["approval work", "certification approval"]);
  card(app, "exceptions").props.onClick();
  assert.deepEqual(listedTitles(app).sort(), ["open incident", "task source-b"]);
  card(app, "active tasks").props.onClick();
  assert.equal(listedTitles(app).length, 7);
});

test("history stays available and clears the summary filter", () => {
  const app = setup();
  card(app, "exceptions").props.onClick();
  buttonLabelled(app.render(), "History")[0].props.onClick();
  assert.deepEqual(listedTitles(app), ["completed source"]);
  assert.equal(card(app, "exceptions").props["aria-pressed"], false);
});

test("every verification-required row renders a checkbox, other rows do not", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  assert.equal(checkboxes(app).length, 4);
  card(app, "awaiting approval").props.onClick();
  assert.equal(checkboxes(app).length, 0);
  assert.equal(app.exports.isSelectableTask(task("x")), true);
  assert.equal(app.exports.isSelectableTask(task("x", { category: "incident" })), false);
  assert.equal(app.exports.isSelectableTask(task("x", { active: false })), false);
});

test("selecting ordinary verification tasks never reaches activation", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  const boxes = checkboxes(app);
  boxes[0].props.onCheckedChange();
  boxes[1].props.onCheckedChange();
  const tree = app.render();
  const activate = buttonLabelled(tree, "Activate selected state packs")[0];
  assert.equal(activate.props.disabled, true);
  activate.props.onClick();
  assert.equal(find(app.render(), (n) => n.props["aria-label"] === "Task selection summary") !== undefined, true);
  assert.deepEqual(app.mutations, []);
});

test("mixed selection activates only activation-ready packs", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  for (const box of checkboxes(app)) box.props.onCheckedChange();
  const tree = app.render();
  const activate = buttonLabelled(tree, "Activate selected state packs")[0];
  assert.equal(activate.props.disabled, false);
  assert.match(flatten(activate.props.children), /1 ready, 1 not ready/);
  activate.props.onClick();
  const dialog = find(app.render(), (n) => n.type === "AlertDialogAction");
  dialog.props.onClick();
  assert.equal(app.mutations.length, 1);
  assert.deepEqual(app.mutations[0].map((pack) => pack.packCandidateId), ["pack-ak"]);
});

test("clear selection empties the selection and hides the tool area", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  checkboxes(app)[0].props.onCheckedChange();
  assert.ok(find(app.render(), (n) => n.props["aria-label"] === "Task selection summary"));
  buttonLabelled(app.render(), "Clear selection")[0].props.onClick();
  assert.equal(find(app.render(), (n) => n.props["aria-label"] === "Task selection summary"), undefined);
  assert.equal(buttonLabelled(app.render(), "Clear selection").length, 0);
});

test("verification links open unresolved requirements", () => {
  const app = setup();
  card(app, "verification required").props.onClick();
  const links = findAll(app.render(), (n) => n.type === "Link" && n.props.search);
  assert.ok(links.length);
  for (const link of links) assert.equal(link.props.search.status, "unresolved");
});