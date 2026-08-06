import type { Database } from "@/integrations/supabase/types";

export type Account = Database["public"]["Tables"]["crm_accounts"]["Row"];
export type Contact = Database["public"]["Tables"]["crm_contacts"]["Row"];
export type Campaign = Database["public"]["Tables"]["crm_campaigns"]["Row"];
export type Template = Database["public"]["Tables"]["crm_templates"]["Row"];
export type NewsItem = Database["public"]["Tables"]["crm_news"]["Row"];
export type Stage = Database["public"]["Enums"]["crm_stage"];
export type AccountType = Database["public"]["Enums"]["crm_account_type"];

export const STAGES: Stage[] = ["new", "trialing", "trial ended", "negotiation", "won", "lost"];

export const STAGE_TONE: Record<Stage, "seal" | "flag" | "reject" | "neutral"> = {
  new: "neutral",
  trialing: "seal",
  "trial ended": "flag",
  negotiation: "neutral",
  won: "seal",
  lost: "reject",
};

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function linkTo(url: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `https://${url}`;
}
