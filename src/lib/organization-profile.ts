import { z } from "zod";

export const workspaceProfileSchema = z.object({
  organization_type: z.enum([
    "multifamily_owner_agent",
    "pha",
    "developer_owner",
    "compliance_asset_management",
    "housing_agency",
    "other",
  ]),
  selected_programs: z.array(z.string().trim().min(1)),
  pha_programs: z.array(z.string().trim().min(1)),
  derived_overlays: z.array(z.string()),
  pha_hotma_cohort: z
    .enum(["NON_MTW_NON_FRS", "INITIAL_MTW", "MTW_EXPANSION", "FRS_EXCLUSIVE"])
    .nullable(),
  hud_50058_reporting_path: z.enum(["HUD_50058_2024", "HUD_50058_2020_ALTERNATIVE"]).nullable(),
});

export function organizationProfileIssue(profile: unknown): string | null {
  const parsed = workspaceProfileSchema.safeParse(profile);
  if (!parsed.success) return "Save a valid organization and program profile before continuing.";
  const p = parsed.data;
  if (p.organization_type === "pha") {
    if (!p.pha_programs.length) return "Select at least one PHA program before continuing.";
    if (!p.pha_hotma_cohort || !p.hud_50058_reporting_path)
      return "Select the PHA cohort and HUD-50058 reporting path before continuing.";
  } else if (!p.selected_programs.length) return "Select at least one program before continuing.";
  return null;
}
