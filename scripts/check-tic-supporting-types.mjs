import path from 'node:path';
import ts from 'typescript';
const roots = ['src/components/tic-supporting-evidence-review.tsx','src/lib/tic-supporting-evidence.d.mts'];
const cfg = ts.readConfigFile('tsconfig.json',ts.sys.readFile);
if (cfg.error) throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText,'\n'));
const config = ts.parseJsonConfigFileContent(cfg.config,ts.sys,process.cwd());
const ambient = config.fileNames.filter(file=>/\.d\.(?:ts|mts|cts)$/.test(file));
const program = ts.createProgram([...roots,...ambient],config.options);
const selected = new Set(roots.map(file=>path.resolve(file)));
const errors = ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error && (!d.file||selected.has(path.resolve(d.file.fileName))));
if(errors.length){console.error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=>'\n'}));process.exitCode=1;}
else console.log('Strict type check passed for supporting evidence component/declaration roots; not a whole-application type check.');
