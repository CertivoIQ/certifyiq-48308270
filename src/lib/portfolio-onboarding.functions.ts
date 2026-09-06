import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ONBOARDING_FIELDS, ONBOARDING_MAX_BYTES, previewOnboarding, readOnboardingCsv, type OnboardingField } from "@/lib/portfolio-onboarding-csv";
import { persistPortfolioOnboarding } from "@/lib/portfolio-onboarding-storage";

const inputSchema = z.object({
  text: z.string().min(1).max(ONBOARDING_MAX_BYTES),
  sourceName: z.string().trim().min(1).max(240),
  mapping: z.record(z.string().refine((key) => Object.hasOwn(ONBOARDING_FIELDS, key), "Unknown destination field"), z.number().int().min(0).max(199).nullable()),
  stateByPropertyId: z.record(z.string().max(120), z.string().max(2)).default({}),
  dateOrder: z.enum(["ISO", "MDY", "DMY"]).default("ISO"),
});

export const createPortfolioOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Re-parse on the server; a client cannot bypass required fields, conflicts,
    // row limits, missing-state prompts, or date validation by editing the preview.
    const table = readOnboardingCsv(data.text);
    const result = previewOnboarding(table, data.mapping as Partial<Record<OnboardingField, number | null>>, {
      stateByPropertyId: data.stateByPropertyId, dateOrder: data.dateOrder,
    });
    if (!result.canImport) throw new Error(result.issues[0] ?? "Select the state for each property that has no state in the CSV.");
    if (result.rows.length > 1) {
      const [live, sandbox] = await Promise.all([
        context.supabase.rpc("has_active_subscription", { user_uuid: context.userId, check_env: "live" }),
        context.supabase.rpc("has_active_subscription", { user_uuid: context.userId, check_env: "sandbox" }),
      ]);
      if (live.error) throw live.error;
      if (sandbox.error) throw sandbox.error;
      if (!live.data && !sandbox.data) throw new Error("Mass portfolio intake requires an active CertivoIQ subscription.");
    }
    return persistPortfolioOnboarding(context.supabase, context.userId, result.rows, data.sourceName);
  });
