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
