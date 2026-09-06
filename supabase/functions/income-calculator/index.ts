import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import { assertInput, assertProfile, evaluate, ENGINE_VERSION, normalizeProgram, profileIssues, validDate, type ApprovedProfile, type Input, type Profile } from "../_shared/income-calculator-engine.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const uuid = (v: unknown): string => { if (typeof v !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(v)) throw new Error("A valid saved record ID is required."); return v; };
const text = (v: unknown, label: string, max = 500): string => { if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(`${label} is required.`); return v.trim(); };
const approval = (v: unknown) => { if (!v || typeof v !== "object") throw new Error("Approval details required."); const a = v as Record<string, unknown>; if (a.consent !== true) throw new Error("Explicit signature confirmation is required."); return { name: text(a.name, "Responsible party name", 240), position: text(a.position, "Responsible party position", 240), signature: text(a.signature, "Signature"), consent: true }; };
const canonical = (v: unknown): string => { if (v === null || typeof v !== "object") return JSON.stringify(v); if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`; return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "Income Calculator service configuration is incomplete." }, 503);
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in to use Income Calculator." }, 401);
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user || auth.user.is_anonymous) return json({ error: "A verified signed-in account is required." }, 401);
    const { data: access, error: accessError } = await client.rpc("income_calculator_access");
    if (accessError) return json({ error: "Could not verify Income Calculator access. Please sign in again or retry." }, 403);
    if (!access?.allowed) return json({ error: access?.reason || "Income Calculator access is unavailable." }, 403);
    const userId = auth.user.id;
    const bodyText = await req.text(); if (new TextEncoder().encode(bodyText).length > 1_000_000) return json({ error: "Calculator request is too large." }, 413);
    const body = JSON.parse(bodyText); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request.");
    if (access.mode === "trial" && ["save_profile", "save_snapshot", "sign_snapshot"].includes(body.action)) return json({ error: "A platform subscription is required to save calculator records to a portfolio. Your working trial calculator remains available while free reviews remain." }, 403);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    // All privileged writes below follow ownership checks using the caller's RLS-scoped client.
    const ownedProperty = async (id: unknown) => { const { data, error } = await client.from("portfolio_properties").select("id,name,state_code,source_data").eq("id", uuid(id)).eq("user_id", userId).single(); if (error || !data) throw new Error("Property unavailable or access denied."); return data; };
    const ownedTenant = async (id: unknown) => { const { data, error } = await client.from("portfolio_tenant_profiles").select("id,property_id,unit_id,household_name,program_codes,certification_type,certification_effective_date").eq("id", uuid(id)).eq("user_id", userId).single(); if (error || !data) throw new Error("Household unavailable or access denied."); return data; };
    const ownedUnit = async (id: unknown, propertyId: string) => { const { data, error } = await client.from("portfolio_units").select("id,property_id,unit_number,source_data").eq("id", uuid(id)).eq("property_id", propertyId).eq("user_id", userId).single(); if (error || !data) throw new Error("Unit unavailable or does not belong to this property."); return data; };
    const configuration = async (tenantId: unknown, effectiveDate: string) => {
      const tenant = await ownedTenant(tenantId); const property = await ownedProperty(tenant.property_id); const unit = await ownedUnit(tenant.unit_id, property.id);
      const { data: rows, error } = await client.from("income_calculator_rule_profiles").select("id,unit_id,program_code,profile,created_at,content_hash").eq("user_id", userId).eq("property_id", property.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1000);
      if (error) throw new Error("Income Calculator rule storage is unavailable."); if ((rows || []).length >= 1000) throw new Error("This property needs a rule-history archive before more profiles can be loaded.");
      const scoped = (rows || []).filter((r) => r.unit_id === null || r.unit_id === unit.id);
      const selected = new Map<string, ApprovedProfile>();
      // A current unit-specific version takes precedence over the property version.
      for (const scope of [unit.id, null]) for (const r of scoped) {
        if (r.unit_id !== scope || selected.has(r.program_code)) continue;
        const p = r.profile as Profile; assertProfile(p);
        if (!validDate(effectiveDate) || effectiveDate < p.effectiveFrom || effectiveDate > p.effectiveTo) continue;
        selected.set(r.program_code, { id: r.id, profile: p, createdAt: r.created_at });
      }
      const rawCodes = [...(Array.isArray(tenant.program_codes) ? tenant.program_codes : []), ...(Array.isArray(unit.source_data?.programCodes) ? unit.source_data.programCodes : []), ...(Array.isArray(property.source_data?.programCodes) ? property.source_data.programCodes : []), ...selected.keys()];
      const programs = [...new Set(rawCodes.filter((v) => typeof v === "string" && v.trim()).map(normalizeProgram))].sort();
      if (programs.length > 20) throw new Error("More than 20 program layers require a reviewed configuration; none were silently dropped.");
      return { tenant, property, unit, programs, profiles: [...selected.values()] };
    };
    const documents = async (tenantId: string) => { const { data, error } = await client.from("certification_import_items").select("id,original_file_name,sha256,status").eq("user_id", userId).eq("tenant_profile_id", tenantId).order("created_at", { ascending: false }).limit(200); if (error) throw new Error("Could not load household document references."); return data || []; };

    if (body.action === "metadata") {
      const { data: properties, error } = await client.from("portfolio_properties").select("id,name,state_code").eq("user_id", userId).order("name").limit(1000);
      if (error) throw new Error("Could not load portfolio properties."); if ((properties || []).length >= 1000) throw new Error("Property search is required for this portfolio; no partial list is presented.");
      let units: unknown[] = [], tenants: unknown[] = [];
      if (body.propertyId) { const p = await ownedProperty(body.propertyId); const result = await client.from("portfolio_units").select("id,unit_number").eq("user_id", userId).eq("property_id", p.id).order("unit_number").limit(1000); if (result.error) throw new Error("Could not load units."); units = result.data || []; if (units.length >= 1000) throw new Error("Unit search is required for this property; no partial list is presented.");
        if (body.unitId) { const u = await ownedUnit(body.unitId, p.id); const result = await client.from("portfolio_tenant_profiles").select("id,household_name,certification_type,certification_effective_date").eq("user_id", userId).eq("property_id", p.id).eq("unit_id", u.id).order("household_name").limit(500); if (result.error) throw new Error("Could not load households."); tenants = result.data || []; if (tenants.length >= 500) throw new Error("Household search is required; no partial list is presented."); }
      }
      return json({ properties: properties || [], units, tenants });
    }
    if (body.action === "load") {
      const date = typeof body.effectiveDate === "string" ? body.effectiveDate : "";
      const config = await configuration(body.tenantId, date);
      const { data: snapshots, error } = await client.from("income_calculator_snapshots").select("id,created_at,content_hash,engine_version").eq("user_id", userId).eq("tenant_profile_id", config.tenant.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw new Error("Could not load saved calculator versions.");
      return json({ ...config, documents: await documents(config.tenant.id), snapshots: snapshots || [], snapshotHistoryLimit: 20, canConfigure: true });
    }
    if (body.action === "save_profile") {
      const p = await ownedProperty(body.propertyId); let unitId: string | null = null;
      if (body.unitId) unitId = (await ownedUnit(body.unitId, p.id)).id;
      assertProfile(body.profile); const profile: Profile = { ...body.profile, program: normalizeProgram(body.profile.program) }; const issues = profileIssues(profile);
      if (issues.length) throw new Error(issues.join(" ")); if (profile.program.length > 80) throw new Error("Program code is too long.");
      const signed = approval(body.approval);
      const { data, error } = await admin.from("income_calculator_rule_profiles").insert({ user_id: userId, property_id: p.id, unit_id: unitId, program_code: profile.program, profile, approval: { ...signed, actorId: userId } }).select("id,created_at,content_hash").single();
      if (error) throw new Error("Could not save the signed rule profile. No existing version was changed.");
      return json(data);
    }
    if (body.action === "save_snapshot") {
      assertInput(body.input); const input: Input = body.input; const config = await configuration(input.tenantId, input.effectiveDate);
      if (input.propertyId !== config.property.id || input.unitId !== config.unit.id) throw new Error("The household does not belong to this property/unit.");
      if (canonical([...new Set(input.layers.map((l) => l.program))].sort()) !== canonical(config.programs) || input.layers.length !== config.programs.length) throw new Error("The program configuration changed. Reload all applicable program layers before saving.");
      const calculation = evaluate(input, config.profiles); const sourceText = canonical(input); const refs = (await documents(config.tenant.id)).filter((d) => sourceText.includes(d.id));
      const { data, error } = await admin.from("income_calculator_snapshots").insert({ user_id: userId, property_id: config.property.id, unit_id: config.unit.id, tenant_profile_id: config.tenant.id, inputs: input, rule_profiles: config.profiles, calculation, document_refs: refs, engine_version: ENGINE_VERSION }).select("id,content_hash,created_at,calculation").single();
      if (error) throw new Error("Could not save the calculation. Existing snapshots were not changed.");
      return json(data);
    }
    if (body.action === "load_snapshot" || body.action === "sign_snapshot") {
      const { data: snapshot, error } = await client.from("income_calculator_snapshots").select("*").eq("id", uuid(body.snapshotId)).eq("user_id", userId).single();
      if (error || !snapshot) throw new Error("Snapshot unavailable or access denied.");
      if (body.action === "load_snapshot") { const { data: review, error: reviewError } = await client.from("income_calculator_reviews").select("id,responsible_name,responsible_position,signature,reviewed_at,snapshot_hash").eq("user_id", userId).eq("snapshot_id", snapshot.id).maybeSingle(); if (reviewError) throw new Error("Could not read review history."); return json({ snapshot, review }); }
      const signed = approval(body.approval); assertInput(snapshot.inputs); const input: Input = snapshot.inputs;
      const config = await configuration(input.tenantId, input.effectiveDate); const recalculated = evaluate(input, config.profiles);
      if (config.property.id !== snapshot.property_id || config.unit.id !== snapshot.unit_id || snapshot.engine_version !== ENGINE_VERSION || canonical(recalculated) !== canonical(snapshot.calculation) || canonical(config.profiles.map((p) => p.id).sort()) !== canonical((snapshot.rule_profiles as ApprovedProfile[]).map((p) => p.id).sort()) || canonical(config.programs) !== canonical(input.layers.map((l) => l.program).sort())) throw new Error("Property, program rules, or engine version changed. Save a new calculation before final review.");
      if (!recalculated.reviewable) throw new Error("Resolve all Not Determined checks before final review.");
      const currentDocs = await documents(input.tenantId);
      for (const ref of snapshot.document_refs) { const current = currentDocs.find((d) => d.id === ref.id); if (!current || !current.sha256 || current.sha256 !== ref.sha256) throw new Error("Referenced document evidence changed or lacks its source hash. Verify the evidence and save a new snapshot."); }
      const { data, error: signError } = await admin.from("income_calculator_reviews").insert({ user_id: userId, snapshot_id: snapshot.id, snapshot_hash: snapshot.content_hash, responsible_name: signed.name, responsible_position: signed.position, signature: signed.signature }).select("id,responsible_name,responsible_position,signature,reviewed_at,snapshot_hash").single();
      if (signError) throw new Error("Final review was not recorded. This snapshot may already have a review; reload its saved version.");
      return json({ review: data });
    }
    return json({ error: "Unknown Income Calculator action." }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Income Calculator could not complete the request." }, 422); }
});

