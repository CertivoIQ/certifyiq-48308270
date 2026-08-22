import assert from "node:assert/strict";
import test from "node:test";

import {
  FY2026_XLSX_PARSER_BUILD,
  parseControlledFy2026Workbook,
} from "../src/lib/fy2026-xlsx-workbook-parser.mjs";

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value) {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function join(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function storedZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const content = encoder.encode(text);
    const checksum = crc32(content);
    const local = join([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(content.length),
      u32(content.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      content,
    ]);
    localParts.push(local);
    centralParts.push(
      join([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(checksum),
        u32(content.length),
        u32(content.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(localOffset),
        nameBytes,
      ]),
    );
    localOffset += local.length;
  }
  const central = join(centralParts);
  return join([
    ...localParts,
    central,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centralParts.length),
    u16(centralParts.length),
    u32(central.length),
    u32(localOffset),
    u16(0),
  ]);
}

function inlineCell(reference, value) {
  return `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function numericCell(reference, value, formula = null) {
  return `<c r="${reference}">${formula ? `<f>${formula}</f>` : ""}<v>${value}</v></c>`;
}

function sharedCell(reference, index) {
  return `<c r="${reference}" t="s"><v>${index}</v></c>`;
}

function workbookFixture({
  headers = ["fips", "lim50_1", "lim60_1"],
  external = false,
  useSharedStrings = false,
} = {}) {
  const shared = [...headers, "5400100000", "5400300000"];
  const headerCells = headers
    .map((header, index) =>
      useSharedStrings
        ? sharedCell(`${String.fromCharCode(65 + index)}1`, index)
        : inlineCell(`${String.fromCharCode(65 + index)}1`, header),
    )
    .join("");
  const rows = [
    `<row r="1">${headerCells}</row>`,
    `<row r="2">${useSharedStrings ? sharedCell("A2", headers.length) : inlineCell("A2", "5400100000")}${numericCell("B2", "61039.99999999999")}${numericCell("C2", "73248")}</row>`,
    `<row r="3">${useSharedStrings ? sharedCell("A3", headers.length + 1) : inlineCell("A3", "5400300000")}${numericCell("B3", "62500", "125000/2")}${numericCell("C3", "75000")}</row>`,
  ].join("");
  const files = {
    "[Content_Types].xml": "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"></Types>",
    "xl/workbook.xml": "<?xml version=\"1.0\"?><workbook xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Limits\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>",
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="${external ? "https://example.com/sheet.xml" : "worksheets/sheet1.xml"}"${external ? ' TargetMode="External"' : ""}/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`,
  };
  if (useSharedStrings) {
    files["xl/sharedStrings.xml"] =
      `<?xml version="1.0"?><sst>${shared.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`;
  }
  return storedZip(files);
}

test("parses controlled rows directly from XLSX bytes", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: workbookFixture(),
  });
  assert.equal(result.parser_status, "PARSED");
  assert.equal(result.parser_build, FY2026_XLSX_PARSER_BUILD);
  assert.equal(result.sheet_name, "Limits");
  assert.equal(result.record_count, 2);
  assert.equal(result.formula_cell_count, 1);
  assert.equal(result.records[0].limit_values.lim50_1, "61039.99999999999");
  assert.equal(result.records[1].source_geography_id, "5400300000");
  assert.match(result.workbook_sha256, /^[a-f0-9]{64}$/);
});

test("parses shared-string headers and geography keys", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: workbookFixture({ useSharedStrings: true }),
  });
  assert.equal(result.parser_status, "PARSED");
  assert.equal(result.record_count, 2);
  assert.equal(result.records[0].source_geography_id, "5400100000");
});

test("rejects bytes whose ZIP content no longer matches its CRC", () => {
  const bytes = Buffer.from(workbookFixture());
  const position = bytes.indexOf("61039.99999999999");
  assert.ok(position > 0);
  bytes[position] = "7".charCodeAt(0);
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: bytes,
  });
  assert.equal(result.parser_status, "BLOCKED");
  assert.equal(result.reason_code, "CONTROLLED_XLSX_PARSE_FAILED");
  assert.match(result.reason, /CRC-32/);
});

test("rejects external workbook relationships", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: workbookFixture({ external: true }),
  });
  assert.equal(result.parser_status, "BLOCKED");
  assert.match(result.reason, /External workbook relationships/);
});

test("rejects duplicate normalized controlled headers", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: workbookFixture({ headers: ["fips", "lim50-1", "lim50 1"] }),
  });
  assert.equal(result.parser_status, "BLOCKED");
  assert.match(result.reason, /duplicate normalized header/);
});

test("rejects unregistered dataset profiles", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "CALLER_DEFINED_DATASET",
    workbook_bytes: workbookFixture(),
  });
  assert.equal(result.parser_status, "BLOCKED");
  assert.equal(result.reason_code, "UNSUPPORTED_CONTROLLED_XLSX_PROFILE");
});

test("rejects unsafe archive paths before reading workbook parts", () => {
  const result = parseControlledFy2026Workbook({
    dataset_id: "HUD_MTSP_LIMITS_FY2026",
    workbook_bytes: storedZip({ "../evil.xml": "bad" }),
  });
  assert.equal(result.parser_status, "BLOCKED");
  assert.match(result.reason, /unsafe or duplicate entry name/);
});
