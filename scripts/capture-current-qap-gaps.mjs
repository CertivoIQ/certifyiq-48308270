import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/current-qap-gap-documents.json");
const MAX_BYTES = 40 * 1024 * 1024;

const specs = [
  {
    state_code: "CA",
    agency: "California Tax Credit Allocation Committee",
    title: "December 10, 2025 Adopted CTCAC Regulations — operative LIHTC allocation rules",
    source_url: "https://www.treasurer.ca.gov/ctcac/programreg/2025/20251210/regulations_clean.pdf",
    discovery_url: "https://www.treasurer.ca.gov/ctcac/programreg/regulations.asp",
    allowed_hosts: ["www.treasurer.ca.gov", "treasurer.ca.gov"],
    applicability_note: "California administers LIHTC allocation through adopted CTCAC regulations rather than a separately titled QAP PDF.",
  },
  {
    state_code: "IL",
    agency: "Illinois Housing Development Authority",
    title: "2026 IHDA Qualified Allocation Plan",
    source_url: "https://www.ihda.org/wp-content/uploads/2026/08/2026-IHDA-Qualified-Allocation-Plan.pdf",
    discovery_url: "https://www.ihda.org/developers/tax-credits/low-income-tax-credit/",
    allowed_hosts: ["www.ihda.org", "ihda.org"],
  },
  {
    state_code: "MI",
    agency: "Michigan State Housing Development Authority",
    title: "2026 Qualified Allocation Plan — Signed",
    source_url: "https://www.michigan.gov/mshda/-/media/Project/Websites/mshda/developers/LIHTC/Qualified-Allocation-Plan/2026-Qualified-Allocation-Plan-Signed.pdf",
    discovery_url: "https://www.michigan.gov/mshda/developers/lihtc/lihtc/qualified-allocation-plan",
    allowed_hosts: ["www.michigan.gov", "michigan.gov"],
  },
  {
    state_code: "MO",
    agency: "Missouri Housing Development Commission",
    title: "2026 Qualified Allocation Plan — Final",
    source_url: "https://mhdc.com/media/wrin1f5m/qualified-allocation-plan_2026.pdf",
    discovery_url: "https://mhdc.com/programs/multifamily/",
    allowed_hosts: ["mhdc.com", "www.mhdc.com"],
  },
  {
    state_code: "MS",
    agency: "Mississippi Home Corporation",
    title: "2026 Qualified Allocation Plan — Final",
    source_url: "https://archivemhc.com/htc/2026/3022026_2026%20QAP_FINAL_Addendum%20L.pdf",
    discovery_url: "https://www.mshomecorp.com/developers/low-income-housing-tax-credits/",
    allowed_hosts: ["archivemhc.com", "www.archivemhc.com"],
  },
  {
    state_code: "MT",
    agency: "Montana Department of Commerce — Housing",
    title: "2026 Housing Credit Qualified Allocation Plan",
    source_url: "https://commerce.mt.gov/_shared/Housing/Multifamily/docs/2026-2027-QAP/July-2025/2026-QAP.pdf",
    discovery_url: "https://commerce.mt.gov/Housing/Developers/Housing-Credit/Qualified-Allocation-Plan",
    allowed_hosts: ["commerce.mt.gov"],
  },
  {
    state_code: "ND",
    agency: "North Dakota Housing Finance Agency",
    title: "2026 LIHTC Allocation Plan",
    source_url: "https://www.ndhousing.nd.gov/wp-content/uploads/2025/06/2026LIHTCAllocationPlan.pdf",
    discovery_url: "https://www.ndhousing.nd.gov/development",
    allowed_hosts: ["www.ndhousing.nd.gov", "ndhousing.nd.gov"],
  },
  {
    state_code: "NJ",
    agency: "New Jersey Housing and Mortgage Finance Agency",
    title: "Adopted 2026 Qualified Allocation Plan",
    source_url: "https://www.nj.gov/dca/hmfa/developers/docs/lihtc/qap/tc_qap.pdf",
    discovery_url: "https://www.nj.gov/dca/hmfa/developers/lihtc/qap/",
    allowed_hosts: ["www.nj.gov", "nj.gov"],
  },
  {
    state_code: "NV",
    agency: "Nevada Housing Division",
    title: "2026 Qualified Allocation Plan — revised March 25, 2026",
    source_url: "https://housing.nv.gov/uploadedFiles/housingnewnvgov/Content/Programs/LIT/QAP/2026%20QAP%20rev%2003.25.2026%20.pdf",
    discovery_url: "https://housing.nv.gov/Programs/LIHTC_Program/",
    allowed_hosts: ["housing.nv.gov"],
  },
  {
    state_code: "OR",
    agency: "Oregon Housing and Community Services",
    title: "2025 Qualified Allocation Plan — operative current plan",
    source_url: "https://www.oregon.gov/ohcs/development/Documents/lihtc/2024/qap-2025-final.pdf",
    discovery_url: "https://www.oregon.gov/ohcs/rental-housing/housing-development/development-resources/pages/low-income-housing-tax-credits.aspx",
    allowed_hosts: ["www.oregon.gov", "oregon.gov"],
    applicability_note: "OHCS continues to identify the 2025 final QAP as the operative plan while the next cycle is under development.",
  },
  {
    state_code: "SC",
    agency: "South Carolina State Housing Finance and Development Authority",
    title: "2026 Qualified Allocation Plan — Revised and Approved March 31, 2026",
    source_url: "https://schousing.sc.gov/sites/schousing/files/Documents/Development/LIHTC/2026/2026%20QAP%20Revised%20and%20Approved%2003.31.2026.pdf",
    discovery_url: "https://schousing.sc.gov/development/lihtc",
    allowed_hosts: ["schousing.sc.gov"],
  },
  {
    state_code: "SD",
    agency: "South Dakota Housing",
    title: "2026-2027 Housing Tax Credit Qualified Allocation Plan — Final July 2026",
    source_url: "https://www.sdhousing.org/s/2026-2027-HTC-QAP-Final-072026.pdf",
    discovery_url: "https://www.sdhousing.org/develop-housing/available-development-programs/housing-tax-credits",
    allowed_hosts: ["www.sdhousing.org", "sdhousing.org", "static1.squarespace.com"],
  },
  {
    state_code: "UT",
    agency: "Utah Housing Corporation",
    title: "2026 Board Approved Qualified Allocation Plan",
    source_url: "https://utahhousingcorp.org/pdf/2026_Board_Approved_QAP.pdf",
    discovery_url: "https://utahhousingcorp.org/multifamily/applicationInfo/",
    allowed_hosts: ["utahhousingcorp.org", "www.utahhousingcorp.org"],
  },
  {
    state_code: "VT",
    agency: "Vermont Housing Finance Agency",
    title: "2024-2025 Vermont Qualified Allocation Plan — current through end of 2026",
    source_url: "https://vhfa.org/sites/default/files/documents/multifamily/Signed_VHFA%202024-25%20Vermont%20Qualified%20Allocation%20Plan_vf.pdf",
    discovery_url: "https://vhfa.org/developers/lihtc/qap",
    allowed_hosts: ["vhfa.org", "www.vhfa.org"],
    applicability_note: "VHFA identifies this signed QAP as remaining in use through the end of 2026.",
  },
  {
    state_code: "WI",
    agency: "Wisconsin Housing and Economic Development Authority",
    title: "2025-2026 Qualified Allocation Plan — updated July 29, 2026",
    source_url: "https://www.wheda.com/globalassets/documents/tax-credits/htc/2025/2025-26-qap.pdf",
    discovery_url: "https://www.wheda.com/developers-and-property-managers/tax-credits/htc/qap",
    allowed_hosts: ["www.wheda.com", "wheda.com"],
  },
  {
    state_code: "WV",
    agency: "West Virginia Housing Development Fund",
    title: "2025 and 2026 Allocation Plan",
    source_url: "https://www.wvhdf.com/wp-content/uploads/2026/02/2025-and-2026-Allocation-Plan-1.pdf",
    discovery_url: "https://www.wvhdf.com/programs/multi-family-programs-and-resources/low-income-housing-tax-credit-program/",
    allowed_hosts: ["www.wvhdf.com", "wvhdf.com"],
  },
  {
    state_code: "WY",
    agency: "Wyoming Community Development Authority",
    title: "2026 Affordable Housing Allocation Plan — LIHTC allocation plan",
    source_url: "https://www.wyomingcda.com/wp-content/uploads/2025/07/2026-AHAP-Final-UPDATED.pdf",
    discovery_url: "https://www.wyomingcda.com/affordable-housing/",
    allowed_hosts: ["www.wyomingcda.com", "wyomingcda.com"],
    applicability_note: "WCDA's AHAP is the allocation plan covering its 4% and 9% LIHTC allocations.",
  },
];

function allowed(url, hosts) {
  const parsed = new URL(url);
  return parsed.protocol === "https:" && hosts.includes(parsed.hostname.toLowerCase());
}
function magic(bytes) {
  const head = Buffer.from(bytes.subarray(0, 8));
  if (head.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (head.subarray(0, 2).toString("ascii") === "PK") return "zip_ooxml";
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "ole_compound";
  return null;
}
async function capture(spec) {
  if (!allowed(spec.source_url, spec.allowed_hosts)) throw new Error("unapproved_initial_host");
  const response = await fetch(spec.source_url, {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "user-agent": "Mozilla/5.0 CertivoIQ-Current-QAP-Capture/1.0",
      "cache-control": "no-cache",
      accept: "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.4",
    },
  });
  if (!response.ok) throw new Error(`http_status:${response.status}`);
  if (!allowed(response.url, spec.allowed_hosts)) {
    throw new Error(`redirected_to_unapproved_host:${new URL(response.url).hostname}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error("invalid_size");
  const documentMagic = magic(bytes);
  if (!documentMagic) throw new Error("not_supported_document");
  return {
    state_code: spec.state_code,
    agency: spec.agency,
    document_title: spec.title,
    source_type: "LIHTC_QAP",
    program_document_roles: ["LIHTC_QAP"],
    programs: ["LIHTC"],
    source_url: spec.source_url,
    final_url: response.url,
    discovery_url: spec.discovery_url,
    applicability_note: spec.applicability_note ?? null,
    content_type: String(response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase() || null,
    document_magic: documentMagic,
    byte_size: bytes.byteLength,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: new Date().toISOString(),
    exact_bytes_captured: true,
    evidence_kind: "exact_document_bytes",
    validation_evidence_eligible: true,
    agent_verification_status: "captured_unvalidated",
    independent_validation_required: true,
    compliance_activation_allowed: false,
  };
}

const documents = [];
const failures = [];
for (const spec of specs) {
  try {
    documents.push(await capture(spec));
  } catch (error) {
    failures.push({
      state_code: spec.state_code,
      source_url: spec.source_url,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ generated_at: new Date().toISOString(), documents, failures }, null, 2));
console.log(JSON.stringify({ captured: documents.length, failures }, null, 2));
if (failures.length) process.exitCode = 2;
