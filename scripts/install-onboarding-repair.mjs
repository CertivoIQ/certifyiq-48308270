// One-time source transport, restricted to the isolated repair branch.
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const repository='Watkin5/certifyiq-48308270';
assert.equal(process.env.GITHUB_REPOSITORY,repository);
assert.equal(process.env.GITHUB_REF_NAME,'fix/onboarding-calculator-acceptance');
const chunks=[];
for(const sha of ['0ab6a0db6eabb2c5a6eb946c1019b7e46b822260','00023c430e82f7468486a4f5e3da35930f99d360','31f3797e368703909e16290cad88d610ab2f4eea']){
 const response=await fetch(`https://api.github.com/repos/${repository}/git/blobs/${sha}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'}});
 assert.ok(response.ok,`Source blob read failed: ${response.status}`);
 const blob=await response.json();assert.equal(blob.encoding,'base64');chunks.push(Buffer.from(blob.content,'base64'));
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const packed=Buffer.concat(chunks);
assert.equal(hash(packed),'cbe51306a5b7fe491c7c0bf7c3534e601260819ea339c871486c355dd4fad25e');
const bundle=JSON.parse(brotliDecompressSync(packed).toString('utf8'));
const allowed=[
 '.github/workflows/native-income-calculator-release.yml','docs/native-income-calculator.md',
 'scripts/test-command-center-certification-actions.mjs','scripts/test-onboarding-repair.mjs','scripts/verify-income-onboarding-session.mjs',
 'src/components/certification-review-panel.tsx','src/components/certification-task-actions.tsx','src/components/certification-upload-panel-v2.tsx','src/components/certification-upload-panel-v3.tsx','src/components/certification-upload-panel-v4.tsx','src/components/certification-upload-panel.tsx','src/components/certivoiq-tic-review-form.tsx',
 'src/components/pha-dashboard.tsx','src/components/pha-family-workflow.tsx','src/components/pha-notice-center.tsx','src/components/pha-waiting-list-workspace.tsx','src/components/portfolio-intake-panel.tsx','src/components/workspace-profile-configurator.tsx',
 'src/integrations/supabase/types.ts','src/lib/billing-portal.server.ts','src/lib/compliance-document-recognition.functions.ts','src/lib/compliance-form-recognition.d.mts','src/lib/enterprise-invoice.functions.ts','src/lib/enterprise-licensing.server.ts','src/lib/onboarding-client.ts','src/lib/paid-onboarding.server.ts','src/lib/pdf-ocr.ts','src/lib/portfolio-intake.functions.ts','src/lib/portfolio-intake.ts','src/lib/serializable-fact-value.ts','src/lib/tic-spatial-extraction.d.mts',
 'src/routes/_authenticated/crm/operations.tsx','src/routes/_authenticated/state-rule-validation.tsx','src/routes/_authenticated/submission-center.tsx','src/routes/_authenticated/tasks.tsx','src/routes/_authenticated/workspace-setup.tsx','src/routes/files.index.tsx','src/routes/launchpad.tsx','src/routes/pha/$persona.tsx',
 'src/utils/certification-extraction-preview.functions.ts','src/utils/certification-review.functions.ts','src/utils/tic-certification-intake.functions.ts'
];
assert.deepEqual(bundle.files.map(f=>f.path).sort(),allowed.sort());
const prepared=[];
for(const file of bundle.files){
 let bytes=existsSync(file.path)?readFileSync(file.path):Buffer.alloc(0);
 if(hash(bytes)===file.final){console.log(`Already installed: ${file.path}`);continue;}
 if(file.base)assert.equal(hash(bytes),file.base,`Base source changed: ${file.path}`);
 else assert.equal(existsSync(file.path),false,`New source path already exists: ${file.path}`);
 let boundary=bytes.length;
 for(const edit of [...file.edits].reverse()){
  const [start,end,text]=edit;assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<=boundary&&typeof text==='string');
  bytes=Buffer.concat([bytes.subarray(0,start),Buffer.from(text,'utf8'),bytes.subarray(end)]);boundary=start;
 }
 assert.equal(hash(bytes),file.final,`Final source digest mismatch: ${file.path}`);prepared.push([file.path,bytes]);
}
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(pkg.dependencies.stripe,'22.4.0');assert.equal(pkg.devDependencies['playwright-core'],'1.55.1');
assert.deepEqual(bundle.packageScripts,{typecheck:'tsc --noEmit','test:onboarding':'node --test scripts/test-onboarding-repair.mjs'});
for(const [path,bytes] of prepared){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);console.log(`Installed verified source: ${path}`);}
Object.assign(pkg.scripts,bundle.packageScripts);writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('All 42 source paths verified; no infrastructure or database data changed.');
