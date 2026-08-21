import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isVerifiedClosedWon,
  shouldSurfacePostSaleChecklist,
  verifiedSaleTriggerReason,
} from "../src/lib/first-sale-monitor.mjs";

const base = {
  stage: "won",
  is_demo: false,
  contract_verified_at: null,
  payment_verified_at: null,
};

test("Closed Won alone does not qualify as a verified sale", () => {
  assert.equal(isVerifiedClosedWon(base), false);
});

test("demo and non-won accounts never qualify", () => {
  assert.equal(isVerifiedClosedWon({ ...base, is_demo: true, payment_verified_at: "2026-08-20" }), false);
  assert.equal(isVerifiedClosedWon({ ...base, stage: "negotiation", contract_verified_at: "2026-08-20" }), false);
});

test("contract or payment verification qualifies a real Closed Won account", () => {
  const contract = { ...base, contract_verified_at: "2026-08-20" };
  const payment = { ...base, payment_verified_at: "2026-08-20" };
  assert.equal(isVerifiedClosedWon(contract), true);
  assert.equal(isVerifiedClosedWon(payment), true);
  assert.equal(verifiedSaleTriggerReason(contract), "contract_verified");
  assert.equal(verifiedSaleTriggerReason(payment), "payment_verified");
  assert.equal(
    verifiedSaleTriggerReason({ ...contract, payment_verified_at: "2026-08-21" }),
    "contract_and_payment_verified",
  );
});

test("only active post-sale checklists surface", () => {
  assert.equal(shouldSurfacePostSaleChecklist({ status: "pending" }), true);
  assert.equal(shouldSurfacePostSaleChecklist({ status: "acknowledged" }), true);
  assert.equal(shouldSurfacePostSaleChecklist({ status: "completed" }), false);
  assert.equal(shouldSurfacePostSaleChecklist({ status: "cancelled" }), false);
});

test("migration contains demo classification and database enforcement", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260821115000_verified_first_sale_monitor.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /Wallick Communities/);
  assert.match(sql, /is_demo = true/);
  assert.match(sql, /new\.stage = 'won'/);
  assert.match(sql, /not new\.is_demo/);
  assert.match(sql, /contract_verified_at is not null or new\.payment_verified_at is not null/);
  assert.match(sql, /crm_prepare_verified_sale_trigger/);
  assert.match(sql, /crm_sync_post_sale_checklist_trigger/);
});
