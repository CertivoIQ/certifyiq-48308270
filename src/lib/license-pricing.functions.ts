import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LicensePricingClass = "standard" | "pha";

export const updateLicensePricingClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { accountId: string; pricingClass: LicensePricingClass }) => {
    if (!UUID_PATTERN.test(data.accountId)) throw new Error("Invalid accountId");
    if (data.pricingClass !== "standard") {
      throw new Error("Invalid pricing class");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!isStaff) throw new Response("Unauthorized", { status: 403 });

    const db = context.supabase as unknown as {
      from: (table: string) => {
        update: (values: Record<string, unknown>) => {
          eq: (column: string, value: string) => PromiseLike<{
            error: { message?: string } | null;
          }>;
        };
      };
    };

    const { error } = await db
      .from("crm_accounts")
      .update({
        license_pricing_class: data.pricingClass,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.accountId);

    if (error) return { error: error.message ?? "Could not update pricing class" };

    return {
      ok: true as const,
      pricingClass: data.pricingClass,
      annualPriceCents: data.pricingClass === "pha" ? 15_000_000 : 6_500_000,
    };
  });
