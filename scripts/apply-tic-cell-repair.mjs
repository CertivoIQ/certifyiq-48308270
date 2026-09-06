/** Apply only reviewed, exact source edits. No network, database, deployment, or credentials. */
import { readFileSync, writeFileSync } from 'node:fs';
const plan = new Map();
const marker = '// TIC_CELL_REPAIR_V1';
function source(path) {
  if (!plan.has(path)) plan.set(path, { original: readFileSync(path, 'utf8'), next: readFileSync(path, 'utf8') });
  return plan.get(path);
}
function replace(path, before, after, count = 1) {
  const entry = source(path);
  if (entry.original.startsWith(marker)) return;
  const found = entry.next.split(before).length - 1;
  if (found !== count) throw new Error(`${path}: expected ${count} exact anchors, found ${found}. Nothing has been written.`);
  entry.next = entry.next.split(before).join(after);
}
function section(path, start, end, transform) {
  const entry = source(path);
  if (entry.original.startsWith(marker)) return;
  const a = entry.next.indexOf(start), b = entry.next.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || entry.next.indexOf(start, a + 1) >= 0) throw new Error(`${path}: section anchor mismatch. Nothing has been written.`);
  entry.next = entry.next.slice(0, a) + transform(entry.next.slice(a, b)) + entry.next.slice(b);
}
const extraction = 'src/lib/tic-field-extraction.ts';
replace(extraction, 'import type { ExtractedFact }', 'import { selectedCertificationType, strictMappedValue } from "@/lib/tic-cell-repair.mjs";\nimport type { ExtractedFact }');
section(extraction, 'function certificationTypeFact(lines: string[]) {', 'function factFromValue(', () => 'function certificationTypeFact(lines: string[]) {\n  return selectedCertificationType(lines.join("\\n"));\n}\n\n');
replace(extraction, '  const found = new Set<string>();', `  const found = new Set<string>();
  const directCandidates = new Map<string, Set<string>>();
  const conflictingDirectFields = new Set<string>();
  for (const line of lines) {
    const match = /^__CERTIVOIQ_TIC_FIELD__\\s+([a-z0-9_]+)\\s*:\\s*(.*)$/i.exec(line.trim());
    if (!match) continue;
    const definition = TIC_FIELD_BY_KEY.get(match[1]);
    if (!definition) continue;
    const value = strictMappedValue(definition.type, match[2], definition.key);
    if (value === null) { conflictingDirectFields.add(definition.key); continue; }
    const values = directCandidates.get(definition.key) ?? new Set<string>();
    values.add(JSON.stringify(value));
    directCandidates.set(definition.key, values);
    if (values.size > 1) conflictingDirectFields.add(definition.key);
  }`);
replace(extraction, 'if (!direct?.[1] || found.has(direct[1])) continue;', 'if (!direct?.[1] || found.has(direct[1]) || conflictingDirectFields.has(direct[1])) continue;');
replace(extraction, 'const value = normalizeValue(definition, direct[2] ?? "");', 'const value = strictMappedValue(definition.type, direct[2] ?? "", definition.key);');
replace(extraction, 'if (!found.has("certification_type")) {', 'if (!found.has("certification_type") && !conflictingDirectFields.has("certification_type")) {');
replace(extraction, 'if (found.has(definition.key) || !definition.aliases.length) continue;', 'if (found.has(definition.key) || conflictingDirectFields.has(definition.key) || definition.key === "certification_type" || !definition.aliases.length) continue;');

const native = 'src/lib/tic-pdf-form-values.ts';
replace(native, 'type PdfFieldWidget = {', 'import { TIC_FIELD_DEFINITIONS } from "@/lib/tic-field-registry";\n\ntype PdfFieldWidget = {');
replace(native, '[widget.value, widget.fieldValue, widget.buttonValue]', '[widget.value, widget.fieldValue]');
replace(native, 'if (name === base) return 1;', 'if (name.toLowerCase() === base.toLowerCase()) return 1;');
replace(native, 'function pushLine(', `function schemaFieldKey(name: string): string | null {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalize(name);
  const matches = TIC_FIELD_DEFINITIONS.filter((definition) =>
    [definition.key, definition.label, ...definition.aliases].some((label) => normalize(label) === target));
  return matches.length === 1 ? matches[0].key : null;
}

function appendSeparateNames(fieldObjects: PdfFieldObjects, byPage: Map<number, string[]>) {
  const rows = new Map<string, { page: number; row: number; first: Set<string>; middle: Set<string> }>();
  for (const [name, widgets] of Object.entries(fieldObjects)) {
    const firstRow = rowFromSuffix(name, "First Name", 10);
    const middleRow = rowFromSuffix(name, "Middle Initial", 10);
    const canonical = /^household_member_(10|[1-9])_(first_name|middle_initial)$/.exec(name);
    const row = firstRow ?? middleRow ?? (canonical ? Number(canonical[1]) : null);
    if (!row) continue;
    const part = firstRow || canonical?.[2] === "first_name" ? "first" : "middle";
    for (const widget of widgets ?? []) {
      const value = widgetValue(widget);
      if (!value) continue;
      const page = pageNumber(widget), id = page + ":" + row;
      const entry = rows.get(id) ?? { page, row, first: new Set<string>(), middle: new Set<string>() };
      entry[part].add(value);
      rows.set(id, entry);
    }
  }
  for (const entry of rows.values()) {
    if (entry.first.size !== 1 || entry.middle.size > 1) continue;
    pushLine(byPage, entry.page, directLine("household_member_" + entry.row + "_first_name_middle_initial", [...entry.first, ...entry.middle].join(" ")));
  }
}

function pushLine(`);
replace(native, 'assetKey(name) ?? signatureKey(name);', 'assetKey(name) ?? signatureKey(name) ?? schemaFieldKey(name);');
replace(native, 'const normalizedValue = key.endsWith("_signature_present") ? "Yes" : value;', 'const normalizedValue = key.endsWith("_signature_present") ? (/^(no|false|off|0)$/i.test(value) ? "No" : "Yes") : value;');
replace(native, '  return byPage;\n}', '  appendSeparateNames(fieldObjects, byPage);\n  return byPage;\n}');

const pdf = 'src/lib/pdf-ocr.ts';
replace(pdf, "import { extractTicSpatialValueLines } from '@/lib/tic-spatial-extraction.mjs';", "import { extractTicSpatialValueLines } from '@/lib/tic-spatial-extraction.mjs';\nimport { nativePdfLayout, isTicContent } from '@/lib/tic-cell-repair.mjs';");
replace(pdf, `        const nativeText = normalizePageText(
          content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
        );
        const formValueLines = nativeFormValuesByPage.get(pageNumber) ?? [];
        const text = normalizePageText([nativeText, ...formValueLines].filter(Boolean).join('\\n'));`, `        const nativeViewport = page.getViewport({ scale: 1 });
        const layout = nativePdfLayout(content.items, nativeViewport);
        const nativeText = normalizePageText(layout.text || content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        const formValueLines = nativeFormValuesByPage.get(pageNumber) ?? [];
        const nativeSpatialLines = isTicContent(nativeText)
          ? extractTicSpatialValueLines(layout.blocks, nativeViewport.width, nativeViewport.height)
          : [];
        // Native form controls take precedence over spatial proposals for the same field.
        const formKeys = new Set(formValueLines.map((line) => line.split(/\\s+/)[1]));
        const spatialValues = nativeSpatialLines.filter((line: string) => !formKeys.has(line.split(/\\s+/)[1]));
        const text = normalizePageText([nativeText, ...formValueLines, ...spatialValues].filter(Boolean).join('\\n'));`);
replace(pdf, `        const isTicFormPage =
          pageNumber <= 3 &&
          /tenant income certification/i.test(nativeText) &&
          !/instructions for completing/i.test(nativeText);`, `        const isTicFormPage = isTicContent(nativeText) && formValueLines.length === 0 && nativeSpatialLines.length === 0;`);
replace(pdf, "const isTicFormPage = pageNumber <= 3 && /tenant income certification/i.test(preparedText);", "const isTicFormPage = isTicContent(preparedText);");
replace(pdf, 'const highResolutionFormCandidate = pageNumber <= 3;', 'const highResolutionFormCandidate = isTicFormPage || pageNumber <= 3;');
replace(pdf, '              highResolutionFormCandidate,\n', '              true,\n');
replace(pdf, 'const ticDetected = isTicFormPage || /tenant income certification/i.test(`${preparedText} ${text}`);', 'const ticDetected = isTicFormPage || isTicContent(`${preparedText} ${text}`);');
replace(pdf, 'const spatialLines = /tenant income certification/i.test(text)', 'const spatialLines = isTicContent(text)');

const spatial = 'src/lib/tic-spatial-extraction.mjs';
replace(spatial, "const clean =", "import { isTicContent } from './tic-cell-repair.mjs';\n\nconst clean =");
replace(spatial, "  if (/^(?:@|#|8|b)$/i.test(text)) return 1;\n", '');
replace(spatial, '  if (direct.length === 1) return direct[0][0];', '  if (direct.length === 1) return direct[0][0];\n  if (direct.length > 1) return null;');
replace(spatial, 'if (!/tenant income certification/.test(pageText)) return [];', 'if (!isTicContent(pageText)) return [];');
section(spatial, 'function incomeLines(', 'function assetLines(', code => code
  .replace('  const out = [];', '  const out = [];\n  let incomeRow = 0;')
  .replace('    add(out, `income_member_${member}_household_member_number`, parts[0]);', '    if (++incomeRow > 10) break;\n    add(out, `income_member_${incomeRow}_household_member_number`, parts[0]);')
  .replaceAll('`income_member_${member}_', '`income_member_${incomeRow}_'));
section(spatial, 'function assetLines(', '/**\n * Recover exact source-field', code => code
  .replace('  const out = [];', '  const out = [];\n  let assetRow = 0;')
  .replace('    add(out, `asset_${member}_household_member_number`, parts[0]);', '    if (++assetRow > 27) break;\n    add(out, `asset_${assetRow}_household_member_number`, parts[0]);')
  .replaceAll('`asset_${member}_', '`asset_${assetRow}_'));

const classifier = 'src/lib/tic-packet-classifier.ts';
replace(classifier, 'import {\n', 'import { isTicContent } from "@/lib/tic-cell-repair.mjs";\nimport {\n');
replace(classifier, '  let best:\n', `  if (isTicContent(text)) {
    return { page: page.page, kind: "tic", documentType: null, label: "Tenant Income Certification", confidence: 0.9, basis: "Recognized TIC title or multiple TIC continuation-page anchors." };
  }

  let best:
`);
replace(classifier, '  if (ticSignals > 0) {', '  if (isTicContent(text)) {');

const intake = 'src/utils/tic-certification-intake.functions.ts';
replace(intake, '  const result = ticExtraction.extractTicFieldsFromText(\n    documentText,', `  const packetPages = packetPagesFromMarkedText(documentText);
  const pageClassifications = classifyPacketPages(packetPages);
  const ticPageNumbers = new Set(pageClassifications.filter((page) => page.kind === "tic").map((page) => page.page));
  const ticText = packetPages.filter((page) => ticPageNumbers.has(page.page)).map((page) => "Page " + page.page + "\\n" + page.text).join("\\n");
  const result = ticExtraction.extractTicFieldsFromText(
    ticText,`);
replace(intake, '  const packetPages = packetPagesFromMarkedText(documentText);\n  const pageClassifications = classifyPacketPages(packetPages);\n  const supportingDocuments = groupSupportingPages(pageClassifications);', '  const supportingDocuments = groupSupportingPages(pageClassifications);');

const registry = 'src/lib/tic-field-registry.ts';
replace(registry, 'export const TIC_FIELD_DEFINITIONS: readonly TicFieldDefinition[] = [', 'export const TIC_FIELD_DEFINITIONS: readonly TicFieldDefinition[] = [\n  field("calculation_review_note", "Calculation review note", "Calculation Review", "text", []),');
const ui = 'src/components/certivoiq-tic-review-form.tsx';
replace(ui, 'import type { TicFieldDefinition }', 'import { TicCalculationReview } from "@/components/tic-calculation-review";\nimport type { TicFieldDefinition }');
replace(ui, '    <div className="mx-auto w-full max-w-[1180px] space-y-5">', '    <div className="mx-auto w-full max-w-[1180px] space-y-5">\n      <TicCalculationReview values={values} busy={busy} onChange={onChange} />');

// Validate every anchor before writing any changed source file.
for (const [path, entry] of plan) {
  if (entry.original.startsWith(marker)) continue;
  writeFileSync(path, marker + '\n' + entry.next);
  console.log('Patched ' + path);
}
