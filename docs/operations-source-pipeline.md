# Batch 3 — HUD Source Pipeline

Batch 3 begins with the official HUD USER Dataset Update Schedule. The manual GitHub
workflow retrieves the page, enforces an HTTPS HUD USER allowlist and size limit,
hashes the actual response bytes, parses the tracked dataset rows, validates the
schedule structure, and stages an immutable source version plus audit event.

## Boundaries

- The workflow is manual-only; no schedule is enabled in this batch.
- Source validation covers identity, transport, hash, and expected schedule structure.
- A staged source is not a confirmed dataset release and has no rule-engine authority.
- The pipeline cannot activate compliance rules, publish CRM news, or send email.
- Duplicate page hashes are recorded as unchanged and do not create duplicate source versions.
- Only the fixed HUD USER source is fetched; redirected final URLs must remain on HUD USER.
- Adding state sources requires a separately reviewed allowlist and parser.

## Production deployment

1. Apply `20260825060000_hud_source_pipeline.sql` after the Batch 1 and Batch 2 migrations.
2. Keep the existing three GitHub repository secrets configured.
3. Run `HUD Source Watch` manually for the production smoke test.
4. Inspect the staged `operations_source_versions` and append-only audit event.
5. Do not add a schedule until the smoke test is green and the release-detection batch is approved.
