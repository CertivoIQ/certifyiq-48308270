import { supabase } from "@/integrations/supabase/client";
import { organizationProfileIssue } from "./organization-profile";
export { organizationProfileIssue } from "./organization-profile";

/** Read the caller's persisted profile; a default or unsaved form is not completion. */
export async function verifySavedOrganizationProfile(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("customer_workspace_profiles")
    .select(
      "organization_type,selected_programs,pha_programs,derived_overlays,pha_hotma_cohort,hud_50058_reporting_path",
    )
    .eq("user_id", userId)
    .abortSignal(AbortSignal.timeout(20000))
    .maybeSingle();
  if (error)
    throw new Error("Your saved organization profile could not be verified. Please retry.");
  const issue = organizationProfileIssue(data);
  if (issue) throw new Error(issue);
}

/** Compare-and-set only step 2. Never completes welcome, portfolio, upload, or final review. */
export async function completeOrganizationOnboardingStep(userId: string): Promise<void> {
  await verifySavedOrganizationProfile(userId);
  const { data: progress, error } = await supabase
    .from("customer_onboarding_progress")
    .select("current_step,completed_steps,completed_at,updated_at")
    .eq("user_id", userId)
    .abortSignal(AbortSignal.timeout(20000))
    .maybeSingle();
  if (error)
    throw new Error(
      "Profile saved, but onboarding progress could not be loaded. Return to LaunchPad and retry.",
    );
  if (!progress || progress.completed_at || progress.current_step !== 2) return;
  if (!progress.completed_steps.includes(1))
    throw new Error("Return to LaunchPad and complete the welcome step first.");
  const { data: saved, error: saveError } = await supabase
    .from("customer_onboarding_progress")
    .update({ current_step: 3, completed_steps: [1, 2], completed_at: null })
    .eq("user_id", userId)
    .eq("current_step", 2)
    .eq("updated_at", progress.updated_at)
    .select("current_step")
    .abortSignal(AbortSignal.timeout(20000))
    .maybeSingle();
  if (saveError)
    throw new Error(
      "Profile saved, but step 2 could not be completed. Retry Save profile & continue.",
    );
  if (!saved)
    throw new Error(
      "Your checklist changed in another window. Return to LaunchPad to load the saved progress.",
    );
}
