import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/ocr-worker-pool.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createOcrWorkerPool,OcrRuntimeError}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('a failed engine is disposed and the next queued page uses a fresh engine',async()=>{
 let created=0;const disposed=[];const pool=createOcrWorkerPool(async()=>++created,async w=>disposed.push(w));
 const failed=pool.run(1,async()=>{throw new Error('Aborted(missing function: DotProductSSE)')});
 const next=pool.run(1,async w=>w);
 await assert.rejects(failed,e=>e instanceof OcrRuntimeError && /processing error/.test(e.message));
 assert.equal(await next,2);assert.deepEqual(disposed,[1]);
});
test('failed initialization can be retried without a poisoned promise',async()=>{
 let count=0;const pool=createOcrWorkerPool(async()=>{if(++count===1)throw new Error('Download failed');return count;},async()=>{});
 await assert.rejects(pool.run(1,async w=>w),OcrRuntimeError);
 assert.equal(await pool.run(1,async w=>w),2);
});
test('bounded workers serialize their operations and retain successful engines',async()=>{
 let created=0;const active=new Set();const pool=createOcrWorkerPool(async()=>++created,async()=>{});
 const result=await Promise.all(Array.from({length:9},()=>pool.run(3,async w=>{assert.ok(!active.has(w));active.add(w);await new Promise(r=>setTimeout(r,2));active.delete(w);return w;})));
 assert.equal(created,3);assert.deepEqual(result,[1,2,3,1,2,3,1,2,3]);
});
test('cleanup errors preserve the runtime error and do not block recovery',async()=>{
 const pool=createOcrWorkerPool(async()=>1,async()=>{throw new Error('Already terminated')});
 await assert.rejects(pool.run(1,async()=>{throw new Error('Runtime aborted')}),/Runtime aborted/);
 assert.equal(await pool.run(1,async()=>42),42);
});
