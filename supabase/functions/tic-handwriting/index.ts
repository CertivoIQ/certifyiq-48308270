import {createClient} from 'npm:@supabase/supabase-js@2.112.1';
import {MODEL,transcriptionPrompt,validateTranscription} from './core.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function readBody(req:Request){const reader=req.body?.getReader();if(!reader)throw Error('INVALID_REQUEST');let size=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4_000_000)throw Error('IMAGE_TOO_LARGE');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
const GEMINI_MODEL='gemini-3.8-flash';
const GROQ_FALLBACK_MODEL='qwen/qwen3.8-27b';
async function readWithGroq(key:string,image:string,model:string){
 const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(90_000),headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:[{type:'text',text:transcriptionPrompt()},{type:'image_url',image_url:{url:image}}]}],response_format:{type:'json_object'},temperature:0,reasoning_effort:'none',max_completion_tokens:4500})});
 const status=response.status,retryAfter=Math.min(60,Math.max(5,Number(response.headers.get('retry-after'))||30));
 if(!response.ok){await response.body?.cancel();return {ok:false,status,content:'',finishReason:'',completionTokens:null,retryAfter};}
 const result=await response.json(),finishReason=String(result.choices?.[0]?.finish_reason??'');
 return {ok:finishReason==='stop',status,content:result.choices?.[0]?.message?.content??'',finishReason,completionTokens:Number.isInteger(result.usage?.completion_tokens)?result.usage.completion_tokens:null,retryAfter};
}
async function readWithGemini(key:string,image:string){
 const base64=image.split(',')[1];
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,{method:'POST',signal:AbortSignal.timeout(90_000),headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{text:transcriptionPrompt()},{inlineData:{mimeType:'image/jpeg',data:base64}}]}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:4500}})});
 if(!response.ok){await response.body?.cancel();return {ok:false as const,status:response.status,retryAfter:Math.min(60,Math.max(5,Number(response.headers.get('retry-after'))||30))};}
 const result=await response.json(),text=result.candidates?.[0]?.content?.parts?.map((part:{text?:string})=>part.text??'').join('')??'';
 return {ok:true as const,text,finishReason:String(result.candidates?.[0]?.finishReason??''),completionTokens:Number.isInteger(result.usageMetadata?.candidatesTokenCount)?result.usageMetadata.candidatesTokenCount:null};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'POST required.'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),key=Deno.env.get('GROQ_API_KEY'),geminiKey=Deno.env.get('GEMINI_API_KEY');
 if(!url||!anon||!service||(!key&&!geminiKey))return json({error:'Handwriting reader is not configured.'},503);
 const authorization=req.headers.get('authorization')??'';
 if(!authorization.startsWith('Bearer '))return json({error:'Sign in to read handwritten TICs.'},401);
 const client=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await client.auth.getUser(authorization.slice(7));
 if(authError||!auth.user||auth.user.is_anonymous)return json({error:'Sign in again to read handwritten TICs.'},401);
 const {data:access,error:accessError}=await client.rpc('income_calculator_access');
 if(accessError||!access?.allowed)return json({error:'Your current session or subscription does not allow certification preparation.'},403);
 let finish: ((outcome:string,details?:Record<string,unknown>)=>Promise<void>)|undefined;
 try{
  const body=await readBody(req);
  if(!body||typeof body!=='object'||!/^[-a-f0-9]{36}$/.test(body.jobId)||!/^[a-f0-9]{64}$/.test(body.sourceSha256)||!Number.isInteger(body.page)||body.page<1||body.page>200)throw Error('INVALID_SOURCE');
  if(typeof body.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image)||body.image.length>3_500_000)throw Error('INVALID_IMAGE');
  if(!Number.isInteger(body.width)||!Number.isInteger(body.height)||body.width<1||body.height<1||body.width>4096||body.height>4096)throw Error('INVALID_IMAGE_SIZE');
  const raw=Uint8Array.from(atob(body.image.split(',')[1]),c=>c.charCodeAt(0));
  if(raw[0]!==255||raw[1]!==216||raw[raw.length-2]!==255||raw[raw.length-1]!==217)throw Error('INVALID_IMAGE');
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:readId,error:reserved}=await admin.rpc('reserve_tic_handwriting_read',{_user_id:auth.user.id,_job_id:body.jobId,_source_sha256:body.sourceSha256,_page_number:body.page,_image_sha256:await hash(raw)});
  if(reserved){if(/LIMIT/.test(reserved.message))return json({error:'Handwriting reading limit reached. Wait before retrying; existing drafts remain unchanged.'},429);return json({error:'The staged certification is unavailable or belongs to another account.'},403);}
  finish=async(outcome,details={})=>{try{const {error}=await admin.from('tic_handwriting_reads').update({completed_at:new Date().toISOString(),outcome,...details}).eq('id',readId);if(error)console.warn('tic_handwriting_metrics_unavailable');}catch{console.warn('tic_handwriting_metrics_unavailable');}};
  let provider='groq',model=MODEL,content='',finishReason='',completionTokens:number|null=null,retryAfter=30,providerStatus=503;
  if(key){for(const groqModel of [MODEL,GROQ_FALLBACK_MODEL]){try{const result=await readWithGroq(key,body.image,groqModel);providerStatus=result.status;retryAfter=result.retryAfter;if(result.ok){model=groqModel;content=result.content;finishReason=result.finishReason;completionTokens=result.completionTokens;break;}}catch{providerStatus=503;}}}
  if(!content&&geminiKey){provider='gemini';model=GEMINI_MODEL;try{const result=await readWithGemini(geminiKey,body.image);if(result.ok){providerStatus=200;content=result.text;finishReason=result.finishReason;completionTokens=result.completionTokens;}else{providerStatus=result.status;retryAfter=result.retryAfter;}}catch{providerStatus=503;}}
  if(!content){await finish(providerStatus===429?'rate_limited':'failed',{provider_status:providerStatus});return json({error:'Handwriting capacity is temporarily unavailable. Retry this extraction shortly; no partial TIC was accepted.',providerStatus,retryAfter},providerStatus===429?429:502);}
  console.info(JSON.stringify({event:'tic_handwriting_response',provider,page:body.page,finishReason,completionTokens}));
  if(!['stop','STOP'].includes(finishReason)){await finish('failed',{failure_code:'INCOMPLETE_TRANSCRIPTION',finish_reason:finishReason.slice(0,32),completion_tokens:completionTokens});finish=undefined;throw Error('INCOMPLETE_TRANSCRIPTION');}
  const transcription=validateTranscription(JSON.parse(content),body.width,body.height);
  await finish('succeeded',{finish_reason:finishReason,completion_tokens:completionTokens,field_count:transcription.fieldCount,unresolved_count:transcription.unresolvedCount});
  return json({...transcription,page:body.page,sourceSha256:body.sourceSha256,readId,model,humanVerified:false});
 }catch(error){const code=error instanceof Error?error.message:'';const errorCode=['INVALID_REQUEST','INVALID_SOURCE','INVALID_IMAGE','INVALID_IMAGE_SIZE','INVALID_TRANSCRIPTION','IMAGE_TOO_LARGE','INCOMPLETE_TRANSCRIPTION'].includes(code)?code:'TRANSCRIPTION_FAILED';console.warn(JSON.stringify({event:'tic_handwriting_failure',code:errorCode}));await finish?.('failed',{failure_code:errorCode});return json({errorCode,error:code.startsWith('INVALID_')||code==='IMAGE_TOO_LARGE'?'The handwriting page image or source information is invalid.':'Handwriting transcription did not finish reliably. Retry; the page has not been accepted as complete.'},code.startsWith('INVALID_')?400:502);}
});

