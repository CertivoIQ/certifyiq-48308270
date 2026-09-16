import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const targets = [
  ['e9d6b99b-a054-4f27-8a7a-ba9ec79a3b09','AZ','2026_2027_AMENDED_QAP','https://housing.az.gov/sites/default/files/2026-08/2026-2027%20QAP-ADOH%20Clean%20Copy.pdf','pdf'],
  ['1d2b4358-397d-4345-8552-65bbe7c1e978','AZ','COMPLIANCE_MANUAL','https://housing.az.gov/resources/lihtc-compliance-manual','html'],
  ['7e6b8561-2763-49da-aadc-e612541404cb','AZ','COMPLIANCE_MANUAL','https://housing.az.gov/sites/default/files/2025-08/LIHTC-Compliance-Manual_2025.pdf','pdf'],
  ['092f365f-2c0c-433b-a9d8-f201267a55ab','AZ','INCOME_AND_RENT_LIMITS','https://housing.az.gov/resources/2026-lihtc-rent-income-limits-post-1989-effective-512026','html'],
  ['2f32055d-df5e-4f5f-affb-d26725afdd8b','AZ','INCOME_AND_RENT_LIMITS','https://housing.az.gov/sites/default/files/2026-05/IB-25-2026-LIHTC-IncomeandRent-Limits.pdf','pdf'],
  ['85855b1c-2ae2-488c-8d74-85ddbe048413','AZ','TENANT_INCOME_CERTIFICATION','https://housing.az.gov/sites/default/files/2025-01/LIHTC-ADOH-TIC-Printable%20Version_Revised%2001_30_2025.pdf','pdf'],
  ['b788780f-0682-4548-a67b-18b2e936f9e2','KY','COMPLIANCE_REVIEW_POLICY','https://www.kyhousing.org/Partners/Inspections-and-Compliance/Compliance/Documents/KHC%20LIHTC%20Manual%20-%20Final%203-31-2026%20%28added%20to%20website%29.pdf','pdf'],
  ['d4fef523-e20e-46cb-934b-ed6c2e8cc444','KY','HOTMA_IMPLEMENTATION_GUIDANCE','https://www.kyhousing.org/Partners/Inspections-and-Compliance/Compliance/Documents/KHC%20HOTMA%20Guidance.pdf','pdf'],
  ['4e1050bb-5100-47a9-8a13-c0c6fa869b4e','MD','ANNUAL_ALLOCATION_PLAN','https://dhcd.maryland.gov/media/524','auto'],
  ['a775afb2-27f1-4902-a11b-1af6b71e470c','MI','ALLOCATION_PLAN','https://www.michigan.gov/mshda/-/media/Project/Websites/mshda/developers/htf/Round_4_HTF_Allocation_Plan.docx?rev=180fba76d8744338bcf4162c768b9dcb','docx'],
  ['24b1ddeb-e5a7-4f40-9fc3-144c00b20521','MI','PROPOSED_RULE_DEVELOPMENT_PAGE','https://www.michigan.gov/mshda/developers/lihtc/spotlight/2028-2029-qualified-allocation-plan-updates','html'],
  ['ac874a83-2d15-4143-a064-29f5c7d4c71c','MN','FEDERAL_HOME_LIMITS','https://www.huduser.gov/portal/datasets/home-income-limits.html','html'],
  ['e183a051-0076-40cd-857a-aaa0e8d5778e','MN','FEDERAL_NHTF_LIMITS','https://www.huduser.gov/portal/datasets/htf-income-limits.html','html'],
  ['94259a15-e61f-4c1e-8bb4-be0f8840e73e','UT','LIHTC_APPLICATION_AND_QAP_INDEX','https://utahhousingcorp.org/multifamily/applicationInfo/','html'],
].map(([id,state,sourceType,url,expected]) => ({id,state,sourceType,url,expected}));

const outDir='artifacts/exact-sha-recovery';
const filesDir=`${outDir}/files`;
await mkdir(filesDir,{recursive:true});
const browserUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

const kind = (buf, ct='') => {
  const h=buf.subarray(0,16).toString('hex');
  if (buf.subarray(0,5).toString()==='%PDF-') return 'pdf';
  if (buf.subarray(0,4).toString('hex')==='504b0304') return 'docx_or_zip';
  const p=buf.subarray(0,512).toString('utf8').trimStart().toLowerCase();
  if (ct.includes('text/html') || p.startsWith('<!doctype html') || p.startsWith('<html')) return 'html';
  return `other:${h}`;
};

async function capture(t){
  const started=new Date().toISOString();
  let last;
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      const origin=new URL(t.url).origin;
      const r=await fetch(t.url,{redirect:'follow',headers:{'user-agent':browserUA,'accept':'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html,application/xhtml+xml,*/*;q=0.8','cache-control':'no-cache','pragma':'no-cache','referer':`${origin}/`}});
      const ab=await r.arrayBuffer();
      const buf=Buffer.from(ab);
      const ct=(r.headers.get('content-type')||'').toLowerCase();
      const detected=kind(buf,ct);
      const sha256=createHash('sha256').update(buf).digest('hex');
      const okStatus=r.status>=200&&r.status<300;
      const expectedOk=t.expected==='auto' || (t.expected==='pdf'&&detected==='pdf') || (t.expected==='docx'&&detected==='docx_or_zip') || (t.expected==='html'&&detected==='html');
      const ext=detected==='pdf'?'pdf':detected==='docx_or_zip'?'docx':detected==='html'?'html':'bin';
      const path=`${filesDir}/${t.id}.${ext}`;
      await writeFile(path,buf);
      last={...t,attempt,http_status:r.status,final_url:r.url,content_type:ct,byte_length:buf.length,sha256,magic_signature:buf.subarray(0,8).toString('hex'),detected_kind:detected,expected_ok:expectedOk,exact:okStatus&&expectedOk,retrieval_time:new Date().toISOString(),artifact_path:path,started_at:started};
      if (last.exact) return last;
    } catch (e) {
      last={...t,attempt,exact:false,error:e instanceof Error?e.message:String(e),retrieval_time:new Date().toISOString(),started_at:started};
    }
    await new Promise(r=>setTimeout(r,1500*attempt));
  }
  return last;
}

const results=[];
for (const t of targets) {
  const r=await capture(t); results.push(r); console.log(JSON.stringify({id:r.id,state:r.state,status:r.http_status,exact:r.exact,kind:r.detected_kind,sha256:r.sha256,error:r.error}));
}
const manifest={generated_at:new Date().toISOString(),runner:'github-actions',workflow:'exact-sha-recovery-20260916',targets:results,success_count:results.filter(x=>x.exact).length,failure_count:results.filter(x=>!x.exact).length};
await writeFile(`${outDir}/manifest.json`,JSON.stringify(manifest,null,2));
console.log(`exact=${manifest.success_count} failed=${manifest.failure_count}`);
if (manifest.failure_count) process.exitCode=2;
