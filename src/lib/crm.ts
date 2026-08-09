import type { Database } from "@/integrations/supabase/types";

export type Account = Database["public"]["Tables"]["crm_accounts"]["Row"];
export type Contact = Database["public"]["Tables"]["crm_contacts"]["Row"];
export type Campaign = Database["public"]["Tables"]["crm_campaigns"]["Row"];
export type Template = Database["public"]["Tables"]["crm_templates"]["Row"];
export type NewsItem = Database["public"]["Tables"]["crm_news"]["Row"];
export type Stage = Database["public"]["Enums"]["crm_stage"];
export type AccountType = Database["public"]["Enums"]["crm_account_type"];
export type SupportCase = Database["public"]["Tables"]["support_cases"]["Row"];
export type SupportCaseNote = Database["public"]["Tables"]["support_case_notes"]["Row"];

export const STAGES: Stage[] = ["new", "trialing", "trial ended", "negotiation", "won", "lost"];

export const OWNERSHIP_VERIFICATION_STATUSES = [
  "unverified",
  "partially verified",
  "verified",
  "unable to determine",
] as const;
export type OwnershipVerificationStatus = (typeof OWNERSHIP_VERIFICATION_STATUSES)[number];

export const STAGE_TONE: Record<Stage, "seal" | "flag" | "reject" | "neutral"> = {
  new: "neutral",
  trialing: "seal",
  "trial ended": "flag",
  negotiation: "neutral",
  won: "seal",
  lost: "reject",
};

export const CASE_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export const CASE_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export const CASE_CHANNELS = ["email", "phone", "web", "chat"] as const;

export const CASE_STATUS_TONE: Record<CaseStatus, "seal" | "flag" | "reject" | "neutral"> = {
  open: "neutral",
  pending: "flag",
  resolved: "seal",
  closed: "neutral",
};

export const CASE_PRIORITY_TONE: Record<CasePriority, "seal" | "flag" | "reject" | "neutral"> = {
  low: "neutral",
  normal: "seal",
  high: "flag",
  critical: "reject",
};

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export type CaseChannel = (typeof CASE_CHANNELS)[number];

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function linkTo(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
}

export type Activity = Database["public"]["Tables"]["crm_activities"]["Row"];

export const TERRITORIES = ["Northeast", "South", "Midwest", "West"] as const;
export type Territory = (typeof TERRITORIES)[number];

export const PROGRAM_TAGS = [
  "LIHTC",
  "Section 8",
  "Section 202",
  "HOME",
  "HOTMA",
  "Workforce",
  "Senior",
  "Mixed Income",
  "Supportive",
  "Rural Development",
  "Military",
  "Public Housing",
  "Student",
] as const;

export function scoreTone(score: number): "seal" | "flag" | "reject" | "neutral" {
  if (score >= 85) return "seal";
  if (score >= 70) return "flag";
  if (score >= 50) return "neutral";
  return "reject";
}

/** Columns exported to / imported from the Google Sheets CRM. */
export const LEAD_CSV_COLUMNS = [
  "name",
  "account_type",
  "role",
  "hq",
  "states",
  "properties",
  "units",
  "programs",
  "website",
  "linkedin_url",
  "property_owner_name",
  "management_company_name",
  "owner_manager_website",
  "ownership_verification_status",
  "ownership_confidence",
  "ownership_sources",
  "ownership_verified_at",
  "corporate_email",
  "phone",
  "stage",
  "plan",
  "arr",
  "territory",
  "lead_score",
  "owner",
  "source",
  "last_contact_on",
  "next_followup_on",
  "responded",
  "reminders_sent",
  "last_touch",
  "notes",
] as const;

export type LeadCsvColumn = (typeof LEAD_CSV_COLUMNS)[number];

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function leadsToCsv(rows: Account[]): string {
  const head = LEAD_CSV_COLUMNS.join(",");
  const body = rows.map((r) => LEAD_CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","));
  return [head, ...body].join("\n");
}

/** Minimal RFC-4180 parser — handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const NUMERIC = new Set(["properties", "units", "arr", "lead_score", "reminders_sent", "ownership_confidence"]);
const LISTS = new Set(["states", "programs", "ownership_sources"]);
const DATES = new Set(["last_contact_on", "next_followup_on", "ownership_verified_at"]);

/** Turns a parsed CSV into crm_accounts upsert payloads. Unknown headers are ignored. */
export function csvToLeads(text: string): Record<string, unknown>[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).flatMap((cells) => {
    const rec: Record<string, unknown> = {};
    header.forEach((key, i) => {
      if (!(LEAD_CSV_COLUMNS as readonly string[]).includes(key)) return;
      const raw = (cells[i] ?? "").trim();
      if (NUMERIC.has(key)) rec[key] = raw ? Number(raw.replace(/[$,]/g, "")) || 0 : 0;
      else if (LISTS.has(key)) rec[key] = raw ? raw.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : [];
      else if (DATES.has(key)) rec[key] = raw || null;
      else if (key === "responded") rec[key] = /^(true|yes|1)$/i.test(raw);
      else rec[key] = raw || null;
    });
    return rec["name"] ? [rec] : [];
  });
}

/** Resolves {{token}} placeholders against a lead row. */
export function mergeTokens(text: string, account: Account, contactName?: string | null): string {
  const map: Record<string, string> = {
    company: account.name,
    contact: contactName || "there",
    first_name: (contactName || "there").split(" ")[0] ?? "there",
    hq: account.hq ?? "",
    units: Number(account.units ?? 0).toLocaleString(),
    properties: Number(account.properties ?? 0).toLocaleString(),
    states: (account.states ?? []).join(", "),
    programs: (account.programs ?? []).join(", "),
    plan: account.plan ?? "CertivoIQ",
    territory: account.territory ?? "",
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => map[key.toLowerCase()] ?? m);
}
