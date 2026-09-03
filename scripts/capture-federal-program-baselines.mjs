import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/federal-program-baselines.json");
const specs = [
  { source_type:"HUD_HCV_GUIDEBOOK_ELIGIBILITY", title:"HCV Guidebook — Eligibility Determination and Denial of Assistance", programs:["SECTION_8","HCV"], roles:["HCV_COMPLIANCE_GUIDEBOOK"], url:"https://www.hud.gov/sites/dfiles/PIH/documents/HCV_Guidebook_Eligibility_Determination_and_Denial_of_Assistance.pdf" },
  { source_type:"HUD_HCV_GUIDEBOOK_HOUSING_SEARCH_LEASING", title:"HCV Guidebook — Housing Search and Leasing (June 2025)", programs:["SECTION_8","HCV"], roles:["HCV_COMPLIANCE_GUIDEBOOK"], url:"https://www.hud.gov/sites/dfiles/PIH/documents/HCV-Guidebook_Housing-Search-and-Leasing-Chapter_June-2025.pdf" },
  { source_type:"HUD_HCV_GUIDEBOOK_PAYMENT_STANDARDS", title:"HCV Guidebook — Payment Standards (June 2025)", programs:["SECTION_8","HCV"], roles:["HCV_COMPLIANCE_GUIDEBOOK"], url:"https://www.hud.gov/sites/dfiles/PIH/documents/HCV_Guidebook_Payment-Standards_June-2025_final.pdf" },
  { source_type:"HUD_HCV_GUIDEBOOK_UTILITY_ALLOWANCES", title:"HCV Guidebook — Utility Allowances", programs:["SECTION_8","HCV"], roles:["HCV_COMPLIANCE_GUIDEBOOK","HCV_UTILITY_ALLOWANCE"], url:"https://www.hud.gov/sites/dfiles/PIH/documents/Utility_Allowance_Final_5.2020.pdf" },
  { source_type:"HUD_HCV_GUIDEBOOK_HAP_CONTRACTS", title:"HCV Guidebook — HAP Contracts (April 2023)", programs:["SECTION_8","HCV"], roles:["HCV_COMPLIANCE_GUIDEBOOK"], url:"https://www.hud.gov/sites/dfiles/PIH/documents/HAP%20Contracts%20HCV%20Guidebook%20Chapter_revised_april_2023.pdf" },
  { source_type:"HUD_PIH_2024_19_HCV_PBV_HOTMA", title:"PIH 2024-19 — HOTMA HCV and PBV Final Rule Guidance", programs:["SECTION_8","HCV","PBV","HOTMA"], roles:["PBV_COMPLIANCE_GUIDANCE","HCV_COMPLIANCE_GUIDANCE","HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/dfiles/OCHCO/documents/2024-19pihn.pdf" },
  { source_type:"HUD_PIH_2023_27_H_2023_10_HOTMA", title:"PIH 2023-27 / H 2023-10 — HOTMA Sections 102 and 104 Implementation Guidance", programs:["SECTION_8","HCV","PBV","HOTMA","HUD_MULTIFAMILY","SECTION_202","SECTION_811"], roles:["HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/dfiles/OCHCO/documents/2023-27pihn.pdf" },
  { source_type:"HUD_PIH_2024_38_HOTMA", title:"PIH 2024-38 — Updated HOTMA Compliance Guidance for PHAs", programs:["SECTION_8","HCV","PBV","HOTMA"], roles:["HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/dfiles/OCHCO/documents/2024-38pihn.pdf" },
  { source_type:"HUD_PIH_2026_09_H_2026_05_HOTMA", title:"PIH 2026-09 / H 2026-05 — HOTMA Interim Reexamination Amendment", programs:["SECTION_8","HCV","PBV","HOTMA","HUD_MULTIFAMILY","SECTION_202","SECTION_811"], roles:["HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/default/files/hudclips/documents/PIH-2026-09.pdf" },
  { source_type:"HUD_H_2025_07_HOTMA_MFH_DEADLINE", title:"H 2025-07 — Multifamily HOTMA Compliance Date", programs:["HOTMA","HUD_MULTIFAMILY","SECTION_202","SECTION_811"], roles:["HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/dfiles/hudclips/documents/HSGN-07.pdf" },
  { source_type:"HUD_PIH_2026_15_HOTMA_PHA_DEADLINE", title:"PIH 2026-15 — PHA HOTMA Compliance Deadline", programs:["SECTION_8","HCV","PBV","HOTMA"], roles:["HOTMA_GUIDANCE"], url:"https://www.hud.gov/sites/default/files/hudclips/documents/PIH-2026-15.pdf" },
  { source_type:"HUD_SECTION_202_HANDBOOK_4571_3_CH1", title:"HUD Handbook 4571.3 REV-1 — Section 202, Chapter 1", programs:["SECTION_202"], roles:["SECTION_202_HANDBOOK"], url:"https://www.hud.gov/sites/documents/45713c1hsgh.pdf" },
  { source_type:"HUD_SECTION_811_HANDBOOK_4571_2_CH1", title:"HUD Handbook 4571.2 — Section 811, Chapter 1", programs:["SECTION_811"], roles:["SECTION_811_HANDBOOK"], url:"https://www.hud.gov/sites/documents/45712c1hsgh.pdf" }
];

function supportedHost(url) {
  const u = new URL(url);
  return u.protocol === "https:" && (u.hostname === "www.hud.gov" || u.hostname === "hud.gov");
}
function magic(bytes) {
  const h = Buffer.from(bytes.subarray(0,8));
  return h.subarray(0,5).toString("ascii") === "%PDF-" ? "pdf" : null;
}
async function capture(spec) {
  if (!supportedHost(spec.url)) throw new Error("unapproved_host");
  const r = await fetch(spec.url, { redirect:"follow", signal:AbortSignal.timeout(60000), headers:{"user-agent":"Mozilla/5.0 CertivoIQ-Federal-Exact-Baseline/1.0","cache-control":"no-cache","accept":"application/pdf,*/*;q=0.5"} });
  if (!r.ok) throw new Error(`http_status:${r.status}`);
  if (!supportedHost(r.url)) throw new Error(`unapproved_redirect:${new URL(r.url).hostname}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > 40*1024*1024) throw new Error("invalid_size");
  if (magic(bytes) !== "pdf") throw new Error("not_pdf");
  return { ...spec, source_url:spec.url, final_url:r.url, content_type:String(r.headers.get("content-type")??"").split(";",1)[0].toLowerCase()||null, document_magic:"pdf", byte_size:bytes.byteLength, source_sha256:createHash("sha256").update(bytes).digest("hex"), retrieved_at:new Date().toISOString(), exact_bytes_captured:true, evidence_kind:"exact_document_bytes", validation_evidence_eligible:true, agent_verification_status:"captured_unvalidated", independent_validation_required:true, compliance_activation_allowed:false, federal_shared_source:true, applies_to_all_50_states:true };
}

const documents=[]; const failures=[];
for (const spec of specs) {
  try { documents.push(await capture(spec)); }
  catch (e) { failures.push({source_type:spec.source_type,url:spec.url,error:e instanceof Error?e.message:String(e)}); }
}
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify({generated_at:new Date().toISOString(),documents,failures},null,2));
console.log(JSON.stringify({documents:documents.length,failures},null,2));
if (failures.length) process.exitCode=2;
