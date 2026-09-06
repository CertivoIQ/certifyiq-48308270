// Read-only release checks, apart from writing local non-sensitive evidence files.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const mode=process.argv[2],sha=process.env.GITHUB_SHA;
const target='certivoiq-launch-candidate-20260905-v11';
const domains=['certivoiq.com','www.certivoiq.com'];
const digest=s=>createHash('sha256').update(s).digest('hex');
const output=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
async function api(path){
 assert.ok(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID,'Existing Cloudflare deployment credentials required');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/${path}`,{headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(30000)});
 assert.ok(r.ok,`Cloudflare read failed (${r.status})`);const p=await r.json();assert.equal(p.success,true);return p.result;
}
async function mapping(){const rows=[];for(const host of domains){const result=await api(`workers/domains?hostname=${host}`);const row=result.find(d=>d.hostname===host);assert.ok(row,`Missing existing mapping: ${host}`);assert.equal(row.service,target,`${host} is not mapped to the approved worker`);rows.push({hostname:row.hostname,service:row.service});}return rows;}
async function activeDeployment(){const p=await api(`workers/scripts/${target}/deployments`);assert.ok(p.deployments?.length,'No deployment history available');const d=p.deployments[0];return {id:d.id,createdOn:d.created_on,versions:d.versions};}
if(mode==='prepare'){
 assert.match(sha||'',/^[a-f0-9]{40}$/);
 const names=await readdir('.output/public/assets');const asset=names.find(n=>/^income-calculator-[\w-]+\.js$/.test(n));assert.ok(asset,'Calculator asset missing');
 const bytes=await readFile(`.output/public/assets/${asset}`);assert.ok(bytes.includes(Buffer.from('Income Calculator')));
 await output('.output/public/assets/income-calculator-release.json',{feature:'income-calculator',engineVersion:'income-calculator/1.0.0',sourceCommit:sha,asset:`/assets/${asset}`,assetSha256:digest(bytes)});
}else if(mode==='preflight'){
 assert.equal(process.env.TARGET_WORKER,target);
 const cfg=JSON.parse(await readFile('.output/server/wrangler.bound.json','utf8'));assert.equal(cfg.name,target);assert.ok(!cfg.routes&&!cfg.route&&!cfg.custom_domains,'Do not alter domain mappings');
 const settings=await api(`workers/scripts/${target}/settings`);
 for(const b of settings.bindings||[]){if(['plain_text','json','secret_text'].includes(b.type))continue;assert.ok(b.type==='assets'&&b.name===cfg.assets?.binding,`Existing binding ${b.name} requires preservation review`);}
 const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];for(const name of required)assert.ok((settings.bindings||[]).some(b=>b.name===name),`Missing existing runtime binding: ${name}`);
 await output('income-cloudflare-before.json',{worker:target,domains:await mapping(),deployment:await activeDeployment(),bindingNames:(settings.bindings||[]).map(b=>({name:b.name,type:b.type})).sort((a,b)=>a.name.localeCompare(b.name))});
 console.log('Existing worker, domain mapping, and resource bindings verified.');
}else if(mode==='postflight'){
 const before=JSON.parse(await readFile('income-cloudflare-before.json','utf8'));
 const settings=await api(`workers/scripts/${target}/settings`);const bindings=(settings.bindings||[]).map(b=>({name:b.name,type:b.type})).sort((a,b)=>a.name.localeCompare(b.name));
 assert.deepEqual(bindings,before.bindingNames,'Deployment changed runtime bindings');const dm=await mapping();assert.deepEqual(dm,before.domains);
 const deployment=await activeDeployment();assert.notEqual(deployment.id,before.deployment.id,'No new active deployment');assert.equal(deployment.versions.length,1);assert.equal(deployment.versions[0].percentage,100);
 await output('income-cloudflare-after.json',{worker:target,sourceCommit:sha,domains:dm,deployment,bindingsPreserved:true});console.log('New deployment serves 100% of traffic; existing domains and bindings preserved.');
}else if(mode==='live'){
 const candidate=new URL(process.argv[3]);assert.equal(candidate.protocol,'https:');assert.ok(candidate.hostname.startsWith(`${target}.`)&&candidate.hostname.endsWith('.workers.dev'));
 const result=[];
 for(const origin of [candidate.origin,...domains.map(d=>`https://${d}`)]){
  const get=async(path)=>{const r=await fetch(new URL(path,origin),{headers:{'cache-control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,`${origin}${path}: HTTP ${r.status}`);return r;};
  const manifest=await(await get(`/assets/income-calculator-release.json?release=${sha}`)).json();assert.equal(manifest.sourceCommit,sha);assert.equal(manifest.feature,'income-calculator');assert.match(manifest.asset,/^\/assets\/income-calculator-[\w-]+\.js$/);
  const asset=await get(manifest.asset);assert.match(asset.headers.get('content-type')||'',/javascript/);assert.equal(digest(Buffer.from(await asset.arrayBuffer())),manifest.assetSha256);
  const route=await fetch(new URL('/income-calculator',origin),{redirect:'manual',signal:AbortSignal.timeout(30000)});assert.ok([200,301,302,303,307,308].includes(route.status),`Calculator route returned ${route.status}`);
  result.push({origin,sourceCommit:sha,calculatorRouteStatus:route.status,assetDigestVerified:true});
 }
 const endpoint='https://emnkzxkcpnyvglwxraxm.supabase.co/functions/v1/income-calculator';
 const backend=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'metadata'}),signal:AbortSignal.timeout(30000)});assert.equal(backend.status,401,'Anonymous calculator request must be rejected');
 await output('income-live-verification.json',{checks:result,anonymousBackendRequest:backend.status,authenticatedSaveReviewTested:false,verifiedAt:new Date().toISOString()});console.log(JSON.stringify(result,null,2));
}else throw new Error('Expected prepare, preflight, postflight, or live');
