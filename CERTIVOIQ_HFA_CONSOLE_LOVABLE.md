# CertivoIQ HFA Regulatory Console — Lovable Build Package

## Objective

Build a regulator-facing workspace that reduces incomplete submissions, repeated correction cycles and monitoring effort while preserving owner control of data. The HFA sees only records explicitly submitted to it under an active grant.

## Install

- `hfaRegulatoryTypes.ts`
- `HfaRegulatoryConsole.tsx`
- `hfa-regulatory-schema.sql`
- Reuse the existing `complianceDecisionAndManifest.ts` and governed state-rule registry.

## Routes

```tsx
<Route element={<RequireAgencyMembership />}>
  <Route path="/agency" element={<AgencyOverview />} />
  <Route path="/agency/submissions" element={<AgencySubmissions />} />
  <Route path="/agency/submissions/:submissionId" element={<AgencySubmissionDetail />} />
  <Route path="/agency/rules" element={<AgencyRulePacks />} />
  <Route path="/agency/sampling" element={<AgencySampling />} />
  <Route path="/agency/corrections" element={<AgencyCorrections />} />
</Route>
```

Every agency route must be `noindex,nofollow`.

## Required server routes

- `GET /api/agency/overview`
- `GET /api/agency/submissions`
- `POST /api/agency/submissions/:id/start-review`
- `POST /api/agency/submissions/:id/request-correction`
- `POST /api/agency/submissions/:id/accept`
- `GET /api/agency/submissions/:id/evidence-manifest`
- `GET /api/agency/rule-releases`
- `POST /api/agency/rule-releases`
- `POST /api/agency/rule-releases/:id/submit-for-expert-validation`
- `POST /api/agency/rule-releases/:id/agency-certify`
- `POST /api/agency/rule-releases/:id/suspend`
- `POST /api/agency/sampling-runs`
- `GET /api/agency/sampling-runs/:id/export`
- `POST /api/agency/corrections/:id/respond`
- `POST /api/agency/corrections/:id/disposition`

Derive agency/user identity from the authenticated session. Never accept a client-supplied agency ID as authorization.

## Release phases

### Phase 1 — Submission Exchange

- Owner preflight
- Explicit submission/grant
- Agency inbox
- Evidence manifest
- Review status and communication
- Acceptance or correction request

### Phase 2 — Corrective Action Exchange

- Finding-specific cases
- Deadlines and extensions
- Owner response and correction evidence
- Automated preflight
- Human agency disposition
- Reopen and immutable closure history

### Phase 3 — Rule-pack governance

- Controlling sources and hashes
- Candidate rule changes
- Expert validation
- Agency review/certification
- Effective-dated activation
- Emergency suspension
- Public change log without confidential records

### Phase 4 — Risk-based sampling

- Frozen population snapshot and hash
- Reproducible random seed
- Random/risk-weighted policies
- Protected-characteristic exclusion
- Selection rationale
- Exportable workpapers

### Phase 5 — Regulatory impact and benchmarking

- Affected-property simulation
- Obsolete form detection
- Required training/actions
- Anonymous, minimum-cohort benchmarks
- No public ranking of owners or properties

## Authorization invariants

1. An HFA cannot discover an owner record before explicit submission.
2. A submission grant exposes only the submitted snapshot and later correction evidence.
3. Revocation blocks future access while preserving legally required audit history.
4. Agency rule reviewers cannot certify their own proposed release when dual control is enabled.
5. Sampling criteria cannot access protected characteristics.
6. Owners cannot edit an accepted submission; corrections create new versions.
7. Every view, export, decision, grant and revocation creates an append-only audit event.

## HFA pilot metrics

- First-pass completeness rate
- Median submission-to-disposition time
- Repeat-finding rate
- Correction-cycle count
- Reviewer minutes per file
- Percentage of findings with complete evidence
- Rule-change implementation time
- Owner satisfaction and agency reviewer satisfaction

Do not hard-code improvement claims. Establish a pre-pilot baseline and publish measured results with methodology.

## Acceptance tests

- Agency A cannot read Agency B submissions.
- Agency A cannot query non-submitted owner records in its own state.
- An owner can preview the exact submission snapshot before granting access.
- Revoking a draft grant removes agency access immediately.
- An accepted submission and its evidence manifest are immutable.
- Revisions create a new version linked to the previous submission.
- Rule activation fails without sources, hashes, tests, expert approval and an effective date.
- Suspended rules return `unable_to_determine` where their absence could change the result.
- Re-running a sampling job with the same population hash, policy and seed returns the same selection.
- Sampling rejects protected-characteristic fields.
- Evidence-manifest export authorization is enforced server-side.
- All sensitive routes send `Cache-Control: no-store`.

## Lovable master prompt

> Implement the HFA Regulatory Console from the supplied schema, types, component and this build package. First inspect the existing TanStack routes, authentication, organization/property schema, findings, documents, evidence manifests and audit logging. Adapt foreign keys to existing models and do not create parallel users, organizations, properties or certifications. Build Phase 1 only in the first change: owner preflight, explicit submission grant, agency inbox, submission detail, evidence-manifest access, correction request and acceptance. Enforce all authorization on the server and add isolation tests. Seed synthetic demo agencies and submissions only in the isolated demo organization. Do not imply agency endorsement, certification or production partnership. After Phase 1 passes, report results and request approval before implementing corrective actions, rule governance or sampling.

