/** Guarded candidate-only integration; no database writes, credentials or network. */
import { readFileSync, writeFileSync } from 'node:fs';
const plan = new Map(), marker='// TIC_EVIDENCE_WIRING_V1';
function entry(path) { if (!plan.has(path)) { const original=readFileSync(path,'utf8'); plan.set(path,{original,next:original}); } return plan.get(path); }
function replace(path, before, after, count=1) { const e=entry(path); if(e.original.startsWith(marker)) return; const n=e.next.split(before).length-1; if(n!==count) throw new Error(`${path}: expected ${count} anchors, got ${n}; no files written.`); e.next=e.next.split(before).join(after); }
const intake='src/utils/tic-certification-intake.functions.ts';
replace(intake,'import { createServerFn }','import { extractSupportingEvidence, validateSupportingCalculations, resolveReviewCertificationType } from "@/lib/tic-supporting-evidence.mjs";\nimport { createServerFn }');
replace(intake,'  return { result, confidence, sourceSha256, packetPages, pageClassifications, supportingDocuments };','  const supportingEvidence = extractSupportingEvidence(packetPages, pageClassifications, { fileName: source.originalFileName, sha256: sourceSha256 }, ocrDocument?.pageProvenance);\n  return { result, confidence, sourceSha256, packetPages, pageClassifications, supportingDocuments, supportingEvidence };');
replace(intake,'const { result, confidence, pageClassifications, supportingDocuments } = await extractStagedSource(', 'const { result, confidence, pageClassifications, supportingDocuments, supportingEvidence } = await extractStagedSource(');
replace(intake,'        supportingDocuments,\n      } as const;', '        supportingDocuments,\n        supportingEvidence,\n      } as const;');
replace(intake,'    startReview?: boolean;\n', '    startReview?: boolean;\n    calculationReviews?: unknown;\n');
replace(intake,'      startReview: data.startReview === true,', '      startReview: data.startReview === true,\n      calculationReviews: data.calculationReviews,');
replace(intake,'const { result, confidence, sourceSha256, supportingDocuments: serverSupportingDocuments }', 'const { result, confidence, sourceSha256, supportingDocuments: serverSupportingDocuments, supportingEvidence }');
replace(intake,'.select("id, property_id, unit_id, household_name")', '.select("id, property_id, unit_id, household_name, program_codes, portfolio_properties(state_code)")');
replace(intake,'    const choiceByGroup = new Map(', `    const certificationType = resolveReviewCertificationType(confirmedExtractedData);
    if (data.startReview && !certificationType) throw new Error("Confirm the certification type. For Other, select the review action without changing the source TIC selection.");
    const calculationReviews = validateSupportingCalculations(data.calculationReviews, supportingEvidence, confirmedExtractedData);
    const choiceByGroup = new Map(`);
replace(intake,'        tenant_profile_id: tenant.id,\n        storage_path:', '        tenant_profile_id: tenant.id,\n        certification_type: certificationType,\n        jurisdiction: tenant.portfolio_properties?.state_code ?? null,\n        program_codes: Array.isArray(tenant.program_codes) ? tenant.program_codes : [],\n        storage_path:');
replace(intake,'          reviewer_supplied_fields: reviewerSuppliedFields,', '          reviewer_supplied_fields: reviewerSuppliedFields,\n          calculation_reviews: calculationReviews,');
replace(intake,'        const original = originalByField.get(field);\n        return {', '        const original = originalByField.get(field);\n        const sourceUnchanged = !!original && JSON.stringify(original.value) === JSON.stringify(value);\n        return {');
replace(intake,'source_snippet: original?.snippet ?? "Entered during pre-save TIC review; OCR did not provide a value for this field.",', 'source_snippet: sourceUnchanged ? original.snippet : "Entered or corrected during pre-save TIC review. Original extraction and calculation sources are retained in the confirmation history.",');
replace(intake,'extraction_provider: original?.provider ?? REVIEWER_CONFIRMED_PROVIDER,','extraction_provider: sourceUnchanged ? original.provider ?? result.provider : REVIEWER_CONFIRMED_PROVIDER,');
const reg='src/lib/tic-supporting-document-registry.ts';
replace(reg,'  | "check_stub"','  | "bank_statement"\n  | "check_stub"');
replace(reg,'  {\n    type: "check_stub",', `  {
    type: "bank_statement",
    label: "Bank / Credit Union Statement",
    aliases: ["Bank Statement", "Credit Union Statement", "Account Statement"],
    strongSignals: [/bank\\s+statement/i, /credit\\s+union\\s+statement/i, /statement\\s+period.*(?:ending|closing|beginning)\\s+balance/is, /account\\s+statement.*balance/is],
    weakSignals: [/interest\\s+(?:earned|paid)/i, /account\\s+(?:number|holder)/i, /ending\\s+balance/i],
  },
  {
    type: "check_stub",`);
const fields='src/lib/tic-field-registry.ts';
replace(fields,'  field("other_certification_type",','  field("other_certification_review_action", "Review action for Other certification", "Certification", "text", []),\n  field("other_certification_type",');
const form='src/components/certivoiq-tic-review-form.tsx';
replace(form,'<div className="mt-2 max-w-md"><Field field="other_certification_type" {...props} compact /></div>', `<div className="mt-2 max-w-md space-y-2"><Field field="other_certification_type" {...props} compact />
                  <label className="block text-xs">Review action for Other (source selection stays Other)
                    <select className="mt-1 w-full border border-slate-500 bg-white p-2" value={values.other_certification_review_action ?? ""} disabled={busy} onChange={event => onChange("other_certification_review_action", event.target.value)}>
                      <option value="">Select before starting review</option><option value="INITIAL">Initial / admission review</option><option value="ANNUAL">Annual review</option><option value="INTERIM">Interim review</option>
                    </select>
                  </label>
                </div>`);
const panel='src/components/certification-upload-panel-v4.tsx';
replace(panel,'import { CertivoIqTicReviewForm }', 'import { TicSupportingEvidenceReview } from "@/components/tic-supporting-evidence-review";\nimport type { SupportingEvidence, SupportingCalculation } from "@/lib/tic-supporting-evidence.mjs";\nimport { CertivoIqTicReviewForm }');
replace(panel,'  supportingDocuments: SupportingPreviewGroup[];','  supportingDocuments: SupportingPreviewGroup[];\n  supportingEvidence: SupportingEvidence[];');
replace(panel,'  const [fieldValues, setFieldValues]', '  const [calculationReviews, setCalculationReviews] = useState<SupportingCalculation[]>([]);\n  const [fieldValues, setFieldValues]');
replace(panel,'      setDraft({\n        source,', '      setCalculationReviews([]);\n      setDraft({\n        source,');
replace(panel,'        supportingDocuments,\n      });', '        supportingDocuments,\n        supportingEvidence: preview.supportingEvidence ?? [],\n      });');
replace(panel,'          startReview,\n', '          startReview,\n          calculationReviews,\n');
replace(panel,'          {draft.supportingDocuments.length > 0 ? (', `          <div className="mt-4">
            <TicSupportingEvidenceReview key={draft.source.sha256} evidence={draft.supportingEvidence} values={fieldValues} busy={busy} sourceUrl={draft.sourcePreviewUrl}
              onApply={(changes, calculation) => {
                setFieldValues(current => ({ ...current, ...changes }));
                setCalculationReviews(current => [...current, calculation]);
              }} />
            {calculationReviews.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{calculationReviews.length} source-bound calculation correction(s) will be recorded when this TIC is saved. Final review remains separate.</p>}
          </div>
          {draft.supportingDocuments.length > 0 ? (`);
const review='src/utils/tic-certification-review.functions.ts';
replace(review,'import { createServerFn }','import { resolveReviewCertificationType } from "@/lib/tic-supporting-evidence.mjs";\nimport { createServerFn }');
replace(review,'program_codes, extraction_provider")', 'program_codes, extraction_provider, extracted_data")');
replace(review,'    const certificationType = data.certificationType ?? item.certification_type;', `    const sourceType = item.extracted_data && typeof item.extracted_data === "object" && !Array.isArray(item.extracted_data)
      ? resolveReviewCertificationType(item.extracted_data as Record<string, unknown>) : null;
    if (sourceType && data.certificationType && data.certificationType !== sourceType) {
      return { error: "The requested review type conflicts with the saved TIC. Correct and confirm the TIC rather than silently changing its certification type." } as const;
    }
    const certificationType = sourceType ?? data.certificationType ?? item.certification_type;`);
const reviewFunctions='src/utils/certification-review.functions.ts';
replace(reviewFunctions,'import { createServerFn }','import { summarizeCalculationHistory } from "@/lib/tic-supporting-evidence.mjs";\nimport { createServerFn }');
replace(reviewFunctions,'    const [facts, findings] = await Promise.all([','    const [facts, findings, history] = await Promise.all([');
replace(reviewFunctions,'        .order("severity"),\n    ]);', `        .order("severity"),
      context.supabase.from("certification_import_items").select("historical_changes").eq("id", data.itemId).eq("user_id", context.userId).maybeSingle(),
    ]);`);
replace(reviewFunctions,'    if (findings.error) throw findings.error;', '    if (findings.error) throw findings.error;\n    if (history.error) throw history.error;');
replace(reviewFunctions,'    return { facts: facts.data ?? [], findings: findings.data ?? [], reviews: reviews.data ?? [] };', '    return { facts: facts.data ?? [], findings: findings.data ?? [], reviews: reviews.data ?? [], calculations: summarizeCalculationHistory(history.data?.historical_changes) };');
const reviewPanel='src/components/certification-review-panel.tsx';
replace(reviewPanel,'      {review.data && review.data.findings.length > 0 && (', `      {review.data && review.data.calculations.length > 0 && (
        <section className="mt-5 space-y-3 rounded-xl border p-4" aria-label="Saved calculation review">
          <h3 className="font-semibold">Saved calculation worksheets — pending final review</h3>
          {review.data.calculations.map((calculation, index) => (
            <article key={index} className="rounded border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{calculation.kind === 'wages' ? 'Employment income' : 'Bank balance / actual interest'} · TIC row {calculation.destinationRow}</p>
              <p className="mt-1">{calculation.formula}</p>
              <p className="mt-1 text-xs">Source pages: {calculation.sourcePages.join(', ')} · Policy: {calculation.policyRef}</p>
              <p className="mt-1 text-xs">Reason: {calculation.reason}</p>
              {!calculation.retainedInSavedTic && <p className="mt-1 text-xs font-semibold">The TIC was edited after this calculation; review the final saved amount against this worksheet.</p>}
            </article>
          ))}
          <p className="text-xs text-muted-foreground">Calculation records are not final approvals. Confirm current property-specific income/rent limits and applicable program rules before final review.</p>
        </section>
      )}
      {review.data && review.data.findings.length > 0 && (`);
for(const [path,e] of plan){if(e.original.startsWith(marker))continue;writeFileSync(path,marker+'\n'+e.next);console.log('Patched '+path);}
