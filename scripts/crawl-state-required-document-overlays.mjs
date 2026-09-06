import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inventory = JSON.parse(await readFile(resolve("src/lib/nationwide-state-source-discovery.json"), "utf8"));
const outputPath = resolve(process.argv[2] ?? "artifacts/state-required-document-overlays.json");
const MAX_BYTES = 35 * 1024 * 1024;
const DOC_EXT = /\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i;
const ROLE_PATTERNS = [
  { role:"LIHTC_QAP", programs:["LIHTC"], re:/\bqap\b|qualified\s+allocation\s+plan/i },
  { role:"INCOME_LIMITS", programs:["LIHTC"], re:/income.{0,20}limit|mtsp.{0,20}income/i },
  { role:"RENT_LIMITS", programs:["LIHTC"], re:/rent.{0,20}limit|maximum\s+rent/i },
  { role:"LIHTC_COMPLIANCE_MANUAL", programs:["LIHTC"], re:/(?:lihtc|tax\s*credit|housing\s*credit).{0,60}(?:compliance|monitoring).{0,30}(?:manual|guide|handbook)|(?:compliance|monitoring).{0,30}(?:manual|guide|handbook).{0,60}(?:lihtc|tax\s*credit|housing\s*credit)/i },
  { role:"HOTMA_STATE_GUIDANCE", programs:["HOTMA"], re:/\bhotma\b|housing\s+opportunity\s+through\s+modernization/i },
  { role:"HCV_STATE_ADMIN_PLAN", programs:["SECTION_8","HCV"], re:/housing\s+choice\s+voucher|(^|[^a-z])hcv([^a-z]|$)|section\s*8/i },
  { role:"PBV_STATE_POLICY", programs:["SECTION_8","HCV","PBV"], re:/project[-\s]+based\s+voucher|(^|[^a-z])pbv([^a-z]|$)/i },
  { role:"SECTION_202_STATE_OVERLAY", programs:["SECTION_202"], re:/section\s*202|supportive\s+housing.{0,40}elder/i },
  { role:"SECTION_811_STATE_OVERLAY", programs:["SECTION_811"], re:/section\s*811|811\s*pra|811pra|supportive\s+housing.{0,40}disabil/i }
];
const PAGE_RE = /qap|qualified|compliance|monitor|income|rent|hotma|voucher|hcv|pbv|section[-_/ ]?(?:8|202|811)|supportive[-_/ ]housing|forms?|documents?|property[-_/ ]manager/i;

function clean(v){return String(v??"").replace(/<[^>]+>/g," ").replace(/&amp;/gi,"&").replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim()}
function officialHost(host,domain){host=host.toLowerCase();domain=domain.toLowerCase();return host===domain||host.endsWith(`.${domain}`)}
function classify(label,url,type=""){const hay=`${label} ${decodeURIComponent(url)} ${type}`;const roles=[];const programs=new Set();for(const p of ROLE_PATTERNS){if(p.re.test(hay)){roles.push(p.role);p.programs.forEach(x=>programs.add(x));}}return{roles:[...new Set(roles)],programs:[...programs]}}
function magic(b){const h=Buffer.from(b.subarray(0,8));if(h.subarray(0,5).toString("ascii")==="%PDF-")return"pdf";if(h.subarray(0,2).toString("ascii")==="PK")return"zip_ooxml";if(h.equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))return"ole_compound";return null}
async function get(url,timeout=30000){const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(timeout),headers:{"user-agent":"Mozilla/5.0 CertivoIQ-Required-State-Document-Overlay/1.0","cache-control":"no-cache","accept":"application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,*/*;q=0.5"}});if(!r.ok)throw new Error(`http_status:${r.status}`);const b=new Uint8Array(await r.arrayBuffer());if(!b.byteLength||b.byteLength>MAX_BYTES)throw new Error("invalid_size");return{r,b,ct:String(r.headers.get("content-type")??"").split(";",1)[0].toLowerCase()}}
function anchors(html,base){const out=[];const re=/<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;for(const m of html.matchAll(re)){const raw=String(m[1]??m[2]??m[3]??"").replace(/&amp;/gi,"&").trim();try{const u=new URL(raw,base);u.hash="";if(u.protocol==="https:")out.push({url:u.href,label:clean(m[4])});}catch{}}return out}

const all=[]; const failures=[];
for(const j of (inventory.jurisdictions??[]).filter(x=>/^[A-Z]{2}$/.test(x.state_code)&&x.state_code!=="DC")){
  const pages=new Set((j.sources??[]).map(x=>x.url));
  for(const source of j.sources??[]){
    try{
      const u=new URL(source.url);if(!officialHost(u.hostname,j.official_domain))continue;
      const {r,b,ct}=await get(source.url);
      if(ct.includes("html")){
        for(const a of anchors(Buffer.from(b).toString("utf8"),r.url)){
          const c=classify(a.label,a.url,source.type);if(!c.roles.length)continue;
          if(DOC_EXT.test(a.url)) all.push({j,c,a,discovery_url:source.url,authorization:"direct_document_link_on_official_page"});
          else {try{const u2=new URL(a.url);if(officialHost(u2.hostname,j.official_domain)&&PAGE_RE.test(`${a.label} ${a.url}`))pages.add(a.url);}catch{}}
        }
      } else {
        const c=classify(source.type,r.url,source.type);if(c.roles.length)all.push({j,c,a:{url:r.url,label:source.type},discovery_url:source.url,authorization:"official_direct_source"});
      }
    }catch(e){failures.push({state_code:j.state_code,url:source.url,error:e instanceof Error?e.message:String(e)});}
  }
  for(const page of [...pages].slice(0,35)){
    try{
      const u=new URL(page);if(!officialHost(u.hostname,j.official_domain))continue;
      const {r,b,ct}=await get(page);if(!ct.includes("html"))continue;
      for(const a of anchors(Buffer.from(b).toString("utf8"),r.url)){
        const c=classify(a.label,a.url);if(!c.roles.length||!DOC_EXT.test(a.url))continue;
        all.push({j,c,a,discovery_url:page,authorization:"direct_document_link_on_official_page"});
      }
    }catch(e){failures.push({state_code:j.state_code,url:page,error:e instanceof Error?e.message:String(e)});}
  }
}
const seen=new Set(); const documents=[];
for(const x of all){const key=`${x.j.state_code}|${x.a.url}`;if(seen.has(key))continue;seen.add(key);try{const {r,b,ct}=await get(x.a.url,45000);const m=magic(b);if(!m)throw new Error("not_supported_document");documents.push({state_code:x.j.state_code,agency:x.j.agency,official_domain:x.j.official_domain,document_title:x.a.label||x.c.roles.join(" / "),source_type:x.c.roles.join("_AND_"),program_document_roles:x.c.roles,programs:x.c.programs,source_url:x.a.url,final_url:r.url,discovery_url:x.discovery_url,attachment_authorization:x.authorization,content_type:ct||null,document_magic:m,byte_size:b.byteLength,source_sha256:createHash("sha256").update(b).digest("hex"),retrieved_at:new Date().toISOString(),exact_bytes_captured:true,evidence_kind:"exact_document_bytes",validation_evidence_eligible:true,agent_verification_status:"captured_unvalidated",independent_validation_required:true,compliance_activation_allowed:false});}catch(e){failures.push({state_code:x.j.state_code,url:x.a.url,discovery_url:x.discovery_url,error:e instanceof Error?e.message:String(e)});}}
const coverage=(inventory.jurisdictions??[]).filter(x=>/^[A-Z]{2}$/.test(x.state_code)&&x.state_code!=="DC").map(j=>({state_code:j.state_code,documents:documents.filter(d=>d.state_code===j.state_code).length,roles:[...new Set(documents.filter(d=>d.state_code===j.state_code).flatMap(d=>d.program_document_roles))]}));
await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify({generated_at:new Date().toISOString(),documents,failures,coverage},null,2));console.log(JSON.stringify({documents:documents.length,states_with_documents:coverage.filter(x=>x.documents>0).length,failures:failures.length},null,2));
