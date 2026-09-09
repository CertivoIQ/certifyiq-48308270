import {fetchPublishedAsset} from './release-public-fetch.mjs';
// Read-only release checks, apart from writing local non-sensitive evidence files.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const mode=process.argv[2],sha=process.env.GITHUB_SHA;
const target='certivoiq-launch-candidate-20260905-v11';
const domains=['certivoiq.com','www.certivoiq.com'];
const digest=s=>createHash('sha256').update(s).digest('hex');
const output=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const identity=()=>{assert.match(sha||'',/^[a-f0-9]{40}$/);return {feature:'income-calculator',engineVersion:'income-calculator/1.0.0',sourceCommit:sha};};
const identityPath=()=>`/assets/income-calculator-release-${identity().sourceCommit}.json`;
async function api(path){
 assert.ok(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID,'Existing Cloudflare deployment credentials required');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/${path}`,{headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`},signal:AbortSignal.timeout(30000)});
 assert.ok(r.ok,`Cloudflare read failed (${r.status})`);const p=await r.json();assert.equal(p.success,true);return p.result;
}
async function mapping(){const rows=[];for(const host of domains){const result=await api(`workers/domains?hostname=${host}`);const row=result.find(d=>d.hostname===host);assert.ok(row,`Missing existing mapping: ${host}`);assert.equal(row.service,target,`${host} is not mapped to the approved worker`);rows.push({hostname:row.hostname,service:row.service});}return rows;}
async function activeDeployment(){const p=await api(`workers/scripts/${target}/deployments`);assert.ok(p.deployments?.length,'No deployment history available');const d=p.deployments[0];return {id:d.id,createdOn:d.created_on,versions:d.versions};}
if(mode==='identity'){
 // Public identity must exist BEFORE Vite/Nitro generates its asset manifest.
 // A commit-specific URL also prevents a stale cached marker from passing.
 await mkdir('public/assets',{recursive:true});
 await output(`public${identityPath()}`,identity());
 console.log('Release identity added to the build input.');
}else if(mode==='prepare'){
 const expected=identity();
 assert.deepEqual(JSON.parse(await readFile(`.output/public${identityPath()}`,'utf8')),expected,'Build did not include its exact release identity');
 const names=await readdir('.output/public/assets');const assets=names.filter(n=>/^income-calculator-(?!engine-)[\w-]+\.js$/.test(n));assert.equal(assets.length,1,'Exactly one calculator asset required');
 const asset=assets[0];const bytes=await readFile(`.output/public/assets/${asset}`);assert.ok(bytes.includes(Buffer.from('Income Calculator')));
 // Never mutate public files after Nitro captures their existence/metadata.
 await output('income-build-verification.json',{...expected,identityPath:identityPath(),asset:`/assets/${asset}`,assetSha256:digest(bytes)});
}else if(mode==='preflight'){
 assert.equal(process.env.TARGET_WORKER,target);
 const cfg=JSON.parse(await readFile('.output/server/wrangler.bound.json','utf8'));assert.equal(cfg.name,target);assert.ok(!cfg.routes&&!cfg.route&&!cfg.custom_domains,'Do not alter domain mappings');
 const settings=await api(`workers/scripts/${target}/settings`);
 for(const b of settings.bindings||[]){if(['plain_text','json','secret_text'].includes(b.type))continue;assert.ok(b.type==='assets'&&b.name===cfg.assets?.binding,`Existing binding ${b.name} requires preservation review`);}
 const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];for(const name of required)assert.ok((settings.bindings||[]).some(b=>b.name===name),`Missing existing runtime binding: ${name}`);
 const keyNames=['SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY'];
 assert.ok((settings.bindings||[]).some(b=>keyNames.includes(b.name)),'Missing configured Supabase public-key binding (prefixed or unprefixed)');
 const authSource=await readFile('src/integrations/supabase/auth-middleware.ts','utf8');
 for(const name of keyNames)assert.ok(authSource.includes(`process.env['${name}']`),`Source no longer supports existing key alias ${name}`);
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
 const expected=identity(),build=JSON.parse(await readFile('income-build-verification.json','utf8'));
 assert.equal(build.sourceCommit,sha);assert.equal(build.identityPath,identityPath());assert.match(build.asset,/^\/assets\/income-calculator-[\w-]+\.js$/);assert.match(build.assetSha256,/^[a-f0-9]{64}$/);
 const result=[];
 for(const origin of [candidate.origin,...domains.map(d=>`https://${d}`)]){
  const get=async(path)=>{
   const url=new URL(path,origin),options={headers:{'cache-control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(30000)};
   let r=await fetchPublishedAsset(url,options);
   // Preserve and explicitly validate the existing www -> canonical redirect.
   if(r.status===308&&url.hostname==='www.certivoiq.com'){
    const canonical=new URL(url);canonical.hostname='certivoiq.com';
    assert.equal(r.headers.get('location'),canonical.href,'Unexpected canonical redirect');
    await r.body?.cancel();r=await fetchPublishedAsset(canonical,options);
   }
   assert.equal(r.status,200,`${origin}${path}: HTTP ${r.status}`);return r;
  };
  const marker=await get(build.identityPath);assert.match(marker.headers.get('content-type')||'',/json/);assert.deepEqual(await marker.json(),expected,'Live source identity differs from this release');
  const asset=await get(build.asset);assert.match(asset.headers.get('content-type')||'',/javascript/);assert.equal(digest(Buffer.from(await asset.arrayBuffer())),build.assetSha256,'Live calculator bytes differ from the checked build');
  const route=await get('/income-calculator');assert.match(route.headers.get('content-type')||'',/html/);await route.body?.cancel();
  result.push({origin,sourceCommit:sha,calculatorRouteStatus:200,canonicalRedirectValidated:origin==='https://www.certivoiq.com',assetDigestVerified:true});
 }
 const backend=await fetch('https://emnkzxkcpnyvglwxraxm.supabase.co/functions/v1/income-calculator',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'metadata'}),signal:AbortSignal.timeout(30000)});assert.equal(backend.status,401,'Anonymous calculator request must be rejected');await backend.body?.cancel();
 await output('income-live-verification.json',{checks:result,anonymousBackendRequest:backend.status,authenticatedSaveReviewTested:false,verifiedAt:new Date().toISOString()});console.log(JSON.stringify(result,null,2));
}else throw new Error('Expected identity, prepare, preflight, postflight, or live');
