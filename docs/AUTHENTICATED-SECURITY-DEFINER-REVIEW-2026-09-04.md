# Authenticated SECURITY DEFINER Review — 2026-09-04

## Outcome

All 19 authenticated `SECURITY DEFINER` functions reported by the Supabase security advisor were reviewed. Each function already enforced an authenticated caller and either checked authorization directly or delegated to an authorization helper. The exposed privileged entry points are now removed: their implementations live in the non-exposed `private` schema with an empty `search_path`, while stable public RPC names are preserved through `SECURITY INVOKER` wrappers.

Anonymous execution is revoked. Authenticated and service-role grants are explicit. Future functions created by the application migration role no longer inherit client execution automatically.

## Additional remediation

`accept_pha_workspace_invitation(uuid)` previously trusted the email claim in the caller JWT while its error message described the email as verified. The private implementation now loads the caller from `auth.users`, requires `email_confirmed_at`, and compares the normalized confirmed email with the invitation.

## Reviewed surface

| Area | Functions | Authorization |
|---|---|---|
| PHA workspace and program access | `current_pha_workspace_user_id`, `is_pha_workspace_owner`, `pha_workspace_admin_access`, `pha_program_access`, `pha_family_access` | Caller identity, ownership, active staff or scoped active membership |
| PHA workflow mutations | `accept_pha_workspace_invitation`, `build_pha_family_evidence_manifest`, `prepare_pha_50058_submission`, `record_pha_50058_submission_event`, `select_next_pha_waiting_list_applicant` | Verified caller email for invitation acceptance; scoped program write/read access for family and 50058 workflows |
| Certification workflow | `certification_task_queue`, `resolve_certification_finding`, `approve_certification_final` | Assigned employee or manager authority, final-state and signature controls |
| State-rule control | `create_state_rule_source_candidate`, `review_state_rule_source_candidate`, `approve_state_rule_release_candidate`, `activate_state_rule_pack`, `state_rule_pack_activation_readiness`, `state_rule_release_readiness` | Active manager/admin checks, independent-review controls, fail-closed readiness checks |

## Verification

The migration contains transactional assertions that fail if:

- any authenticated executable `SECURITY DEFINER` remains in `public`;
- fewer than 19 invoker-safe public wrappers are installed;
- fewer than 19 private implementations have an empty `search_path`;
- anonymous execution is present on the reviewed surface.

Production verification must include the Supabase security advisor and a catalog query confirming wrapper/implementation counts and grants.
