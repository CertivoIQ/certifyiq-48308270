import { mkdir, writeFile } from "node:fs/promises";

const pages = [
  "https://thda.org/rental-housing-partn/housing-credit-compliance/",
  "https://thda.org/rental-housing-partn/thomas-documents/",
  "https://thda.org/help-for-renters/hcv-administrative-plans-policy-and-rules/",
  "https://thda.org/help-for-renters/pbv-page/",
  "https://thda.org/rental-housing-partn/project-based-vouchers/",
  "https://thda.org/rental-housing-partn/utility-allowances/",
];

const terms = /(THOMAS Compliance Guide|HOTMA Compliance Training|Employment Verification|Asset Self-Certification|HO-0423|Utility Allowance|2026 Emergency Rule Changes|2025 PBV|5-Year PHA Plan|Administrative Plan Effective June 2024|PBV Chapter|Administrative Plan)/i;

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(?:8211|x2013);/gi, "–")
    .replace(/&#(?:8212|x2014);/gi, "—")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const result = [];
for (const page of pages) {
  const response = await fetch(page, {
    headers: { "user-agent": "Mozilla/5.0 CertivoIQ-THDA-Link-Diagnostic/1.0", accept: "text/html,*/*;q=0.8" },
    signal: AbortSignal.timeout(30000),
  });
  const pageResult = { page, status: response.status, final_url: response.url, links: [] };
  console.log(`\nPAGE ${page} HTTP ${response.status} ${response.url}`);
  if (response.ok) {
    const html = await response.text();
    const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(re)) {
      const label = clean(match[4]);
      if (!terms.test(label)) continue;
      const raw = String(match[1] ?? match[2] ?? match[3] ?? "").replace(/&amp;/gi, "&").trim();
      let url = raw;
      try { url = new URL(raw, response.url).toString(); } catch {}
      const item = { label, url };
      pageResult.links.push(item);
      console.log(JSON.stringify(item));
    }
  }
  result.push(pageResult);
}

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/thda-current-document-links.json", JSON.stringify({ generated_at: new Date().toISOString(), pages: result }, null, 2));
