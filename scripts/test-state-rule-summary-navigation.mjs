import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/routes/_authenticated/state-rule-validation.tsx", import.meta.url), "utf8");
assert.match(source, /label: "Pending verifications"/);
assert.match(source, /open: \(\) => openSources\("active"\)/);

const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup({ error = null, loading = false } = {}) {
  let cursor = 0;
  const state = [];
  const mutations = [];
  let options;
  const makeSource = (id, status, candidateStatus = "CAPTURED") => ({ id, state_code: "AZ", scope: "STATEWIDE", authority_name: id, source_type: "MANUAL", source_url: `https://example.gov/${id}.pdf`, agent_verification_status: status, candidate_status: candidateStatus, verification_evidence: {} });
  const data = {
    packs: [
      { id: "az", state_code: "AZ", status: "awaiting_second_verification", compliance_activation_allowed: false },
      { id: "ma", state_code: "MA", status: "verified", compliance_activation_allowed: true },
      { id: "us", state_code: "US", status: "verified" },
    ],
    activations: [
      { pack_candidate_id: "az", state_code: "AZ", sources_ready: true, activation_recorded: false, viewer_can_activate: false, first_reviewer_count: 1 },
      { pack_candidate_id: "ma", state_code: "MA", sources_ready: true, activation_recorded: true },
      { pack_candidate_id: "ny", state_code: "NY", sources_ready: false, activation_recorded: false },
    ],
    sources: [makeSource("verified", "verified"), makeSource("blocked", "blocked"), makeSource("rejected", "rejected"), makeSource("redundant", "rejected", "EXCLUDED_REDUNDANT_SOURCE"), makeSource("captured", "captured_unvalidated")],
  };
  const jsx = (type, props) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {} });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial; return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }]; },
      useMemo: (fn) => fn(), useRef: () => ({ current: null }),
    },
    "@tanstack/react-router": { createFileRoute: () => (config) => { options = config; return { useSearch: () => ({ state: "AZ", status: "active" }) }; } },
    "@tanstack/react-query": { useQueryClient: () => ({}), useQuery: () => ({ data, error, isLoading: loading }), useMutation: () => ({ mutate: (value) => mutations.push(value) }) },
    "@/hooks/use-crm-staff-authority": { useCrmStaffAuthority: () => ({ canManageStaff: true, isCrmAdmin: true, loading: false }) },
    "@/integrations/supabase/client": { supabase: {} }, sonner: { toast: {} },
  };
  vm.runInNewContext(code, { exports: {}, require: (name) => mocks[name] ?? new Proxy({}, { get: (_, key) => String(key) }), requestAnimationFrame: (fn) => fn() });
  const render = () => { cursor = 0; return options.component(); };
  return { render, mutations, options };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const clickTile = (app, label) => find(app.render(), (n) => n.props["aria-label"] === `View ${label}`).props.onClick();
const sourceIds = (app) => nodes(app.render()).filter((n) => n.type === "SourceReviewCard").map((n) => n.props.source.id);

test("each summary opens its matching records without any mutation", () => {
  const app = setup();
  clickTile(app, "verified sources");
  assert.deepEqual(sourceIds(app), ["verified"]);
  clickTile(app, "blocked / rejected");
  assert.deepEqual(sourceIds(app), ["blocked", "rejected", "redundant"]);
  clickTile(app, "pending verifications");
  assert.deepEqual(sourceIds(app), ["blocked", "rejected", "captured"]);
  assert.equal(find(app.render(), (n) => n.type === "Stat" && n.props.label === "Pending verifications").props.value, 3);
  clickTile(app, "state packs");
  assert.equal(nodes(app.render()).filter((n) => n.type === "li").length, 2);
  clickTile(app, "compliance active");
  assert.equal(nodes(app.render()).filter((n) => n.type === "li").length, 1);
  assert.deepEqual(app.mutations, []);
});

test("Agent-activation count and list exclude completed and unready packs", () => {
  const app = setup();
  clickTile(app, "agent activation");
  const tree = app.render();
  assert.equal(find(tree, (n) => n.type === "Stat" && n.props.label === "Agent activation").props.value, "1/2");
  assert.equal(nodes(tree).filter((n) => n.type === "li").length, 1);
  assert.equal(sourceIds(app).length, 0);
  assert.equal(find(tree, (n) => n.type === "Button" && nodes(n).some((child) => child.props?.children === "Activate state pack")), undefined);
  const open = find(tree, (n) => n.type === "Button" && n.props.variant === "outline");
  open.props.onClick();
  assert.equal(sourceIds(app).length, 5);
  assert.deepEqual(app.mutations, []);
});

test("summary selection resets stale search and jurisdiction filters", () => {
  const app = setup();
  find(app.render(), (n) => n.props.id === "source-search").props.onChange({ target: { value: "no-match" } });
  assert.equal(sourceIds(app).length, 0);
  clickTile(app, "verified sources");
  assert.deepEqual(sourceIds(app), ["verified"]);
  assert.equal(find(app.render(), (n) => n.props.id === "state-filter").props.value, "ALL");
  assert.equal(find(app.render(), (n) => n.props.id === "source-search").props.value, "");
});

test("tiles are keyboard-native buttons and disabled until data is available", () => {
  for (const condition of [{ loading: true }, { error: new Error("offline") }]) {
    const tiles = nodes(setup(condition).render()).filter((n) => n.props["aria-controls"] === "validation-records");
    assert.equal(tiles.length, 6);
    assert.ok(tiles.every((n) => n.type === "button" && n.props.type === "button" && n.props.disabled));
  }
});

