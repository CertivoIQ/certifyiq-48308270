# CertivoIQ

**The compliance intelligence infrastructure for affordable housing programs.**

CertivoIQ helps affordable housing owners, operators, property managers, and compliance teams turn certification data, supported federal requirements, versioned rules, and supporting evidence into actionable compliance intelligence.

> **Find compliance risk before the auditor.**

## What CertivoIQ Does

- Reviews and organizes certification information
- Connects supported federal compliance requirements with source evidence
- Surfaces potential compliance risks and blocking limitations
- Provides traceable findings and supporting context
- Standardizes compliance workflows
- Improves visibility across properties and portfolios
- Supports audit readiness

## Current Compliance Scope

CertivoIQ currently performs a **Federal Baseline Compliance Review** for supported federal affordable-housing requirements, including applicable portions of LIHTC, HOME, Project-Based Section 8, and HOTMA as implemented and validated.

State-agency, allocating-agency, local, and project-specific requirements are outside the current automated evaluation scope and require separate manual review. If an unevaluated requirement could change the overall result, the system must return **Unable to Determine** and record the limitation.

## Compliance Intelligence Philosophy

CertivoIQ is designed around evidence, applicable requirements, traceability, explicit limitations, and operational visibility. Customer-facing product messaging focuses on compliance intelligence rather than the underlying implementation technology.

## Agent Governance

An **agent** is an authorized compliance agent acting for the customer. It does not refer to CertivoIQ or an automated software agent.

The review lifecycle uses these defined controls:

1. CertivoIQ produces a federal baseline evaluation.
2. Uncertain or conflicting items receive **Agent Action Required**.
3. The assigned agent performs **Manual Review**.
4. The agent records **Agent Verification** for corrected or confirmed fields.
5. The completed result receives **Agent Approval**.
6. CertivoIQ records the **Agent Signature**, identity, role, timestamp, and review version.

CertivoIQ is compliance intelligence infrastructure, not legal advice or complete jurisdictional approval.

## Pricing Architecture

CertivoIQ has one **$65,000 annual platform license** with all currently available platform features included. There are no public plan tiers, training or Academy products, certificates, state-pack add-ons, per-file overages, or separately priced API products.

The application, sales materials, agreement, Stripe catalog, and public website must use the same annual price and entitlement language.

## API Direction

The core integration workflow is secure certification submission, processing status, federal baseline evaluation, Agent Action Required states, Agent Approval, Agent Signature, findings retrieval, evidence-manifest export, and completion webhooks.

API and property-management-system integration capabilities must not be marketed as production-ready until the end-to-end workflow has passed release testing.

## Stripe Architecture

Stripe is the billing source of truth for the single annual platform license. Customer-facing descriptions must match the application, agreement, and public pricing experience.

## Security

Protect customer documents, certification data, company information, credentials, signatures, and billing information. Use least-privilege access, server-side secrets, secure authentication, appropriate authorization boundaries, and auditable changes.

Do not request production tenant files through a public funnel until data handling, retention, tenant isolation, subprocessors, incident response, and customer-data-use terms are verified and published.

## Testing

Run application tests and compliance-intelligence checks before release. Validate federal-scope enforcement, Unable to Determine blocking behavior, agent authorization, Agent Approval, Agent Signature, evidence manifests, and payment flows.

## Development Setup

Install project dependencies with the repository's configured package manager, configure required environment variables from the deployment environment, and run the project's development and test commands defined in the repository and CI workflows.

## Environment Variables

Environment variables are deployment-specific and must never be committed with real secrets. Review deployment configuration and application source for required variable names before local setup.

## Deployment

Deploy through the configured production pipeline. Verify domain, authentication, billing, database access, application health, federal-scope limitations, agent controls, and critical customer workflows after deployment.

## Brand Standards

- **Brand:** CertivoIQ
- **Positioning:** The compliance intelligence infrastructure for affordable housing programs.
- **Primary message:** Find compliance risk before the auditor.
- **Colors:** Dark Blue `#012447`, Navy `#082B56`, White `#FFFFFF`, Subtle Yellow `#FEC229`
- **Pronunciation:** “SUR-duh-voe-eye-cue” — `[ˈsərdəvoʊ aɪˈkjuː]`
- **Primary CTA:** Try CertivoIQ for Free
- **Price:** $65,000 annually
- **Green is not part of the approved brand palette.**

## Source Specification

Historical build prompts and implementation specifications should live under `/docs/` rather than replacing the production README. Current customer-facing positioning is maintained in `docs/BRAND_MESSAGING.md`.
