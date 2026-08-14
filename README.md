# CertivoIQ

**AI Compliance Intelligence for Affordable Housing**

CertivoIQ is an affordable-housing compliance intelligence platform being built to help owners, management companies, compliance teams, and housing agencies review certification evidence, apply deterministic program rules, identify findings, document human decisions, and maintain defensible audit trails.

## Mission

Reduce preventable affordable-housing compliance errors by combining traceable document intelligence, deterministic rules, human approval controls, and portfolio-level risk visibility.

## Product Principles

- **Evidence before conclusions.** Findings should trace to source evidence.
- **Deterministic compliance decisions.** AI may assist with extraction and explanation; authoritative rule outcomes should be reproducible.
- **Human authority.** High-impact certification and regulatory actions remain subject to authorized human review.
- **Fail closed.** Missing, stale, conflicting, or unauthorized evidence must not silently become a compliance approval.
- **Versioned rules.** Findings should retain the rule version and authority used at decision time.
- **Auditable delivery.** Internal submission status must remain distinct from verified external delivery.

## Intended Compliance Scope

CertivoIQ is being designed for layered affordable-housing compliance workflows including LIHTC, HUD/Section 8, HOME, HOTMA, state housing finance agency requirements, and related property-specific controls. Regulatory coverage must be treated as versioned and jurisdiction-specific; the repository should not imply that every jurisdiction or integration is production-ready until it has been implemented and verified.

## Core Platform Capabilities

### Compliance Intelligence
- Certification evidence ingestion and structured extraction
- Evidence confidence and human verification
- Multi-source conflict detection
- Deterministic PASS / FAIL / NOT_DETERMINED outcomes
- Rule citations, effective dates, versions, and revision history
- Finding remediation and approval history

### HFA Submission Authority
- Human-approved certification authority
- Immutable evidence-manifest concepts
- Destination authorization controls
- Duplicate and stale-submission protection
- Separation of internal `submitted` state from verified external delivery
- External delivery receipt foundation

### Portfolio Intelligence
- Property and portfolio audit-readiness concepts
- Finding trends and recurrence analysis
- Risk indicators and training-intervention concepts
- Executive visibility into compliance exposure

### KnowledgeIQ Vision
- Affordable-housing compliance training
- Reviewer education and guided audit workflows
- Program-specific learning modules and achievement records

## Verification Status

The GitHub CI gate runs the compliance intelligence, vertical-slice, certification-authority, transmission-authority, HFA submit-transition, and external-delivery-receipt test suites, followed by lint and a production build. Production claims should be based on implemented and tested behavior, not roadmap items.

## Technology

- TypeScript / React
- TanStack Start / Router
- Tailwind CSS
- Supabase-backed application services
- Deterministic compliance domain modules
- GitHub Actions CI

See `package.json` and the source tree for the current implementation rather than relying on older architectural proposals.

## Security and Compliance Posture

CertivoIQ is designed around least privilege, explicit authority, auditability, evidence provenance, and human approval for consequential actions. Security, privacy, AI data-use, retention, and regulatory representations require continuing legal and technical review before enterprise deployment.

## Intellectual Property

Copyright (c) 2026 CertivoIQ. All rights reserved.

This repository is proprietary and confidential unless a separate written license states otherwise. No permission is granted to copy, modify, distribute, sublicense, reverse engineer, or create derivative commercial products from proprietary CertivoIQ source code, documentation, rule packages, workflows, or original interface assets except as expressly authorized in writing.

Third-party and open-source components remain subject to their respective licenses. Contributors and contractors should have written confidentiality and intellectual-property assignment agreements in place.

## Development

```sh
git clone <repository-url>
cd certifyiq-48308270
bun install --frozen-lockfile
bun run test:compliance
bun run test:slice
bun run lint
bun run build
```

Additional authority and delivery tests are executed by `.github/workflows/compliance-intelligence.yml`.

## Legal Notice

CertivoIQ is software intended to assist trained housing-compliance professionals. It is not a substitute for legal advice, agency determinations, owner policy, or required human review. Regulatory authorities and program requirements control where they conflict with software output.

## Confidentiality

Investor, customer, and diligence access to non-public technical materials should be provided under appropriate confidentiality terms. Do not publish secrets, production credentials, resident PII, protected tenant records, or trade-secret rule implementation details in public repositories or marketing materials.
