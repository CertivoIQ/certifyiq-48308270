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

function makeSource(id, overrides = {}) {
  return {
    id,
    state_code: "AK",
    scope: "STATEWIDE",
    authority_name: `authority ${id}`,
    official_domain: "example.gov",
    program: "LIHTC",
    source_type: "COMPLIANCE_MANUAL",
    source_url: `https://example.gov/${id}.pdf`,
    candidate_status: "CAPTURED",
    agent_verification_status: "verified",
    exact_bytes_captured: true,
    compliance_activation_allowed: false,
    source_sha256: "a".repeat(64),
    retrieved_at: "2026-09-01T00:00:00Z",
    verification_evidence: {},
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function setup({ state = "ALL", status = "active", sources, packs, activations } = {}) {
  let cursor = 0;
  const cells = [];
  const mutations = [];
  const mutationConfigs = [];
  const cache = new Map();
  const invalidated = [];
  const queryClient = {
    setQueryData: (key, updater) => {
      const id = JSON.stringify(key);
      const next = typeof updater === "function" ? updater(cache.get(id)) : updater;
      cache.set(id, next);
      return next;
    },
    getQueryData: (key) => cache.get(JSON.stringify(key)),
    invalidateQueries: (args) => { invalidated.push(args?.queryKey); },
  };
  let options;
  const data = {
    packs: packs ?? [
      { id: "ak", state_code: "AK", status: "verified", source_candidate_count: 3, blocked_source_count: 0, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-01T00:00:00Z" },
      { id: "ak-old", state_code: "AK", status: "verified", source_candidate_count: 3, blocked_source_count: 0, compliance_activation_allowed: false, validated_on: null, updated_at: "2024-01-01T00:00:00Z" },
      { id: "wy", state_code: "WY", status: "agent_verification_in_progress", source_candidate_count: 5, blocked_source_count: 1, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-02T00:00:00Z" },
    ],
    activations: activations ?? [
      { pack_candidate_id: "ak", state_code: "AK", inventory_generated_at: "2026-09-01T00:00:00Z", pack_status: "verified", sources_ready: false, activation_recorded: false, first_reviewer_count: 1, viewer_is_first_reviewer: false, viewer_can_activate: false, validated_on: null, activated_on: null },
      { pack_candidate_id: "wy", state_code: "WY", inventory_generated_at: "2026-09-02T00:00:00Z", pack_status: "agent_verification_in_progress", sources_ready: false, activation_recorded: false, first_reviewer_count: 0, viewer_is_first_reviewer: false, viewer_can_activate: false, validated_on: null, activated_on: null },
    ],
    sources: sources ?? [
      makeSource("verified-complete"),
      makeSource("verified-no-hash", { source_sha256: null }),
      makeSource("verified-no-bytes", { exact_bytes_captured: false }),
      makeSource("verified-no-retrieved", { retrieved_at: null }),
      makeSource("blocked", { agent_verification_status: "blocked" }),
      makeSource("rejected", { agent_verification_status: "rejected" }),
      makeSource("redundant", { agent_verification_status: "rejected", candidate_status: "EXCLUDED_REDUNDANT_SOURCE" }),
      makeSource("queued", { agent_verification_status: "queued_for_agent_verification" }),
    ],
  };
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
      createFileRoute: () => (config) => { options = config; return { useSearch: () => ({ state, status }) }; },
    },
    "@tanstack/react-query": {
      useQueryClient: () => queryClient,
      useQuery: () => ({ data, error: null, isLoading: false }),
      useMutation: (config) => {
        mutationConfigs.push(config);
        return { mutate: (value) => mutations.push(value), isPending: false };
      },
    },
    "@/hooks/use-crm-staff-authority": { useCrmStaffAuthority: () => ({ canManageStaff: true, isCrmAdmin: true, loading: false }) },
    "@/integrations/supabase/client": { supabase: {} },
    sonner: { toast: { success: () => {}, error: () => {} } },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => mocks[name] ?? new Proxy({}, { get: (_, key) => String(key) }),
    requestAnimationFrame: (fn) => fn(),
  });
  const render = () => { cursor = 0; return options.component(); };
  return { render, mutations, exports, options, mutationConfigs, queryClient, cache, invalidated, data };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const sourceIds = (app) => nodes(app.render()).filter((n) => n.type === "SourceReviewCard").map((n) => n.props.source.id);
const clickTile = (app, label) => find(app.render(), (n) => n.props["aria-label"] === `View ${label}`).props.onClick();
function flatten(children) {
  if (children === null || children === undefined || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(flatten).join("");
  if (typeof children === "object") return flatten(children.props?.children);
  return "";
}
const text = (tree) => flatten(tree);
const buttonsLabelled = (tree, label) =>
  nodes(tree).filter((n) => n.type === "Button" && flatten(n.props.children).trim() === label);

test("the source query pages past the first 1000 rows", async () => {
  const { exports } = setup();
  const size = exports.SOURCE_PAGE_SIZE;
  assert.equal(size, 1000);
  const all = Array.from({ length: size + 7 }, (_, index) => makeSource(`row-${index}`));
  const ranges = [];
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => ({
            range: (from, to) => {
              ranges.push([from, to]);
              return Promise.resolve({ data: all.slice(from, to + 1), error: null });
            },
          }),
        }),
      }),
    }),
  };
  const rows = await exports.loadAllSourceCandidates(client);
  assert.equal(rows.length, all.length);
  assert.equal(JSON.stringify(ranges), JSON.stringify([[0, 999], [1000, 1999]]));
  assert.equal(rows.map((row) => row.id).join(","), all.map((row) => row.id).join(","));
});

test("an exactly full final page still terminates on the next short page", async () => {
  const { exports } = setup();
  const size = exports.SOURCE_PAGE_SIZE;
  const all = Array.from({ length: size }, (_, index) => makeSource(`row-${index}`));
  let calls = 0;
  const client = {
    from: () => ({
      select: () => ({ order: () => ({ order: () => ({ range: (from, to) => {
        calls += 1;
        return Promise.resolve({ data: all.slice(from, to + 1), error: null });
      } }) }) }),
    }),
  };
  const rows = await exports.loadAllSourceCandidates(client);
  assert.equal(calls, 2);
  assert.equal(rows.length, size);
});

test("unresolved marks records awaiting verification and never reviewer rejections", () => {
  const { exports } = setup();
  const unresolved = (overrides) => exports.isUnresolvedSource(makeSource("x", overrides));
  assert.equal(unresolved({}), false);
  assert.equal(unresolved({ source_sha256: null }), true);
  assert.equal(unresolved({ retrieved_at: null }), true);
  assert.equal(unresolved({ exact_bytes_captured: false }), true);
  assert.equal(unresolved({ agent_verification_status: "blocked" }), true);
  assert.equal(unresolved({ agent_verification_status: "rejected" }), false);
  assert.equal(
    unresolved({ agent_verification_status: "rejected", candidate_status: "EXCLUDED_REDUNDANT_SOURCE" }),
    false,
  );
  const rejected = (overrides) => exports.isRejectedSource(makeSource("x", overrides));
  assert.equal(rejected({ agent_verification_status: "rejected" }), true);
  assert.equal(
    rejected({ agent_verification_status: "rejected", candidate_status: "EXCLUDED_REDUNDANT_SOURCE" }),
    false,
  );
  assert.equal(rejected({}), false);
});

test("Pending verifications opens the unresolved view over the full dataset", () => {
  const app = setup();
  const tile = find(app.render(), (n) => n.props["aria-label"] === "View pending verifications");
  const stat = nodes(tile).find((n) => n.type === "Stat");
  assert.equal(stat.props.value, 5, "reviewer-rejected records are not pending verifications");
  tile.props.onClick();
  assert.equal(
    sourceIds(app).sort().join(","),
    "blocked,queued,verified-no-bytes,verified-no-hash,verified-no-retrieved",
  );
  assert.equal(find(app.render(), (n) => n.props.id === "status-filter").props.value, "unresolved");
  assert.deepEqual(app.mutations, []);
});

test("the unresolved route search is honoured directly", () => {
  const app = setup({ status: "unresolved" });
  assert.equal(find(app.render(), (n) => n.props.id === "status-filter").props.value, "unresolved");
  assert.ok(!sourceIds(app).includes("rejected"));
  assert.ok(!sourceIds(app).includes("verified-complete"));
});

test("a rejected federal/shared source leaves the unresolved view for a selected state", () => {
  const sources = [
    makeSource("federal-rejected", {
      state_code: "US",
      scope: "FEDERAL_SHARED",
      agent_verification_status: "rejected",
    }),
    makeSource("ak-queued", { agent_verification_status: "queued_for_agent_verification" }),
  ];
  const app = setup({ state: "AK", status: "unresolved", sources });
  assert.deepEqual(sourceIds(app), ["ak-queued"]);
});

test("the rejected queue still lists reviewer-rejected sources", () => {
  const app = setup();
  const tile = find(app.render(), (n) => n.props["aria-label"] === "View rejected sources");
  assert.equal(nodes(tile).find((n) => n.type === "Stat").props.value, 1);
  tile.props.onClick();
  assert.ok(text(app.render()).length > 0);
  assert.deepEqual(app.mutations, []);
});

test("a successful Reject decision updates the cached queue immediately", () => {
  const app = setup();
  app.render();
  const key = ["state-rule-validation-queue"];
  app.queryClient.setQueryData(key, { packs: [], activations: [], sources: [makeSource("to-reject")] });
  const review = app.mutationConfigs.find((config) => typeof config?.onSuccess === "function");
  assert.ok(review, "the review mutation registers an onSuccess handler");
  review.onSuccess(
    { source_status: "rejected", pack_status: "verified", compliance_activation_allowed: false, validated_on: null },
    { source: makeSource("to-reject"), decision: "rejected" },
  );
  const cached = app.queryClient.getQueryData(key);
  assert.equal(cached.sources[0].agent_verification_status, "rejected");
  assert.equal(app.exports.isUnresolvedSource(cached.sources[0]), false);
  assert.equal(app.exports.isRejectedSource(cached.sources[0]), true);
  assert.ok(app.invalidated.some((k) => JSON.stringify(k) === JSON.stringify(key)));
});

test("Agent activation lists unresolved states when none are activation-ready", () => {
  const app = setup();
  const tile = find(app.render(), (n) => n.props["aria-label"] === "View agent activation");
  assert.equal(tile.props.disabled, false);
  tile.props.onClick();
  const tree = app.render();
  const items = nodes(tree).filter((n) => n.type === "li");
  assert.equal(items.length, 2, "every current state pack has a readiness row");
  assert.match(text(tree), /Unresolved requirements/);
  const activateButtons = buttonsLabelled(tree, "Activate state pack");
  assert.equal(activateButtons.length, 0, "sources_ready=false never offers activation");
  const viewUnresolved = buttonsLabelled(tree, "View unresolved requirements");
  assert.equal(viewUnresolved.length, 2);
  viewUnresolved[0].props.onClick();
  assert.equal(find(app.render(), (n) => n.props.id === "status-filter").props.value, "unresolved");
  assert.deepEqual(app.mutations, []);
});

test("a ready pack keeps its authorized activation button and skips stale candidates", () => {
  const app = setup({
    activations: [
      { pack_candidate_id: "ak", state_code: "AK", inventory_generated_at: "2026-09-01T00:00:00Z", pack_status: "verified", sources_ready: true, activation_recorded: false, first_reviewer_count: 1, viewer_is_first_reviewer: false, viewer_can_activate: true, validated_on: null, activated_on: null },
      { pack_candidate_id: "ak-old", state_code: "AK", inventory_generated_at: "2024-01-01T00:00:00Z", pack_status: "verified", sources_ready: true, activation_recorded: false, first_reviewer_count: 1, viewer_is_first_reviewer: false, viewer_can_activate: true, validated_on: null, activated_on: null },
    ],
  });
  clickTile(app, "agent activation");
  const tree = app.render();
  const activate = buttonsLabelled(tree, "Activate state pack");
  assert.equal(activate.length, 1);
  activate[0].props.onClick();
  assert.equal(app.mutations.map((row) => row.pack_candidate_id).join(","), "ak");
});

test("every summary card reveals concrete data", () => {
  const app = setup({
    packs: [
      { id: "ak", state_code: "AK", status: "verified", source_candidate_count: 3, blocked_source_count: 0, compliance_activation_allowed: true, validated_on: "2026-09-01", updated_at: "2026-09-01T00:00:00Z" },
      { id: "wy", state_code: "WY", status: "agent_verification_in_progress", source_candidate_count: 5, blocked_source_count: 1, compliance_activation_allowed: false, validated_on: null, updated_at: "2026-09-02T00:00:00Z" },
    ],
  });
  const labels = [
    "state packs",
    "agent activation",
    "compliance active",
    "pending verifications",
    "verified sources",
    "blocked",
    "rejected sources",
  ];
  for (const label of labels) {
    const tile = find(app.render(), (n) => n.props["aria-label"] === `View ${label}`);
    assert.ok(tile, `${label} tile renders`);
    assert.equal(typeof tile.props.onClick, "function");
    tile.props.onClick();
    const tree = app.render();
    const revealed =
      nodes(tree).some((n) => n.type === "SourceReviewCard") ||
      nodes(tree).some((n) => n.type === "li");
    assert.ok(revealed, `${label} reveals records`);
  }
  assert.deepEqual(app.mutations, []);
});
