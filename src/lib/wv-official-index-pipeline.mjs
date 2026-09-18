import { createHash } from "node:crypto";

export const WVHDF_MULTIFAMILY_INDEX_URL =
  "https://www.wvhdf.com/programs/multi-family-programs-and-resources/";
export const WVHDF_MULTIFAMILY_INDEX_FALLBACK_URL =
  "https://www.wvhdf.com/program/on-site-systems-program";
export const WV_INDEX_PIPELINE_BUILD = "wv-official-index-2026.09.17.2";
const MAX_BYTES = 5 * 1024 * 1024;

function trustedWvhdfUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ["wvhdf.com", "www.wvhdf.com"].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function prepareWvOfficialIndexSnapshot({
  sourceUrl,
  finalUrl,
  body,
  contentType,
  retrievedAt,
} = {}) {
  if (!trustedWvhdfUrl(sourceUrl) || !trustedWvhdfUrl(finalUrl)) {
    return { stage_status: "BLOCKED", reason_code: "NON_OFFICIAL_WVHDF_SOURCE" };
  }
  const bytes = body instanceof Uint8Array ? body : Buffer.from(String(body ?? ""), "utf8");
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) {
    return { stage_status: "BLOCKED", reason_code: "SOURCE_SIZE_INVALID" };
  }
  if (!String(contentType ?? "").toLowerCase().includes("text/html")) {
    return { stage_status: "BLOCKED", reason_code: "SOURCE_CONTENT_TYPE_INVALID" };
  }
  const retrieved = new Date(String(retrievedAt ?? ""));
  if (Number.isNaN(retrieved.valueOf())) {
    return { stage_status: "BLOCKED", reason_code: "RETRIEVED_AT_INVALID" };
  }
  const html = Buffer.from(bytes).toString("utf8");
  const requiredMarkers = [
    /LIHTCP Compliance Documents/i,
    /West Virginia Income Limits Report/i,
    /LIHTC Income Asset Worksheet/i,
  ];
  if (!requiredMarkers.every((marker) => marker.test(html))) {
    return { stage_status: "BLOCKED", reason_code: "WV_RESOURCE_MARKERS_INCOMPLETE" };
  }
  return {
    stage_status: "VALIDATED_FOR_STAGING",
    activation_status: "BLOCKED_PENDING_CONTENT_VALIDATION",
    official_url: sourceUrl,
    retrieval_url: finalUrl,
    authority: "West Virginia Housing Development Fund",
    program: "LIHTC",
    jurisdiction: "WV",
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    retrieved_at: retrieved.toISOString(),
    content_type: String(contentType).split(";", 1)[0].toLowerCase(),
    content_length: bytes.byteLength,
    parser_build: WV_INDEX_PIPELINE_BUILD,
    compliance_activation_allowed: false,
  };
}
