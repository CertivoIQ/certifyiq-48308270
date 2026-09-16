import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const sourcePath = new URL("../src/routes/_authenticated/state-rule-validation.tsx", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

const STALE_AK_PACK = "ak-2024-historical";
const CURRENT_AK_PACK = "ak-current";

function verifiedSource(id, stateCode, scope = "STATEWIDE") {
  return {
    id,
    state_code: stateCode,
    scope,
    authority_name: `${stateCode} authority ${id}`,
    official_domain: "example.gov",
    program: "LIHTC",
    source_type: "COMPLIANCE_MANUAL",
    source_url: `https://example.gov/${id}.pdf`,
    candidate_status: "CAPTURED",
    agent_verification_status: "verified",
    exact_bytes_captured: true,
    compliance_activation_allowed: false,
    source_sha256: null,
    retrieved_at: null,
    verification_evidence: {},
    updated_at: "2026-09-01T00:00:00Z",
  };
}

function setup({ state = "ALL", status = "verified" } = {}) {
  let cursor = 0;
  const state_ = [];
  const mutations = [];
  let options;
  const data = {
    packs: [
      { id: STALE_AK_PACK, state_code: "AK", status: "verified", source_candidate_count: 3, blocked_source_count: 0, compliance_activation_allowed: false, validated_on: null, updated_at: "2024-01-01T00:00:00Z" },
      { id: CURRENT_AK_PACK, state_code: "AK", status: "verified", source_candidate_count: 4, blocked_source_count: 0, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-01T00:00:00Z" },
      { id: "wy-current", state_code: "WY", status: "agent_verification_in_progress", source_candidate_count: 5, blocked_source_count: 1, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-02T00:00:00Z" },
      { id: "us", state_code: "US", status: "verified", source_candidate_count: 2, blocked_source_count: 0, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-01T00:00:00Z" },
    ],
    activations: [
      { pack_candidate_id: STALE_AK_PACK, state_code: "AK", inventory_generated_at: "2024-01-01T00:00:00Z", pack_status: "verified", sources_ready: true, activation_recorded: false, first_reviewer_count: 1, viewer_is_first_reviewer: false, viewer_can_activate: true, validated_on: null, activated_on: null },
      { pack_candidate_id: CURRENT_AK_PACK, state_code: "AK", inventory_generated_at: "2026-09-01T00:00:00Z", pack_status: "verified", sources_ready: true, activation_recorded: false, first_reviewer_count: 1, viewer_is_first_reviewer: false, viewer_can_activate: true, validated_on: null, activated_on: null },
      { pack_candidate_id: "wy-current", state_code: "WY", inventory_generated_at: "2026-09-02T00:00:00Z", pack_status: "agent_verification_in_progress", sources_ready: false, activation_recorded: false, first_reviewer_count: 0, viewer_is_first_reviewer: false, viewer_can_activate: false, validated_on: null, activated_on: null },
    ],
    sources: [
      verifiedSource("ak-source", "AK"),
      verifiedSource("wy-source", "WY"),
      verifiedSource("federal-source", "US", "FEDERAL_SHARED"),
    ],
  };
  const jsx = (type, props) => ({ type: typeof type === "function" ? type.name : type, props: props ?? {} });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state_)) state_[index] = typeof initial === "function" ? initial() : initial;
        return [state_[index], (value) => { state_[index] = typeof value === "function" ? value(state_[index]) : value; }];
      },
      useMemo: (fn) => fn(),
      useRef: () => ({ current: null }),
    },
    "@tanstack/react-router": {
      createFileRoute: () => (config) => { options = config; return { useSearch: () => ({ state, status }) }; },
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({}),
      useQuery: () => ({ data, error: null, isLoading: false }),
      useMutation: () => ({ mutate: (value) => mutations.push(value), isPending: false }),
    },
    "@/hooks/use-crm-staff-authority": { useCrmStaffAuthority: () => ({ canManageStaff: true, isCrmAdmin: true, loading: false }) },
    "@/integrations/supabase/client": { supabase: {} },
    sonner: { toast: {} },
  };
  vm.runInNewContext(code, {
    exports: {},
    require: (name) => mocks[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
    requestAnimationFrame: (fn) => fn(),
  });
  const render = () => { cursor = 0; return options.component(); };
  return { render, mutations };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

const cards = (app) => nodes(app.render()).filter((node) => node.type === "SourceReviewCard");
const cardFor = (app, id) => cards(app).find((node) => node.props.source.id === id);

test("an ALL-view verified state card resolves its own state's current pack", () => {
  const app = setup();
  const card = cardFor(app, "ak-source");
  assert.ok(card, "the verified Alaska card renders in the ALL view");
  assert.ok(card.props.activation, "the Alaska card still receives its activation row in the ALL view");
  assert.equal(card.props.activation.state_code, "AK");
  assert.deepEqual(app.mutations, []);
});

test("a historical duplicate pack candidate never becomes the activation target", () => {
  const app = setup();
  assert.equal(cardFor(app, "ak-source").props.activation.pack_candidate_id, CURRENT_AK_PACK);
  const stateOptions = nodes(app.render()).filter((node) => node.type === "option" && node.props.value === "AK");
  assert.equal(stateOptions.length, 1, "only the current AK pack candidate is offered");
});

test("the inherited federal row gets no state-pack action in ALL and US views", () => {
  for (const state of ["ALL", "US"]) {
    const app = setup({ state });
    const card = cardFor(app, "federal-source");
    assert.ok(card, `the federal card renders in the ${state} view`);
    assert.equal(card.props.activation, undefined);
    assert.equal(card.props.inheritedByState, undefined);
  }
});

test("a selected state binds the inherited federal row to that state's current pack", () => {
  const app = setup({ state: "AK" });
  const card = cardFor(app, "federal-source");
  assert.equal(card.props.activation.pack_candidate_id, CURRENT_AK_PACK);
  assert.equal(card.props.inheritedByState, "AK");
});

test("an unresolved pack keeps activation blocked and offers an enabled validate action", () => {
  const app = setup();
  const card = cardFor(app, "wy-source");
  assert.equal(card.props.activation.pack_candidate_id, "wy-current");
  assert.equal(card.props.activation.sources_ready, false);
  assert.equal(card.props.activation.viewer_can_activate, false);
  card.props.onResolvePack(card.props.activation);
  assert.deepEqual(app.mutations, [], "resolving requirements never calls an activation mutation");
  const tree = app.render();
  const find = (predicate) => nodes(tree).find(predicate);
  assert.equal(find((node) => node.props.id === "state-filter").props.value, "WY");
  assert.equal(find((node) => node.props.id === "status-filter").props.value, "active");
});

test("the verified card markup keeps the validate action enabled and activation gated", () => {
  assert.match(source, /!activation\.sources_ready \? \(\s*<Button\s+type="button"\s+variant="outline"\s+onClick=\{\(\) => onResolvePack\(activation\)\}/);
  assert.match(source, /Validate \$\{activation\.state_code\} state pack/);
  assert.match(source, /disabled=\{!activation\.viewer_can_activate \|\| activationBusy\}/);
  assert.match(source, /Active Administrator authorization is required/);
  assert.match(source, /finalize_state_rule_source_rejection/);
  assert.match(source, /return_state_rule_source_to_validation/);
});