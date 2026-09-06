import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const edits = [
  ['src/lib/tic-field-extraction.ts', 'TIC_FIELD_BY_KEY.get(match[1]);', 'TIC_FIELD_BY_KEY.get(match[1]!);'],
  ['src/lib/tic-pdf-form-values.ts', 'matches.length === 1 ? matches[0].key : null;', 'matches.length === 1 ? matches[0]!.key : null;'],
  ['src/components/tic-calculation-review.tsx', 'parts[0].toLowerCase()', 'parts[0]!.toLowerCase()'],
  ['src/components/tic-calculation-review.tsx', 'amounts: entries.map(parts => parts[1])', 'amounts: entries.map(parts => parts[1]!)'],
  ['src/components/tic-calculation-review.tsx', 'values.calculation_review_note', "values['calculation_review_note']"],
];
const planned = new Map();
for (const [file, before, after] of edits) {
  const current = planned.get(file) ?? readFileSync(file, 'utf8');
  if (current.includes(before)) planned.set(file, current.split(before).join(after));
  else if (!current.includes(after)) throw new Error(`${file}: strict-type repair anchor is missing.`);
}
for (const [file, text] of planned) writeFileSync(file, text);

const roots = ['src/components/tic-calculation-review.tsx', 'src/lib/tic-field-extraction.ts', 'src/lib/tic-pdf-form-values.ts', 'src/lib/tic-cell-repair.d.mts'];
const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
// The application supplies ambient module declarations in separate .d.ts files.
const ambient = config.fileNames.filter(file => /\.d\.(?:ts|mts|cts)$/.test(file));
const program = ts.createProgram([...roots, ...ambient], config.options);
const rootPaths = new Set(roots.map(file => path.resolve(file)));
const diagnostics = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error && (!diagnostic.file || rootPaths.has(path.resolve(diagnostic.file.fileName))));
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n' }));
  process.exitCode = 1;
} else console.log('Strict TypeScript check passed for the four TIC repair roots (not a whole-application type check).');
