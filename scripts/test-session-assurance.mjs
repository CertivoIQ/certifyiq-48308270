import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/integrations/supabase/auth-middleware.ts',import.meta.url),'utf8'))
  .replace(/^import .*$/gm,'').replaceAll('export const ','const ');
function middleware(data,error=null) {
  const createMiddleware = () => ({server: fn => fn});
  const getRequest = () => ({headers:new Headers({authorization:'Bearer verified.token.fixture'})});
  const createClient = () => ({auth:{getClaims:async()=>({data:{claims:{sub:'owner',aal:'aal1'}},error:null})},rpc:async()=>({data,error})});
  return new Function('createMiddleware','getRequest','createClient','Headers','process',source+'\nreturn {requireSupabaseAuth,requireMfaRecoverySession};')
    (createMiddleware,getRequest,createClient,Headers,{env:{}});
}
const next = ({context}) => context.userId;
test('normal server requests reject missing, false or ambiguous MFA assurance',async()=>{
  for(const mfa_satisfied of [undefined,false,null,'true',1]) {
    await assert.rejects(middleware({valid:true,mfa_satisfied}).requireSupabaseAuth({next}),/authenticator/);
  }
});
test('normal server requests accept explicit current assurance',async()=>{
  assert.equal(await middleware({valid:true,mfa_satisfied:true}).requireSupabaseAuth({next}),'owner');
});
test('recovery entry accepts AAL1 only with an explicitly valid lifetime',async()=>{
  assert.equal(await middleware({valid:true,mfa_satisfied:false}).requireMfaRecoverySession({next}),'owner');
  for(const valid of [undefined,false,null,'true',1]) {
    await assert.rejects(middleware({valid,mfa_satisfied:true}).requireMfaRecoverySession({next}),/session has ended/);
  }
});
test('transport errors reject both entry points',async()=>{
  for(const key of ['requireSupabaseAuth','requireMfaRecoverySession']) {
    await assert.rejects(middleware({valid:true,mfa_satisfied:true},new Error('unavailable'))[key]({next}),/session has ended/);
  }
});
test('only recovery-code verification uses the narrow recovery middleware',()=>{
  const mfa=readFileSync(new URL('../src/utils/mfa.functions.ts',import.meta.url),'utf8');
  assert.equal((mfa.match(/\.middleware\(\[requireMfaRecoverySession\]\)/g)||[]).length,1);
  assert.match(mfa,/verifyAndDisableRecoveryCode = createServerFn\([\s\S]*?middleware\(\[requireMfaRecoverySession\]\)/);
});
