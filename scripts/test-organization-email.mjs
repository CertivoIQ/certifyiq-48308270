import test from "node:test";
import assert from "node:assert/strict";
import { isOrganizationEmail } from "../src/lib/organization-email.mjs";

test("organization website domains qualify for free reviews", () => {
  assert.equal(isOrganizationEmail("compliance@examplehousing.org"), true);
  assert.equal(isOrganizationEmail("reviewer@management-company.com"), true);
  assert.equal(isOrganizationEmail("director@housingauthority.gov"), true);
});

test("personal, disposable-style, reserved, and malformed addresses are rejected", () => {
  for (const email of [
    "lead@gmail.com",
    "lead@yahoo.com",
    "lead@outlook.com",
    "lead@hotmail.com",
    "lead@icloud.com",
    "lead@protonmail.com",
    "lead@mail.com",
    "lead@example.invalid",
    "not-an-email",
  ]) {
    assert.equal(isOrganizationEmail(email), false, email);
  }
});
