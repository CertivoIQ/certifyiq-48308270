-- Cover certification workflow foreign keys reported by the production advisor.

create index if not exists certification_audit_files_item_idx
  on public.certification_audit_files(certification_item_id);
create index if not exists certification_audit_files_evidence_manifest_idx
  on public.certification_audit_files(evidence_manifest_id);
create index if not exists certification_audit_files_manager_idx
  on public.certification_audit_files(manager_id);

create index if not exists certification_finding_assignments_case_idx
  on public.certification_finding_assignments(case_id);
create index if not exists certification_finding_assignments_resolved_by_idx
  on public.certification_finding_assignments(resolved_by);

create index if not exists certification_workflow_cases_approved_by_idx
  on public.certification_workflow_cases(approved_by);

create index if not exists certification_workflow_events_actor_idx
  on public.certification_workflow_events(actor_id);
create index if not exists certification_workflow_events_finding_idx
  on public.certification_workflow_events(finding_id);

create index if not exists certification_workflow_memberships_created_by_idx
  on public.certification_workflow_memberships(created_by);
