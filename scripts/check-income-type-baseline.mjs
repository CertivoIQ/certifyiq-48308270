// Preserve all diagnostics; require zero errors in calculator/menu files and no new
// diagnostic locations elsewhere. Existing platform debt is reported, not called clean.
import ts from 'typescript';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
const [mode,...args]=process.argv.slice(2);
if(mode==='capture'){
 const [rootArg,out]=args; const root=resolve(rootArg); assert.ok(out);
 const config=ts.readConfigFile(resolve(root,'tsconfig.json'),ts.sys.readFile);
 if(config.error)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
 const program=ts.createProgram(parsed.fileNames,parsed.options);
 const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)].map(d=>({file:d.file?relative(root,d.file.fileName):'<config>',code:d.code,start:d.start??null,length:d.length??null,source:d.file&&d.start!==undefined?d.file.text.slice(d.start,d.start+(d.length||0)):'',message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
 writeFileSync(out,JSON.stringify(diagnostics,null,2)+'\n');
 console.log(`${diagnostics.length} full diagnostics saved for ${root}.`);
}else if(mode==='compare'){
 const [baseFile,currentFile,out]=args;
 const base=JSON.parse(readFileSync(baseFile,'utf8')),current=JSON.parse(readFileSync(currentFile,'utf8'));
 const key=d=>JSON.stringify([d.file,d.code,d.start,d.length,d.source]);
 const counts=new Map(); for(const d of base)counts.set(key(d),(counts.get(key(d))||0)+1);
 const added=current.filter(d=>{const k=key(d),n=counts.get(k)||0;if(!n)return true;counts.set(k,n-1);return false;});
 const owned=['src/components/income-calculator.tsx','src/components/app-shell.tsx','src/routes/_authenticated/income-calculator.tsx','supabase/functions/_shared/income-calculator-engine.ts'];
 const featureErrors=current.filter(d=>owned.includes(d.file));
 const report={baselineCommit:'3a662a690d7e02bf5cd6fda16149c964864c0cd4',baselineDiagnostics:base.length,currentDiagnostics:current.length,newDiagnostics:added,calculatorAndMenuDiagnostics:featureErrors,fullApplicationTypecheckClean:current.length===0,passed:added.length===0&&featureErrors.length===0};
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n## Income Calculator type gate\nBaseline diagnostics: ${base.length}; current: ${current.length}; new: ${added.length}; calculator/menu: ${featureErrors.length}. Full diagnostics retained as artifacts. This is not a claim of a clean whole-platform typecheck.\n`);
 assert.equal(report.passed,true,'New type errors or calculator/menu errors block integration.');
}else throw new Error('Expected capture ROOT OUTPUT or compare BASE CURRENT OUTPUT');
