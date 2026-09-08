import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tenantSchema = z.object({ id: z.string(), unit_id: z.string(), external_id: z.string(), household_name: z.string(), move_in_date: z.string().nullable(), created_at: z.string() });
const unitSchema = z.object({ id: z.string(), unit_number: z.string(), external_id: z.string(), bedrooms: z.number().nullable() });
const historyRecordSchema = z.record(z.unknown()).nullable().transform((record) => {
  if (!record) return null;
  const details: Record<string, string | null> = {};
  for (const key of ["household_name", "external_id", "move_in_date", "unit_id", "property_id", "certification_type", "certification_effective_date"]) {
    const value = record[key];
    if (value === null || typeof value === "string") details[key] = value;
  }
  return details;
});
export const listPortfolioUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; page?: number }) => z.object({ propertyId: z.string().uuid(), page: z.number().int().min(0).default(0) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const units = await db.from("portfolio_units").select("id,unit_number,external_id,bedrooms", { count: "exact" })
      .eq("user_id", context.userId).eq("property_id", data.propertyId).order("unit_number").order("id").range(data.page * 50, data.page * 50 + 49);
    if (units.error) throw units.error;
    const records = z.array(unitSchema).parse(units.data ?? []);
    const tenants = records.length ? await db.from("portfolio_tenant_profiles").select("id,unit_id,external_id,household_name,move_in_date,created_at")
      .eq("user_id", context.userId).eq("property_id", data.propertyId).in("unit_id", records.map((unit) => unit.id)).order("created_at") : { data: [], error: null };
    if (tenants.error) throw tenants.error;
    const profiles = z.array(tenantSchema).parse(tenants.data ?? []);
    return { total: units.count ?? 0, units: records.map((unit) => ({ ...unit, tenants: profiles.filter((tenant) => tenant.unit_id === unit.id) })) };
  });

export const listPortfolioUnitHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unitId: string }) => z.object({ unitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.from("portfolio_tenant_events")
      .select("id,event_type,occurred_at,actor_id,tenant_profile_id,before_record,after_record")
      .eq("user_id", context.userId).eq("unit_id", data.unitId).order("occurred_at", { ascending: false }).order("id").limit(100);
    if (result.error) throw result.error;
    return z.array(z.object({
      id: z.string(), event_type: z.string(), occurred_at: z.string(), actor_id: z.string().nullable(), tenant_profile_id: z.string(),
      before_record: historyRecordSchema, after_record: historyRecordSchema,
    })).parse(result.data ?? []);
  });

const assignmentSchema = z.object({
  unitId: z.string().uuid(), requestId: z.string().uuid(),
  tenantReference: z.string().trim().min(1).max(160), householdName: z.string().trim().min(1).max(240),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(value + "T00:00:00Z");
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && !value.startsWith("0000");
  }, "Enter a valid move-in date"),
});
export const assignPortfolioUnitTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof assignmentSchema>) => assignmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.rpc("assign_portfolio_unit_tenant", {
      p_unit_id: data.unitId, p_tenant_id: data.requestId, p_external_id: data.tenantReference,
      p_household_name: data.householdName, p_move_in_date: data.moveInDate,
    });
    if (result.error) throw result.error;
    return { tenantId: z.string().uuid().parse(result.data) };
  });
