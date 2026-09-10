# Compliance graph and temporal foundation

This additive Phase 2–4 foundation adds a machine-readable, version-aware link layer without creating a second Evidence Record or overwriting regulatory history.

## Existing systems preserved

- `evidence_manifests` remains the sole CertivoIQ Evidence Record. Graph nodes and edges may reference its existing identifier through a restrictive foreign key.
- Existing authority sources, versioned state-rule packs, deterministic rules, property/unit/household profiles, certification facts, findings, and immutable calculator snapshots remain authoritative in their own tables.
- The graph does not activate a source, rule, or determination. Existing release and human-approval gates remain in control.

## Graph model

- `compliance_graph_nodes` records dated, immutable representations of authorities, programs, property entities, determinations, and Evidence Records.
- `compliance_graph_edges` records dated, immutable relationships such as `governs`, `applies_to`, `calculates`, `determines`, and `records`.
- `compliance_graph_events` is append-only event history for recording, linking, validation, and supersession.
- `compliance_finding_why_chain(finding, as_of)` traverses in reverse from a finding toward supporting authority and Evidence Record using only records effective on the selected date.

## Security and temporal rules

Rows are service-written and immutable; authenticated users have tenant-scoped read access only. Staff reads retain the existing staff authorization boundary. The recursive explanation function is `SECURITY INVOKER`, uses an empty search path, and relies on RLS rather than bypassing it.

A new dated node supersedes an earlier node through `supersedes_node_id`; neither row is overwritten. This keeps source, rule, engine, and property-election versions reconstructable as-of a date.

## Current scope

This batch supplies the safe underlying graph and temporal contract. Future UI work will register graph nodes/edges from certified source ingestion, property elections, rule evaluations, calculations, findings, remediation, and approval events. It must not use the graph to infer or fabricate regulatory applicability.
