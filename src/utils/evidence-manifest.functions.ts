import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Evidence manifests are generated server-side after each material review event
 * and stored immutably. Export is authorized by row-level security: a customer
 * reads manifests for their own reviews, staff read all.
 */

export const listEvidenceManifests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("evidence_manifests")
      .select("id, review_id, certification_id, property_id, outcome, engine_build, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const exportEvidenceManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { reviewId: string }) => {
    if (!data?.reviewId || data.reviewId.length > 200) throw new Error("A review id is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("evidence_manifests")
      .select("manifest, manifest_sha256, created_at")
      .eq("review_id", data.reviewId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { error: "No evidence manifest is available for this review." } as const;
    return {
      manifest: row.manifest,
      manifestSha256: row.manifest_sha256,
      generatedAt: row.created_at,
    } as const;
  });

/** Writes a manifest once per review version. Never overwrites a stored one. */
export const recordEvidenceManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { manifest: unknown }) => {
    if (!data?.manifest || typeof data.manifest !== "object") throw new Error("A manifest is required.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertProductionTenant } = await import("@/lib/demo-tenant");
    const { hashJson } = await import("@/lib/complianceDecisionAndManifest");
    const manifest = data.manifest as {
      reviewId: string;
      organizationId: string;
      propertyId?: string;
      certificationId?: string;
      outcome: string;
      engine: { build: string };
    };

    assertProductionTenant(manifest.organizationId);
    const manifestSha256 = await hashJson(manifest);

    const { error } = await context.supabase.from("evidence_manifests").insert({
      review_id: manifest.reviewId,
      user_id: context.userId,
      organization_id: manifest.organizationId,
      property_id: manifest.propertyId ?? null,
      certification_id: manifest.certificationId ?? null,
      outcome: manifest.outcome,
      engine_build: manifest.engine.build,
      manifest: manifest as never,
      manifest_sha256: manifestSha256,
    });
    // A duplicate hash means this exact manifest is already stored.
    if (error && (error as { code?: string }).code !== "23505") throw error;
    return { manifestSha256 } as const;
  });
