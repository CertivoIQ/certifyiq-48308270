/* eslint-disable @typescript-eslint/no-explicit-any */
import type { OnboardingRow } from "./portfolio-onboarding-csv";

type Db = { from: (table: string) => any };
type RecordData = Record<string, unknown>;
const present = (value: RecordData) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const messageOf = (error: unknown) => error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Database import failed";

// Keep sparse rows in separate groups: absent CSV values must not clear existing
// certification, program, address, bedroom, or move-in information on re-import.
async function upsertGroups(db: Db, table: string, rows: RecordData[], onConflict: string, select: string) {
  const groups = new Map<string, RecordData[]>();
  for (const row of rows) {
    const key = Object.keys(row).sort().join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const result: RecordData[] = [];
  for (const group of groups.values()) for (let offset = 0; offset < group.length; offset += 200) {
    const batch = group.slice(offset, offset + 200);
    const response = await db.from(table).upsert(batch, { onConflict, defaultToNull: false }).select(select);
    if (response.error) throw response.error;
    if (!Array.isArray(response.data) || response.data.length !== batch.length) throw new Error(`The saved ${table} row count could not be verified.`);
    result.push(...response.data);
  }
  return result;
}
const mergeRow = (map: Map<string, RecordData>, key: string, row: RecordData) => map.set(key, { ...map.get(key), ...present(row) });

/** Called only after authenticated, server-side CSV validation. Never creates certification documents. */
export async function persistPortfolioOnboarding(db: Db, userId: string, rows: OnboardingRow[], sourceName: string) {
  if (!userId || !rows.length) throw new Error("Authenticated onboarding records are required.");
  const { data: job, error: jobError } = await db.from("certification_import_jobs").insert({
    user_id: userId, created_by: userId, status: "processing", source_name: sourceName,
    total_files: 0, intake_type: "portfolio_tenant_intake",
  }).select("id").single();
  if (jobError) throw jobError;
  if (!job?.id) throw new Error("The onboarding job could not be created.");
  try {
    const propertyRows = new Map<string, RecordData>();
    for (const row of rows) mergeRow(propertyRows, row.propertyExternalId, {
      user_id: userId, external_id: row.propertyExternalId, name: row.propertyName, state_code: row.state,
      address_line1: row.propertyAddress, city: row.city, postal_code: row.postalCode,
      latest_import_job_id: job.id, source_data: row.sourceData,
    });
    const properties = await upsertGroups(db, "portfolio_properties", [...propertyRows.values()], "user_id,external_id", "id,external_id");
    const propertyIds = new Map(properties.map((row) => [String(row.external_id), String(row.id)]));
    const unitRows = new Map<string, RecordData>();
    for (const row of rows) {
      const propertyId = propertyIds.get(row.propertyExternalId);
      if (!propertyId) throw new Error("The imported property destination could not be verified.");
      mergeRow(unitRows, JSON.stringify([propertyId, row.unitExternalId]), {
        user_id: userId, property_id: propertyId, external_id: row.unitExternalId,
        unit_number: row.unitNumber, bedrooms: row.bedrooms, latest_import_job_id: job.id, source_data: row.sourceData,
      });
    }
    const units = await upsertGroups(db, "portfolio_units", [...unitRows.values()], "user_id,property_id,external_id", "id,property_id,external_id");
    const unitIds = new Map(units.map((row) => [JSON.stringify([String(row.property_id), String(row.external_id)]), String(row.id)]));
    const tenantRows = new Map<string, RecordData>();
    for (const row of rows) {
      const propertyId = propertyIds.get(row.propertyExternalId);
      const unitId = unitIds.get(JSON.stringify([propertyId, row.unitExternalId]));
      if (!propertyId || !unitId) throw new Error("The imported unit destination could not be verified.");
      mergeRow(tenantRows, row.tenantExternalId, {
        user_id: userId, property_id: propertyId, unit_id: unitId, external_id: row.tenantExternalId,
        household_name: row.householdName, move_in_date: row.moveInDate,
        certification_type: row.certificationType, certification_effective_date: row.certificationEffectiveDate,
        program_codes: row.programCodes.length ? row.programCodes : undefined,
        latest_import_job_id: job.id, source_data: row.sourceData,
      });
    }
    const tenants = await upsertGroups(db, "portfolio_tenant_profiles", [...tenantRows.values()], "user_id,external_id", "id,external_id,property_id,unit_id");
    const { error: finishError } = await db.from("certification_import_jobs").update({
      status: "completed", processed_files: 0, error_count: 0, completed_at: new Date().toISOString(),
      parsed_property_count: properties.length, parsed_unit_count: units.length, parsed_tenant_count: tenants.length,
    }).eq("id", job.id).eq("user_id", userId);
    if (finishError) throw finishError;
    return { jobId: String(job.id), propertyCount: properties.length, unitCount: units.length, tenantCount: tenants.length };
  } catch (error) {
    // Existing hierarchy writes are idempotent, but this is not one SQL transaction.
    // Record partial status and report that possibility rather than claiming rollback.
    try { await db.from("certification_import_jobs").update({ status: "partial", error_count: 1, completed_at: new Date().toISOString() }).eq("id", job.id).eq("user_id", userId); } catch { /* retain original error */ }
    throw new Error(`Onboarding was not completed. Some records may have been saved; retry with the same reference IDs. ${messageOf(error)}`);
  }
}
