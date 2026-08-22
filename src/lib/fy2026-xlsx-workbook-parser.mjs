import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

/** Trusted, dependency-free XLSX parser used by the Test #61 activation path. */
export const FY2026_XLSX_PARSER_BUILD = "fy2026-xlsx-parser-2026.08.1";

const MAX_ARCHIVE_ENTRIES = 2_000;
const MAX_COMPRESSED_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_UNCOMPRESSED_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_EXPANSION_RATIO = 250;
const MAX_WORKSHEET_ROWS = 10_000;
const MAX_WORKSHEET_COLUMNS = 512;

const PROFILES = Object.freeze({
  HUD_MTSP_LIMITS_FY2026: Object.freeze({
    geography_headers: Object.freeze([
      "fips",
      "fips2010",
      "fips2025",
      "fips2026",
      "geography_id",
      "geo_id",
    ]),
    limit_header_pattern:
      /^(?:median\d*|mfi\d*|lim(?:20|30|40|50|60|70|80)_?p?[1-8]|il(?:20|30|40|50|60|70|80)_?p?[1-8]|(?:very_low|extremely_low|low_income)_?p?[1-8])$/,
  }),
  HUD_MTSP_INCOME_AVERAGING_FY2026_REV_2026_05_18: Object.freeze({
    geography_headers: Object.freeze([
      "fips",
      "fips2010",
      "fips2025",
      "fips2026",
      "geography_id",
      "geo_id",
    ]),
    limit_header_pattern:
      /^(?:lim|il)?(?:20|30|40|50|60|70|80)(?:pct|percent)?_?p?[1-8]$/,
  }),
  HUD_HOME_RENT_LIMITS_FY2026: Object.freeze({
    geography_headers: Object.freeze([
      "fips2026",
      "fips",
      "geography_id",
      "geo_id",
    ]),
    limit_header_pattern:
      /^(?:low|high|fmr|rent50|rent65|sro)(?:_|\d|br|rent|home|fmr).*/,
  }),
});

function parserBlocked(reasonCode, reason, missingInputs = [], details = {}) {
  return {
    parser_status: "BLOCKED",
    reason_code: reasonCode,
    reason,
    missing_inputs: [...new Set(missingInputs.map(String))].sort(),
    ...details,
  };
}

function bytesFrom(value) {
  return value instanceof Uint8Array ? value : null;
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

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

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8`);
  }
}

function safeArchiveName(name) {
  return (
    name &&
    !name.includes("\\") &&
    !name.startsWith("/") &&
    !name.split("/").some((part) => part === ".." || part === "")
  );
}

function findEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (readU32(bytes, offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntries(workbookBytes) {
  const eocdOffset = findEndOfCentralDirectory(workbookBytes);
  if (eocdOffset < 0) throw new Error("XLSX ZIP end-of-central-directory record is missing");
  const eocdCommentLength = readU16(workbookBytes, eocdOffset + 20);
  if (eocdOffset + 22 + eocdCommentLength !== workbookBytes.length) {
    throw new Error("XLSX archive has trailing data or an invalid ZIP comment length");
  }
  if (readU16(workbookBytes, eocdOffset + 4) !== 0 || readU16(workbookBytes, eocdOffset + 6) !== 0) {
    throw new Error("Multi-disk XLSX archives are not supported");
  }
  const entryCount = readU16(workbookBytes, eocdOffset + 10);
  const centralSize = readU32(workbookBytes, eocdOffset + 12);
  const centralOffset = readU32(workbookBytes, eocdOffset + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 XLSX archives are not supported by the controlled parser");
  }
  if (!entryCount || entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error("XLSX archive entry count is outside the controlled limit");
  }
  if (centralOffset + centralSize > eocdOffset) {
    throw new Error("XLSX central directory is outside the archive boundary");
  }

  const entries = new Map();
  const localRanges = [];
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (readU32(workbookBytes, cursor) !== 0x02014b50) {
      throw new Error("XLSX central directory contains an invalid entry signature");
    }
    const flags = readU16(workbookBytes, cursor + 8);
    const method = readU16(workbookBytes, cursor + 10);
    const expectedCrc = readU32(workbookBytes, cursor + 16);
    const compressedSize = readU32(workbookBytes, cursor + 20);
    const uncompressedSize = readU32(workbookBytes, cursor + 24);
    const nameLength = readU16(workbookBytes, cursor + 28);
    const extraLength = readU16(workbookBytes, cursor + 30);
    const commentLength = readU16(workbookBytes, cursor + 32);
    const localOffset = readU32(workbookBytes, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > centralOffset + centralSize) {
      throw new Error("XLSX central directory entry exceeds its declared boundary");
    }
    const name = decodeUtf8(
      workbookBytes.subarray(cursor + 46, cursor + 46 + nameLength),
      "XLSX entry name",
    );
    if (!safeArchiveName(name) || entries.has(name)) {
      throw new Error("XLSX archive contains an unsafe or duplicate entry name");
    }
    if (flags & 0x1) throw new Error("Encrypted XLSX entries are not supported");
    if (method !== 0 && method !== 8) {
      throw new Error("XLSX entry uses an unsupported compression method");
    }
    if (
      compressedSize > MAX_COMPRESSED_ENTRY_BYTES ||
      uncompressedSize > MAX_UNCOMPRESSED_ENTRY_BYTES ||
      (compressedSize === 0 && uncompressedSize > 0) ||
      (compressedSize > 0 && uncompressedSize / compressedSize > MAX_EXPANSION_RATIO)
    ) {
      throw new Error("XLSX entry exceeds the controlled size or expansion limit");
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error("XLSX archive exceeds the controlled uncompressed-size limit");
    }
    if (readU32(workbookBytes, localOffset) !== 0x04034b50) {
      throw new Error("XLSX local entry header is invalid");
    }
    const localFlags = readU16(workbookBytes, localOffset + 6);
    const localMethod = readU16(workbookBytes, localOffset + 8);
    const localNameLength = readU16(workbookBytes, localOffset + 26);
    const localExtraLength = readU16(workbookBytes, localOffset + 28);
    const localName = decodeUtf8(
      workbookBytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      "XLSX local entry name",
    );
    if (localName !== name || localFlags !== flags || localMethod !== method) {
      throw new Error("XLSX local and central entry metadata do not reconcile");
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > centralOffset) {
      throw new Error("XLSX entry data exceeds the archive data boundary");
    }
    const range = [localOffset, dataOffset + compressedSize];
    if (localRanges.some(([start, end]) => range[0] < end && range[1] > start)) {
      throw new Error("XLSX archive contains overlapping local entries");
    }
    localRanges.push(range);
    const compressed = workbookBytes.subarray(dataOffset, dataOffset + compressedSize);
    let content;
    try {
      content = method === 0 ? Uint8Array.from(compressed) : inflateRawSync(compressed);
    } catch {
      throw new Error("XLSX entry decompression failed");
    }
    if (content.byteLength !== uncompressedSize || crc32(content) !== expectedCrc) {
      throw new Error("XLSX entry size or CRC-32 does not match the central directory");
    }
    entries.set(name, content);
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize) {
    throw new Error("XLSX central directory size does not reconcile");
  }
  return entries;
}

function xmlText(entries, name, required = true) {
  const value = entries.get(name);
  if (!value) {
    if (!required) return null;
    throw new Error(`Required XLSX part is missing: ${name}`);
  }
  const text = decodeUtf8(value, name);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new Error(`Unsafe XML declaration is not allowed in ${name}`);
  }
  return text;
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attribute(tag, name) {
  const escaped = name.replace(":", "\\:");
  const match = new RegExp(`(?:^|\\s)${escaped}=(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return match ? decodeXml(match[1] ?? match[2]) : null;
}

function normalizePartTarget(target) {
  const raw = decodeXml(target).replace(/^\//, "");
  const prefixed = raw.startsWith("xl/") ? raw : `xl/${raw}`;
  const parts = [];
  for (const part of prefixed.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const normalized = parts.join("/");
  if (!normalized.startsWith("xl/") || !safeArchiveName(normalized)) {
    throw new Error("Workbook relationship target escapes the XLSX package");
  }
  return normalized;
}

function workbookSheet(entries) {
  const workbook = xmlText(entries, "xl/workbook.xml");
  const relationships = xmlText(entries, "xl/_rels/workbook.xml.rels");
  const rels = new Map();
  for (const tag of relationships.match(/<Relationship\b[^>]*\/?\s*>/g) ?? []) {
    const id = attribute(tag, "Id");
    const target = attribute(tag, "Target");
    const targetMode = attribute(tag, "TargetMode");
    if (targetMode === "External") throw new Error("External workbook relationships are not allowed");
    if (id && target) rels.set(id, normalizePartTarget(target));
  }
  const sheetTags = workbook.match(/<sheet\b[^>]*\/?\s*>/g) ?? [];
  for (const tag of sheetTags) {
    if (String(attribute(tag, "state") ?? "visible").toLowerCase() !== "visible") continue;
    const relationshipId = attribute(tag, "r:id");
    const target = rels.get(relationshipId);
    if (target && entries.has(target)) {
      return { name: attribute(tag, "name") ?? "Sheet1", target };
    }
  }
  throw new Error("XLSX workbook does not contain a readable visible worksheet");
}

function sharedStrings(entries) {
  const xml = xmlText(entries, "xl/sharedStrings.xml", false);
  if (!xml) return [];
  return (xml.match(/<si\b[\s\S]*?<\/si>/g) ?? []).map((item) =>
    (item.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [])
      .map((tag) => decodeXml(tag.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
      .join(""),
  );
}

function columnIndex(reference) {
  const match = /^([A-Z]+)[1-9]\d*$/.exec(reference);
  if (!match) throw new Error(`Worksheet cell reference is invalid: ${reference}`);
  let index = 0;
  for (const letter of match[1]) index = index * 26 + letter.charCodeAt(0) - 64;
  if (index > MAX_WORKSHEET_COLUMNS) throw new Error("Worksheet exceeds the controlled column limit");
  return index - 1;
}

function cellValue(cell, strings) {
  const openTag = /^<c\b[^>]*>/.exec(cell)?.[0] ?? "";
  const type = attribute(openTag, "t");
  const formula = /<f\b/.test(cell);
  if (type === "inlineStr") {
    const text = (cell.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [])
      .map((tag) => decodeXml(tag.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
      .join("");
    return { value: text, formula };
  }
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cell)?.[1];
  if (raw === undefined) {
    if (formula) throw new Error("Formula cell is missing its cached value");
    return { value: "", formula };
  }
  const value = decodeXml(raw);
  if (type === "s") {
    if (!/^\d+$/.test(value) || strings[Number(value)] === undefined) {
      throw new Error("Shared-string cell references an unavailable string");
    }
    return { value: strings[Number(value)], formula };
  }
  if (type === "b") return { value: value === "1" ? "TRUE" : "FALSE", formula };
  return { value, formula };
}

function worksheetRows(entries, target) {
  const xml = xmlText(entries, target);
  const strings = sharedStrings(entries);
  const rows = [];
  let formulaCellCount = 0;
  for (const rowXml of xml.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
    if (rows.length >= MAX_WORKSHEET_ROWS) throw new Error("Worksheet exceeds the controlled row limit");
    const row = [];
    const usedColumns = new Set();
    for (const cell of rowXml.match(/<c\b[\s\S]*?<\/c>/g) ?? []) {
      const openTag = /^<c\b[^>]*>/.exec(cell)?.[0] ?? "";
      const reference = String(attribute(openTag, "r") ?? "").toUpperCase();
      const index = columnIndex(reference);
      if (usedColumns.has(index)) throw new Error("Worksheet row contains a duplicate cell reference");
      usedColumns.add(index);
      const parsed = cellValue(cell, strings);
      row[index] = parsed.value;
      if (parsed.formula) formulaCellCount += 1;
    }
    rows.push(row);
  }
  return { rows, formulaCellCount };
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function deriveControlledRecords(rows, profile) {
  let selected = null;
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeHeader);
    const geographyIndex = headers.findIndex((header) => profile.geography_headers.includes(header));
    const limitIndexes = headers
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => profile.limit_header_pattern.test(header));
    if (geographyIndex >= 0 && limitIndexes.length > 0) {
      selected = { rowIndex, headers, geographyIndex, limitIndexes };
      break;
    }
  }
  if (!selected) throw new Error("Controlled geography and limit headers were not found on one worksheet row");
  const nonEmptyHeaders = selected.headers.filter(Boolean);
  if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) {
    throw new Error("Worksheet contains duplicate normalized header names");
  }

  const records = [];
  for (let rowIndex = selected.rowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row.some((value) => String(value ?? "").trim())) continue;
    const sourceGeography = String(row[selected.geographyIndex] ?? "").trim();
    if (!/^\d{10}$/.test(sourceGeography)) {
      throw new Error(`Worksheet row ${rowIndex + 1} has an invalid ten-digit HUD geography key`);
    }
    const limitValues = {};
    for (const { header, index } of selected.limitIndexes) {
      const value = String(row[index] ?? "").trim();
      if (!/^\d+(?:\.\d+)?$/.test(value)) {
        throw new Error(`Worksheet row ${rowIndex + 1} has an invalid value for ${header}`);
      }
      limitValues[header] = value;
    }
    records.push({
      source_geography_id: sourceGeography,
      target_geography_id: sourceGeography,
      limit_values: limitValues,
    });
  }
  if (!records.length) throw new Error("Worksheet does not contain any controlled data records");
  return {
    header_row_number: selected.rowIndex + 1,
    geography_header: selected.headers[selected.geographyIndex],
    limit_headers: selected.limitIndexes.map(({ header }) => header),
    records,
  };
}

export function parseControlledFy2026Workbook(input = {}) {
  const datasetId = String(input.dataset_id ?? "");
  const profile = PROFILES[datasetId];
  if (!profile) {
    return parserBlocked(
      "UNSUPPORTED_CONTROLLED_XLSX_PROFILE",
      "No trusted FY2026 XLSX schema profile is registered for this dataset.",
      ["dataset_id"],
    );
  }
  const bytes = bytesFrom(input.workbook_bytes);
  if (!bytes || !bytes.byteLength) {
    return parserBlocked(
      "SOURCE_WORKBOOK_BYTES_REQUIRED",
      "Actual XLSX workbook bytes are required for trusted parsing.",
      ["workbook_bytes"],
    );
  }
  try {
    const entries = readZipEntries(bytes);
    for (const required of ["[Content_Types].xml", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"]) {
      xmlText(entries, required);
    }
    const sheet = workbookSheet(entries);
    const parsedSheet = worksheetRows(entries, sheet.target);
    const derived = deriveControlledRecords(parsedSheet.rows, profile);
    return {
      parser_status: "PARSED",
      parser_build: FY2026_XLSX_PARSER_BUILD,
      dataset_id: datasetId,
      workbook_sha256: createHash("sha256").update(bytes).digest("hex"),
      sheet_name: sheet.name,
      sheet_part: sheet.target,
      header_row_number: derived.header_row_number,
      geography_header: derived.geography_header,
      limit_headers: derived.limit_headers,
      record_count: derived.records.length,
      formula_cell_count: parsedSheet.formulaCellCount,
      records: derived.records,
    };
  } catch (error) {
    return parserBlocked(
      "CONTROLLED_XLSX_PARSE_FAILED",
      error instanceof Error ? error.message : "Controlled XLSX parsing failed.",
      ["workbook_bytes"],
      { dataset_id: datasetId },
    );
  }
}
