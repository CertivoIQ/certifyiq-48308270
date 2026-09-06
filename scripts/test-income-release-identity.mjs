import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const script=resolve('scripts/verify-native-income-calculator-release.mjs'),sha='a'.repeat(40);
function fixture(t){const cwd=mkdtempSync(join(tmpdir(),'income-release-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));const run=(mode,extra={})=>spawnSync(process.execPath,[script,mode],{cwd,env:{...process.env,GITHUB_SHA:sha,...extra},encoding:'utf8'});return {cwd,run};}
test('release marker is a build input, with exact source identity',t=>{const {cwd,run}=fixture(t);assert.equal(run('identity').status,0);const marker=JSON.parse(readFileSync(join(cwd,`public/assets/income-calculator-release-${sha}.json`)));assert.deepEqual(marker,{feature:'income-calculator',engineVersion:'income-calculator/1.0.0',sourceCommit:sha});});
test('prepare verifies built marker and hashes calculator without rewriting public bytes',t=>{const {cwd,run}=fixture(t);assert.equal(run('identity').status,0);const out=join(cwd,'.output/public/assets');mkdirSync(out,{recursive:true});const marker=`income-calculator-release-${sha}.json`;copyFileSync(join(cwd,'public/assets',marker),join(out,marker));const original=readFileSync(join(out,marker));const bytes='export const title="Income Calculator";';writeFileSync(join(out,'income-calculator-abcdef.js'),bytes);const result=run('prepare');assert.equal(result.status,0,result.stderr);assert.deepEqual(readFileSync(join(out,marker)),original);const evidence=JSON.parse(readFileSync(join(cwd,'income-build-verification.json')));assert.equal(evidence.assetSha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(evidence.asset,'/assets/income-calculator-abcdef.js');});
test('prepare rejects an absent build-time marker',t=>{const {run}=fixture(t);assert.notEqual(run('prepare').status,0);});
test('prepare rejects stale source identity',t=>{const {cwd,run}=fixture(t);const out=join(cwd,'.output/public/assets');mkdirSync(out,{recursive:true});writeFileSync(join(out,`income-calculator-release-${sha}.json`),JSON.stringify({feature:'income-calculator',engineVersion:'income-calculator/1.0.0',sourceCommit:'b'.repeat(40)}));assert.notEqual(run('prepare').status,0);});
test('identity refuses invalid source commit input',t=>{const {run}=fixture(t);assert.notEqual(run('identity',{GITHUB_SHA:'not-a-commit'}).status,0);});
test('release workflow writes identity before the application build',()=>{const yml=readFileSync('.github/workflows/native-income-calculator-release.yml','utf8');assert.ok(yml.indexOf('release.mjs identity')<yml.indexOf('run: bun run build'));assert.ok(yml.includes('income-build-verification.json'));});
