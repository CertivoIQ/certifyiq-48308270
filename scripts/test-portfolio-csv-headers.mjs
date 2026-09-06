import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/portfolio-intake.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { parsePortfolioIntakeCsv: parse, PORTFOLIO_IMPORT_TEMPLATE: template } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const headers = ["property_external_id", "property_name", "state", "unit_external_id", "unit_number", "tenant_external_id", "household_name", "certification_type"];
const values = ["P-001", "Example Apartments", "TN", "U-010", "010", "T-001", "Example Household", "ANNUAL"];
const cell = (value, delimiter) => /["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replaceAll('"', '""')}"` : value;
const csv = (labels = headers, row = values, delimiter = ",", eol = "\n") =>
  [labels, row].map((record) => record.map((value) => cell(value, delimiter)).join(delimiter)).join(eol) + eol;
const baseline = parse(csv());

test("canonical onboarding headings and legacy document template still parse", () => {
  assert.equal(baseline[0].propertyExternalId, "P-001");
  assert.equal(parse(template)[0].documentFileName, "tenant-001-certification.pdf");
});

test("friendly headings, spaces, hyphens and camelCase map without changing values", () => {
  const labels = ["Property External ID", "Property Name", "State Code", "unitExternalId", "Unit-Number", "Tenant ID", "Household Name", "Certification Type"];
  assert.deepEqual(parse(csv(labels)), baseline);
});

for (const alias of ["Property ID", "Property Code", "external_property_id"]) {
  test(`${alias} maps to the stable property key`, () => {
    assert.deepEqual(parse(csv([alias, ...headers.slice(1)])), baseline);
  });
}

test("unit and resident code aliases preserve identifiers including leading zeros", () => {
  const labels = [...headers]; labels[3] = "Unit Code"; labels[5] = "Resident ID"; labels[6] = "Resident Name";
  const row = [...values]; row[0] = "0001"; row[3] = "0010"; row[5] = "000002";
  const result = parse(csv(labels, row))[0];
  assert.equal(result.propertyExternalId, "0001"); assert.equal(result.unitExternalId, "0010"); assert.equal(result.tenantExternalId, "000002");
});

test("BOM, blank lines, quoted headings and invisible header characters are tolerated", () => {
  const labels = [...headers]; labels[0] = "\u200Bproperty_external_id";
  assert.deepEqual(parse("\uFEFF\r\n\r\n" + csv(labels)), baseline);
  assert.deepEqual(parse(headers.map((value) => `"${value}"`).join(",") + "\n" + values.join(",")), baseline);
});

for (const [name, delimiter] of [["semicolon", ";"], ["tab", "\t"]]) {
  test(`${name} separated exports are recognized from their header`, () => {
    assert.deepEqual(parse(csv(headers, values, delimiter)), baseline);
    assert.deepEqual(parse(`\uFEFFsep=${delimiter}\r\n` + csv(headers, values, delimiter, "\r\n")), baseline);
  });
}

for (const [name, eol] of [["LF", "\n"], ["CRLF", "\r\n"], ["CR", "\r"]]) {
  test(`${name} line endings preserve row boundaries`, () => assert.deepEqual(parse(csv(headers, values, ",", eol)), baseline));
}

test("quoted commas, escaped quotes and embedded newlines are retained", () => {
  const row = [...values]; row[1] = 'Example, "East"'; row[6] = "Example\r\nHousehold";
  const result = parse(csv(headers, row))[0];
  assert.equal(result.propertyName, row[1]); assert.equal(result.householdName, row[6]);
});

test("semicolon inside program values does not change comma delimiter detection", () => {
  assert.deepEqual(parse(csv([...headers, "program_codes"], [...values, "LIHTC;HOME"]))[0].programCodes, ["LIHTC", "HOME"]);
  assert.deepEqual(parse(csv([...headers, "program_codes"], [...values, "LIHTC;HOME"], ";"))[0].programCodes, ["LIHTC", "HOME"]);
});

test("all genuinely missing IDs are listed together without inferring them from names", () => {
  const indexes = [0, 3, 5];
  assert.throws(() => parse(csv(headers.filter((_, i) => !indexes.includes(i)), values.filter((_, i) => !indexes.includes(i)))), (error) => {
    assert.match(error.message, /Missing required columns: property_external_id, unit_external_id, tenant_external_id/);
    assert.match(error.message, /stable property, unit, and tenant reference codes/);
    assert.match(error.message, /Download onboarding CSV/);
    return true;
  });
});

test("canonical and alias duplicates are rejected rather than silently picking a value", () => {
  assert.throws(() => parse(csv([...headers, "Property ID"], [...values, "DIFFERENT"])), /both map to property_external_id/);
  assert.throws(() => parse(csv([...headers, "property_external_id"], [...values, "DIFFERENT"])), /both map to property_external_id/);
});

test("blank IDs are never fabricated", () => {
  const row = [...values]; row[0] = "";
  assert.throws(() => parse(csv(headers, row)), /property_external_id is required/);
});

test("unrelated columns remain ignored and reordered headings preserve mapping", () => {
  assert.deepEqual(parse(csv([...headers].reverse(), [...values].reverse())), baseline);
  assert.deepEqual(parse(csv([...headers, "notes", "other_notes"], [...values, "anything", "else"])), baseline);
});

test("malformed rows and unclosed quotes are rejected before import", () => {
  assert.throws(() => parse(headers.join(",") + "\n" + '"unclosed'), /unclosed quoted value/);
  assert.throws(() => parse(csv(headers, [...values, "extra"])), /more values than column headings/);
});

test("state and certification validation remain unchanged", () => {
  const wrongState = [...values]; wrongState[2] = "Tennessee";
  assert.throws(() => parse(csv(headers, wrongState)), /state must be a two-letter code/);
  const wrongType = [...values]; wrongType[7] = "UNKNOWN";
  assert.throws(() => parse(csv(headers, wrongType)), /certification_type must be INITIAL, ANNUAL, or INTERIM/);
  assert.throws(() => parse(""), /header and at least one tenant row/);
});
