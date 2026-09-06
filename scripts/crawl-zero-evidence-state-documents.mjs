import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/zero-evidence-state-documents.json");
const MAX_BYTES = 30 * 1024 * 1024;

const specs = [
  { state_code:"MS", agency:"Mississippi Home Corporation", official_domain:"mshomecorp.com", title:"2023 Compliance Monitoring Plan", source_type:"MS_LIHTC_COMPLIANCE_MONITORING_PLAN", roles:["LIHTC_COMPLIANCE_MANUAL"], programs:["LIHTC"], source_url:"https://archivemhc.com/Compliance/Manual/2023%20CMP.pdf", discovery_url:"https://www.mshomecorp.com/property-managers/htc-compliance-forms-and-resources/", allowed_hosts:["archivemhc.com"] },
  { state_code:"MS", agency:"Mississippi Home Corporation", official_domain:"mshomecorp.com", title:"MHC Post HOTMA Cover Sheet", source_type:"MS_HOTMA_COVER_SHEET", roles:["HOTMA_GUIDANCE","COMPLIANCE_FORM"], programs:["LIHTC","HOTMA"], source_url:"https://archivemhc.com/Compliance/Forms/HTC/MHC%20Post%20HOTMA%20Cover%20sheet.pdf", discovery_url:"https://www.mshomecorp.com/property-managers/htc-compliance-forms-and-resources/", allowed_hosts:["archivemhc.com"] },
  { state_code:"MS", agency:"Mississippi Home Corporation", official_domain:"mshomecorp.com", title:"2026 MTSP Income and Rent Limits", source_type:"MS_2026_MTSP_LIMITS", roles:["LIHTC_INCOME_RENT_LIMITS"], programs:["LIHTC"], source_url:"https://archivemhc.com/Compliance/Resources/HTC/2026%20MTSP%20Limits.pdf", discovery_url:"https://www.mshomecorp.com/property-managers/htc-compliance-forms-and-resources/", allowed_hosts:["archivemhc.com"] },

  { state_code:"NE", agency:"Nebraska Investment Finance Authority", official_domain:"nifa.org", title:"2026-2028 Qualified Allocation Plan", source_type:"NE_2026_2028_LIHTC_QAP", roles:["LIHTC_QAP"], programs:["LIHTC"], source_url:"https://www-nifa-org-files.s3.amazonaws.com/c0d6-32307177-0.0_26-27-28_Full_QAP_Doc.pdf?pfvId=19y103.m8j47ehh", discovery_url:"https://www.nifa.org/developers-property-managers/forms-docs", allowed_hosts:["www-nifa-org-files.s3.amazonaws.com"] },
  { state_code:"NE", agency:"Nebraska Investment Finance Authority", official_domain:"nifa.org", title:"LIHTC Compliance Manual", source_type:"NE_LIHTC_COMPLIANCE_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL"], programs:["LIHTC"], source_url:"https://www-nifa-org-files.s3.amazonaws.com/90fb-91477867-Compliance_Manual_12-21-final.pdf?pfvId=19rqzv.kyuh16mz", discovery_url:"https://www.nifa.org/developers-property-managers/forms-docs", allowed_hosts:["www-nifa-org-files.s3.amazonaws.com"] },
  { state_code:"NE", agency:"Nebraska Investment Finance Authority", official_domain:"nifa.org", title:"Employment Verification", source_type:"NE_EMPLOYMENT_VERIFICATION", roles:["COMPLIANCE_FORM"], programs:["LIHTC","HOTMA"], source_url:"https://www-nifa-org-files.s3.amazonaws.com/03f9-28177867-EMPLOYMENT_VERIFICATION.pdf?pfvId=19rqta.kyuf7f8d", discovery_url:"https://www.nifa.org/developers-property-managers/forms-docs", allowed_hosts:["www-nifa-org-files.s3.amazonaws.com"] },

  { state_code:"NJ", agency:"New Jersey Housing and Mortgage Finance Agency", official_domain:"njhousing.gov", title:"Tenant Income Certification (HOTMA)", source_type:"NJ_HOTMA_TENANT_INCOME_CERTIFICATION", roles:["COMPLIANCE_FORM","HOTMA_GUIDANCE"], programs:["LIHTC","HOTMA"], source_url:"https://www.nj.gov/dca/hmfa/developers/docs/lihtc/compliance/compliance_forms/tc_comp_tenant_income_cert.pdf", discovery_url:"https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/", allowed_hosts:["www.nj.gov","nj.gov"] },
  { state_code:"NJ", agency:"New Jersey Housing and Mortgage Finance Agency", official_domain:"njhousing.gov", title:"Asset Self Certification", source_type:"NJ_ASSET_SELF_CERTIFICATION", roles:["COMPLIANCE_FORM"], programs:["LIHTC","HOTMA"], source_url:"https://www.nj.gov/dca/hmfa/developers/docs/lihtc/compliance/compliance_forms/AssetSelfCertification.pdf", discovery_url:"https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/", allowed_hosts:["www.nj.gov","nj.gov"] },
  { state_code:"NJ", agency:"New Jersey Housing and Mortgage Finance Agency", official_domain:"njhousing.gov", title:"Employment Verification", source_type:"NJ_EMPLOYMENT_VERIFICATION", roles:["COMPLIANCE_FORM"], programs:["LIHTC","HOTMA"], source_url:"https://www.nj.gov/dca/hmfa/developers/docs/lihtc/compliance/compliance_forms/tc_comp_employee_ver.pdf", discovery_url:"https://www.nj.gov/dca/hmfa/developers/lihtc/compliance/", allowed_hosts:["www.nj.gov","nj.gov"] },

  { state_code:"SC", agency:"South Carolina State Housing Finance and Development Authority", official_domain:"schousing.com", title:"LIHTC Compliance Manual — Updated 11/19/2024", source_type:"SC_LIHTC_COMPLIANCE_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL","HOTMA_GUIDANCE"], programs:["LIHTC","HOTMA"], source_url:"https://www.schousing.com/library/Monitoring/LIHTC%20Compliance%20Manual%20--%20Updated%2011.19.2024-%20Final.pdf", discovery_url:"https://www.schousing.com/", allowed_hosts:["www.schousing.com","schousing.com"] },

  { state_code:"SD", agency:"South Dakota Housing", official_domain:"sdhousing.org", title:"Housing Tax Credit Compliance Manual", source_type:"SD_LIHTC_COMPLIANCE_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL","HOTMA_GUIDANCE","SECTION8_HCV_FORM"], programs:["LIHTC","HOTMA","SECTION_8","HCV"], source_url:"https://www.sdhousing.org/s/2025HTC.pdf", discovery_url:"https://www.sdhousing.org/forms/housing-tax-credit-compliance-manual", allowed_hosts:["www.sdhousing.org","sdhousing.org"] },

  { state_code:"UT", agency:"Utah Housing Corporation", official_domain:"utahhousingcorp.org", title:"Compliance Manual", source_type:"UT_LIHTC_COMPLIANCE_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL"], programs:["LIHTC"], source_url:"https://utahhousingcorp.org/pdf/ComplianceManual.pdf", discovery_url:"https://utahhousingcorp.org/", allowed_hosts:["utahhousingcorp.org","www.utahhousingcorp.org"] },

  { state_code:"VA", agency:"Virginia Housing", official_domain:"virginiahousing.com", title:"2026 Federal Housing Credit Manual", source_type:"VA_2026_LIHTC_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL","LIHTC_QAP"], programs:["LIHTC"], source_url:"https://mc-7eaf08cc-3802-4bab-9abf-a732-cdn-endpoint.azureedge.net/-/media/docs/partners/rental-housing/rental-financing-tax-credits/how-does-it-work/2026-federal-housing-credit-manual.pdf?hash=7679B592362EE54300BE3E0DBD7964A1&rev=530f3ff25ff340cba92363f7e606fbd1", discovery_url:"https://www.virginiahousing.com/partners/rental-housing/compliance-monitoring/guidance", allowed_hosts:["mc-7eaf08cc-3802-4bab-9abf-a732-cdn-endpoint.azureedge.net"] },
  { state_code:"VA", agency:"Virginia Housing", official_domain:"virginiahousing.com", title:"Housing Choice Voucher Administrative Plan", source_type:"VA_HCV_ADMIN_PLAN", roles:["HCV_ADMIN_PLAN","PBV_POLICY"], programs:["SECTION_8","HCV","PBV"], source_url:"https://mc-7eaf08cc-3802-4bab-9abf-a732-cdn-endpoint.azureedge.net/-/media/docs/renters/housing-choice-voucher-program/administrative-plan.pdf?hash=C84EA10B067672404BAF5D4F107E850B&rev=5e68506d37b84239a6f7d680778d3098", discovery_url:"https://www.virginiahousing.com/partners/rental-housing/compliance-monitoring/guidance", allowed_hosts:["mc-7eaf08cc-3802-4bab-9abf-a732-cdn-endpoint.azureedge.net"] },
  { state_code:"VA", agency:"Virginia Housing", official_domain:"virginiahousing.com", title:"HOTMA Guidance Summary — Updated October 2025", source_type:"VA_HOTMA_GUIDANCE", roles:["HOTMA_GUIDANCE"], programs:["LIHTC","HOTMA","SECTION_8","HCV","PBV"], source_url:"https://www.virginiahousing.com/-/media/docs/partners/rental-housing/compliance-monitoring/hotma-guidance-summary_updated_oct-2025.pdf?hash=2937748EC4FA07C7C724F59B3016C638&rev=0bf3aeb7e24a465584f461499f14d1a3&sc_lang=en", discovery_url:"https://www.virginiahousing.com/partners/rental-housing/compliance-monitoring/guidance", allowed_hosts:["www.virginiahousing.com","virginiahousing.com"] },

  { state_code:"WV", agency:"West Virginia Housing Development Fund", official_domain:"wvhdf.com", title:"2025 and 2026 Tax Credit Manual", source_type:"WV_2025_2026_LIHTC_MANUAL", roles:["LIHTC_COMPLIANCE_MANUAL"], programs:["LIHTC"], source_url:"https://www.wvhdf.com/wp-content/uploads/2026/02/2025-and-2026-Tax-Credit-Manual.pdf", discovery_url:"https://www.wvhdf.com/property-managers/multifamily-programs/", allowed_hosts:["www.wvhdf.com","wvhdf.com"] },
];

function approved(url, allowedHosts) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" && allowedHosts.includes(parsed.hostname.toLowerCase());
}
function magic(bytes) {
  const h = Buffer.from(bytes.subarray(0, 8));
  if (h.subarray(0,5).toString("ascii") === "%PDF-") return "pdf";
  if (h.subarray(0,2).toString("ascii") === "PK") return "zip_ooxml";
  if (h.equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) return "ole_compound";
  return null;
}
async function capture(spec) {
  if (!approved(spec.source_url, spec.allowed_hosts)) throw new Error("unapproved_initial_host");
  const response = await fetch(spec.source_url, { redirect:"follow", signal:AbortSignal.timeout(45_000), headers:{"user-agent":"Mozilla/5.0 CertivoIQ-Zero-State-Exact-Document-Capture/1.0","cache-control":"no-cache"} });
  if (!response.ok) throw new Error(`http_status:${response.status}`);
  if (!approved(response.url, spec.allowed_hosts)) throw new Error(`redirected_to_unapproved_host:${new URL(response.url).hostname}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_document_size");
  const documentMagic = magic(bytes);
  if (!documentMagic) throw new Error("response_is_not_supported_document");
  return {
    ...spec,
    allowed_hosts: undefined,
    final_url: response.url,
    content_type: String(response.headers.get("content-type") ?? "").split(";",1)[0].toLowerCase() || null,
    document_magic: documentMagic,
    byte_size: bytes.byteLength,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: new Date().toISOString(),
    etag: response.headers.get("etag"),
    last_modified: response.headers.get("last-modified"),
    exact_bytes_captured: true,
    evidence_kind: "exact_document_bytes",
    validation_evidence_eligible: true,
    agent_verification_status: "captured_unvalidated",
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

const documents=[]; const failures=[];
for (const spec of specs) {
  try { documents.push(await capture(spec)); }
  catch (error) { failures.push({state_code:spec.state_code,title:spec.title,source_url:spec.source_url,error:error instanceof Error?error.message:String(error)}); }
}
const coverage=[...new Set(specs.map(s=>s.state_code))].map(state_code=>({state_code,documents:documents.filter(d=>d.state_code===state_code).length,failures:failures.filter(f=>f.state_code===state_code).length}));
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify({generated_at:new Date().toISOString(),documents,failures,coverage},null,2));
console.log(JSON.stringify({outputPath,documents:documents.length,failures:failures.length,coverage},null,2));
if (coverage.some(row=>row.documents===0)) process.exitCode=2;
