/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  propertyExternalId: z.string().trim().min(1).max(120),
  propertyName: z.string().trim().min(1).max(240),
  state: z.string().regex(/^[A-Z]{2}$/),
  propertyAddress: z.string().trim().max(300).optional(),
  city: z.string().trim().max(160).optional(),
  postalCode: z.string().trim().max(20).optional(),
  unitExternalId: z.string().trim().min(1).max(120),
  unitNumber: z.string().trim().min(1).max(80),
  bedrooms: z.number().int().min(0).max(20).optional(),
  tenantExternalId: z.string().trim().min(1).max(160),
  householdName: z.string().trim().min(1).max(240),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  certificationType: z.enum(["INITIAL", "ANNUAL", "INTERIM"]),
  certificationEffectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  programCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  documentFileName: z.string().trim().max(300).optional(),
});

type Db = any;

export const createPortfolioIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rows: unknown[]; documentCount: number; sourceName: string }) => ({
    rows: z.array(rowSchema).min(1).max(5000).parse(data.rows),
    documentCount: z.number().int().min(0).max(5000).parse(data.documentCount),
    sourceName: z.string().trim().min(1).max(240).parse(data.sourceName),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { userId } = context;
    if (data.rows.length > 1 || data.documentCount > 1) {
      const [live, sandbox] = await Promise.all([
        db.rpc("has_active_subscription", { user_uuid: userId, check_env: "live" }),
        db.rpc("has_active_subscription", { user_uuid: userId, check_env: "sandbox" }),
      ]);
      if (live.error) throw live.error;
      if (sandbox.error) throw sandbox.error;
      if (!live.data && !sandbox.data) throw new Error("Mass portfolio intake requires an active CertivoIQ subscription.");
    }

    const { data: job, error: jobError } = await db.from("certification_import_jobs").insert({
      user_id: userId, created_by: userId, status: "processing", source_name: data.sourceName,
      total_files: data.documentCount, intake_type: "portfolio_tenant_intake",
    }).select("id").single();
    if (jobError) throw jobError;

    const propertyRows = [...new Map(data.rows.map((row) => [row.propertyExternalId, {
      user_id: userId, external_id: row.propertyExternalId, name: row.propertyName,
      state_code: row.state, address_line1: row.propertyAddress || null, city: row.city || null,
      postal_code: row.postalCode || null, latest_import_job_id: job.id, source_data: row,
    }])).values()];
    const { data: properties, error: propertyError } = await db.from("portfolio_properties")
      .upsert(propertyRows, { onConflict: "user_id,external_id" }).select("id,external_id");
    if (propertyError) throw propertyError;
    const propertyIds = new Map(properties.map((row: any) => [row.external_id, row.id]));

    const unitRows = [...new Map(data.rows.map((row) => {
      const propertyId = propertyIds.get(row.propertyExternalId);
      return [`${propertyId}::${row.unitExternalId}`, {
        user_id: userId, property_id: propertyId, external_id: row.unitExternalId,
        unit_number: row.unitNumber, bedrooms: row.bedrooms ?? null,
        latest_import_job_id: job.id, source_data: row,
      }];
    })).values()];
    const { data: units, error: unitError } = await db.from("portfolio_units")
      .upsert(unitRows, { onConflict: "user_id,property_id,external_id" }).select("id,property_id,external_id");
    if (unitError) throw unitError;
    const unitIds = new Map(units.map((row: any) => [`${row.property_id}::${row.external_id}`, row.id]));

    const tenantRows = [...new Map(data.rows.map((row) => {
      const propertyId = propertyIds.get(row.propertyExternalId);
      const unitId = unitIds.get(`${propertyId}::${row.unitExternalId}`);
      return [row.tenantExternalId, {
        user_id: userId, property_id: propertyId, unit_id: unitId, external_id: row.tenantExternalId,
        household_name: row.householdName, move_in_date: row.moveInDate || null,
        certification_type: row.certificationType, certification_effective_date: row.certificationEffectiveDate || null,
        program_codes: row.programCodes, latest_import_job_id: job.id, source_data: row,
      }];
    })).values()];
    const { data: tenants, error: tenantError } = await db.from("portfolio_tenant_profiles")
      .upsert(tenantRows, { onConflict: "user_id,external_id" }).select("id,external_id,property_id,unit_id");
    if (tenantError) throw tenantError;
    const mappedTenants = z.array(z.object({ id: z.string().uuid(), external_id: z.string(), property_id: z.string().uuid(), unit_id: z.string().uuid() })).parse(tenants);
    const tenantIds = new Map(mappedTenants.map((row) => [row.external_id, row]));

    const { error: countError } = await db.from("certification_import_jobs").update({
      parsed_property_count: properties.length, parsed_unit_count: units.length, parsed_tenant_count: tenants.length,
    }).eq("id", job.id);
    if (countError) throw countError;

    const documentMappings = data.rows.filter((row) => row.documentFileName).map((row) => {
      const tenant = tenantIds.get(row.tenantExternalId);
      if (!tenant) throw new Error("The imported tenant destination could not be verified.");
      return {
        documentFileName: row.documentFileName!,
        propertyId: tenant.property_id as string,
        unitId: tenant.unit_id as string,
        tenantProfileId: tenant.id as string,
        certificationType: row.certificationType,
        jurisdiction: row.state,
        programCodes: row.programCodes,
      };
    });
    const uniqueMappings = new Map<string, typeof documentMappings[number]>();
    for (const mapping of documentMappings) {
      const key = mapping.documentFileName.toLowerCase();
      const prior = uniqueMappings.get(key);
      if (prior && prior.tenantProfileId !== mapping.tenantProfileId) {
        throw new Error(`Document ${mapping.documentFileName} is assigned to more than one tenant.`);
      }
      uniqueMappings.set(key, mapping);
    }
    return {
      jobId: job.id as string,
      propertyCount: properties.length,
      unitCount: units.length,
      tenantCount: tenants.length,
      documentMappings: [...uniqueMappings.values()],
    };
  });

export const finalizePortfolioIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; itemCount: number; errorCount?: number }) => ({
    jobId: z.string().uuid().parse(data.jobId),
    itemCount: z.number().int().min(0).max(5000).parse(data.itemCount),
    errorCount: z.number().int().min(0).max(5000).parse(data.errorCount ?? 0),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { error } = await db.from("certification_import_jobs").update({
      status: data.errorCount ? "partial" : "completed",
      processed_files: data.itemCount, error_count: data.errorCount, completed_at: new Date().toISOString(),
    }).eq("id", data.jobId).eq("user_id", context.userId);
    if (error) throw error;
    return { completed: true as const };
  });

export const listPortfolioSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const [properties, units, tenants] = await Promise.all([
      db.from("portfolio_properties").select("id,external_id,name,state_code,city,created_at").eq("user_id", context.userId).order("name"),
      db.from("portfolio_units").select("id,property_id").eq("user_id", context.userId),
      db.from("portfolio_tenant_profiles").select("id,property_id,unit_id").eq("user_id", context.userId),
    ]);
    if (properties.error) throw properties.error;
    if (units.error) throw units.error;
    if (tenants.error) throw tenants.error;
    return (properties.data ?? []).map((property) => ({
      ...property,
      unitCount: (units.data ?? []).filter((unit) => unit.property_id === property.id).length,
      tenantCount: (tenants.data ?? []).filter((tenant) => tenant.property_id === property.id).length,
    }));
  });

export const queueCertificationReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemIds: string[] }) => ({
    itemIds: z.array(z.string().uuid()).min(1).max(500).parse([...new Set(data.itemIds)]),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: items, error } = await db.from("certification_import_items")
      .select("id,created_at,upload_sequence,certification_type,jurisdiction,program_codes")
      .in("id", data.itemIds).eq("user_id", context.userId);
    if (error) throw error;
    if (items.length !== data.itemIds.length) throw new Error("One or more selected certifications are unavailable.");
    const ordered = [...items].sort((a: any, b: any) =>
      Date.parse(a.created_at) - Date.parse(b.created_at)
      || (a.upload_sequence ?? Number.MAX_SAFE_INTEGER) - (b.upload_sequence ?? Number.MAX_SAFE_INTEGER)
      || String(a.id).localeCompare(String(b.id))
    );
    const queuedAt = new Date().toISOString();
    const reviewOrderBase = Date.now() * 1000;
    const updates = await Promise.all(ordered.map((item: any, index: number) =>
      db.from("certification_import_items").update({
        review_queue_status: "queued", queued_for_review_at: queuedAt,
        review_order: reviewOrderBase + index,
        review_started_at: null, review_finished_at: null,
      }).eq("id", item.id).eq("user_id", context.userId)
    ));
    const updateError = updates.find((result: any) => result.error)?.error;
    if (updateError) throw updateError;
    return { items: ordered, queuedAt };
  });

export const markCertificationReviewFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemId: string }) => ({ itemId: z.string().uuid().parse(data.itemId) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { error } = await db.from("certification_import_items").update({
      review_queue_status: "failed", review_finished_at: new Date().toISOString(),
    }).eq("id", data.itemId).eq("user_id", context.userId);
    if (error) throw error;
    return { failed: true as const };
  });
